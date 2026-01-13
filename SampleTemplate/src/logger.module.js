/* logger.module.js
 * ------------------------------------------------------------
 * Simple console wrapper with log level filtering.
 * ---------------------------------------------------------- */
import { LOG_LEVEL } from "./config.module.js?v={{{ PRODUCT_VERSION }}}";

/**
 * Log levels matching Unity's Gamenator.Core.Logging.LogLevel
 */
const LogLevel = {
  /** All messages will be logged */
  All: 0,
  /** Only Information and above will be logged */
  Information: 1,
  /** Only Warning and above will be logged */
  Warning: 2,
  /** Only Error and above will be logged */
  Error: 3,
  /** Only Exception will be logged */
  Exception: 4,
  /** No logging will occur */
  None: 5
};

class Logger {
  constructor() {
    this.currentLevel = LOG_LEVEL;
    this.setLogLevel(LOG_LEVEL);
    this.showStackTrace = false;
  }

  /**
   * Set the current log level
   * @param {number} level - The log level to set
   */
  setLogLevel(level) {
    this.currentLevel = level;
  }

  /**
   * Check if a log level should be output
   * @param {number} level - The level to check
   * @returns {boolean} - Whether the level should be logged
   */
  shouldLog(level) {
    return level >= this.currentLevel;
  }

  /**
   * Set whether to show stack traces
   * @param {boolean} show - Whether to show stack traces
   */
  setShowStackTrace(show) {
    this.showStackTrace = show;
  }

  /**
   * Get current stack trace
   * @returns {string} - Formatted stack trace
   */
  getStackTrace() {
    const error = new Error();
    return error.stack
      .split('\n')
      .slice(2) // Remove Error constructor and this function
      .map(line => line.trim())
      .join('\n');
  }

  /**
   * Enhanced logging with optional stack trace
   * @param {Function} consoleMethod - Console method to use (console.log, console.debug, etc.)
   * @param {boolean} showStackTrace - Whether to show stack trace
   * @param {...any} args - Arguments to log
   */
  _logWithStackTrace(consoleMethod, showStackTrace, ...args) {
    if (showStackTrace) {
      // Methods that already have stack trace by default
      const methodsWithDefaultStackTrace = [console.error, console.warn];
      
      if (methodsWithDefaultStackTrace.includes(consoleMethod)) {
        // For methods that already have stack trace, just log normally
        consoleMethod(...args);
      } else {
        // For methods without default stack trace, use groupCollapsed with the message
        console.groupCollapsed(...args);
        console.trace();
        console.groupEnd();
      }
    } else {
      consoleMethod(...args);
    }
  }

  /** Always logged (prod & dev) */
  always(...args) {
    this._logWithStackTrace(console.log, this.showStackTrace, ...args);
  }

  /** Always logged (prod & dev) */
  log(...args) {
    this._logWithStackTrace(console.log, this.showStackTrace, ...args);
  }

  /** Debug messages */
  debug(...args) {
    if (this.shouldLog(LogLevel.All)) {
      this._logWithStackTrace(console.debug, this.showStackTrace, ...args);
    }
  }

  /** Informational messages */
  info(...args) {
    if (this.shouldLog(LogLevel.Information)) {
      this._logWithStackTrace(console.info, this.showStackTrace, ...args);
    }
  }

  /** Warning messages */
  warn(...args) {
    if (this.shouldLog(LogLevel.Warning)) {
      this._logWithStackTrace(console.warn, this.showStackTrace, ...args);
    }
  }

  /** Error messages */
  error(...args) {
    if (this.shouldLog(LogLevel.Error)) {
      // If first argument is already an Error, use it as-is
      if (args.length > 0 && args[0] instanceof Error) {
        console.error(...args);
      } else {
        this._logWithStackTrace(console.error, this.showStackTrace, ...args);
      }
    }
  }

  /** Exception level logging */
  exception(...args) {
    if (this.shouldLog(LogLevel.Exception)) {
      // If first argument is already an Error, use it as-is
      if (args.length > 0 && args[0] instanceof Error) {
        console.error('[EXCEPTION]', ...args);
      } else {
        this._logWithStackTrace(console.error, this.showStackTrace, '[EXCEPTION]', ...args);
      }
    }
  }

  /**
   * Log with specific level
   * @param {number} level - The log level
   * @param {...any} args - Arguments to log
   */
  logWithLevel(level, ...args) {
    if (!this.shouldLog(level)) return;

    switch (level) {
      case LogLevel.All:
        this.debug(...args);
        break;
      case LogLevel.Information:
        this.info(...args);
        break;
      case LogLevel.Warning:
        this.warn(...args);
        break;
      case LogLevel.Error:
        this.error(...args);
        break;
      case LogLevel.Exception:
        this.exception(...args);
        break;
      default:
        this.log(...args);
    }
  }
}

export const Log = new Logger();
export { LogLevel };

/* Global fallbacks */
// window.Log = Log;
window.UnityWebGLApp = window.UnityWebGLApp || {};
window.UnityWebGLApp.Log = Log;
window.UnityWebGLApp.LogLevel = LogLevel;
