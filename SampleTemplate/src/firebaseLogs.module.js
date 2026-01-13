// firebase_logs.module.js
// Ships console/error logs to Firebase RTDB with retry/back‑off.

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";
import { initializeApp } from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-app.js";
import {
  getDatabase,
  ref,
  update,
} from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-database.js";

const _uniquePerSession = new Set();
const PATH_PREFIX = "Mega";
const ROOT_LOGS = "logs";
const FOLDER_INDEXES = "indexes";
const FOLDER_ENTRIES = "entries";

/* ── internal singletons ───────────────────────────────────── */
let _database = null;
let _initialized = false;
let _initPromise = null;

let _nickname = "?";
let _userId = loadOrCreateUserId();
let _project = PATH_PREFIX; // logical project name
let _server = "UNKNOWN";
let _platform = detectPlatform();
let _seq = 0; // per-session sequence for deterministic logId

/* ===================================================================== */
/*  PUBLIC CONFIGURATION HELPERS                                         */
/* ===================================================================== */

/**
 * Sets nickname that is saved with every log entry.
 * @param {string} [nick=""] - Nickname to associate with log entries.
 * @returns {void}
 */
export function setNickname(nick = "") {
  nick = nick.trim();
  if (nick) _nickname = nick;
}

/**
 * Overrides current userId and persists it to localStorage.
 * @param {string} [id=""] - Custom user identifier.
 * @returns {void}
 */
export function setUserId(id = "") {
  id = id.trim();
  if (id) {
    _userId = id;
    localStorage.setItem("firebaseLogs_userId", id);
  }
}

/* ===================================================================== */
/*  INITIALISE                                                            */
/* ===================================================================== */

/**
 * Initialises Firebase connection for logging.
 * @param {object} firebaseConfig - Firebase configuration object.
 * @param {string} pathPrefix - Logical project key (group for logs).
 * @param {number} [maxRetries=3] - Attempts to init the SDK.
 * @param {number} [retryDelayMs=2000] - Delay between retries in ms.
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function firebaseLogsInit(
  firebaseConfig,
  pathPrefix,
  maxRetries = 3,
  retryDelayMs = 2_000
) {
  if (_initialized) return { ok: true };
  if (_initPromise) return _initPromise;

  if (!firebaseConfig?.apiKey) {
    const err = new Error("firebaseLogsInit: invalid firebaseConfig");
    Log.error(err);
    return { ok: false, error: err };
  }

  _project = (pathPrefix || PATH_PREFIX).trim() || PATH_PREFIX;
  _server = parseSegment(location.href, 1) ?? "UNKNOWN";
  _platform = detectPlatform();

  _initPromise = (async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const app = initializeApp(firebaseConfig, "logsApp");
        _database = getDatabase(app);
        _initialized = true;
        Log.debug("[FirebaseLogs] connected");
        // subscribeOnErrorEvents(); // ← enable if you want automatic capture
        return { ok: true };
      } catch (e) {
        Log.warn(`[FirebaseLogs] init failed (attempt ${attempt})`, e);
        if (attempt === maxRetries) return { ok: false, error: e };
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  })();

  return _initPromise;
}

/* ===================================================================== */
/*  LOGGER OBJECT                                                         */
/* ===================================================================== */

/**
 * Named export (and global fallback) used by other modules.
 */
export const firebaseLogger = {
  /**
   * Sends a log message using the Firebase logger.
   * @param {"INFO"|"WARN"|"ERROR"} level - Log level.
   * @param {{message:string}} payload - Log payload with message.
   * @returns {void}
   */
  log(level, payload) {
    sendLogsToServer(`[${level}] ${payload.message}`);
  },
};
window.firebaseLogger = firebaseLogger; // legacy global for non‑module code

/* ===================================================================== */
/*  CORE SENDER                                                           */
/* ===================================================================== */

/**
 * Sends a single log to RTDB using fan-out to entries and indexes.
 * Performs per-session de-duplication and structures data for efficient reads.
 * @param {string} raw - Raw message string to log.
 * @returns {void}
 */
