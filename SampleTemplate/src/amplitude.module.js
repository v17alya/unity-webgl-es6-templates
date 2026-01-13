// amplitude.module.js
// Sends gameplay / UX events to custom HTTP‑API (Amplitude‑compatible)
// while preserving order and enriching payload with Analytics core data.

import {
  AnalyticsState,
  getSavedClientId,
  getCurrentSessionId,
} from "./analytics_core.module.js?v={{{ PRODUCT_VERSION }}}";
import { app_version } from "./app_version.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/*──────────────────── configurable via init() ───────────────────*/
let _buildName = "YourBuildName"; // Replace with your build name
let _endpoint = "YOUR_ANALYTICS_ENDPOINT_URL_HERE"; // Replace with your analytics endpoint
let _initialized = false;
const MAX_RETRIES = 10;

/* wait‑until‑ready promise, lazily created on first send */
let _readyPromise = null;

/**
 * Bootstraps analytics once per page load. Safe to call repeatedly.
 *
 * @param {string}  [buildName]
 * @param {string}  [endpoint]
 */
export function initAmplitude(
  buildName = "YourBuildName", // Replace with your build name
  endpoint = "YOUR_ANALYTICS_ENDPOINT_URL_HERE" // Replace with your analytics endpoint
) {
  if (buildName) _buildName = buildName;
  if (endpoint) _endpoint = endpoint;
  _initialized = true;
}

/*──────────────────── internal counters (ordering) ──────────────*/
const state = { lastRequest: 1, currentRequest: 1 };

export const getLastAmplitudeRequestNumber = () => state.lastRequest;
export const setLastAmplitudeRequestNumber = (n) => {
  state.lastRequest = n;
};
export const incrementLastAmplitudeRequestNumber = (d) =>
  setLastAmplitudeRequestNumber(state.lastRequest + d);

export const getCurrentAmplitudeRequestNumber = () => state.currentRequest;
export const setCurrentAmplitudeRequestNumber = (n) => {
  state.currentRequest = n;
};
export const incrementCurrentAmplitudeRequestNumber = (d) =>
  setCurrentAmplitudeRequestNumber(state.currentRequest + d);

/*=================================================================*/
/*  PUBLIC SEND API                                                */
/*=================================================================*/

/**
 * Sends a single event (ordered queue unless `ignoreOrder`).
 */
export function sendEvent(
  eventName,
  eventProps = {},
  userProps = {},
  ignoreOrder = false // kept for API compatibility; ignored for send behavior
) {
  const slot = getCurrentAmplitudeRequestNumber();
  incrementCurrentAmplitudeRequestNumber(1);

  buildEventPayload(eventName, eventProps, userProps, slot)
    .then((body) => dispatchWithQueue(slot, body, `event:${eventName}`, 1))
    .catch((err) => logError("sendEvent", err, { eventName, slot }));
}

/**
 * Sends an already‑formatted JSON payload.
 */
export function sendRawEvent(jsonPayload, ignoreOrder = false) {
  const slot = getCurrentAmplitudeRequestNumber();
  const parsed =
    typeof jsonPayload === "string" ? JSON.parse(jsonPayload) : jsonPayload;
  const nEvts = Array.isArray(parsed.events) ? parsed.events.length : 1;

  incrementCurrentAmplitudeRequestNumber(nEvts);
  if (Array.isArray(parsed.events))
    parsed.events.forEach((ev, i) => (ev.event_id = slot + i));

  const body = JSON.stringify(parsed);
  dispatchWithQueue(slot, body, "raw", nEvts);
}

/*=================================================================*/
/*  INTERNAL HELPERS                                               */
/*=================================================================*/

/**
 * Ensures `clientId` is present before building payloads.
 * Polls `getSavedClientId()` up to 5 s (configurable).
 */
function ensureReady(maxWaitMs = 100000, step = 150) {
  if (_readyPromise) return _readyPromise;

  _readyPromise = new Promise((resolve, reject) => {
    const started = performance.now();

    (function poll() {
      if (getSavedClientId() && _initialized) return resolve();
      if (performance.now() - started > maxWaitMs)
        return reject(new Error("clientId not available"));
      setTimeout(poll, step);
    })();
  });

  return _readyPromise;
}

async function buildEventPayload(name, evt, usr, id) {
  await ensureReady(); // wait until analytics core resolved clientId

  const clientId = getSavedClientId();
  const sessionId = getCurrentSessionId();
  if (!clientId) throw new Error("clientId still missing – event dropped");

  return JSON.stringify({
    events: [
      {
        event_type: name,
        event_id: id,
        time: Date.now(),
        user_id: clientId,
        session_id: sessionId,
        insert_id: makeInsertId(id),
        platform: "HTML",
        app_version,
        event_properties: { ...AnalyticsState.basedEventProperty, ...evt },
        user_properties: { ...AnalyticsState.basedEventProperty, ...usr },
      },
    ],
  });
}

function dispatchWithQueue(slot, body, label, eventsCount) {
  const sendAttempt = (tryNo) => {
    fetch(_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "build-name": _buildName,
        accept: "*/*",
      },
      keepalive: true,
      body,
    })
      .then((r) => {
        if (!r.ok) {
          return r.text().then((t) => {
            const e = new Error("HTTP " + r.status);
            e.status = r.status;
            e.responseText = t;
            e.url = _endpoint;
            throw e;
          });
        }
        Log.debug(`[Amplitude] ${label} sent (slot ${slot})`);
        incrementLastAmplitudeRequestNumber(eventsCount);
      })
      .catch((err) => {
        logError("dispatch", err, { tryNo, slot, label, endpoint: _endpoint });
        if (tryNo >= MAX_RETRIES) {
          logError("dispatch_abort", err, { slot, label, endpoint: _endpoint, maxRetries: MAX_RETRIES });
          return;
        }
        const delay = Math.min(1000 * Math.pow(2, tryNo - 1), 10000);
        setTimeout(() => sendAttempt(tryNo + 1), delay);
      });
  };
  sendAttempt(1);
}

// ordering queue removed – we send immediately and rely on event_id/time

function makeInsertId(slot) {
  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${Date.now()}_${rand}_${slot}`;
}

function logError(ctx, err, extra = {}) {
  const payload = {
    ctx,
    message: String((err && err.message) || err),
    name: err && err.name,
    stack: err && err.stack,
    status: err && err.status,
    url: err && err.url,
    responseText: err && err.responseText,
    online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    ...extra,
  };
  try {
    Log.error("[Amplitude]", payload);
  } catch {
    // best-effort log
    console.error("[error] [Amplitude]", payload);
  }
}
