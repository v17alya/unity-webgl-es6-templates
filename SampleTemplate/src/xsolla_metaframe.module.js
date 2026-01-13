/* xsolla_metaframe.module.js
 * Safe loader for the Xsolla Metaframe wallet widget with retry logic,
 * event relays, Unity callbacks and optional cookie storage of the token.
 */

import { Cookies } from "./cookies_constants.module.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";
import { Events } from "./analytics_events.module.js?v={{{ PRODUCT_VERSION }}}";
import * as Amplitude from "./amplitude.module.js?v={{{ PRODUCT_VERSION }}}";
import { EventTracker } from "./eventTracker.module.js?v={{{ PRODUCT_VERSION }}}";

/* CDN + loader defaults */
const SDK_URL = "https://cdn.xsolla.net/metaframe-web-wallet-widget-prod/container/v1/metaframe.js";
const DEF_RETRIES = 3;
const DEF_DELAY = 2_000; // ms
const DEF_TIMEOUT = 10_000; // ms

/* DOM / callback constants */
const METAFRAME_CONTAINER_ID = "__xsolla_metaframe_container";
const METAFRAME_CALLBACK_VIEW = "XsollaAuthProvider";
const SAVE_TOKEN_TO_COOKIES = false;

/* Analytics event bases */
const MF_STAGE_BASE = Events.BOOTSTRAP_XSOLLA_METAFRAME;
const MF_INIT = MF_STAGE_BASE + "_Init";
const MF_SDK = MF_STAGE_BASE + "_SDK";
const MF_WIDGET = MF_STAGE_BASE + "_Widget";
const MF_READY = MF_STAGE_BASE + "_Ready";
const MF_OTHER = "Games_Xsolla_Metaframe";

/* Event names from Xsolla */
const EVT_APP_LOADED = "@metaframe-partner-events:app-loaded";
const EVT_NOT_AUTH_MINI_APPS_LOADED =
  "@metaframe-partner-events:not-authorized-mini-apps-loaded";
const EVT_LOGIN_SUCCESSFUL = "@metaframe-partner-events:login-successful";
const EVT_LOGOUT_SUCCESSFUL = "@metaframe-partner-events:logout-successful";

/* ------------------------------------------------------------------ */
/*  module-level state                                                */
/* ------------------------------------------------------------------ */
let _isMetaframeScriptLoaded = false;
let _isMetaframeReady = false;
let _authToken = "";
let _sdkPromise = null;
let _scriptTag = null;
let _initialized = false;
let _eventsHooked = false;
let _cfg = null;
let _readyWatchdogTimer = null;

/* ================================================================== */
/*  PUBLIC API                                                        */
/* ================================================================== */

