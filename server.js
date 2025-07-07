// 1. First check your server.js file - Make sure routes are properly imported
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

const app = express();

// CORS configuration
const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("❌ CORS error: Origin not allowed:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Stripe Webhook Route First (raw body needed!)
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  require("./routes/stripeWebhook") // make sure it's exporting a function, not router
);

// Middleware
app.use(express.json());

// Connect MongoDB
connectDB();

// ADD DEBUG MIDDLEWARE TO LOG ALL REQUESTS
app.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// Routes - Make sure these paths match your file structure
try {
  app.use("/api", require("./routes/auth"));
  console.log("✅ Auth routes loaded");
} catch (error) {
  console.error("❌ Error loading auth routes:", error.message);
}

try {
  app.use("/api", require("./routes/survey"));
  console.log("✅ Survey routes loaded");
} catch (error) {
  console.error("❌ Error loading survey routes:", error.message);
}

// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Add a test route to verify server is working
app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working",
    timestamp: new Date().toISOString(),
    availableRoutes: [
      "GET /api/test",
      "POST /api/customer-survey",
      "GET /api/customer-surveys",
      "GET /api/customer-survey/:id",
      "PUT /api/customer-survey/:id",
      "DELETE /api/customer-survey/:id",
      "GET /api/customer-surveys/search",
    ],
  });
});

// 404 Handler - This should be AFTER all routes
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    message: "Route not found",
    requestedPath: req.path,
    method: req.method,
    availableRoutes: [
      "GET /",
      "GET /api/test",
      "POST /api/customer-survey",
      "GET /api/customer-surveys",
    ],
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  res
    .status(500)
    .json({ message: "Internal server error", error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Test your API at: http://localhost:${PORT}/api/test`);
});

// Handle exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  server.close(() => process.exit(1));
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});

// ===========================================
// 2. Test your routes with these cURL commands:
// ===========================================

/*
// Test server health:
curl http://localhost:5000/

// Test API endpoint:
curl http://localhost:5000/api/test

// Test POST customer survey:
curl -X POST http://localhost:5000/api/customer-survey \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "company_name": "ABC Corp",
    "designation": "Manager",
    "email": "john@abc.com",
    "mobile": "9876543210",
    "questions": ["How many assets?", "Project duration?"],
    "answers": ["20", "1 month"]
  }'

// Test GET all surveys:
curl http://localhost:5000/api/customer-surveys
*/

// ===========================================
// 3. Common Issues & Solutions:
// ===========================================

/*
ISSUE 1: File path wrong
- Make sure your routes files are in ./routes/ folder
- Check file names: auth.js, survey.js (case sensitive)

ISSUE 2: Route order wrong
- Make sure specific routes come before generic ones
- 404 handler should be LAST

ISSUE 3: Missing middleware
- express.json() should be before routes
- CORS should be before routes

ISSUE 4: Database connection
- Make sure MongoDB is running
- Check connection string in .env file

ISSUE 5: Port already in use
- Change PORT in .env file
- Or kill process: pkill -f node
*/

module.exports = app;
