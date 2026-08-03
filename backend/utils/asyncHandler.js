// Wraps a route handler so a rejected promise (e.g. a Mongoose query with no
// Mongo connection to talk to) sends a clean response instead of leaving the
// request hanging or crashing the process. Delete this once every route is
// migrated off Mongoose and this is no longer needed.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (res.headersSent) return next(err);
    res.status(503).json({
      message: "This feature is still running on the old database and isn't available yet.",
      error: err.message,
    });
  });
};

module.exports = asyncHandler;