/**
 * Bootstraps the widget. Callable multiple times; second call is no-op.
 *
 * @param {object} cfg                        – REQUIRED widget config
 * @param {number|string} cfg.loginProjectId
 * @param {number|string} cfg.merchantId
 * @param {number|string} cfg.projectId
 * @param {string}        cfg.orbsApiHostId
 * @param {boolean}       [cfg.isMobile]
 * @param {boolean}       [cfg.isCollapsed]
 * @param {object}        [cfg.layoutSettings]
 *
 * @param {number} [maxRetries   = DEF_RETRIES]
 * @param {number} [retryDelay   = DEF_DELAY]     – ms
 * @param {number} [loadTimeout  = DEF_TIMEOUT]   – ms
 *
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function initMetaframe(
  cfg,
  maxRetries = DEF_RETRIES,
  retryDelay = DEF_DELAY,
  loadTimeout = DEF_TIMEOUT
) {
  /* short-circuit if already initialised */
  if (_initialized) {
    try {
      Amplitude.sendEvent(Events.GetAnalyticsEventSuccessKey(MF_INIT), {
        reason: "already_initialized",
      });
    } catch {}
    return { ok: true };
  }

  /* validate mandatory cfg */
  if (!cfg?.loginProjectId || !cfg?.merchantId || !cfg?.projectId) {
    const err = new Error(
      "Metaframe: projectId, merchantId, loginProjectId are required"
    );
    Log.error(err);
    try {
      Amplitude.sendEvent(Events.GetAnalyticsEventErrorKey(MF_INIT), {
        error: err.message,
      });
    } catch {}
    return { ok: false, error: err };
  }
  _cfg = cfg;

  const initTracker = EventTracker.trackStage(MF_INIT, "init", {
    isMobile: !!_cfg?.isMobile,
    isCollapsed: !!_cfg?.isCollapsed,
  });

  /* attach listeners only once */
  if (!_eventsHooked) {
    subscribeOnMetaframeEvents();
    observeMetaframeContainerAddition();
    _eventsHooked = true;
  }

  /* load SDK (with retry) */
  const loaded = await loadSdk(maxRetries, retryDelay, loadTimeout);
  if (!loaded.ok) return loaded;

  /* create widget */
  try {
    const t0 = performance.now();
    createMetaframe();
    try {
      Amplitude.sendEvent(Events.GetAnalyticsEventSuccessKey(MF_WIDGET), {
        duration_ms: Math.round(performance.now() - t0),
      });
    } catch {}
  } catch (e) {
    Log.error("[metaframe] widget creation failed:", e);
    try {
      Amplitude.sendEvent(Events.GetAnalyticsEventErrorKey(MF_WIDGET), {
        error: e?.message || String(e),
      });
    } catch {}
    initTracker.error(e);
    return { ok: false, error: e };
  }

  _initialized = true;
  Log.debug("[metaframe] widget initialised");
  clearTimeout(_readyWatchdogTimer);
  _readyWatchdogTimer = setTimeout(() => {
    if (!_isMetaframeReady) {
      const ctx = buildDiagContext();
      try {
        Amplitude.sendEvent(Events.GetAnalyticsEventErrorKey(MF_READY), {
          reason: "ready_timeout",
          ...ctx,
        });
      } catch {}
      initTracker.error(new Error("metaframe_ready_timeout"), ctx);
    }
  }, Math.max(5_000, loadTimeout + 2_000));

  initTracker.success();
  return { ok: true };
}

/**
 * Opens the Metaframe login modal.
 */
export function openMetaframeLogin() {
  if (!_isMetaframeReady) return Log.error("Metaframe not ready");
  showMetaframeUI(true);
  window.metaframe.partnerActions.openLogin();
}

/**
 * Opens the backpack UI.
 */
export function openMetaframeBackpack() {
  if (!_isMetaframeReady) return Log.error("Metaframe not ready");
  window.metaframe.partnerActions.openBackpack();
}

/**
 * Pushes a notification.
 * @param {object} params
 */
export function pushMetaframeNotification(params) {
  if (!_isMetaframeReady) return Log.error("Metaframe not ready");
  window.metaframe.partnerActions.pushNotification(params);
}

export function checkMetaframeReady() {
  return _isMetaframeReady;
}

/**
 * Checks if the user is authorized based on the presence of an auth token.
 *
 * @returns {boolean} True if authorized; otherwise, false.
 */
export function isAuthorized() {
  const token = getAuthToken();
  if (!token) return false;

  // Main JWT must be valid and not expired
  if (!isJwtValidAndNotExpired(token)) return false;

  // If payload contains nested social tokens, validate them too (when they look like JWTs)
  const payload = safeDecodeJwtPayload(token);
  const sat = payload?.social_access_token;
  // social_refresh_token is opaque (not a JWT)

  if (sat && isProbablyJwt(sat) && !isJwtValidAndNotExpired(sat)) return false;

  return true;
}

/* ------- UI helpers, observers, ShadowDOM utils (unchanged) -------- */
/**
 * Shows or hides the Metaframe UI container.
 *
 * @param {boolean} show - True to show the UI; false to hide it.
 */
export function showMetaframeUI(show) {
  const c = getMetaframeUI();
  if (!c) return Log.error(`Element #${METAFRAME_CONTAINER_ID} not found`);
  c.style.visibility = show ? "visible" : "hidden";
  c.style.opacity = show ? 1 : 0;
  c.style.pointerEvents = show ? "all" : "none";
}

/**
 * Retrieves the Xsolla Metaframe token from cookies.
 *
 * @returns {string} The decoded token or an empty string if not found.
 */
