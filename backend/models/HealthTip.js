const mongoose = require("mongoose");

const healthTipSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["nutrition", "exercise", "mental_wellness"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HealthTip", healthTipSchema);
