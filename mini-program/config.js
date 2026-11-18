// 接口域名与资源地址集中在这里；切换环境只改这一处。
const API_BASE = "https://api.rollie-rank.swimmingliu.cn";
// 新域名 rollie-rank-oss.swimmingliu.cn 目前对同一份文件返回 404，先使用已在用的七牛域名。
const ASSET_BASE = "https://oss.swimmingliu.cn/static/rollierank";

module.exports = {
  API_BASE,
  ASSET_BASE,
  ASSET: {
    logo: `${ASSET_BASE}/assets/rollierank-logo-v4-256.png`,
    profile: `${ASSET_BASE}/assets/profile-default.svg`,
    keepsake: `${ASSET_BASE}/assets/score-keepsake-v1-640.png`,
    sihai: `${ASSET_BASE}/assets/sihai-peanut.svg`,
    chaoge: `${ASSET_BASE}/assets/chaoge-study.svg`,
    fenbi: `${ASSET_BASE}/assets/fenbi-mark.svg`,
    shangancun: `${ASSET_BASE}/assets/shangancun-mark.svg`,
  },
};