export function getAuthToken() {
  if (SAVE_TOKEN_TO_COOKIES) {
    const cookies = document.cookie.split("; ");
    for (const c of cookies) {
      const [name, val] = c.split("=");
      if (name === Cookies.XSOLLA_METAFRAME_TOKEN_PREFS_KEY) {
        return decodeURIComponent(val);
      }
    }
  }
  return _authToken;
}

export function getMetaframeOpenButton() {
  return findElementInShadowDOM(getMetaframeUI(), "button.go699427653");
}

/* ================================================================== */
/*  INTERNAL HELPERS                                                  */
/* ================================================================== */

/* ------- script loader with retry --------------------------------- */
function loadSdk(maxRetries, retryDelay, loadTimeout) {
  if (window.metaframe) {
    _isMetaframeScriptLoaded = true;
    try {
      Amplitude.sendEvent(Events.GetAnalyticsEventSuccessKey(MF_SDK), {
        attempt: 0,
        cached: true,
      });
    } catch {}
    return Promise.resolve({ ok: true });
  }
  if (_sdkPromise) return _sdkPromise;

  _sdkPromise = new Promise((resolve) => {
    /* --- moved inside so resolve is in scope ----------------------- */
    function attempt(n) {
      Log.debug(`[metaframe] SDK attempt ${n}/${maxRetries}`);
      const t0 = performance.now();
      try {
        Amplitude.sendEvent(Events.GetAnalyticsEventStartKey(MF_SDK), {
          attempt: n,
          maxRetries,
          retryDelay,
          loadTimeout,
        });
      } catch {}
      const existing = document.querySelector(`script[src^="${SDK_URL}"]`);
      if (existing) return hook(existing, n);

      const s = document.createElement("script");
      s.src = SDK_URL;
      s.async = true;
      _scriptTag = s;
      document.body.appendChild(s);
      hook(s, n);

      function reportSuccess() {
        try {
          Amplitude.sendEvent(Events.GetAnalyticsEventSuccessKey(MF_SDK), {
            attempt: n,
            duration_ms: Math.round(performance.now() - t0),
          });
        } catch {}
      }

      function reportError(message) {
        try {
          Amplitude.sendEvent(Events.GetAnalyticsEventErrorKey(MF_SDK), {
            attempt: n,
            duration_ms: Math.round(performance.now() - t0),
            error: message,
          });
        } catch {}
      }

      function hook(tag, n) {
        let done = false;
        const tOut = setTimeout(() => tag.onerror?.(), loadTimeout);

        tag.onload = () => {
          if (done) return;
          done = true;
          clearTimeout(tOut);
          _isMetaframeScriptLoaded = true;
          Log.debug("[metaframe] SDK loaded");
          reportSuccess();
          resolve({ ok: true });
        };

        tag.onerror = () => {
          if (done) return;
          done = true;
          clearTimeout(tOut);
          tag.remove();
          _scriptTag = null;

          const online = typeof navigator !== "undefined" ? navigator.onLine : undefined;
          const visibility = typeof document !== "undefined" ? document.visibilityState : undefined;
          const delay = n < maxRetries ? retryDelay : 0;
          Log.error(`[metaframe] SDK load failed on attempt ${n}`, {
            attemptNo: n,
            maxRetries,
            online,
            visibility,
            url: SDK_URL,
            nextDelayMs: delay,
          });
          reportError("script_load_failed");
          if (n < maxRetries) {
            setTimeout(() => attempt(n + 1), retryDelay);
          } else {
            _sdkPromise = null;
            try {
              Amplitude.sendEvent(Events.GetAnalyticsEventErrorKey(MF_SDK), {
                final: true,
                attempt: n,
                message: "Metaframe SDK load failed",
              });
            } catch {}
            resolve({ ok: false, error: new Error("Metaframe SDK load failed") });
          }
        };
      }
    }

    /* kick-off first try */
    attempt(1);
  });

  return _sdkPromise;
}

/* ------- widget creation wrapper ---------------------------------- */
function createMetaframe() {
  if (!window.metaframe?.create) {
    throw new Error("window.metaframe.create is not available");
  }
  window.metaframe.create(_cfg);
}

