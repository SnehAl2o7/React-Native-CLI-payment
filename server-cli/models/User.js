/**
 * ============================================================================
 * User Model — server/models/User.js
 * ============================================================================
 *
 * Defines the Mongoose schema and model for application users.
 *
 * Features:
 *   - Secure password hashing with bcryptjs (salt rounds: 12)
 *   - Pre-save hook that only hashes when the password field is modified
 *   - Instance method for password comparison during login
 *   - Role-based access control (user / admin)
 *   - Automatic timestamps (createdAt, updatedAt)
 *
 * Security considerations:
 *   - Passwords are NEVER stored in plaintext
 *   - Salt rounds of 12 provide a good balance between security and performance
 *     (≈ 300ms hashing time on modern hardware)
 *   - The `comparePassword` method uses bcrypt's timing-safe comparison
 *     to prevent timing attacks
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema Definition
 *
 * Each field includes validation rules that Mongoose will enforce
 * before saving to the database.
 */
const userSchema = new mongoose.Schema(
  {
    /**
     * username — the display name for the user
     * - required: must be provided during registration
     * - trim: automatically strips leading/trailing whitespace
     */
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
    },

    /**
     * email — the user's unique identifier for authentication
     * - required: must be provided during registration
     * - unique: creates a MongoDB unique index (enforced at DB level)
     * - lowercase: normalises to lowercase before saving (prevents
     *   duplicate accounts like User@Email.com vs user@email.com)
     * - trim: strips whitespace
     */
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    /**
     * password — stored as a bcrypt hash, never plaintext
     * - required: must be provided during registration
     * - minlength: enforced at the Mongoose level (before hashing)
     *   Note: after hashing, the stored string will be ~60 chars
     */
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },

    /**
     * role — determines access level within the application
     * - 'user': regular user, can manage their own payment methods
     * - 'admin': administrator, can view and filter all users' payments
     * - default: 'user' — new registrations are always regular users
     *   (admins are created via the seed script or manual DB update)
     */
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: 'Role must be either "user" or "admin"',
      },
      default: 'user',
    },
  },
  {
    /**
     * timestamps option — Mongoose automatically manages:
     *   - createdAt: set once when the document is first saved
     *   - updatedAt: updated every time the document is modified
     * These are useful for auditing and sorting.
     */
    timestamps: true,
  }
);

/**
 * ============================================================================
 * Pre-save Middleware — Password Hashing
 * ============================================================================
 *
 * This hook runs BEFORE every save() call on a User document.
 * It intercepts the plain-text password and replaces it with a bcrypt hash.
 *
 * Key detail: `this.isModified('password')` returns true only when:
 *   1. The document is brand new (first save)
 *   2. The password field was explicitly changed (e.g., password reset)
 *
 * This prevents re-hashing an already-hashed password when other fields
 * (like username or role) are updated.
 *
 * We use a regular function (not arrow) because we need `this` to refer
 * to the document instance.
 */
userSchema.pre('save', async function (next) {
  /**
   * Short-circuit: if the password hasn't been modified, skip hashing.
   * This is critical — without this check, updating a user's email would
   * re-hash the already-hashed password, making it unverifiable.
   */
  if (!this.isModified('password')) {
    return next();
  }

  try {
    /**
     * Generate a salt with 12 rounds of key stretching.
     *
     * Salt rounds (cost factor) explanation:
     *   - Each increment doubles the computation time
     *   - 10 rounds ≈ 100ms, 12 rounds ≈ 300ms, 14 rounds ≈ 1s
     *   - 12 is a good default for 2024 — secure yet responsive
     *   - Increase to 14+ if your threat model requires it
     */
    const salt = await bcrypt.genSalt(12);

    /**
     * Hash the plaintext password with the generated salt.
     * The resulting hash includes the salt, algorithm version, and
     * cost factor — everything needed to verify the password later.
     * Format: $2a$12$<22-char-salt><31-char-hash>
     */
    this.password = await bcrypt.hash(this.password, salt);

    /**
     * Call next() to proceed with the save operation.
     * The hashed password will be stored in MongoDB.
     */
    next();
  } catch (error) {
    /**
     * If hashing fails (extremely rare — usually an OS-level entropy issue),
     * pass the error to Mongoose's error-handling pipeline.
     */
    next(error);
  }
});

/**
 * ============================================================================
 * Instance Method — comparePassword
 * ============================================================================
 *
 * Compares a candidate (plaintext) password against the stored bcrypt hash.
 * Used during the login flow.
 *
 * bcrypt.compare() is timing-safe: it takes the same amount of time
 * regardless of how many characters match, preventing timing-based attacks
 * that could reveal partial password information.
 *
 * @param   {string}           candidatePassword — the plaintext password to check
 * @returns {Promise<boolean>}                   — true if the password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  /**
   * `this.password` is the bcrypt hash stored in the database.
   * bcrypt.compare extracts the salt from the hash, hashes the candidate
   * with the same salt, and compares the results.
   */
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Create and export the User model
 *
 * mongoose.model('User', userSchema) does two things:
 *   1. Registers the model so it can be referenced elsewhere with mongoose.model('User')
 *   2. Creates (or reuses) a MongoDB collection named 'users' (lowercase, pluralised)
 */
const User = mongoose.model('User', userSchema);

module.exports = User;
