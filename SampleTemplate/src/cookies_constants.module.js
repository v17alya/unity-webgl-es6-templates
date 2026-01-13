// cookies_constants.module.js

// Replace with your own cookie prefix
const COOKIES_PREFIX = "_webgl_app";

const Cookies = {
  // Storage keys
  ACCESS_TOKEN_PREFS_KEY: `${COOKIES_PREFIX}_p_at`,
  REFRESH_TOKEN_PREFS_KEY: `${COOKIES_PREFIX}_p_rt`,
  XSOLLA_METAFRAME_TOKEN_PREFS_KEY: "xsolla_metaframe_token",
};

export { Cookies };
