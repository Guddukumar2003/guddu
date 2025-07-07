const express = require("express");
const router = express.Router();
const CustomerSurvey = require("../models/CustomerSurvey");

router.post("/customer-survey", async (req, res) => {
  try {
    console.log("📋 Survey data received:", req.body);

    const {
      name, // Optional field
      company_name,
      designation,
      email,
      mobile,
      url,
      questions,
      answers,
      // Support for legacy questions_answers format
      questions_answers,
    } = req.body;

    // Handle both formats - new (questions, answers) and legacy (questions_answers)
    let processedQuestions = questions;
    let processedAnswers = answers;

    // If legacy format is used, convert it
    if (questions_answers && Array.isArray(questions_answers)) {
      processedQuestions = questions_answers.map((qa) => qa.question);
      processedAnswers = questions_answers.map((qa) => qa.answer ?? "");
    }

    // Validation for required fields (excluding name)
    if (
      !company_name ||
      !designation ||
      !email ||
      !mobile ||
      (!processedQuestions && !processedAnswers)
    ) {
      return res.status(400).json({
        message:
          "Required fields: company_name, designation, email, mobile, questions, answers",
        success: false,
      });
    }

    // Validate questions and answers arrays
    if (!Array.isArray(processedQuestions) || processedQuestions.length === 0) {
      return res.status(400).json({
        message: "questions must be a non-empty array",
        success: false,
      });
    }

    if (!Array.isArray(processedAnswers) || processedAnswers.length === 0) {
      return res.status(400).json({
        message: "answers must be a non-empty array",
        success: false,
      });
    }

    // Check if questions and answers arrays have same length
    if (processedQuestions.length !== processedAnswers.length) {
      return res.status(400).json({
        message: "Number of questions and answers must be equal",
        success: false,
      });
    }

    // Validate each question (answers can be empty or null)
    for (let i = 0; i < processedQuestions.length; i++) {
      if (!processedQuestions[i]) {
        return res.status(400).json({
          message: `Question is required for item ${i + 1}`,
          success: false,
        });
      }
      // Normalize null answers to empty strings
      processedAnswers[i] = processedAnswers[i] ?? "";
    }

    // Check if email already exists
    const existingCustomer = await CustomerSurvey.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({
        message: "Customer with this email already exists",
        success: false,
      });
    }

    // Create new customer survey
    const newCustomerSurvey = new CustomerSurvey({
      name: name || undefined,
      company_name,
      designation,
      email,
      mobile,
      url: url || "",
      questions: processedQuestions,
      answers: processedAnswers,
    });

    // Save to database
    const savedSurvey = await newCustomerSurvey.save();

    console.log("✅ Customer survey saved to database:", savedSurvey._id);

    return res.status(201).json({
      message: "Customer survey submitted successfully",
      success: true,
      data: {
        id: savedSurvey._id,
        name: savedSurvey.name,
        company_name: savedSurvey.company_name,
        designation: savedSurvey.designation,
        email: savedSurvey.email,
        mobile: savedSurvey.mobile,
        url: savedSurvey.url,
        total_questions: savedSurvey.questions.length,
        created_at: savedSurvey.createdAt,
        questions_answers: savedSurvey.getQuestionAnswerPairs(),
      },
    });
  } catch (error) {
    console.error("❌ Survey submission error:", error.message);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        message: "Validation failed",
        success: false,
        errors: validationErrors,
      });
    }

    return res.status(500).json({
      message: "Server error during survey submission",
      success: false,
      error: error.message,
    });
  }
});

// Get all customer surveys
router.get("/customer-surveys", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const surveys = await CustomerSurvey.find()
      .select("-__v") // Exclude __v field
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CustomerSurvey.countDocuments();

    // Transform data to include question-answer pairs for compatibility
    const transformedSurveys = surveys.map((survey) => ({
      ...survey.toObject(),
      questions_answers: survey.questions.map((q, i) => ({
        question: q,
        answer: survey.answers[i],
      })),
    }));

    res.json({
      success: true,
      data: transformedSurveys,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: limit,
      },
    });
  } catch (error) {
    console.error("❌ Get surveys error:", error.message);
    res.status(500).json({
      message: "Server error fetching surveys",
      success: false,
      error: error.message,
    });
  }
});

