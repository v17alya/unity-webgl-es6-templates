/**
 * Central configuration module.
 * All settings can be overridden via URL query parameters.
 * 
 * Example: ?debug=true&logLevel=0&production=false
 */

/** -------------------- Helpers -------------------- */
function detectProduction() {
  const url = self.location.href;
  // Override this logic based on your deployment URLs
  return !url.includes("localhost") && !url.includes("127.0.0.1") && !url.includes("dev");
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
  // Diagnostics can be enabled via URL parameter: ?diagnostics=true
  return getQueryParamBool("diagnostics") ?? false;
}

function setupLogLevel() {
  const logLevelParam = getQueryParam("logLevel");
  
  // Default log levels based on environment
  let defaultLogLevel;
  if (IS_PRODUCTION) {
    defaultLogLevel = 2; // Warning
  } else {
    defaultLogLevel = 0; // All
  }
  
  let logLevel = defaultLogLevel;
  if (logLevelParam) {
    const parsedLevel = parseInt(logLevelParam);
    if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 5) {
      logLevel = parsedLevel;
    }
  }
  
  return logLevel;
}

/** -------------------- Environment -------------------- */
const IS_PRODUCTION = getQueryParamBool("production") ?? detectProduction();
const DEBUG = getQueryParamBool("debug") ?? !IS_PRODUCTION;
const SHOW_DIAGNOSTICS = setupShowDiagnostics();

/** -------------------- Logging -------------------- */
const LOG_LEVEL = setupLogLevel();

/** -------------------- Exports -------------------- */
export {
  IS_PRODUCTION,
  DEBUG,
  LOG_LEVEL,
  SHOW_DIAGNOSTICS,
};
