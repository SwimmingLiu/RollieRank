const PRODUCTION_API_BASE = "https://rollie-rank.swimmingliu.cn";
const TEST_API_BASE = "https://rollie-rank-test.swimmingliu.cn";
const LOCAL_TEST_ORIGIN = "";
const LOCAL_TEST_NAMESPACE = "";

function wechatVersion() {
  try {
    return typeof wx === "undefined" ? undefined : wx.getAccountInfoSync?.()?.miniProgram?.envVersion;
  } catch {
    return undefined;
  }
}

// 只有微信标明的正式版使用生产。首发使用新存储前缀，隔开历史预览包的草稿和身份。
const IS_TEST_ENVIRONMENT = wechatVersion() !== "release";
const API_BASE = IS_TEST_ENVIRONMENT ? LOCAL_TEST_ORIGIN || TEST_API_BASE : PRODUCTION_API_BASE;
const STORAGE_NAMESPACE = IS_TEST_ENVIRONMENT ? LOCAL_TEST_NAMESPACE || "rr-test:device:" : "rr-release:";
// 当前 AppID 使用原生入口；取得企业主体内嵌网页能力后再填入站点地址。
const RELEASE_WEB_APP_ORIGIN = "";
const WEB_APP_ORIGIN = IS_TEST_ENVIRONMENT ? "" : RELEASE_WEB_APP_ORIGIN;
// 七牛 rollie-rank 空间的加速域名。
const ASSET_BASE = "https://rollie-rank-oss.swimmingliu.cn/static/rollierank";
// 包内资源（图标、机构标识、产品标识）随小程序发布，不依赖网络。
const LOCAL = "/assets";

module.exports = {
  API_BASE,
  PRODUCTION_API_BASE,
  IS_TEST_ENVIRONMENT,
  STORAGE_NAMESPACE,
  storageKey: key => STORAGE_NAMESPACE + key,
  WEB_APP_ORIGIN,
  ASSET_BASE,
  ASSET: {
    logo: `${LOCAL}/rollierank-logo.png`,
    // 未授权真实头像前沿用原稿的纸卡人物头像，授权后立即替换为用户所选照片。
    profile: `${LOCAL}/avatars/rank-1.svg`,
    sihai: `${LOCAL}/sihai-peanut.svg`,
    chaoge: `${LOCAL}/chaoge-study.svg`,
    fenbi: `${LOCAL}/fenbi-mark.svg`,
    shangancun: `${LOCAL}/shangancun-mark.svg`,
    qrcode: `${LOCAL}/miniprogram-qrcode.jpg`,
    keepsake: `${LOCAL}/score-keepsake.png`,
    // 以下资源包内没有，使用 OSS。
    avatars: name => `${ASSET_BASE}/assets/avatars/${name}.svg`,
  },
};
