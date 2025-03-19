const Admin = require("../models/Admin");
const TestCode = require("../models/TestCode");
const TestScore = require("../models/TestScore");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Admin signup
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin with this email already exists" });
    }

    // Create new admin
    const admin = new Admin({
      name,
      email,
      password
    });

    await admin.save();

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (error) {
    console.error("Admin signup error:", error);
    res.status(500).json({ error: "Server error during admin registration" });
  }
};

// Admin login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      },
      message: "Login successful"
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Server error during admin login" });
  }
};

// Generate a unique test code
const generateTestCode = async (req, res) => {
  try {
    const { subject, topic, difficulty } = req.body;
    const adminId = req.admin.adminId;

    if (!subject || !topic || !difficulty) {
      return res.status(400).json({ error: "Subject, topic, and difficulty are required" });
    }

    // Generate a unique test code
    const generateUniqueCode = () => {
      // Generate a random 8-character alphanumeric code
      return crypto.randomBytes(4).toString("hex").toUpperCase();
    };

    let testCode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    // Try to generate a unique code
    while (!isUnique && attempts < maxAttempts) {
      testCode = generateUniqueCode();
      const existingCode = await TestCode.findOne({ testCode });
      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: "Failed to generate a unique test code" });
    }

    // Create new test code
    const newTestCode = new TestCode({
      testCode,
      subject,
      topic,
      difficulty,
      createdBy: adminId
    });

    await newTestCode.save();

    res.status(201).json({
      message: "Test code generated successfully",
      testCode: newTestCode
    });
  } catch (error) {
    console.error("Test code generation error:", error);
    res.status(500).json({ error: "Server error during test code generation" });
  }
};

// Get all test codes for an admin
const getTestCodes = async (req, res) => {
  try {
    const adminId = req.admin.adminId;

    const testCodes = await TestCode.find({ createdBy: adminId })
      .sort({ createdAt: -1 });

    res.json(testCodes);
  } catch (error) {
    console.error("Get test codes error:", error);
    res.status(500).json({ error: "Server error while fetching test codes" });
  }
};

// Get leaderboard for a specific test code
const getLeaderboard = async (req, res) => {
  try {
    const { testCode } = req.params;

    // Verify the test code exists
    const testCodeDoc = await TestCode.findOne({ testCode });
    if (!testCodeDoc) {
      return res.status(404).json({ error: "Test code not found" });
    }

    // Get all scores for this test code, sorted by score (desc) and time taken (asc)
    const scores = await TestScore.find({ testCode })
      .sort({ score: -1, timeTaken: 1 })
      .populate("userId", "username email");

    res.json({
      testInfo: {
        testCode: testCodeDoc.testCode,
        subject: testCodeDoc.subject,
        topic: testCodeDoc.topic,
        difficulty: testCodeDoc.difficulty
      },
      leaderboard: scores
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Server error while fetching leaderboard" });
  }
};

module.exports = {
  signup,
  login,
  generateTestCode,
  getTestCodes,
  getLeaderboard
};
