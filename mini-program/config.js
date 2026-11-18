// 接口域名与资源地址集中在这里；切换环境只改这一处。
const API_BASE = "https://api.rollie-rank.swimmingliu.cn";
// 用户提供的新域名 rollie-rank-oss.swimmingliu.cn 对同一文件返回 404，先使用已在用的七牛域名。
const ASSET_BASE = "https://oss.swimmingliu.cn/static/rollierank";
// 包内资源（图标、机构标识、产品标识）随小程序发布，不依赖网络。
const LOCAL = "/assets";

module.exports = {
  API_BASE,
  ASSET_BASE,
  ASSET: {
    logo: `${LOCAL}/rollierank-logo-v4-256.png`,
    profile: `${LOCAL}/profile-default.svg`,
    sihai: `${LOCAL}/sihai-peanut.svg`,
    chaoge: `${LOCAL}/chaoge-study.svg`,
    fenbi: `${LOCAL}/fenbi-mark.svg`,
    shangancun: `${LOCAL}/shangancun-mark.svg`,
    // 以下资源包内没有，使用 OSS。
    keepsake: `${ASSET_BASE}/assets/illustrations/score-keepsake-v1-640.png`,
    avatars: name => `${ASSET_BASE}/assets/avatars/${name}.svg`,
  },
};
