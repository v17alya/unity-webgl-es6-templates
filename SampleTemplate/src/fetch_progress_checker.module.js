// fetch_progress_checker.module.js
import { Events } from "./analytics_events.module.js?v={{{ PRODUCT_VERSION }}}";
import { sendEvent } from "./amplitude.module.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

const fetchProgressData = {}; // Object to store progress data for each file
let allFilesLoaded = false; // Flag to track whether all files are loaded
let intervalId = null; // Interval ID for periodic actions
const intervalSeconds = 10; // Interval in seconds
const originalFetch = window.fetch; // Save the original fetch function
const reportedErrors = new Set();
const reportedSuccesses = new Set();

// ─── Tracked file definitions ───────────────────────────────────────
const trackedFileConfig = [
  { suffix: ".data.br", name: "DataFile" },
  { suffix: ".wasm.br", name: "WasmFile" },
];

export function stopChecking() {
  if (allFilesLoaded) return;
  sendEvent(Events.Client_Download_Full_All);
  clearInterval(intervalId); // Stop the interval
  allFilesLoaded = true;
  clearProgressData(); // Clear progress data
  restoreOriginalFetch(); // Restore the original fetch function
}

export function startChecking() {
  Log.debug(`startChecking`);

  // Start the interval
  startProgressInterval();

  window.fetch = async (resource, options) => {
    // Log.debug(`window.fetch: ` + resource);

    // Track only .data.br and .wasm.br files
    const { isTrackedFile, name } = getTrackedFileInfo(resource);

    if (isTrackedFile) {
      Log.debug(`Downloading file: ${resource}`);
    }

    try {
      const response = await originalFetch(resource, options);

      if (isTrackedFile && response.body) {
        const clonedResponse = response.clone(); // Clone the response for reading
        const reader = clonedResponse.body.getReader();
        const rawLen = +response.headers.get("content-length");
        const contentLength =
          Number.isFinite(rawLen) && rawLen > 0 ? rawLen : -1;
        let loaded = 0;
        let averageSpeed = 0;
        let elapsedTimeInSeconds = 0;

        // Initialize progress for this file

        if (!fetchProgressData[resource]) {
          initializeProgressEntry(resource, name, contentLength);
        }

        while (true) {
          const { done, value } = await reader.read();

          // Calculate elapsed time since the download started
          const now = performance.now();
          const delta =
            (now - fetchProgressData[resource].lastUpdateTime) / 1000;
          fetchProgressData[resource].intervalTime += delta;
          fetchProgressData[resource].lastUpdateTime = now;
          elapsedTimeInSeconds =
            (now - fetchProgressData[resource].startTime) / 1000;

          if (done) {
            // Update progress in fetchProgressData
            fetchProgressData[resource] = {
              ...fetchProgressData[resource],
              lastUpdateTime: now,
              elapsedTime: elapsedTimeInSeconds,
            };
            break;
          }

          const chunkSize = value.length;
          loaded += chunkSize;

          // // Calculate average download speed in megabytes/second
          // const averageSpeed = elapsedTimeInSeconds > 0 ? (loaded / elapsedTimeInSeconds / 1024 / 1024).toFixed(2) : 0;
          // Calculate average download speed in bytes/second
          // const averageSpeed = elapsedTimeInSeconds > 0 ? (loaded / elapsedTimeInSeconds).toFixed(2) : 0;
          averageSpeed =
            elapsedTimeInSeconds > 0
              ? Math.round(loaded / elapsedTimeInSeconds)
              : 0;

          // Update interval-specific bytes
          fetchProgressData[resource].intervalBytes += chunkSize;

          // Update progress in fetchProgressData
          fetchProgressData[resource] = {
            ...fetchProgressData[resource],
            loaded: loaded, // uncompressed file loaded progress
            lastUpdateTime: now,
            elapsedTime: elapsedTimeInSeconds,
            averageSpeed: averageSpeed,
          };
        }

        reportFileSuccessEntry(fetchProgressData[resource], resource);
        sendProgressData();
      }

      return response;
    } catch (error) {
      // Handle errors during file download
      if (isTrackedFile) {
        markProgressError(
          resource,
          name,
          fetchProgressData[resource]?.totalSize || 0
        );

        // call your helper with a single object that includes resource + the rest
        reportFileErrorEntry(fetchProgressData[resource], resource);

        sendProgressData();
      }
      throw error;
    }
  };
}

