/**
 * Simple console wrapper with log level filtering.
 * Log levels match Unity's common logging patterns.
 */
import { LOG_LEVEL } from "./config.module.js?v={{{ PRODUCT_VERSION }}}";

const LogLevel = {
  All: 0,
  Information: 1,
  Warning: 2,
  Error: 3,
  Exception: 4,
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
   * @param {number} level - The log level to set (0-5)
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

  getStackTrace() {
    const error = new Error();
    return error.stack
      .split('\n')
      .slice(2)
      .map(line => line.trim())
      .join('\n');
  }

  _logWithStackTrace(consoleMethod, showStackTrace, ...args) {
    if (showStackTrace) {
      const methodsWithDefaultStackTrace = [console.error, console.warn];
      
      if (methodsWithDefaultStackTrace.includes(consoleMethod)) {
        consoleMethod(...args);
      } else {
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
      if (args.length > 0 && args[0] instanceof Error) {
        console.error('[EXCEPTION]', ...args);
      } else {
        this._logWithStackTrace(console.error, this.showStackTrace, '[EXCEPTION]', ...args);
      }
    }
  }
}

export const Log = new Logger();
export { LogLevel };