/* ------- event listeners ------------------------------------------ */
function subscribeOnMetaframeEvents() {
  window.addEventListener(EVT_APP_LOADED, () => {
    Log.debug("Metaframe event: app-loaded");
    _isMetaframeReady = true;
    setupPartnerActions();
    setupMetaframeUI();
    showMetaframeUI(false);
    clearTimeout(_readyWatchdogTimer);
    try {
      Amplitude.sendEvent(Events.GetAnalyticsEventSuccessKey(MF_READY), {
        container_present: !!getMetaframeUI(),
        open_btn_present: !!getMetaframeOpenButton(),
        script_loaded: _isMetaframeScriptLoaded,
        isMobile: !!_cfg?.isMobile,
      });
    } catch {}
  });

  window.addEventListener(EVT_NOT_AUTH_MINI_APPS_LOADED, () => {
    Log.debug("Metaframe event: not-authorized-mini-apps-loaded");
    removeAuthToken();
    try {
      Amplitude.sendEvent(MF_OTHER + "_NotAuthorized_MiniApps_Loaded", {});
    } catch {}
  });

  window.addEventListener(EVT_LOGIN_SUCCESSFUL, ({ detail = {} }) => {
    Log.debug("Metaframe event: login-successful", detail);
    setAuthToken(detail.token);
    window.UnityWebGLApp?.myGameInstance?.SendMessage?.(
      METAFRAME_CALLBACK_VIEW,
      "OnMetaframeLoginSuccess",
      JSON.stringify(detail)
    );
    try {
      Amplitude.sendEvent(MF_OTHER + "_Login_Success", {
        has_token: !!detail?.token,
        token_len: detail?.token ? String(detail.token).length : 0,
      });
    } catch {}
  });

  window.addEventListener(EVT_LOGOUT_SUCCESSFUL, () => {
    Log.debug("Metaframe event: logout-successful");
    removeAuthToken();
    window.UnityWebGLApp?.myGameInstance?.SendMessage?.(
      METAFRAME_CALLBACK_VIEW,
      "OnMetaframeLogoutSuccess"
    );
    try {
      Amplitude.sendEvent(MF_OTHER + "_Logout_Success", {});
    } catch {}
  });
}

/* partner placeholder */
function setupPartnerActions() {
  /* customise if needed */
}

/* ------- auth-token CRUD ------------------------------------------ */
/**
 * Stores the token in a session cookie.
 *
 * @param {string} token - The token string to be stored.
 */
function setAuthToken(token) {
  if (!token) return;
  _authToken = token;
  if (!SAVE_TOKEN_TO_COOKIES) return;
  document.cookie = `${
    Cookies.XSOLLA_METAFRAME_TOKEN_PREFS_KEY
  }=${encodeURIComponent(token)}; path=/`;
}

/**
 * Removes the Xsolla Metaframe token cookie.
 */
