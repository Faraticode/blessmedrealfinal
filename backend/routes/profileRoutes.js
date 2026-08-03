const express = require("express");
const {
  getProfile,
  updateProfile,
  updateProfilePicture,
  getEmergencyQr,
  getPublicEmergencyInfo,
  connectWallet,
  disconnectWallet,
  getWalletBalance,
} = require("../controllers/profileController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Public route (for emergency responders scanning the QR code) — must come before protect-all
router.get("/emergency/:qrCodeId", getPublicEmergencyInfo);

router.get("/", protect, getProfile);
router.put("/", protect, updateProfile);
router.put("/picture", protect, upload.single("picture"), updateProfilePicture);
router.get("/qr", protect, getEmergencyQr);

router.put("/wallet", protect, connectWallet);
router.delete("/wallet", protect, disconnectWallet);
router.get("/wallet/balance", protect, getWalletBalance);

module.exports = router;
