const mongoose = require("mongoose");

// Main Customer Survey Schema with separate questions and answers
const customerSurveySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
    company_name: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
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
    mobile: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    url: {
      type: String,
      required: false,
      trim: true,
      match: [
        /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
        "Please enter a valid URL",
      ],
    },
    // Separate questions array
    questions: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return (
            v && v.length > 0 && v.every((q) => q && typeof q === "string")
          );
        },
        message: "At least one non-empty question is required",
      },
    },
    // Separate answers array
    answers: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one answer is required",
      },
    },
  },
  {
    timestamps: true,
    collection: "customer_survey",
  }
);

// Pre-save validation to ensure questions and answers arrays have same length
customerSurveySchema.pre("save", function (next) {
  if (this.questions.length !== this.answers.length) {
    const error = new Error("Number of questions and answers must be equal");
    return next(error);
  }
  next();
});

// Pre-update validation
customerSurveySchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.questions && update.answers) {
    if (update.questions.length !== update.answers.length) {
      const error = new Error("Number of questions and answers must be equal");
      return next(error);
    }
  }
  next();
});

// Index for better performance
customerSurveySchema.index({ email: 1 });
customerSurveySchema.index({ company_name: 1 });
customerSurveySchema.index({ createdAt: -1 });
customerSurveySchema.index({ questions: 1 });
customerSurveySchema.index({ answers: 1 });

// Instance method to get question-answer pairs (for compatibility)
customerSurveySchema.methods.getQuestionAnswerPairs = function () {
  const pairs = [];
  for (let i = 0; i < this.questions.length; i++) {
    pairs.push({
      question: this.questions[i],
      answer: this.answers[i] || "", // Ensure empty string for null/undefined
    });
  }
  return pairs;
};

// Static method to create survey from question-answer pairs
customerSurveySchema.statics.createFromPairs = function (
  surveyData,
  questionAnswerPairs
) {
  const questions = questionAnswerPairs.map((pair) => pair.question);
  const answers = questionAnswerPairs.map((pair) => pair.answer || "");

  return new this({
    ...surveyData,
    questions,
    answers,
  });
};

// Transform function to add questions_answers field in JSON output
customerSurveySchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.questions_answers = this.getQuestionAnswerPairs();
  return obj;
};

module.exports = mongoose.model("CustomerSurvey", customerSurveySchema);
