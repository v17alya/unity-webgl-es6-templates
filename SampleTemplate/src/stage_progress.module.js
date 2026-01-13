/* stage_progress.module.js
 * Helper to pre-register bootstrap stages and mark completion with logs,
 * updating a provided progress setter with fraction [0..1].
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/**
 * Creates a stage-progress orchestrator that:
 * - allows registering named tasks (stages) with executors
 * - logs start/success/error per stage
 * - updates a provided progress setter with fraction [0..1]
 * - can execute registered tasks sequentially
 *
 * @param {(v:number)=>void} setProgressFn Setter receiving [0..1]
 */
export function createStageProgress(setProgressFn, options = {}) {
  const { onStageError } = options || {};
  const registered = new Set();
  const completed = new Set();
  const tasks = [];
  let frozen = false;

  /**
   * Registers a stage without binding an executor.
   * @param {string} stageName
   */
  function register(stageName) {
    if (frozen) {
      Log.warn(`[PROGRESS] register called after freeze: ${stageName}`);
      return;
    }
    registered.add(stageName);
  }

  /**
   * Freezes stage registration and logs the plan.
   */
  function freeze() {
    frozen = true;
  }

  /**
   * Marks a stage as completed with success/error and updates progress.
   * @param {string} stageName
   * @param {boolean} success
   * @param {any} [extra]
   */
  function mark(stageName, success, extra) {
    if (!registered.has(stageName)) {
      Log.warn(`[PROGRESS] mark on unregistered stage: ${stageName}`);
      registered.add(stageName);
    }
    if (completed.has(stageName)) {
      Log.warn(`[PROGRESS] stage already marked: ${stageName}`);
      return;
    }
    completed.add(stageName);
    const total = registered.size;
    const done = completed.size;
    try { setProgressFn(done / total); } catch {}
    const msg = `[PROGRESS] Stage ${stageName}: ${success ? "SUCCESS" : "ERROR"} (${done}/${total})`;
    if (success) {
      Log.always(msg);
    } else {
      Log.error(msg);
    }
    if (extra) {
      try { Log.debug(`[PROGRESS] ${stageName} details:`, extra); } catch {}
    }
  }

  /**
   * Registers a stage with an executor function (sync or async).
   * @param {string} stageName
   * @param {() => (void|Promise<void>)} executor
   */
  function registerTask(stageName, executor) {
    register(stageName);
    tasks.push({ stageName, executor });
  }

  /**
   * Executes all registered tasks sequentially, marking results.
   */
  async function runSequentially() {
    for (const { stageName, executor } of tasks) {
      try {
        const res = executor?.();
        if (res && typeof res.then === "function") await res;
        mark(stageName, true);
      } catch (err) {
        mark(stageName, false, err);
        try { onStageError && onStageError(stageName, err); } catch {}
        return { ok: false, stage: stageName, error: err };
      }
    }
    return { ok: true };
  }

  return { register, freeze, mark, registerTask, runSequentially };
}


