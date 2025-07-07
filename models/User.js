const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    company: { type: String, required: true, trim: true },
    assets: { type: String, required: true },
    duration: { type: String, required: true },
    pricing: { type: String, required: true },
    paymentIntentId: { type: String },
    paymentStatus: { type: String, default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