// Perform an action every n seconds for all files
function startProgressInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  intervalId = setInterval(() => {
    sendProgressData();
  }, intervalSeconds * 1000);
}

function sendProgressData() {
  Log.debug(`sendProgressData: ` + allFilesLoaded);
  startProgressInterval();
  if (allFilesLoaded) return;

  // Create an array of progress data for all files
  const allProgressData = Object.entries(fetchProgressData).map(
    ([resource, data]) => {
      const progressPercent = data.totalSize
        ? ((data.loaded / data.totalSize) * 100).toFixed(2)
        : "Unknown";

      // // Calculate the average speed for the current interval in MB/s
      // const intervalBytesDownloaded = data.intervalBytes || 0;
      // // const intervalTimeDownloaded = intervalSeconds;
      // const intervalTimeDownloaded = data.intervalTime || 1;
      // const averageSpeedForInterval = Math.round(
      //   intervalBytesDownloaded / intervalTimeDownloaded
      // ); // Convert to byte/s
      // // const averageSpeedForInterval = (intervalBytesDownloaded / intervalTimeDownloaded).toFixed(0); // Convert to byte/s
      // // const averageSpeedForInterval = (intervalBytesDownloaded / intervalTimeDownloaded / 1024 / 1024).toFixed(2); // Convert to MB/s

      // Update the average speed for the interval in fetchProgressData
      fetchProgressData[resource] = {
        ...fetchProgressData[resource],
        intervalBytes: 0, // Reset intervalBytes for the next interval
        intervalTime: 0,
      };

      return {
        resource, // File name
        loaded: data.loaded, // Bytes downloaded
        totalSize: data.totalSize || -1, // Total file size
        averageSpeed: data.averageSpeed,
        // averageSpeed: averageSpeedForInterval, // Speed for this interval
        elapsedTime: data.elapsedTime, // Elapsed time
        progressPercent, // Percentage of progress
        status: data.status, // Status (in-progress, loaded, error)
        name: data.name,
      };
    }
  );

  // Only call someAction if there is progress data
  if (allProgressData.length > 0) {
    someAction(allProgressData);
  } else if (allProgressData.length == 0) return;

  // Collect entries that errored
  const errorEntries = allProgressData.filter((f) => f.status === "error");
  // Check if all files are loaded or encountered an error
  const anyError = errorEntries.length > 0;

  if (anyError) {
    Log.error("Some files have encountered an error.");
    errorEntries.forEach(reportFileErrorEntry);

    stopChecking();
    return;
  }

  // don’t do anything until each tracked suffix has at least one entry
  if (!areAllTrackedFilesPresent()) {
    Log.debug("Waiting for all tracked files to appear...");
    return;
  }

  // Check if all files are loaded or encountered an error
  const allDone = allProgressData.every((file) => file.status === "loaded");

  if (allDone) {
    // after determining allDone…
    Log.debug("All files have finished downloading or encountered an error.");
    stopChecking();
    return;
  }
}

function clearProgressData() {
  Log.debug("Clearing all progress data...");
  reportedErrors.clear();
  for (const resource in fetchProgressData) {
    delete fetchProgressData[resource];
  }
}

function getTotalSize(size) {
  return size == -1 ? "Unknown" : (size / 1024 / 1024).toFixed(4);
}

function getLoadedSize(size) {
  return (size / 1024 / 1024).toFixed(4);
}

function getLoadedSpeed(speed) {
  return (speed / 1024 / 1024).toFixed(4);
}

function getElapsedTime(time) {
  return time > 0 ? time.toFixed(2) : time;
}

function restoreOriginalFetch() {
  Log.debug("Restoring the original fetch function...");
  window.fetch = originalFetch;
}

// Function to process data for all files
function someAction(allProgressData) {
  Log.debug("Action: updating progress for all files");
  const properties = allProgressData.reduce((acc, file, index) => {
    acc[`Full_size_${file.name}`] = getTotalSize(file.totalSize); // compressed file size
    // acc[`Downloaded_Progress_${index + 1}`] = file.progressPercent;
    acc[`Downloaded_${file.name}`] = getLoadedSize(file.loaded); // time of loading+decompressing
    acc[`Time_${file.name}`] = getElapsedTime(file.elapsedTime); // time of loading+decompressing
    acc[`Speed_${file.name}`] = getLoadedSpeed(file.averageSpeed); // speed of loading+decompressing
    return acc;
  }, {});
  sendEvent(Events.Client_Download, properties);
}

