const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

router.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log("Received webhook event:", event.type, "ID:", event.id);
    } catch (err) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object;
        const { name, email, company, assets, duration, pricing } = pi.metadata;
        console.log("Webhook metadata:", pi.metadata);
        console.log("Payment Intent ID:", pi.id);

        // Validate metadata
        if (!email || !company || !assets || !duration || !pricing) {
          console.error("❌ Missing metadata in webhook:", pi.metadata);
          return res
            .status(400)
            .json({ received: false, message: "Missing metadata" });
        }

        // Validate pricing (in USD)
        const assetCount = parseInt(assets) || 0;
        const months = parseInt(duration) || 1;
        const basePrice = assetCount === 5 ? 50 : assetCount * 10; // $50 for 1-5 devices, $10 per asset otherwise
        const total = basePrice * months;
        const discount = months >= 12 ? 0.2 : months >= 6 ? 0.1 : 0;
        const expectedPrice = Math.max(total * (1 - discount), 0.5); // Enforce minimum $0.50
        if (Math.abs(expectedPrice - parseFloat(pricing)) > 0.01) {
          console.error("❌ Price mismatch:", {
            expectedPrice,
            received: pricing,
          });
          return res
            .status(400)
            .json({ received: false, message: "Price mismatch" });
        }

        // Update user
        const user = await User.findOneAndUpdate(
          { paymentIntentId: pi.id },
          { paymentStatus: "succeeded" },
          { new: true }
        );

        if (!user) {
          console.error("❌ User not found for paymentIntentId:", pi.id);
          return res
            .status(400)
            .json({ received: false, message: "User not found" });
        }

        console.log("💰 Payment succeeded & user updated:", user._id);
      } else if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object;
        console.log("Payment failed for Payment Intent ID:", pi.id);
        const user = await User.findOneAndUpdate(
          { paymentIntentId: pi.id },
          { paymentStatus: "failed" },
          { new: true }
        );

        if (!user) {
          console.error("❌ User not found for paymentIntentId:", pi.id);
          return res
            .status(400)
            .json({ received: false, message: "User not found" });
        }

        console.log("❌ Payment failed & user updated:", user._id);
      } else {
        console.log("Unhandled event type:", event.type);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("❌ Webhook processing error:", error.message);
      return res.status(500).json({
        received: false,
        message: "Server error during webhook processing",
        error: error.message,
      });
    }
  }
);

module.exports = router;
