/* xsolla_paystation.module.js
 * Loads Xsolla PayStation widget once and relays its events to Unity.
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/* ── configurable defaults ───────────────────────────────────────────── */

const SDK_URL =
  "https://static.xsolla.com/embed/paystation/1.0.7/widget.min.js";
const DEF_RETRIES = 5; // default max retries
const DEF_DELAY = 1_000; // base delay, grows with backoff
const DEF_TIMEOUT = 10_000; // ms before giving up <script> load
const MAX_BACKOFF = 15_000; // cap for backoff delay

/* ── internal module state ───────────────────────────────────────────── */

let _loadPromise = null; // shared Promise for SDK loading
let _initialized = false; // event listeners attached
let _callbackView = "GameMenuUIMoreOrbsView";

const payStationOptions = {
  access_token: "",
  sandbox: false,
};

/* ── public: bootstrap ───────────────────────────────────────────────── */

/**
 * Loads the PayStation SDK with retry/back‑off.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.maxRetries=DEF_RETRIES]
 * @param {number}  [opts.retryDelay=DEF_DELAY]      – ms
 * @param {number}  [opts.loadTimeout=DEF_TIMEOUT]   – ms
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function initXsollaPaystation({
  maxRetries = DEF_RETRIES,
  retryDelay = DEF_DELAY,
  loadTimeout = DEF_TIMEOUT,
} = {}) {
  const loadResult = await loadSdk({ maxRetries, retryDelay, loadTimeout });
  if (!loadResult.ok) return loadResult;

  if (!_initialized) {
    attachEventRelays();
    _initialized = true;
  }
  return { ok: true };
}

/* ── public: open widget ─────────────────────────────────────────────── */

/**
 * Opens the PayStation iframe (call after successful init).
 *
 * @param {string}  accessToken
 * @param {string}  callbackView – Unity behaviour to receive messages
 * @param {boolean} sandbox
 */
export function openXsollaPayStation(accessToken, callbackView, sandbox) {
  payStationOptions.access_token = accessToken;
  payStationOptions.sandbox = sandbox;
  _callbackView = callbackView;

  if (typeof window.XPayStationWidget?.init !== "function") {
    Log.error("[xsolla_paystation] XPayStationWidget not ready – call init first");
    return;
  }

  window.XPayStationWidget.init(payStationOptions);
  window.XPayStationWidget.open();
}

/* ═════════════════════════════════════════════════════════════════════ */
/*  Internal helpers                                                     */
/* ═════════════════════════════════════════════════════════════════════ */

async function loadSdk({ maxRetries, retryDelay, loadTimeout }) {
  if (checkReady()) return { ok: true };
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve) => {
    /* ───────────── helpers now see resolve ───────────── */
    function attempt(attemptNo) {
      Log.debug(`[xsolla_paystation] SDK load attempt ${attemptNo}/${maxRetries}`);
      const existing = document.querySelector(`script[src^="${SDK_URL}"]`);
      if (existing) {
        if (checkReady()) {
          return resolve({ ok: true });
        }
        const started = Date.now();
        const tick = setInterval(() => {
          if (checkReady()) {
            clearInterval(tick);
            resolve({ ok: true });
          } else if (Date.now() - started > loadTimeout) {
            clearInterval(tick);
            const delay = computeBackoffDelay(attemptNo, retryDelay);
            if (attemptNo < maxRetries) {
              Log.error(
                `[xsolla_paystation] existing script not ready; retry in ${delay}ms`
              );
              setTimeout(() => attempt(attemptNo + 1), delay);
            } else {
              _loadPromise = null;
              resolve({
                ok: false,
                error: new Error(
                  "Xsolla SDK load failed (existing tag stalled)"
                ),
              });
            }
          }
        }, 100);
        return;
      }

      const s = document.createElement("script");
      s.src = withCacheBuster(SDK_URL);
      s.async = true;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "strict-origin-when-cross-origin";
      document.head.appendChild(s);

      waitForScript(s, attemptNo);
    }

    function waitForScript(tag, attemptNo) {
      let done = false;
      const tId = setTimeout(() => !done && tag.onerror?.(), loadTimeout);

      tag.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(tId);
        cleanup(tag);
        Log.debug("[xsolla_paystation] SDK loaded");
        resolve({ ok: true });
      };

      tag.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(tId);
        cleanup(tag, { remove: true });

        const online = typeof navigator !== "undefined" ? navigator.onLine : undefined;
        const visibility = typeof document !== "undefined" ? document.visibilityState : undefined;
        const delay = computeBackoffDelay(attemptNo, retryDelay);
        Log.error(`[xsolla_paystation] SDK load failed on attempt ${attemptNo}`, {
          attemptNo,
          maxRetries,
          online,
          visibility,
          url: SDK_URL,
          nextDelayMs: delay,
        });
        if (attemptNo < maxRetries) {
          setTimeout(() => attempt(attemptNo + 1), delay);
        } else {
          _loadPromise = null;
          resolve({ ok: false, error: new Error("Xsolla SDK load failed") });
        }
      };
    }

    function cleanup(tag, { remove = false } = {}) {
      tag.onload = tag.onerror = null;
      if (remove) tag.parentNode?.removeChild(tag);
    }

    /* kick‑off first try */
    attempt(1);
  });

  return _loadPromise;
}


function attachEventRelays() {
  Log.debug("[xsolla_paystation] attachEventRelays");
  const w = window.XPayStationWidget;
  if (typeof w?.on !== "function") {
    Log.error("[xsolla_paystation] XPayStationWidget.on missing after load");
    return;
  }

  [
    "init",
    "open",
    "load",
    "close",
    "status",
    "status-invoice",
    "status-delivering",
    "status-done",
    "status-troubled",
  ].forEach((evt) => {
    w.on(evt, (...args) => {
      const method = `OnXPayStationWidget_${evt
        .split("-")
        .map((p) => p[0].toUpperCase() + p.slice(1))
        .join("")}`;

      Log.debug(`[xsolla_paystation] event "${evt}" → ${method}`);

      if (window.UnityWebGLApp?.myGameInstance?.SendMessage)
        window.UnityWebGLApp.myGameInstance.SendMessage(
          _callbackView,
          method,
          args.length ? JSON.stringify(args) : ""
        );
    });
  });
}

function computeBackoffDelay(attemptNo, base) {
  const exp = Math.min(base * Math.pow(2, Math.max(0, attemptNo - 1)), MAX_BACKOFF);
  // Full jitter in [0.5x, 1.5x]
  const jitter = 0.5 + Math.random();
  return Math.floor(exp * jitter);
}

function withCacheBuster(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}ts=${Date.now()}`;
}

function checkReady() {
  return !!window.XPayStationWidget && typeof window.XPayStationWidget.init === "function";
}