function sendLogsToServer(raw) {
  if (!_initialized) {
    if (_initPromise) {
      _initPromise.then(() => {
        if (_initialized) sendLogsToServer(raw);
      });
      return;
    }
    return Log.warn("[FirebaseLogs] not initialised:", raw);
  }
  if (!raw?.trim()) return;

  const message = raw;

  // per-session dedupe
  if (_uniquePerSession.has(message)) return;
  _uniquePerSession.add(message);

  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD

  const projectKey = sanitizeKey(_project);
  const serverKey = sanitizeKey(_server);
  const platformKey = sanitizeKey(_platform);
  const userIdKey = sanitizeKey(_userId);

  const seq = _seq++;
  const logId = makeLogId(projectKey, serverKey, platformKey, date, userIdKey, seq);
  const tsKey = String(now).padStart(13, "0");

  const entry = {
    project: projectKey,
    server: serverKey,
    platform: platformKey,
    date,
    userId: _userId,
    seq,
    nickname: _nickname ?? null,
    message,
    ts: now,
  };

  const updates = {};
  // main entry
  updates[`${ROOT_LOGS}/${FOLDER_ENTRIES}/${logId}`] = entry;

  // indexes (date-scoped)
  updates[`${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectDate/${projectKey}/${date}/${logId}`] = true;
  updates[`${ROOT_LOGS}/${FOLDER_INDEXES}/byUserDate/${userIdKey}/${date}/${logId}`] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjSrvPlatDate/${projectKey}/${serverKey}/${platformKey}/${date}/${logId}`
  ] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectUserDate/${projectKey}/${userIdKey}/${date}/${logId}`
  ] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectPlatformDate/${projectKey}/${platformKey}/${date}/${logId}`
  ] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectServerDate/${projectKey}/${serverKey}/${date}/${logId}`
  ] = true;

  // indexes (time-ordered without date dimension)
  updates[`${ROOT_LOGS}/${FOLDER_INDEXES}/byProject/${projectKey}/${tsKey}_${logId}`] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectServer/${projectKey}/${serverKey}/${tsKey}_${logId}`
  ] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectPlatform/${projectKey}/${platformKey}/${tsKey}_${logId}`
  ] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectPlatformTs/${projectKey}/${platformKey}/${tsKey}_${logId}`
  ] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byProjectServerPlatform/${projectKey}/${serverKey}/${platformKey}/${tsKey}_${logId}`
  ] = true;
  updates[
    `${ROOT_LOGS}/${FOLDER_INDEXES}/byUser/${userIdKey}/${tsKey}_${logId}`
  ] = true;

  safeUpdate(updates);
}

/**
 * Performs update(ref(db), updates) with retry and linear backoff.
 * @param {Record<string, unknown>} updates - Multi-path update map.
 * @param {number} [tryCount=0] - Current retry attempt.
 * @returns {Promise<void>}
 */
async function safeUpdate(updates, tryCount = 0) {
  try {
    await update(ref(_database), updates);
  } catch (e) {
    if (tryCount >= 5) {
      Log.error("[FirebaseLogs] update failed permanently", e);
      return;
    }
    const backoff = Math.min(5000, 500 * (tryCount + 1));
    Log.warn(`[FirebaseLogs] update failed, retrying in ${backoff}ms`, e);
    setTimeout(() => safeUpdate(updates, tryCount + 1), backoff);
  }
}

/* ===================================================================== */
/*  OPTIONAL GLOBAL CAPTURE                                              */
/* ===================================================================== */
/**
 * Subscribes to global error events and patches console.error.
 * @returns {void}
 */
function subscribeOnErrorEvents() {
  window.addEventListener("error", (evt) =>
    sendLogsToServer(`Uncaught ${evt.message} at ${evt.filename}:${evt.lineno}`)
  );

  if (!console._patchedByFirebaseLogger) {
    const native = console.error.bind(console);
    console.error = (...args) => {
      native(...args);
      sendLogsToServer(args.map(stringifySafe).join(" "));
    };
    console._patchedByFirebaseLogger = true;
  }
}

/* ===================================================================== */
/*  INTERNAL UTILS                                                       */
/* ===================================================================== */

/**
 * Builds a deterministic, RTDB-safe log identifier from components.
 * @param {string} project
 * @param {string} server
 * @param {string} platform
 * @param {string} date - YYYY-MM-DD
 * @param {string} userIdKey - Sanitized user id
 * @param {number} seq - Per-session sequence number
 * @returns {string}
 */
function makeLogId(project, server, platform, date, userIdKey, seq) {
  return [project, server, platform, date, userIdKey, String(seq)].join("|");
}

/**
 * Sanitizes a string for use as an RTDB key segment.
 * @param {unknown} s
 * @returns {string}
 */
function sanitizeKey(s) {
  return String(s ?? "").replace(/[.#$\[\]]/g, "_");
}

/**
 * Detects current platform string.
 * @returns {string}
 */
function detectPlatform() {
  return navigator.userAgentData?.platform || navigator.platform || "unknown";
}

/**
 * Loads persisted userId or creates a new one and persists it.
 * @returns {string}
 */
function loadOrCreateUserId() {
  const saved = localStorage.getItem("firebaseLogs_userId");
  if (saved) return saved;
  const id =
    crypto?.randomUUID?.() ??
    `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  localStorage.setItem("firebaseLogs_userId", id);
  return id;
}

/**
 * Parses the URL and returns a path segment by index in uppercase.
 * @param {string} url
 * @param {number} idx
 * @returns {string|undefined}
 */
function parseSegment(url, idx) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean)[idx]?.toUpperCase();
  } catch {
    return undefined;
  }
}

/**
 * Stringifies any value safely, guarding against circular references.
 * @param {unknown} v
 * @returns {string}
 */
function stringifySafe(v) {
  if (typeof v !== "object" || v === null) return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "[Circular]";
  }
}
