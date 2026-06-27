/**
 * ============================================================================
 * Admin Routes — server/routes/adminRoutes.js
 * ============================================================================
 *
 * Defines the HTTP endpoints for admin-only payment management.
 *
 * ALL routes require BOTH authentication AND admin authorization:
 *   1. `auth` middleware: verifies the JWT and sets req.user
 *   2. `adminAuth` middleware: checks that req.user.role === 'admin'
 *
 * If either check fails, the request is rejected before reaching the controller.
 *
 * These routes are mounted at /api/admin/payments in server.js.
 *
 * Route summary:
 *   GET /api/admin/payments         — list all payments (paginated)
 *   GET /api/admin/payments/filter  — filter payments by criteria
 *
 * ============================================================================
 */

const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { getAllPayments, filterPayments } = require('../controllers/adminController');

/**
 * Create a new Express Router instance
 */
const router = express.Router();

/**
 * ============================================================================
 * GET / — List All Payments (Admin Only)
 * ============================================================================
 *
 * Middleware chain: auth → adminAuth → getAllPayments
 *
 * 1. auth:      verifies JWT (returns 401 if invalid)
 * 2. adminAuth: checks role === 'admin' (returns 403 if not admin)
 * 3. getAllPayments: fetches, paginates, decrypts, and returns
 *
 * Query parameters:
 *   - page  (default: 1)  — page number
 *   - limit (default: 20) — results per page
 */
router.get('/', auth, adminAuth, getAllPayments);

/**
 * ============================================================================
 * GET /filter — Filter Payments (Admin Only)
 * ============================================================================
 *
 * Middleware chain: auth → adminAuth → filterPayments
 *
 * Query parameters (all optional):
 *   - username    — search by user's name (regex)
 *   - paymentType — filter by type
 *   - bankName    — filter Bank payments by name (regex, DB-level)
 *   - ifscCode    — filter Bank payments by IFSC (regex, DB-level)
 *   - paytmNumber — filter by Paytm number (decrypted, in-memory)
 *   - upiId       — filter by UPI ID (decrypted, in-memory)
 *   - paypalEmail — filter by PayPal email (decrypted, in-memory)
 *   - usdtAddress — filter by USDT address (decrypted, in-memory)
 *   - page        — page number (default: 1)
 *   - limit       — results per page (default: 20)
 *
 * Note: This endpoint MUST be defined BEFORE any /:id route
 * to prevent Express from treating "filter" as an :id parameter.
 */
router.get('/filter', auth, adminAuth, filterPayments);

module.exports = router;
