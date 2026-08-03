// Placeholder integration layer for Google Fit.
//
// Not implemented yet — this file exists so the future OAuth + sync flow has
// an obvious home without touching the controller/route layer or the
// StepEntry schema. When ready, this typically becomes:
//   1. OAuth2 flow (google-auth-library) to get a user access/refresh token,
//      stored on the User model (e.g. `googleFitRefreshToken`).
//   2. A call to the Google Fit REST API's
//      `users.dataset.aggregate` endpoint for the `com.google.step_count.delta`
//      data type, for a given date range.
//   3. Upserting the results into StepEntry with source: "google_fit",
//      which the existing streak/points logic in stepController.js already
//      handles the same way as sensor-sourced steps.

async function syncStepsFromGoogleFit(/* userId */) {
  const err = new Error(
    "Google Fit sync is not connected yet. Set up OAuth credentials and implement this function to enable it."
  );
  err.status = 501;
  throw err;
}

module.exports = { syncStepsFromGoogleFit };
