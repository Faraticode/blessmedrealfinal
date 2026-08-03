import { useCallback, useRef, useState } from "react";
import { apiRequest } from "../lib/api";

// Automatic step tracking using the device's accelerometer (DeviceMotion).
// Real, working pedometer — no manual entry — that runs while this page is
// open. Placeholder for whatever sensor is available today; when Google
// Fit is connected later its steps become just another `source` value on
// the same StepEntry model, so nothing else needs to change.
//
// Algorithm: simple peak detection on acceleration magnitude (including
// gravity). A step counts when magnitude crosses above a threshold after
// being below it, with a minimum interval to avoid double-counting.

const STEP_THRESHOLD = 11.5; // m/s^2 — tuned for a phone held/in-pocket
const MIN_STEP_INTERVAL_MS = 300;
const SYNC_INTERVAL_MS = 15 * 1000;
const LOCAL_STEPS_KEY = "blessmed_local_steps"; // { date, count }

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

async function syncStepsToServer() {
  const steps = loadLocalSteps();
  if (steps === 0) return null;
  try {
    return await apiRequest("/steps/today", { method: "PUT", body: { steps, source: "sensor" } });
  } catch {
    return null; // fail silently on a background sync
  }
}

export function useStepTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const lastStepAt = useRef(0);
  const aboveThreshold = useRef(false);
  const syncTimer = useRef(null);
  const onStepRef = useRef(null);

  const handleMotion = useCallback((event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null) return;

    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const now = Date.now();

    if (magnitude > STEP_THRESHOLD && !aboveThreshold.current && now - lastStepAt.current > MIN_STEP_INTERVAL_MS) {
      aboveThreshold.current = true;
      lastStepAt.current = now;
      const total = loadLocalSteps() + 1;
      saveLocalSteps(total);
      onStepRef.current?.(total);
    } else if (magnitude < STEP_THRESHOLD - 1) {
      aboveThreshold.current = false;
    }
  }, []);

  const start = useCallback(
    async ({ onStep } = {}) => {
      onStepRef.current = onStep;

      if (typeof DeviceMotionEvent === "undefined") {
        throw new Error("This device/browser doesn't support motion sensors.");
      }

      if (typeof DeviceMotionEvent.requestPermission === "function") {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== "granted") {
          throw new Error("Motion sensor permission was denied.");
        }
      }

      window.addEventListener("devicemotion", handleMotion);
      setIsTracking(true);

      syncTimer.current = setInterval(syncStepsToServer, SYNC_INTERVAL_MS);
      syncStepsToServer();
    },
    [handleMotion]
  );

  const stop = useCallback(() => {
    window.removeEventListener("devicemotion", handleMotion);
    setIsTracking(false);
    if (syncTimer.current) clearInterval(syncTimer.current);
    return syncStepsToServer();
  }, [handleMotion]);

  return { isTracking, start, stop, getLocalSteps: loadLocalSteps };
}
