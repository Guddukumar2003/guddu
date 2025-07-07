const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

router.post("/register", async (req, res) => {
  try {
    const { name, email, company, assets, duration, pricing } = req.body;
    console.log("Received /api/register request:", req.body);

    // Validation
    if (!email || !company || !assets || !duration || !pricing) {
      console.error("Missing required fields:", {
        email,
        company,
        assets,
        duration,
        pricing,
      });
      return res.status(400).json({
        message: "Required fields: email, company, assets, duration, pricing",
        success: false,
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email:", email);
      return res.status(400).json({
        message: "Please enter a valid email address",
        success: false,
      });
    }

    // Parse and validate inputs
    const assetCount = parseInt(assets) || 0;
    const months = parseInt(duration) || 1;
    if (assetCount <= 0 || months <= 0) {
      console.error("Invalid assets or duration:", { assets, duration });
      return res.status(400).json({
        message: "Assets and duration must be positive numbers",
        success: false,
      });
    }

    // Validate pricing (in USD)
    const basePrice = assetCount === 5 ? 50 : assetCount * 10; // $50 for 1-5 devices, $10 per asset otherwise
    const total = basePrice * months;
    const discount = months >= 12 ? 0.2 : months >= 6 ? 0.1 : 0;
    const expectedPrice = Math.max(total * (1 - discount), 0.5); // Enforce minimum $0.50
    if (Math.abs(expectedPrice - parseFloat(pricing)) > 0.01) {
      console.error("Pricing mismatch:", { expectedPrice, received: pricing });
      return res.status(400).json({
        message: `Invalid pricing amount. Expected: ${expectedPrice.toFixed(
          2
        )}, Received: ${pricing}`,
        success: false,
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error("User already exists:", email);
      return res.status(400).json({
        message: "User with this email already exists",
        success: false,
      });
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(pricing) * 100), // Amount in cents
      currency: "usd",
      payment_method_types: ["card"], // Use card only until UPI is enabled
      metadata: { name, email, company, assets, duration, pricing },
    });

    // Save user with pending status
    const newUser = new User({
      name: name || undefined,
      email,
      company,
      assets,
      duration,
      pricing,
      paymentIntentId: paymentIntent.id,
      paymentStatus: "pending",
    });

    await newUser.save();
    console.log(
      "✅ User saved with pending status:",
      newUser._id,
      "Payment Intent ID:",
      paymentIntent.id
    );

    return res.status(201).json({
      message: "Proceed to payment",
      success: true,
      clientSecret: paymentIntent.client_secret,
      userId: newUser._id,
      data: { email, company, assets, duration, pricing },
    });
  } catch (error) {
    console.error("❌ Registration error:", error.message);
    return res.status(500).json({
      message: "Server error during registration",
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
