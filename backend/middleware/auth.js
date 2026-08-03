const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Fields that must never ride along on req.user, no matter which route
// handler reads it — including ones we haven't migrated to Postgres yet.
const stripSensitive = (user) => {
  if (!user) return user;
  delete user.password;
  delete user.otpCode;
  delete user.otpExpiresAt;
  return user;
};

// Protects routes: verifies JWT and attaches req.user
const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = stripSensitive(await User.findById(decoded.id));
    if (!req.user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
};

module.exports = { protect };
