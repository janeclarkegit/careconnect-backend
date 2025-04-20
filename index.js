// Import all required dependencies
const express = require("express"); // Core Express library for building the server
const mongoose = require("mongoose"); // Mongoose to interact with MongoDB
const dotenv = require("dotenv"); // For loading environment variables securely
const cors = require("cors"); // Middleware to handle cross-origin requests
const bcrypt = require("bcryptjs"); // For securely hashing user passwords
const jwt = require("jsonwebtoken"); // For generating secure authentication tokens
const { OpenAI } = require("openai"); // OpenAI SDK to enable GPT chat
const User = require("./models/User"); // Mongoose model for user accounts

dotenv.config(); // Load environment variables from .env file

const app = express(); // Initialize the Express app

// Middleware to parse JSON requests
app.use(express.json());

// Enable CORS for frontend access (development and deployed versions)
app.use(cors({
  origin: [
    "http://localhost:3000", // Local dev version
    "https://careconnect-frontend-il7i.onrender.com" // Deployed frontend
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// Connect to MongoDB database using Mongoose
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Initialize OpenAI with API key from environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT Chat Route — handles incoming user message and sends reply via GPT
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    console.log("User Message:", userMessage);

    // Send conversation to OpenAI GPT-3.5 for response generation
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." }, // Sets tone
        { role: "user", content: userMessage },
      ],
    });

    const botMessage = response.choices[0].message.content;
    res.json({ botMessage }); // Return bot response to frontend
  } catch (error) {
    console.error("❌ OpenAI API Error:", error);
    res.status(500).json({ error: "Something went wrong with OpenAI API." });
  }
});

// Signup Route — handles user registration
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Basic field validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields (name, email, password, role) are required" });
    }

    // Check if the email is already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash the password and save the new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("❌ Signup Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Login Route — authenticates user and returns a JWT token
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user in the database
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    // Compare password with the hashed password stored in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    // Generate JWT token and return it with user details
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, name: user.name, role: user.role });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Start the server on the specified port (default to 3001)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});