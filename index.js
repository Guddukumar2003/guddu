const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const authRouter = require("./routes/auth");
const stripeWebhookRouter = require("./routes/stripeWebhook");

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));

// Webhook must be before express.json() for raw body
app.use("/api/stripe-webhook", stripeWebhookRouter);

// Other routes use JSON parsing
app.use(express.json());

// Debug incoming requests
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  next();
});

app.use("/api", authRouter);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Catch-all route for debugging
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    requestedPath: req.path,
    method: req.method,
    availableRoutes: ["POST /api/register", "POST /api/stripe-webhook"],
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
