/**
 * ============================================================================
 * Authentication Routes — server/routes/authRoutes.js
 * ============================================================================
 *
 * Defines the HTTP endpoints for user authentication (register and login).
 *
 * These routes are PUBLIC — they do not require a JWT token.
 * They are mounted at /api/auth in server.js.
 *
 * Validation:
 *   Input validation is performed using express-validator middleware.
 *   Validation rules are defined inline as arrays of validator chains.
 *   The actual error checking happens in the controller (validationResult).
 *
 * Routes:
 *   POST /api/auth/register — create a new user account
 *   POST /api/auth/login    — authenticate with email and password
 *
 * ============================================================================
 */

const express = require('express');
const { body } = require('express-validator');
const { register, login } = require('../controllers/authController');

/**
 * Create a new Express Router instance
 *
 * express.Router() creates a modular, mountable route handler.
 * It is a "mini-app" that can have its own middleware and routes.
 */
const router = express.Router();

/**
 * ============================================================================
 * POST /register — User Registration
 * ============================================================================
 *
 * Validation rules (run as middleware BEFORE the controller):
 *
 * 1. username
 *    - Must not be empty after trimming whitespace
 *    - trim() normalises whitespace (applied before the check)
 *
 * 2. email
 *    - Must be a valid email format (contains @, valid domain structure)
 *    - normalizeEmail() standardises the email (e.g., lowercases domain)
 *
 * 3. password
 *    - Must be at least 6 characters long
 *    - This matches the minlength validation in the User model
 *
 * If any validation fails, express-validator adds the error to the request
 * (not the response). The controller calls validationResult(req) to check
 * for errors and returns a 400 response if any are found.
 */
router.post(
  '/register',
  [
    /**
     * Username validation
     * - trim(): removes leading/trailing whitespace before checking
     * - notEmpty(): fails if the trimmed value is an empty string
     * - withMessage(): custom error message (default is "Invalid value")
     */
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required'),

    /**
     * Email validation
     * - isEmail(): checks format using the validator.js library internally
     * - normalizeEmail(): lowercases domain, handles Gmail-style dots, etc.
     * - withMessage(): describes what went wrong
     */
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),

    /**
     * Password validation
     * - isLength({ min: 6 }): ensures at least 6 characters
     * - withMessage(): tells the user the requirement
     */
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  register // The controller function handles the actual registration logic
);

/**
 * ============================================================================
 * POST /login — User Login
 * ============================================================================
 *
 * Validation rules are lighter than registration:
 *   - Email format check
 *   - Password existence check (we don't check length here because the
 *     user might have an older password with different requirements)
 */
router.post(
  '/login',
  [
    /**
     * Email validation — same as registration
     */
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),

    /**
     * Password validation — just check that it exists
     * We don't enforce length here because we're not setting a password,
     * we're comparing against an existing one.
     */
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  login // The controller function handles the actual login logic
);

module.exports = router;
