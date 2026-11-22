import { createHmac } from "node:crypto";
import { creditError, TOOL_ID } from "./tool-credits-rules.mjs";

const WECHAT_API = "https://api.weixin.qq.com";
const CHECKOUT_MODE = "short_series_goods";
const PAYMENT_ENV = 0;
const PRODUCT_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const staleTokenCodes = new Set([40001, 40014, 42001]);

function sign(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function createWechatToolPayment({ env, appId, secret, fetchImpl = globalThis.fetch, clock = Date.now }) {
  const offerId = env.ROLLIERANK_WXPAY_OFFER_ID?.trim();
  const appKey = env.ROLLIERANK_WXPAY_APP_KEY?.trim();
  const rawGoods = env.ROLLIERANK_WXPAY_GOODS?.trim();
  if (!appId || !secret || !offerId || !appKey || !rawGoods) return null;

  let goods;
  try {
    goods = JSON.parse(rawGoods);
  } catch {
    throw new Error("微信道具配置 ROLLIERANK_WXPAY_GOODS 不是有效的 JSON。");
  }
  if (!Array.isArray(goods) || !goods.length || goods.length > 50 ||
      new Set(goods.map(item => item?.productId)).size !== goods.length || goods.some(item =>
        typeof item?.productId !== "string" || !PRODUCT_ID.test(item.productId) ||
        typeof item.tool !== "string" || !TOOL_ID.test(item.tool) ||
        typeof item.title !== "string" || !item.title.trim() || item.title.length > 60 ||
        !Number.isInteger(item.cents) || item.cents < 1 || item.cents > 10_000_000)) {
    throw new Error("微信道具配置须包含有效且唯一的 productId、工具、名称和分值价格。");
  }
  const products = goods.map(({ productId, tool, title, cents, ios = false }) => ({
    productId, tool, title: title.trim(), cents, ios: ios === true && cents >= 100,
  }));

  let token;
  let tokenExpires = 0;
  let pendingToken;

  async function post(url, body, { allowEmpty = false } = {}) {
    try {
      const response = await fetchImpl(url, {
        method: "POST", signal: AbortSignal.timeout(5_000),
        headers: { "Content-Type": "application/json" }, body,
      });
      if (!response.ok) throw new Error();
      const text = await response.text();
      return allowEmpty && !text.trim() ? { errcode: 0 } : JSON.parse(text);
    } catch {
      // The URL can contain credentials. Keep transport diagnostics out of public errors.
      throw creditError(502, "暂时无法核对微信支付，请稍后重试。", "wechat-payment");
    }
  }

  async function accessToken() {
    if (token && clock() < tokenExpires) return token;
    pendingToken ??= (async () => {
      const result = await post(new URL("/cgi-bin/stable_token", WECHAT_API), JSON.stringify({
        grant_type: "client_credential", appid: appId, secret, force_refresh: false,
      }));
      if (result?.errcode || typeof result?.access_token !== "string" ||
          !Number.isInteger(result.expires_in) || result.expires_in < 1) {
        throw creditError(502, "微信支付服务凭证暂不可用。", "wechat-payment");
      }
      token = result.access_token;
      tokenExpires = clock() + Math.max(0, result.expires_in - 120) * 1000;
      return token;
    })().finally(() => { pendingToken = undefined; });
    return pendingToken;
  }

  async function invoke(path, payload, { unsigned = false } = {}) {
    const body = JSON.stringify(payload);
    const url = new URL(path, WECHAT_API);
    if (!unsigned) url.searchParams.set("pay_sig", sign(appKey, path + "&" + body));
    async function send(access) {
      url.searchParams.set("access_token", access);
      return post(url, body, { allowEmpty: unsigned });
    }
    const usedToken = await accessToken();
    let result = await send(usedToken);
    if (staleTokenCodes.has(result?.errcode)) {
      if (token === usedToken) tokenExpires = 0;
      result = await send(await accessToken());
    }
    if (result?.errcode !== 0) {
      throw Object.assign(creditError(502, "微信尚未确认这笔交易，请稍后重试。", "wechat-payment"), {
        wechatCode: result?.errcode,
      });
    }
    return result;
  }

  function checkout(order, sessionKey) {
    const signData = JSON.stringify({
      offerId, buyQuantity: 1, env: PAYMENT_ENV, currencyType: "CNY",
      productId: order.productId, goodsPrice: order.cents, outTradeNo: order.id, attach: order.id,
    });
    return {
      mode: CHECKOUT_MODE, signData,
      paySig: sign(appKey, "requestVirtualPayment&" + signData),
      signature: sign(sessionKey, signData),
    };
  }

  return {
    offerId, products, checkout,
    async query(order, id = order.id) {
      const result = await invoke("/xpay/query_order", { openid: order.openid, env: PAYMENT_ENV, order_id: id });
      if (!result.order || result.order.order_id !== id || !Number.isInteger(result.order.status)) {
        throw creditError(502, "微信返回的订单信息与本地订单不一致。", "wechat-order-mismatch");
      }
      return result.order;
    },
    acknowledge(order) {
      return invoke("/xpay/notify_provide_goods", { order_id: order.id, env: PAYMENT_ENV }, { unsigned: true });
    },
    async refund(order, refund) {
      const result = await invoke("/xpay/refund_order", {
        openid: order.openid, order_id: order.id, refund_order_id: refund.id,
        left_fee: order.cents, refund_fee: order.cents, biz_meta: order.id,
        refund_reason: refund.reason, req_from: "1", env: PAYMENT_ENV,
      });
      if (result.refund_order_id !== refund.id || result.pay_order_id !== order.id) {
        throw creditError(502, "微信返回的退款单与本地订单不一致。", "wechat-order-mismatch");
      }
    },
  };
}
