const QRCode = require("qrcode");
const User = require("../models/User");
const { getAccountBalance } = require("../services/stacksService");

// Very loose validation — full c32check validation is left to the wallet/API,
// this just guards against obviously malformed input.
const isLikelyStacksAddress = (addr) => /^S[PT][0-9A-Z]{38,39}$/.test(addr || "");

// @desc  Get own profile
// @route GET /api/profile
const getProfile = async (req, res) => {
  res.json({ user: req.user });
};

// @desc  Update health profile
// @route PUT /api/profile
const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      "firstName",
      "lastName",
      "otherNames",
      "age",
      "bloodGroup",
      "genotype",
      "allergies",
      "medicalConditions",
      "emergencyContact",
      "walletAddress",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ user });
  } catch (err) {
    res.status(400).json({ message: "Update failed", error: err.message });
  }
};

// @desc  Upload / replace profile picture
// @route PUT /api/profile/picture
const updateProfilePicture = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profilePicture: fileUrl },
    { new: true }
  );
  res.json({ user });
};

// @desc  Get emergency QR code (as data URL image) for the logged-in user
// @route GET /api/profile/qr
const getEmergencyQr = async (req, res) => {
  try {
    const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:3000";
    const emergencyUrl = `${baseUrl}/emergency.html?id=${req.user.qrCodeId}`;
    const qrDataUrl = await QRCode.toDataURL(emergencyUrl);
    res.json({ qrDataUrl, emergencyUrl });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate QR code", error: err.message });
  }
};

// @desc  Public lookup of emergency info by QR code id (no auth — for first responders)
// @route GET /api/profile/emergency/:qrCodeId
const getPublicEmergencyInfo = async (req, res) => {
  const user = await User.findOne({ qrCodeId: req.params.qrCodeId }).select(
    "firstName lastName otherNames bloodGroup genotype allergies medicalConditions emergencyContact"
  );
  if (!user) return res.status(404).json({ message: "Record not found" });
  res.json({ info: user });
};

// @desc  Connect / update the user's Stacks wallet address
// @route PUT /api/profile/wallet
const connectWallet = async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress || !isLikelyStacksAddress(walletAddress)) {
    return res.status(400).json({ message: "A valid Stacks address is required" });
  }

  const taken = await User.findOne({ walletAddress, _id: { $ne: req.user._id } });
  if (taken) {
    return res.status(409).json({ message: "This wallet is already linked to another account" });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { walletAddress },
    { new: true }
  );
  res.json({ user });
};

// @desc  Disconnect the user's Stacks wallet
// @route DELETE /api/profile/wallet
const disconnectWallet = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { walletAddress: null },
    { new: true }
  );
  res.json({ user });
};

// @desc  Get the connected wallet's testnet STX balance
// @route GET /api/profile/wallet/balance
const getWalletBalance = async (req, res) => {
  if (!req.user.walletAddress) {
    return res.status(400).json({ message: "No wallet connected" });
  }
  try {
    const balance = await getAccountBalance(req.user.walletAddress);
    res.json({ balance });
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || "Failed to fetch balance" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateProfilePicture,
  getEmergencyQr,
  getPublicEmergencyInfo,
  connectWallet,
  disconnectWallet,
  getWalletBalance,
};