// Get single customer survey by ID
router.get("/customer-survey/:id", async (req, res) => {
  try {
    const survey = await CustomerSurvey.findById(req.params.id).select("-__v");

    if (!survey) {
      return res.status(404).json({
        message: "Customer survey not found",
        success: false,
      });
    }

    // Transform data to include question-answer pairs for compatibility
    const transformedSurvey = {
      ...survey.toObject(),
      questions_answers: survey.questions.map((q, i) => ({
        question: q,
        answer: survey.answers[i],
      })),
    };

    res.json({
      success: true,
      data: transformedSurvey,
    });
  } catch (error) {
    console.error("❌ Get survey error:", error.message);
    res.status(500).json({
      message: "Server error fetching survey",
      success: false,
      error: error.message,
    });
  }
});

// Update customer survey
router.put("/customer-survey/:id", async (req, res) => {
  try {
    const {
      name,
      company_name,
      designation,
      email,
      mobile,
      url,
      questions,
      answers,
      // Support for legacy questions_answers format
      questions_answers,
    } = req.body;

    // Handle both formats
    let processedQuestions = questions;
    let processedAnswers = answers;

    // If legacy format is used, convert it
    if (questions_answers && Array.isArray(questions_answers)) {
      processedQuestions = questions_answers.map((qa) => qa.question);
      processedAnswers = questions_answers.map((qa) => qa.answer);
    }

    const updatedSurvey = await CustomerSurvey.findByIdAndUpdate(
      req.params.id,
      {
        name,
        company_name,
        designation,
        email,
        mobile,
        url,
        questions: processedQuestions,
        answers: processedAnswers,
      },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!updatedSurvey) {
      return res.status(404).json({
        message: "Customer survey not found",
        success: false,
      });
    }

    console.log("✅ Customer survey updated:", updatedSurvey._id);

    // Transform data to include question-answer pairs for compatibility
    const transformedSurvey = {
      ...updatedSurvey.toObject(),
      questions_answers: updatedSurvey.questions.map((q, i) => ({
        question: q,
        answer: updatedSurvey.answers[i],
      })),
    };

    res.json({
      message: "Customer survey updated successfully",
      success: true,
      data: transformedSurvey,
    });
  } catch (error) {
    console.error("❌ Update survey error:", error.message);
    res.status(500).json({
      message: "Server error updating survey",
      success: false,
      error: error.message,
    });
  }
});

// Delete customer survey
router.delete("/customer-survey/:id", async (req, res) => {
  try {
    const deletedSurvey = await CustomerSurvey.findByIdAndDelete(req.params.id);

    if (!deletedSurvey) {
      return res.status(404).json({
        message: "Customer survey not found",
        success: false,
      });
    }

    console.log("✅ Customer survey deleted:", deletedSurvey._id);

    res.json({
      message: "Customer survey deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("❌ Delete survey error:", error.message);
    res.status(500).json({
      message: "Server error deleting survey",
      success: false,
      error: error.message,
    });
  }
});

// Search customer surveys
router.get("/customer-surveys/search", async (req, res) => {
  try {
    const { q, company, designation } = req.query;

    let query = {};

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { company_name: { $regex: q, $options: "i" } },
        { questions: { $regex: q, $options: "i" } },
        { answers: { $regex: q, $options: "i" } },
      ];
    }

    if (company) {
      query.company_name = { $regex: company, $options: "i" };
    }

    if (designation) {
      query.designation = { $regex: designation, $options: "i" };
    }

    const surveys = await CustomerSurvey.find(query)
      .select("-__v")
      .sort({ createdAt: -1 })
      .limit(50);

    // Transform data to include question-answer pairs for compatibility
    const transformedSurveys = surveys.map((survey) => ({
      ...survey.toObject(),
      questions_answers: survey.questions.map((q, i) => ({
        question: q,
        answer: survey.answers[i],
      })),
    }));

    res.json({
      success: true,
      data: transformedSurveys,
      count: transformedSurveys.length,
    });
  } catch (error) {
    console.error("❌ Search surveys error:", error.message);
    res.status(500).json({
      message: "Server error searching surveys",
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