function removeAuthToken() {
  _authToken = "";
  document.cookie = `${Cookies.XSOLLA_METAFRAME_TOKEN_PREFS_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

/**
 * Retrieves the Metaframe container element by its ID.
 *
 * @returns {HTMLElement|null} The container element or null if not found.
 */
function getMetaframeUI() {
  return document.getElementById(METAFRAME_CONTAINER_ID);
}

/**
 * Sets up the Metaframe UI by adding click event listeners to buttons
 * within the Shadow DOM of the Metaframe container.
 */
function setupMetaframeUI() {
  setupMetaframeButtonClickActions();
  const isMobileQuery = window.matchMedia("(max-width: 1000px)");
  handleMetaframeLayoutChange(isMobileQuery);
  isMobileQuery.addEventListener("change", handleMetaframeLayoutChange);
}

function setupMetaframeButtonClickActions() {
  // Find all buttons with the class "go699427653" inside the Shadow DOM.
    const button = getMetaframeOpenButton();
    if (button) {
      button.addEventListener("click", () => {
        // showMetaframeLogoutButton(false);
      });
    } else {
      Log.warn('No button with class "go699427653" found in the Shadow DOM.');
    }
}

/**
 * Finds one or more elements inside a Shadow DOM using a specified query selector.
 *
 * @param {HTMLElement} host - The shadow host element.
 * @param {string} selector - The query selector to find the desired element(s) within the Shadow DOM.
 * @param {boolean} [all=false] - If true, returns all matching elements as a NodeList; if false, returns the first matching element.
 * @returns {HTMLElement|NodeList|null} - The found element(s), or null if not found.
 */
function findElementInShadowDOM(host, selector, all = false) {
  if (!host?.shadowRoot) return null;
  return all
    ? host.shadowRoot.querySelectorAll(selector)
    : host.shadowRoot.querySelector(selector);
}

/**
 * Generic function that observes a target node for the addition of an element matching a given query selector.
 *
 * @param {HTMLElement|ShadowRoot} targetNode - The node (or ShadowRoot) to observe.
 * @param {string} querySelector - The CSS selector to identify the desired element.
 * @param {Function} callback - A function to be called when a matching element is added. Receives the matched node as an argument.
 * @param {boolean} [disconnectOnFound=true] - Whether to disconnect the observer after the element is found.
 * @param {boolean} [anySelector=false] - observe any added element.
 */
function observeElementAddition(
  targetNode,
  querySelector,
  callback,
  disconnectOnFound = true,
  anySelector = false
) {
  if (!targetNode) {
    Log.warn("Target node not provided for observation.");
    return;
  }

  const config = { childList: true, subtree: true };

  const observer = new MutationObserver((mutationsList, obs) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          // Ensure the added node is an element.
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself matches the query or contains a matching element.
            if (
              anySelector ||
              node.matches(querySelector) ||
              node.querySelector(querySelector)
            ) {
              Log.debug(
                `Element matching "${querySelector}" has been added:`,
                node
              );

              if (typeof callback === "function") {
                callback(node);
              }

              if (disconnectOnFound) {
                obs.disconnect();
              }
              // Exit early once a matching element is found.
              return;
            }
          }
        });
      }
    }
  });

  observer.observe(targetNode, config);
}

/**
 * Observes the document for the addition of the Metaframe container element by its ID.
 * Once the element is added, it executes the optional callback and hides the UI container.
 *
 * @param {Function} [callback] - Optional callback to be called when the element is added.
 */
function observeMetaframeContainerAddition(callback) {
  observeElementAddition(
    document.body,
    `#${METAFRAME_CONTAINER_ID}`,
    (node) => {
      Log.debug(`Metaframe container "${METAFRAME_CONTAINER_ID}" added`);
      showMetaframeUI(false);
      callback?.(node);
    }
  );
}

/* ------- layout helper -------------------------------------------- */

/**
 * Switches Metaframe from desktop to mobile version or vice versa.
 *
 * @param {Function} [isMobile] - Whether to switch Metaframe to the mobile version. If set to true, Metaframe switches to the mobile version.
 * If set to false, Metaframe switches to the desktop version.
 */
function setMetaframeIsMobile(isMobile) {
  window.metaframe.setIsMobile(isMobile);
}
function handleMetaframeLayoutChange(e) {
  setMetaframeIsMobile(e.matches);
}

/* ------- JWT helpers ----------------------------------------------- */
function isProbablyJwt(token) {
  return typeof token === "string" && token.split(".").length >= 2;
}

function safeDecodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = base64UrlDecode(parts[1]);
    return JSON.parse(payload);
  } catch (e) {
    Log.warn("[metaframe] JWT decode failed:", e);
    return null;
  }
}

function isJwtValidAndNotExpired(token) {
  const payload = safeDecodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    // If we cannot read exp, consider token invalid/expired to be safe
    return false;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec < payload.exp;
}

function base64UrlDecode(input) {
  // Replace URL-safe chars and pad to proper Base64 length
  let str = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad === 2) str += "==";
  else if (pad === 3) str += "=";
  else if (pad !== 0) str += "==="; // fallback
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

/* ------- diagnostics context builder -------------------------------- */
function buildDiagContext() {
  try {
    const c = getMetaframeUI();
    return {
      script_loaded: _isMetaframeScriptLoaded,
      metaframe_defined: !!window.metaframe,
      partner_actions: !!window.metaframe?.partnerActions,
      container_present: !!c,
      container_visible: c ? c.style?.visibility : undefined,
      container_opacity: c ? c.style?.opacity : undefined,
      isMobile: !!_cfg?.isMobile,
      ua: navigator.userAgent.slice(0, 120),
      conn: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData,
      } : null,
    };
  } catch {
    return { script_loaded: _isMetaframeScriptLoaded };
  }
}