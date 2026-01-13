/* gtag_handler.module.js
 * Loads Google Analytics v4 (gtag.js) once, with automatic retries
 * and DOM‑cleanup of any timed‑out <script> tags.
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/* ── module‑level singletons ─────────────────────────────────────────── */

let _initPromise = null; // shared Promise for concurrent callers
let _id = null; // GA Measurement ID used in this session
let _initialized = false; // true when gtag config finished
let _scriptTag = null; // currently attached <script>, if any

/* ────────────────────────────────────────────────────────────────────── */
/*  Public API                                                           */
/* ───────────────────────────────────────────────────────────────────── */

/**
 * Bootstraps gtag.js with retry/back‑off.
 *
 * @param {object} params
 * @param {string} params.id                 – GA Measurement ID ("G‑XXXX").
 * @param {number} [params.maxRetries=1]     – how many attempts before fail.
 * @param {number} [params.retryDelay=2000]  – delay (ms) between attempts.
 * @param {number} [params.scriptTimeout=10000] – give up load after N ms.
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function initGtag({
  id,
  maxRetries = 1,
  retryDelay = 2000,
  scriptTimeout = 10_000,
} = {}) {
  Log.debug(`[gtag] initGtag called with id: ${id}, maxRetries: ${maxRetries}, retryDelay: ${retryDelay}, scriptTimeout: ${scriptTimeout}`);
  
  if (!id) return { ok: false, error: new Error("GA ID required") };
  if (_initialized && _id === id) return { ok: true };
  if (_initPromise) return _initPromise; // another call in flight

  _id = id;
  const src = `https://www.googletagmanager.com/gtag/js?id=${id}`;

  /* provisional dataLayer & stub */
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag.__initialized = false;

  let attempt = 0;

  _initPromise = new Promise((resolve) => attemptLoad(resolve));

  return _initPromise;

  /* ───────────────── helper: one attempt ───────────────────── */

  function attemptLoad(resolve) {
    attempt++;
    Log.debug(`[gtag] attempt ${attempt}/${maxRetries}`);

    let done = false; // ensure single resolution

    const onSuccess = () => {
      if (done) return;
      done = true;
      try {
        window.gtag("js", new Date());
        window.gtag("config", id);
        window.gtag.__initialized = true;
        _initialized = true;
        Log.debug("[gtag] initialised");
        resolve({ ok: true });
      } catch (err) {
        onFail(err);
      }
    };

    const onFail = (err) => {
      if (done) return;
      done = true;

      /* cleanup timed‑out script to avoid late onload */
      if (_scriptTag && _scriptTag.parentNode) {
        _scriptTag.parentNode.removeChild(_scriptTag);
        _scriptTag = null;
      }

      Log.error(`[gtag] attempt failed (${attempt}/${maxRetries})`, err);

      if (attempt < maxRetries) {
        setTimeout(attemptLoad, retryDelay);
      } else {
        _initPromise = null; // allow external fresh retry
        resolve({ ok: false, error: err });
      }
    };

    /* if correct <script> already in DOM and still loading, reuse it */
    const existing = document.querySelector(`script[src^="${src}"]`);
    if (existing) {
      _scriptTag = existing;
      attachHandlers(existing);
      return;
    }

    /* else create a brand‑new tag */
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    _scriptTag = s;
    attachHandlers(s);
    document.head.appendChild(s);

    /* attach onload/onerror + timeout guard */
    function attachHandlers(tag) {
      const timer = setTimeout(() => {
        tag.onerror?.(); // trigger error path manually
      }, scriptTimeout);

      tag.onload = () => {
        clearTimeout(timer);
        onSuccess();
      };
      tag.onerror = () => {
        clearTimeout(timer);
        onFail(new Error("gtag script load failed"));
      };
    }
  }
}

/**
 * Safe wrapper around the live gtag.
 * Returns uniform result instead of throwing.
 *
 * @param  {...any} args – forwarded to gtag
 * @returns {{ok:true}|{ok:false,error:Error}}
 */
export function gtagSafe(...args) {
  if (typeof window.gtag === "function" && window.gtag.__initialized) {
    window.gtag(...args);
    return { ok: true };
  }
  return { ok: false, error: new Error("gtag not ready") };
}
