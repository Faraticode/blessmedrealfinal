// Automatic step tracking using the device's accelerometer (DeviceMotion).
// This is a real, working pedometer — no manual entry required — that runs
// while the tracking page/tab is open. It's a placeholder for whatever
// sensor is available today; when Google Fit is connected later, its steps
// become just another `source` value written to the same StepEntry model,
// so nothing else in the app needs to change.
//
// Algorithm: simple peak detection on the magnitude of acceleration
// (including gravity). A step is counted when magnitude crosses above a
// threshold after being below it, with a minimum interval between steps to
// avoid double-counting a single footfall.

const STEP_THRESHOLD = 11.5; // m/s^2 — tuned for a phone held/in-pocket; adjust per device
const MIN_STEP_INTERVAL_MS = 300;
const SYNC_INTERVAL_MS = 15 * 1000;
const LOCAL_STEPS_KEY = "blessmed_local_steps"; // { date, count }

let listening = false;
let lastStepAt = 0;
let aboveThreshold = false;
let sessionSteps = 0; // steps counted since tracking started this page load
let syncTimer = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadLocalSteps() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_STEPS_KEY) || "{}");
    return raw.date === todayKey() ? raw.count : 0;
  } catch {
    return 0;
  }
}

function saveLocalSteps(count) {
  localStorage.setItem(LOCAL_STEPS_KEY, JSON.stringify({ date: todayKey(), count }));
}

function handleMotion(event) {
  const acc = event.accelerationIncludingGravity;
  if (!acc || acc.x === null) return;

  const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
  const now = Date.now();

  if (magnitude > STEP_THRESHOLD && !aboveThreshold && now - lastStepAt > MIN_STEP_INTERVAL_MS) {
    aboveThreshold = true;
    lastStepAt = now;
    sessionSteps += 1;
    const total = loadLocalSteps() + 1;
    saveLocalSteps(total);
    onStepCounted?.(total);
  } else if (magnitude < STEP_THRESHOLD - 1) {
    aboveThreshold = false; // reset so the next crossing counts as a new step
  }
}

/**
 * Requests motion permission (required on iOS 13+) and starts listening.
 * Must be called from a user gesture (e.g. a button click) on iOS.
 */
async function startStepTracking({ onStep, onError } = {}) {
  onStepCounted = onStep;

  if (typeof DeviceMotionEvent === "undefined") {
    onError?.(new Error("This device/browser doesn't support motion sensors."));
    return false;
  }

  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") {
        onError?.(new Error("Motion sensor permission was denied."));
        return false;
      }
    } catch (err) {
      onError?.(err);
      return false;
    }
  }

  window.addEventListener("devicemotion", handleMotion);
  listening = true;

  // Sync accumulated steps to the server periodically.
  syncTimer = setInterval(syncStepsToServer, SYNC_INTERVAL_MS);
  syncStepsToServer(); // initial sync of whatever's already stored today

  return true;
}

function stopStepTracking() {
  window.removeEventListener("devicemotion", handleMotion);
  listening = false;
  if (syncTimer) clearInterval(syncTimer);
  syncStepsToServer(); // final sync on stop
}

async function syncStepsToServer() {
  const steps = loadLocalSteps();
  if (steps === 0) return null;
  try {
    return await apiRequest("/steps/today", { method: "PUT", body: { steps, source: "sensor" } });
  } catch {
    return null; // fail silently on a background sync; UI polls /summary separately
  }
}

let onStepCounted = null;

window.BlessMedSteps = {
  startStepTracking,
  stopStepTracking,
  syncStepsToServer,
  isTracking: () => listening,
  getLocalSteps: loadLocalSteps,
};
