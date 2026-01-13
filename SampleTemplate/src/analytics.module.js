// analytics.module.js
// ------------------------------------------------------------
// Lightweight bootstrap for all “product‑wide” analytics data.
// Resolves a persistent client‑ID, starts a new session‑ID on
// every successful init, and exposes basic device / browser info.
// ------------------------------------------------------------

import UAParser from "./lib/ClientDataJS/ua-parser.min.js?v={{{ PRODUCT_VERSION }}}";
import {
  parseSegment,
  getDeviceName,
  checkIfMobile,
  getSystemInfo,
} from "./helpers.module.js?v={{{ PRODUCT_VERSION }}}";
import { initGtag } from "./gtag_handler.module.js?v={{{ PRODUCT_VERSION }}}";
// import { Events } from "./analytics_events.module.js?v={{{ PRODUCT_VERSION }}}";
import { isUserAuthorized } from "./unity.module.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/*────────────────── exported session‑wide state ──────────────────*/
export const AnalyticsState = {
  serverName: null,
  indexedDB_Available: "indexedDB" in window,
  deviceProperty: null,
  basedEventProperty: null,
};

/*────────────────── private singletons ───────────────────────────*/
let _clientId = "";
let _currentSessionId = -1;
let _initialised = false;

/*────────────────── public convenience getters ──────────────────*/
export const getSavedClientId = () => _clientId;
export const getCurrentSessionId = () => _currentSessionId;

/*=================================================================*/
/*   PERSISTENT CLIENT‑ID                                          */
/*=================================================================*/

/**
 * Resolves and returns a stable `clientId`.
 * Order of preference: localStorage → GA4 client_id → UUID‑v4.
 * Never rejects – falls back to `"anon"` on fatal error.
 *
 * @param {string|undefined} gtagId - Measurement ID used for GA lookup
 * @param {number} maxRetries       - attempts for GA initialisation
 * @param {number} retryDelayMs     - delay between retries, ms
 * @returns {Promise<string>}
 */
async function resolveClientId(gtagId, maxRetries, retryDelayMs) {
  /* 1️⃣ localStorage */
  try {
    const cached = localStorage.getItem("analytics_user_id");
    if (cached) return cached;
  } catch {}

  /* 2️⃣ GA4 client_id with retry */
  if (gtagId) {
    for (let i = 1; i <= maxRetries; i++) {
      try {
        await initGtag({ id: gtagId });
        const gaId = await getGtagClientId(gtagId);
        if (gaId) {
          localStorage.setItem("analytics_user_id", gaId);
          return gaId;
        }
      } catch (err) {
        Log.error(
          `[Analytics] GA clientId attempt ${i}/${maxRetries} failed`,
          err
        );
      }
      if (i < maxRetries) await new Promise((r) => setTimeout(r, retryDelayMs));
    }
    Log.error("[Analytics] GA client_id unavailable – using UUID fallback");
  }

  /* 3️⃣ fallback UUID */
  const uuid = self.crypto?.randomUUID?.() ?? fallbackUuidv4();
  try {
    localStorage.setItem("analytics_user_id", uuid);
  } catch {}
  return uuid;
}

/*=================================================================*/
/*   PUBLIC INITIALISER                                            */
/*=================================================================*/

/**
 * Bootstraps analytics once per page load. Safe to call repeatedly.
 *
 * @param {string}  [gtagId]          - GA4 Measurement ID (optional)
 * @param {number}  [maxRetries=3]    - retries for GA client_id
 * @param {number}  [retryDelay=1500] - delay between retries, ms
 * @param {boolean} [force=false]     - re‑run even if already OK
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function initAnalytics(
  gtagId,
  maxRetries = 3,
  retryDelay = 1500,
  force = false,
) {
  if (_initialised && !force) return { ok: true };

  try {
    _currentSessionId = Date.now();

    AnalyticsState.serverName = parseSegment(location.href, 1) ?? "none";
    AnalyticsState.deviceProperty = getDeviceName?.();
    AnalyticsState.basedEventProperty = buildBaseProps();

    Log.debug("[Analytics] init start");
    _clientId = await resolveClientId(gtagId, maxRetries, retryDelay);

    _initialised = true;
    Log.debug("[Analytics] init OK:", { clientId: _clientId, currentSessionId: _currentSessionId });
    return { ok: true };
  } catch (err) {
    Log.error("[Analytics] init failed:", err);
    return { ok: false, error: err };
  }
}

/*=================================================================*/
/*   INTERNAL HELPERS                                              */
/*=================================================================*/

/** RFC‑4122 v4 fallback when `crypto.randomUUID` not available. */
function fallbackUuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) =>
    ((Math.random() * 16) | 0).toString(16)
  );
}

/**
 * Queries GA4 for the current `client_id`.
 * Resolves `null` if unavailable or times out.
 */
function getGtagClientId(gtagId, timeout = 3000) {
  return new Promise((res) => {
    if (typeof gtag !== "function") return res(null);

    let done = false;
    const timer = setTimeout(() => {
      if (!done) res(null);
    }, timeout);

    try {
      gtag("get", gtagId, "client_id", (id) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        res(id || null);
      });
    } catch {
      if (!done) res(null);
    }
  });
}

/** Builds base event properties once per session. */
function buildBaseProps() {
  const ua = new UAParser(navigator.userAgent).getResult();
  const sys = getSystemInfo();
  const safeHref = (() => {
    try {
      return top.location.href;
    } catch {
      return location.href;
    }
  })();

  return {
    Browser: ua.browser.name ?? "unknown",
    Browser_Version: ua.browser.version ?? "unknown",
    Operating_System: ua.os.name ?? "unknown",
    Operating_System_Version: ua.os.version ?? "unknown",
    WebGL_Available: !!window.WebGLRenderingContext,
    WebGL_Version: document.createElement("canvas").getContext("webgl2")
      ? "WebGL2"
      : "WebGL1",
    IndexedDB_Available: AnalyticsState.indexedDB_Available,
    DeviceType: AnalyticsState.deviceProperty,
    Link_Open: safeHref,
    IsMobile: checkIfMobile(),
    Server_Name: AnalyticsState.serverName,
    New_User: !isUserAuthorized(),
    Vendor: sys.vendor,
    VideoCard: sys.renderer,
    Min_RAM: sys.minRam,
    ProcessorsCount: sys.hardwareConcurrency,
  };
}
