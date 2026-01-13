/* config.module.js */

/** -------------------- Helpers -------------------- */
function detectProduction() {
  const url = self.location.href;
  return (url.includes(".io") || url.includes(".gg")) && !url.includes("dev");
}

function strToBool(str) {
  if (str == null) return undefined;
  const normalized = str.toLowerCase();
  if (["1", "true", "on"].includes(normalized)) return true;
  if (["0", "false", "off"].includes(normalized)) return false;
  return undefined;
}

function safeSearch() {
  try {
    return window.top.location.search;
  } catch {
    return window.location.search;
  }
}

function getQueryParamBool(param) {
  return strToBool(new URLSearchParams(safeSearch()).get(param));
}

function getQueryParam(param) {
  return new URLSearchParams(safeSearch()).get(param);
}

function setupShowDiagnostics() {
  #if SHOW_DIAGNOSTICS
  return getQueryParamBool("diagnostics") ?? false;
  #else
  return false;
  #endif
}

/** -------------------- Environment -------------------- */
const IS_PRODUCTION = detectProduction();
const DEBUG = getQueryParamBool("debug") ?? !IS_PRODUCTION;
const IS_VIDEO_STREAMING_ENABLED = getQueryParamBool("videoStreamingEnabled") ?? false;
const SHOW_DIAGNOSTICS = setupShowDiagnostics();

/** -------------------- Log Level Setup -------------------- */
function setupLogLevel() {
  // Get logLevel from URL parameter
  const logLevelParam = getQueryParam("logLevel");
  
  // Default log levels based on environment
  let defaultLogLevel;
  if (IS_PRODUCTION) {
    // In production, use Warning level by default
    defaultLogLevel = 2; // Warning
  } else {
    // In development, use All level by default
    defaultLogLevel = 0; // All
  }
  
  // Parse logLevel parameter if provided
  let logLevel = defaultLogLevel;
  if (logLevelParam) {
    const parsedLevel = parseInt(logLevelParam);
    if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 5) {
      logLevel = parsedLevel;
    }
  }
  
  return logLevel;
}

/** -------------------- Logging -------------------- */
const LOG_LEVEL = setupLogLevel();

/** -------------------- Assets -------------------- */
// Replace these URLs with your own asset URLs
const ASSETS = {
  SPLASH_MOBILE: "YOUR_SPLASH_MOBILE_URL_HERE",
  SPLASH_DESKTOP: "YOUR_SPLASH_DESKTOP_URL_HERE",
  LOGO: "YOUR_LOGO_URL_HERE",
};

/** -------------------- Google Analytics -------------------- */
// Replace with your Google Analytics tracking ID (e.g., "G-XXXXXXXXXX")
const GOOGLE = {
  GTAG_ID: "YOUR_GOOGLE_ANALYTICS_ID_HERE",
};

/** -------------------- Analytics -------------------- */
const ANALYTICS = {
  BUILD_NAME: "YourBuildName", // Replace with your build name
};

/** -------------------- Web3 / MetaMask -------------------- */
function getOriginSafe() {
  try { return self.location.origin; } catch { return ""; }
}

const WEB3_METAMASK = {
  enabled: getQueryParamBool("web3Enabled") ?? false,
  dappName: getQueryParam("web3DappName") || "YourAppName", // Replace with your app name
  dappUrl: getQueryParam("web3DappUrl") || getOriginSafe(),
  infuraApiKey: getQueryParam("web3InfuraKey") || "YOUR_INFURA_API_KEY_HERE", // Replace with your Infura API key
};

/** -------------------- Firebase -------------------- */
// Replace with your Firebase configuration
const FIREBASE_LOGS = {
  config: {
    apiKey: "YOUR_FIREBASE_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.YOUR_REGION.firebasedatabase.app",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  },
  pathPrefix: "YourLogsPath", // Replace with your Firebase logs path prefix
};

/** -------------------- Xsolla -------------------- */
// Replace with your Xsolla OAuth configuration
const XSOLLA_OAUTH = {
  projectId: "YOUR_XSOLLA_PROJECT_ID_HERE",
  clientId: "YOUR_XSOLLA_CLIENT_ID_HERE",
  preferredLocale: "en_US",
  responseType: "code",
  scope: "offline",
};

// Replace with your Xsolla Metaframe configuration
const XSOLLA_METAFRAME = {
  loginProjectId: "YOUR_XSOLLA_LOGIN_PROJECT_ID_HERE",
  merchantId: 0, // Replace with your merchant ID
  projectId: 0, // Replace with your project ID
  orbsApiHostId: "YOUR_ORBS_API_HOST_ID_HERE",
  isMobile: false,
  isCollapsed: true,
  layoutSettings: {
    desktop: { widgetMarginTop: 16 },
    mobile: { widgetMarginTop: 16 },
  },
};

/** -------------------- Debug Info -------------------- */
// console.debug(
//   `[CONFIG] → IS_PRODUCTION: ${IS_PRODUCTION} | DEBUG: ${DEBUG} | LOG_LEVEL: ${LOG_LEVEL} | URL: ${self.location.href}`
// );

/** -------------------- Exports -------------------- */
export {
  IS_PRODUCTION,
  DEBUG,
  LOG_LEVEL,
  SHOW_DIAGNOSTICS,
  ASSETS,
  GOOGLE,
  XSOLLA_OAUTH,
  FIREBASE_LOGS,
  ANALYTICS,
  XSOLLA_METAFRAME,
  WEB3_METAMASK,
  IS_VIDEO_STREAMING_ENABLED,
};
