const express = require("express");
const { getTips } = require("../controllers/tipController");

const router = express.Router();

router.get("/", getTips);

module.exports = router;
