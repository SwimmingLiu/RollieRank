// 接口域名与资源地址集中在这里；切换环境只改这一处。
const API_BASE = "https://rollie-rank.swimmingliu.cn";
// 当前 AppID 使用原生入口；取得企业主体内嵌网页能力后再填入站点地址。
const WEB_APP_ORIGIN = "";
// 七牛 rollie-rank 空间的加速域名。
const ASSET_BASE = "https://rollie-rank-oss.swimmingliu.cn/static/rollierank";
// 包内资源（图标、机构标识、产品标识）随小程序发布，不依赖网络。
const LOCAL = "/assets";

module.exports = {
  API_BASE,
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
    // 以下资源包内没有，使用 OSS。
    keepsake: `${ASSET_BASE}/assets/illustrations/score-keepsake-v1-640.png`,
    avatars: name => `${ASSET_BASE}/assets/avatars/${name}.svg`,
  },
};
