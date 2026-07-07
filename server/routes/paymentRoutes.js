/**
 * ============================================================================
 * Payment Routes — server/routes/paymentRoutes.js
 * ============================================================================
 *
 * Defines the HTTP endpoints for managing payment methods.
 *
 * ALL routes in this file are PROTECTED — they require a valid JWT token.
 * The `auth` middleware is applied to every route to enforce authentication.
 *
 * These routes are mounted at /api/payments in server.js.
 *
 * Route summary:
 *   GET    /api/payments              — list all user's payments
 *   POST   /api/payments              — add a new payment method
 *   PUT    /api/payments/:id          — update an existing payment
 *   DELETE /api/payments/:id          — delete a payment method
 *   PATCH  /api/payments/:id/primary  — set a payment as primary
 *
 * Why different HTTP methods?
 *   - GET:    retrieves data (safe, idempotent)
 *   - POST:   creates a new resource (not idempotent)
 *   - PUT:    replaces/updates an existing resource (idempotent)
 *   - DELETE: removes a resource (idempotent)
 *   - PATCH:  partially updates a resource (the primary flag in this case)
 *
 * ============================================================================
 */

const express = require('express');
const auth = require('../middleware/auth');
const {
  getPayments,
  addPayment,
  updatePayment,
  deletePayment,
  setPrimary,
} = require('../controllers/paymentController');

/**
 * Create a new Express Router instance
 */
const router = express.Router();

/**
 * ============================================================================
 * GET / — List All User's Payments
 * ============================================================================
 *
 * Middleware chain: auth → getPayments
 *
 * 1. auth: verifies JWT, attaches req.user = { id, role }
 * 2. getPayments: fetches all payments for req.user.id, decrypts, returns
 *
 * No request body or params needed — the user ID comes from the JWT.
 */
router.get('/', auth, getPayments);

/**
 * ============================================================================
 * POST / — Add a New Payment Method
 * ============================================================================
 *
 * Middleware chain: auth → addPayment
 *
 * 1. auth: verifies JWT
 * 2. addPayment: validates paymentType, creates with correct discriminator,
 *    handles isPrimary transaction if needed
 *
 * Request body varies by payment type:
 *   - Bank:   { paymentType: 'Bank', accountNumber, accountHolderName, bankName, ifscCode, branchName, isPrimary? }
 *   - Paytm:  { paymentType: 'Paytm', paytmNumber, isPrimary? }
 *   - UPI:    { paymentType: 'UPI', upiId, isPrimary? }
 *   - PayPal: { paymentType: 'PayPal', paypalEmail, isPrimary? }
 *   - USDT:   { paymentType: 'USDT', usdtAddress, network, isPrimary? }
 */
router.post('/', auth, addPayment);

/**
 * ============================================================================
 * PUT /:id — Update an Existing Payment
 * ============================================================================
 *
 * Middleware chain: auth → updatePayment
 *
 * The `:id` parameter is the MongoDB ObjectId of the payment to update.
 * The controller verifies that the authenticated user owns this payment
 * before allowing the update.
 *
 * Request body: any fields to update (excluding user and paymentType)
 */
router.put('/:id', auth, updatePayment);

/**
 * ============================================================================
 * DELETE /:id — Delete a Payment Method
 * ============================================================================
 *
 * Middleware chain: auth → deletePayment
 *
 * The controller verifies ownership, deletes the payment, and auto-promotes
 * another payment to primary if the deleted one was the primary.
 */
router.delete('/:id', auth, deletePayment);

/**
 * ============================================================================
 * PATCH /:id/primary — Set a Payment as Primary
 * ============================================================================
 *
 * Middleware chain: auth → setPrimary
 *
 * Uses a MongoDB transaction to atomically:
 *   1. Remove isPrimary from all user's payments
 *   2. Set isPrimary on the specified payment
 *
 * PATCH is used instead of PUT because we're modifying a single aspect
 * (the primary flag) of the resource, not replacing the entire resource.
 */
router.patch('/:id/primary', auth, setPrimary);

module.exports = router;
