const crypto = require("crypto");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { sendOtpEmail } = require("../services/emailService");

const OTP_EXPIRY_MINUTES = 10;

const generateOtp = () => String(crypto.randomInt(100000, 999999)); // 6-digit code

// @desc  Register new user — creates a verified account and logs them straight in.
//        OTP email verification is disabled for now (Render free tier blocks SMTP).
// @route POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { firstName, lastName, otherNames, email, password, walletAddress } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "First name, last name, email and password are required",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Email verification is temporarily disabled: Render's free tier blocks
    // outbound SMTP (ports 25/465/587), so nodemailer can never reach Gmail
    // from there. Accounts are auto-verified at signup instead. To bring
    // OTP verification back, restore the otp/otpExpiresAt fields below,
    // set isVerified back to false, and re-add the sendOtpEmail call
    // (ideally switched to an HTTP-based provider like Resend/SendGrid,
    // since SMTP won't work on Render's free tier regardless).
    const user = await User.create({
      firstName,
      lastName,
      otherNames: otherNames || "",
      email,
      password,
      walletAddress: walletAddress || null,
      qrCodeId: crypto.randomBytes(8).toString("hex"),
      isVerified: true,
    });

    const token = generateToken(user._id);
    user.password = undefined;

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
};

// @desc  Verify email with the OTP sent at signup (or resend)
// @route POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+otpCode +otpExpiresAt"
    );
    if (!user) {
      return res.status(404).json({ message: "No account found for this email" });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: "This account is already verified" });
    }
    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Code expired. Please request a new one." });
    }
    if (user.otpCode !== otp) {
      return res.status(400).json({ message: "Incorrect code" });
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = generateToken(user._id);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ message: "Verification failed", error: err.message });
  }
};

// @desc  Resend a fresh OTP to an unverified account
// @route POST /api/auth/resend-otp
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "No account found for this email" });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: "This account is already verified" });
    }

    const otp = generateOtp();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await user.save();

    await sendOtpEmail({ to: user.email, otp, firstName: user.firstName });

    res.json({ message: "A new code has been sent to your email." });
  } catch (err) {
    res.status(500).json({ message: "Could not resend code", error: err.message });
  }
};

// @desc  Login user
// @route POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        notVerified: true,
        email: user.email,
      });
    }

    const token = generateToken(user._id);
    user.password = undefined;
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// @desc  Get logged in user
// @route GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { signup, verifyOtp, resendOtp, login, getMe };