/**
 * Reports a download error for one file:
 *  • logs to console
 *  • fires Client_Download_Error
 *  • shows an alert
 *
 * @param {{ name: string,
 *            totalSize: number,
 *            loaded: number,
 *            averageSpeed: number,
 *            elapsedTime: number }} entry
 * @param {string} resource
 */
function reportFileErrorEntry(entry, resource) {
  if (reportedErrors.has(resource)) return;
  reportedErrors.add(resource);

  Log.error(`Error downloading file: ${resource}`);

  sendEvent(Events.Client_Download_Error, {
    Resource: resource,
    Name: entry.name,
    Full_size: getTotalSize(entry.totalSize),
    Downloaded: getLoadedSize(entry.loaded),
    Speed: getLoadedSpeed(entry.averageSpeed),
    Time: getElapsedTime(entry.elapsedTime),
  });

  alert(`Error downloading file: ${resource}\nPlease reload the page.`);
}

/**
 * Reports a successful download for one file:
 *  • logs to console
 *  • fires Client_Download_Full
 *
 * @param {{ name: string,
 *            totalSize: number,
 *            loaded: number,
 *            averageSpeed: number,
 *            elapsedTime: number }} entry
 * @param {string} resource
 */
function reportFileSuccessEntry(entry, resource) {
  Log.always(`Finished downloading file: ${resource}`);

  if (reportedSuccesses.has(resource)) return;
  reportedSuccesses.add(resource);

  // Mark the file as successfully loaded
  entry.status = "loaded";

  sendEvent(Events.Client_Download_Full, {
    Resource: resource,
    Name: entry.name,
    Full_size: getTotalSize(entry.totalSize),
    Downloaded: getLoadedSize(entry.loaded),
    Speed: getLoadedSpeed(entry.averageSpeed),
    Time: getElapsedTime(entry.elapsedTime),
  });
}

// /**
//  * Goes through all tracked files and fires success reports
//  * for those that are loaded but not yet reported.
//  */
// function reportOutstandingSuccesses() {
//   for (const [resource, entry] of Object.entries(fetchProgressData)) {
//     if (entry.status === 'loaded') {
//       reportFileSuccessEntry(entry, resource);
//     }
//   }
// }

/**
 * Determines if a URL is one of our tracked files
 * based on trackedFileConfig, and returns both the boolean and the friendly name.
 */
function getTrackedFileInfo(resource) {
  for (const cfg of trackedFileConfig) {
    if (resource.split("?")[0].endsWith(cfg.suffix)) {
      return { isTrackedFile: true, name: cfg.name };
    }
  }
  return { isTrackedFile: false, name: null };
}

/**
 * Returns true only once we have a progress entry for every
 * suffix listed in trackedFileConfig.
 */
function areAllTrackedFilesPresent() {
  const loadedResources = Object.keys(fetchProgressData);
  return trackedFileConfig.every((cfg) =>
    loadedResources.some((res) => res.split("?")[0].endsWith(cfg.suffix))
  );
}

/**
 * Initialize all the tracking fields for a new file entry.
 *
 * @param {string} resource   – the URL/key of the file
 * @param {string} name       – friendly name, e.g. "DataFile" or "WasmFile"
 * @param {number} totalSize  – compressed file size in bytes
 */
function initializeProgressEntry(resource, name, totalSize) {
  fetchProgressData[resource] = {
    totalSize,
    loaded: 0,
    startTime: performance.now(),
    lastUpdateTime: performance.now(),
    averageSpeed: 0,
    elapsedTime: 0,
    intervalBytes: 0,
    intervalTime: 0,
    status: "in-progress",
    name: name,
  };
}

/**
 * Mark a file’s entry as errored—initializing it first if missing.
 *
 * @param {string} resource   – the URL/key of the file
 * @param {string} name       – friendly name, e.g. "DataFile" or "WasmFile"
 * @param {number} totalSize  – compressed file size in bytes (optional)
 */
function markProgressError(resource, name, totalSize = 0) {
  // if there's no entry yet, create one with defaults
  if (!fetchProgressData[resource]) {
    initializeProgressEntry(resource, name, totalSize);
  }
  // then mark it as an error
  fetchProgressData[resource].status = "error";
}
