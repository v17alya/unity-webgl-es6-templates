/* xsolla_oauth.module.js
 * Loads Xsolla Login SDK, mounts OAuth widget, relays token to Unity.
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/* CDN + retry defaults */
const SDK_URL = "https://login-sdk.xsolla.com/latest/";
const DEF_RETRIES = 3;
const DEF_DELAY = 2_000; // ms
const DEF_TIMEOUT = 10_000; // ms

/* internal state */
let _sdkPromise = null;
let _widget = null;
let _initialized = false;
let _scriptTag = null;
let _channel = null;
let _callbackView = "XsollaAuthProvider";

/* ───────────────────────── PUBLIC ─────────────────────────── */

/**
 * Loads SDK & mounts OAuth widget.
 *
 * @param {object} cfg                     – REQUIRED widget config
 * @param {string} cfg.projectId
 * @param {string} cfg.clientId
 * @param {string} [cfg.preferredLocale="en_US"]
 * @param {string} [cfg.responseType="code"]
 * @param {string} [cfg.scope="offline"]
 *
 * @param {number} [maxRetries   = DEF_RETRIES]
 * @param {number} [retryDelay   = DEF_DELAY]   – ms
 * @param {number} [loadTimeout  = DEF_TIMEOUT] – ms
 *
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function initXsollaAuth(
  cfg,
  maxRetries = DEF_RETRIES,
  retryDelay = DEF_DELAY,
  loadTimeout = DEF_TIMEOUT
) {
  /* sanity check for mandatory fields */
  if (!cfg || !cfg.projectId || !cfg.clientId) {
    const err = new Error("Xsolla OAuth: projectId and clientId are required");
    Log.error(err);
    return { ok: false, error: err };
  }

  /* download SDK with retry */
  const loaded = await loadSdk(maxRetries, retryDelay, loadTimeout);
  if (!loaded.ok) return loaded;
  if (_initialized) return { ok: true };

  /* widget creation */
  try {
    _widget = new window.XsollaLogin.Widget({
      projectId: cfg.projectId,
      preferredLocale: cfg.preferredLocale ?? "en_US",
      clientId: cfg.clientId,
      responseType: cfg.responseType ?? "code",
      state: randomHex(32),
      redirectUri: buildRedirectUri(),
      scope: cfg.scope ?? "offline",
      // scope: "email",        // ← original commented line retained
    });
    _widget.mount("xl_auth");
  } catch (err) {
    Log.error("[xsolla-oauth] widget mount failed:", err);
    return { ok: false, error: err };
  }

  attachBroadcast();
  _initialized = true;
  Log.debug("[xsolla-oauth] widget initialised");
  return { ok: true };
}

/**
 * Open OAuth widget (after initXsollaAuth)
 */
export function openXsolla() {
  // document.querySelector("#xl_auth").style.display = "block";
  _widget?.open();
}

/**
 * Open a direct login link in a new tab/window
 * @param {string} link
 */
export function openXsollaLoginLink(link) {
  /* original approach preserved */
  const linkElement = document.createElement("a");
  linkElement.href = link;
  linkElement.target = "_blank";
  document.body.appendChild(linkElement); // Temporarily add to the DOM
  linkElement.click();
  document.body.removeChild(linkElement); // Clean up afterwards
  // window.open(link, "_blank");
}

/**
 * Open OAuth widget in helper page and handle callback via BroadcastChannel
 * @param {(token:string)=>void} callback
 */
export function openXsollaLoginWidget(callback) {
  /* recreate channel for one‑shot callback */
  resetBroadcast(callback);

  const additionalPath = "/html/oauth_xsolla.html";
  // for link type: {site_url}/{server}
  // const origin = window.location.origin;
  // for link type: {site_url}/{build}/{server}
  const origin = window.location.origin + window.location.pathname;

  window.open(
    `${origin.replace(/\/$/, "")}/${additionalPath.replace(/^\//, "")}`,
    "_blank"
  );
}

/* ═════════════ INTERNAL HELPERS ═════════════════════════════ */

async function loadSdk(maxRetries, retryDelay, loadTimeout) {
  if (window.XsollaLogin) return { ok: true };
  if (_sdkPromise) return _sdkPromise;

  _sdkPromise = new Promise((resolve) => attempt(1));
  return _sdkPromise;

  function attempt(n) {
    Log.debug(`[xsolla-oauth] SDK load attempt ${n}/${maxRetries}`);

    const existing = document.querySelector(`script[src^="${SDK_URL}"]`);
    if (existing) return hook(existing, n);

    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    _scriptTag = s;
    document.head.appendChild(s);
    hook(s, n);
  }

  function hook(tag, n) {
    let done = false;
    const timer = setTimeout(() => tag.onerror?.(), loadTimeout);

    tag.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: true });
    };

    tag.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      tag.remove();
      _scriptTag = null;

      if (n < maxRetries) {
        setTimeout(() => attempt(n + 1), retryDelay);
      } else {
        _sdkPromise = null;
        resolve({
          ok: false,
          error: new Error("Xsolla OAuth SDK load failed"),
        });
      }
    };
  }
}

function attachBroadcast() {
  _channel?.close();
  _channel = new BroadcastChannel("app-data");
  _channel.onmessage = ({ data }) => {
    Log.debug("[xsolla-oauth] token:", data);
    window.UnityWebGLApp?.myGameInstance?.SendMessage?.(
      _callbackView,
      "XsollaAuthProvider_BabkaAuthTokenGot",
      data
    );
  };
}

function resetBroadcast(cb) {
  const ch = new BroadcastChannel("app-data");
  let once = false;
  ch.onmessage = ({ data }) => {
    if (once) return;
    once = true;
    cb?.(data);
    ch.close();
  };
}

function buildRedirectUri() {
  /* original comment kept */
  // for link type: {site_url}/{server}
  // const origin = window.location.origin;
  // for link type: {site_url}/{build}/{server}
  const origin = window.location.origin + window.location.pathname;
  return `${origin.replace(/\/$/, "")}/html/oauth_xsolla_callback.html`;
}

function randomHex(len) {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[(Math.random() * 16) | 0];
  return out;
}
