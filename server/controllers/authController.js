/**
 * ============================================================================
 * Authentication Controller — server/controllers/authController.js
 * ============================================================================
 *
 * Handles user registration and login.
 *
 * Endpoints:
 *   POST /api/auth/register — create a new user account
 *   POST /api/auth/login    — authenticate and receive a JWT
 *
 * Security measures:
 *   - Input validation via express-validator (handled in routes, errors checked here)
 *   - Password hashing handled by the User model's pre-save hook
 *   - JWT tokens expire after 7 days
 *   - Email uniqueness enforced at the database level (unique index)
 *
 * Response format:
 *   Success: { success: true, token, user: { id, username, email, role } }
 *   Error:   { success: false, message, [errors] }
 *
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

/**
 * generateToken(user)
 *
 * Creates a signed JWT containing the user's ID and role.
 *
 * @param   {Object} user      — Mongoose User document
 * @param   {string} user._id  — MongoDB ObjectId
 * @param   {string} user.role — 'user' or 'admin'
 * @returns {string}           — signed JWT string
 *
 * Token payload: { id, role }
 *   - id:   used by auth middleware to identify the user
 *   - role: used by adminAuth middleware for authorization
 *
 * expiresIn: '7d'
 *   - 7 days is a common choice for web apps — long enough that users
 *     don't need to re-login frequently, short enough to limit exposure
 *     if a token is compromised
 *   - For higher-security apps, consider shorter expiry with refresh tokens
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * ============================================================================
 * register — POST /api/auth/register
 * ============================================================================
 *
 * Creates a new user account.
 *
 * Flow:
 *   1. Validate input (errors collected by express-validator in routes)
 *   2. Check if a user with the same email already exists
 *   3. Create the user (password is hashed by the pre-save hook)
 *   4. Generate a JWT
 *   5. Return the token and sanitised user object
 *
 * @param {Object} req — Express request (body: { username, email, password })
 * @param {Object} res — Express response
 */
const register = async (req, res) => {
  try {
    /**
     * Step 1: Check for validation errors
     *
     * express-validator middleware (defined in authRoutes.js) has already
     * run by this point. validationResult() extracts any errors that
     * were collected during validation.
     */
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { username, email, password } = req.body;

    /**
     * Step 2: Check for existing user
     *
     * While the unique index on email would cause a duplicate key error
     * if we tried to insert, checking explicitly gives us the opportunity
     * to return a user-friendly error message instead of a cryptic
     * MongoDB error.
     */
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    /**
     * Step 3: Create the new user
     *
     * The User model's pre-save hook will automatically hash the password
     * before it's stored in MongoDB. We don't need to hash it here.
     *
     * Note: we don't set `role` here — it defaults to 'user'.
     * Admin accounts are created via the seed script.
     */
    const user = await User.create({
      username,
      email,
      password,
    });

    /**
     * Step 4: Generate a JWT for the newly created user
     *
     * This allows the user to be immediately authenticated after
     * registration (no separate login step required).
     */
    const token = generateToken(user);

    /**
     * Step 5: Return the response
     *
     * We return a sanitised user object that NEVER includes the
     * password hash. The client receives only what it needs:
     * id, username, email, and role.
     */
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    /**
     * Catch-all error handler
     *
     * This catches unexpected errors like database connection issues,
     * disk I/O errors, etc. We log the full error for debugging but
     * return a generic message to the client (never expose internals).
     */
    console.error('❌ Registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.',
    });
  }
};

/**
 * ============================================================================
 * login — POST /api/auth/login
 * ============================================================================
 *
 * Authenticates a user with email and password.
 *
 * Flow:
 *   1. Validate input
 *   2. Find the user by email
 *   3. Compare the candidate password against the stored hash
 *   4. Generate a JWT
 *   5. Return the token and sanitised user object
 *
 * @param {Object} req — Express request (body: { email, password })
 * @param {Object} res — Express response
 */
const login = async (req, res) => {
  try {
    /**
     * Step 1: Check for validation errors
     */
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    /**
     * Step 2: Find the user by email
     *
     * We use findOne (not findById) because the user authenticates
     * with their email, not their MongoDB ObjectId.
     *
     * If no user is found, we return a generic "Invalid credentials"
     * message — NOT "User not found". This prevents email enumeration
     * attacks (where an attacker tries emails to see which ones are
     * registered).
     */
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    /**
     * Step 3: Compare passwords
     *
     * user.comparePassword() is an instance method defined on the User
     * model. It uses bcrypt.compare() which is timing-safe — it takes
     * the same amount of time regardless of how many characters match,
     * preventing timing attacks.
     */
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      /**
       * Same generic message as "user not found" — don't reveal
       * whether the email exists or the password is wrong.
       */
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    /**
     * Step 4: Generate a JWT
     */
    const token = generateToken(user);

    /**
     * Step 5: Return the response (same shape as register)
     */
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.',
    });
  }
};

module.exports = { register, login };
