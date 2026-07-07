/**
 * ============================================================================
 * Payment Controller — server/controllers/paymentController.js
 * ============================================================================
 *
 * CRITICAL FILE — Handles all CRUD operations for user payment methods.
 *
 * This controller uses Mongoose Transactions for operations that require
 * atomicity (specifically, the "set primary" workflow where we must update
 * multiple documents as a single unit).
 *
 * Why Transactions?
 *   When a user sets a new payment method as "primary", we must:
 *     1. Set ALL existing payment methods' isPrimary to false
 *     2. Set the new payment method's isPrimary to true
 *   These two operations MUST succeed or fail together — otherwise we could
 *   end up with zero primary methods (if step 1 succeeds but step 2 fails)
 *   or multiple primary methods (if step 2 succeeds but step 1 fails).
 *
 * Transactions require a MongoDB Replica Set (even a single-node one).
 * The connection URI in .env includes ?replicaSet=rs0 for this reason.
 *
 * Endpoints:
 *   GET    /api/payments           — list all payments for the current user
 *   POST   /api/payments           — add a new payment method
 *   PUT    /api/payments/:id       — update an existing payment method
 *   DELETE /api/payments/:id       — delete a payment method
 *   PATCH  /api/payments/:id/primary — set a payment method as primary
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const {
  Payment,
  BankPayment,
  PaytmPayment,
  UPIPayment,
  PayPalPayment,
  USDTPayment,
} = require('../models/Payment');

/**
 * MODEL_MAP — Maps paymentType strings to their Mongoose discriminator models
 *
 * When creating a new payment, we need to use the correct discriminator model
 * (not the base Payment model) so that Mongoose applies the right schema
 * validation and sets the discriminatorKey automatically.
 */
const MODEL_MAP = {
  Bank: BankPayment,
  Paytm: PaytmPayment,
  UPI: UPIPayment,
  PayPal: PayPalPayment,
  USDT: USDTPayment,
};

/**
 * ============================================================================
 * getPayments — GET /api/payments
 * ============================================================================
 *
 * Retrieves all payment methods belonging to the authenticated user.
 * Decrypts sensitive fields before returning them to the client.
 *
 * @param {Object} req — Express request (req.user.id from auth middleware)
 * @param {Object} res — Express response
 */
const getPayments = async (req, res) => {
  try {
    /**
     * Query the base Payment model to fetch ALL payment types at once.
     * Because we're using discriminators on a single collection, this
     * single query returns Bank, Paytm, UPI, PayPal, and USDT documents.
     *
     * Sort by isPrimary descending so the primary method appears first,
     * then by creation date descending (newest first).
     */
    const payments = await Payment.find({ user: req.user.id })
      .sort({ isPrimary: -1, createdAt: -1 });

    /**
     * Decrypt sensitive fields for each payment before sending to client.
     *
     * Payment.decryptFields() is a static method that:
     *   1. Converts the Mongoose document to a plain object
     *   2. Decrypts the appropriate field based on paymentType
     *   3. Returns the modified object
     *
     * We map over the array to create a new array of decrypted objects.
     */
    const decryptedPayments = payments.map((payment) =>
      Payment.decryptFields(payment)
    );

    res.status(200).json({
      success: true,
      count: decryptedPayments.length,
      payments: decryptedPayments,
    });
  } catch (error) {
    console.error('❌ Get payments error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment methods.',
    });
  }
};

/**
 * ============================================================================
 * addPayment — POST /api/payments
 * ============================================================================
 *
 * Creates a new payment method for the authenticated user.
 *
 * If isPrimary is true, uses a MongoDB transaction to atomically:
 *   1. Set all existing payments' isPrimary to false
 *   2. Create the new payment with isPrimary = true
 *
 * If isPrimary is false (or not provided), creates normally without a
 * transaction (better performance for the common case).
 *
 * @param {Object} req — Express request (body contains payment details)
 * @param {Object} res — Express response
 */
const addPayment = async (req, res) => {
  try {
    const { paymentType, isPrimary, ...paymentData } = req.body;

    /**
     * Validate the payment type — ensure it's one of the supported types.
     * This is also enforced by the Mongoose enum, but checking early
     * gives a cleaner error message and avoids unnecessary DB operations.
     */
    const PaymentModel = MODEL_MAP[paymentType];
    if (!PaymentModel) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment type: "${paymentType}". Must be one of: Bank, Paytm, UPI, PayPal, USDT`,
      });
    }

    /**
     * Prepare the payment data object.
     * We spread the type-specific fields from paymentData and add:
     *   - user: the authenticated user's ID (from JWT)
     *   - paymentType: explicitly set (though the discriminator would set it)
     *   - isPrimary: from the request body (defaults to false in schema)
     */
    const newPaymentData = {
      ...paymentData,
      user: req.user.id,
      paymentType,
      isPrimary: !!isPrimary, // Coerce to boolean for safety
    };

    let createdPayment;

    if (isPrimary) {
      /**
       * TRANSACTIONAL FLOW — Atomic primary swap
       *
       * We need to ensure that:
       *   a) All existing payments lose their primary status
       *   b) The new payment is created with isPrimary = true
       * Both operations succeed or both are rolled back.
       *
       * mongoose.startSession() creates a client session.
       * session.withTransaction() handles:
       *   - Starting the transaction
       *   - Committing on success
       *   - Aborting (rolling back) on error
       *   - Retrying on transient errors (network blips, etc.)
       */
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          /**
           * Step 1: Remove primary status from ALL existing payments
           *
           * updateMany with { session } ensures this operation is part
           * of the transaction. If the subsequent create fails, this
           * updateMany will be rolled back.
           */
          await Payment.updateMany(
            { user: req.user.id, isPrimary: true },
            { $set: { isPrimary: false } },
            { session }
          );

          /**
           * Step 2: Create the new payment with isPrimary = true
           *
           * We use the discriminator model (e.g., BankPayment) to get
           * proper schema validation. The create() method with an array
           * argument is required when using sessions (Mongoose quirk).
           */
          const [payment] = await PaymentModel.create(
            [newPaymentData],
            { session }
          );
          createdPayment = payment;
        });
      } finally {
        /**
         * Always end the session, whether the transaction succeeded or not.
         * This releases the session resources on the MongoDB server.
         */
        await session.endSession();
      }
    } else {
      /**
       * NON-TRANSACTIONAL FLOW — Simple create
       *
       * When isPrimary is false, no atomicity guarantee is needed.
       * We skip the session overhead for better performance.
       */
      createdPayment = await PaymentModel.create(newPaymentData);
    }

    /**
     * Decrypt the created payment before returning to the client.
     * The pre-save hook encrypted the sensitive fields, so the document
     * in `createdPayment` has ciphertext. We decrypt for the response.
     */
    const decryptedPayment = Payment.decryptFields(createdPayment);

    res.status(201).json({
      success: true,
      message: 'Payment method added successfully.',
      payment: decryptedPayment,
    });
  } catch (error) {
    console.error('❌ Add payment error:', error.message);

    /**
     * Check for Mongoose validation errors (wrong field types, missing
     * required fields, enum violations) and return them in a structured format.
     */
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add payment method.',
    });
  }
};

/**
 * ============================================================================
 * updatePayment — PUT /api/payments/:id
 * ============================================================================
 *
 * Updates an existing payment method.
 *
 * Security: Verifies that the authenticated user owns the payment before
 * allowing the update. This prevents horizontal privilege escalation
 * (one user modifying another user's payment).
 *
 * If isPrimary is being changed to true, uses a transaction for atomicity.
 *
 * @param {Object} req — Express request (params.id, body with updates)
 * @param {Object} res — Express response
 */
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;

    /**
     * Step 1: Find the existing payment by ID
     *
     * We use the base Payment model so this works regardless of
     * the payment type. If the ID doesn't exist, we get null.
     */
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found.',
      });
    }

    /**
     * Step 2: Verify ownership
     *
     * Compare the payment's user field (ObjectId) with the authenticated
     * user's ID (string). We use toString() because ObjectId !== string
     * in JavaScript, even if they represent the same value.
     */
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this payment method.',
      });
    }

    /**
     * Step 3: Determine if we need a transaction
     *
     * A transaction is needed only when isPrimary is being changed from
     * false to true. If it's being changed from true to false, or if
     * isPrimary isn't in the update, a simple save suffices.
     */
    const { isPrimary, ...updateFields } = req.body;
    const needsTransaction = isPrimary === true && !payment.isPrimary;

    /**
     * Step 4: Apply the non-primary field updates to the document
     *
     * We iterate over the update fields and apply them to the Mongoose
     * document. This approach (vs. findByIdAndUpdate) allows the pre-save
     * hook to run, which handles encryption of modified sensitive fields.
     *
     * We exclude 'user' and 'paymentType' from updates because:
     *   - user: changing ownership is a security risk
     *   - paymentType: changing the discriminator type would break the schema
     */
    const protectedFields = ['user', 'paymentType', '_id'];
    for (const [key, value] of Object.entries(updateFields)) {
      if (!protectedFields.includes(key)) {
        payment[key] = value;
      }
    }

    if (needsTransaction) {
      /**
       * TRANSACTIONAL FLOW — Atomic primary swap during update
       */
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          /**
           * Remove primary status from all other user payments
           */
          await Payment.updateMany(
            { user: req.user.id, isPrimary: true, _id: { $ne: id } },
            { $set: { isPrimary: false } },
            { session }
          );

          /**
           * Set this payment as primary and save
           * The { session } option ensures this save is part of the transaction
           */
          payment.isPrimary = true;
          await payment.save({ session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      /**
       * NON-TRANSACTIONAL FLOW — Simple save
       *
       * If isPrimary is explicitly false, set it. Otherwise, don't change it.
       */
      if (typeof isPrimary === 'boolean') {
        payment.isPrimary = isPrimary;
      }
      await payment.save();
    }

    /**
     * Step 5: Return the updated and decrypted payment
     */
    const decryptedPayment = Payment.decryptFields(payment);

    res.status(200).json({
      success: true,
      message: 'Payment method updated successfully.',
      payment: decryptedPayment,
    });
  } catch (error) {
    console.error('❌ Update payment error:', error.message);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update payment method.',
    });
  }
};

/**
 * ============================================================================
 * deletePayment — DELETE /api/payments/:id
 * ============================================================================
 *
 * Deletes a payment method and handles primary reassignment.
 *
 * If the deleted payment was the primary, and the user has other payments,
 * the first remaining payment is automatically promoted to primary.
 * This ensures the user always has a primary payment method (if they have
 * any payment methods at all).
 *
 * @param {Object} req — Express request (params.id)
 * @param {Object} res — Express response
 */
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    /**
     * Step 1: Find the payment to delete
     */
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found.',
      });
    }

    /**
     * Step 2: Verify ownership — same check as updatePayment
     */
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this payment method.',
      });
    }

    /**
     * Step 3: Remember if this was the primary payment
     * We need this after deletion to decide whether to promote another one.
     */
    const wasPrimary = payment.isPrimary;

    /**
     * Step 4: Delete the payment document
     *
     * We use deleteOne() on the document instance (not the model) to
     * trigger any post-remove middleware if defined later.
     */
    await payment.deleteOne();

    /**
     * Step 5: Auto-promote another payment to primary (if needed)
     *
     * If the deleted payment was the primary AND the user still has
     * other payment methods, we promote the first one found.
     * This is a courtesy feature — the user can always change it later.
     */
    if (wasPrimary) {
      const remainingPayment = await Payment.findOne({ user: req.user.id })
        .sort({ createdAt: 1 }); // Oldest first — consistent behavior

      if (remainingPayment) {
        remainingPayment.isPrimary = true;
        await remainingPayment.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully.',
    });
  } catch (error) {
    console.error('❌ Delete payment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment method.',
    });
  }
};

/**
 * ============================================================================
 * setPrimary — PATCH /api/payments/:id/primary
 * ============================================================================
 *
 * Dedicated endpoint to set a payment method as the primary.
 *
 * Uses a MongoDB transaction to atomically:
 *   1. Set ALL user's payments' isPrimary to false
 *   2. Set the target payment's isPrimary to true
 *
 * This is separate from updatePayment because:
 *   - It's a more focused operation (only changes isPrimary)
 *   - The frontend might have a dedicated "Set as Primary" button
 *   - It always uses a transaction (no conditional logic)
 *
 * @param {Object} req — Express request (params.id)
 * @param {Object} res — Express response
 */
const setPrimary = async (req, res) => {
  try {
    const { id } = req.params;

    /**
     * Step 1: Find the target payment
     */
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found.',
      });
    }

    /**
     * Step 2: Verify ownership
     */
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this payment method.',
      });
    }

    /**
     * Step 3: Short-circuit if already primary
     * No need to start a transaction if the payment is already primary.
     */
    if (payment.isPrimary) {
      return res.status(200).json({
        success: true,
        message: 'This payment method is already set as primary.',
        payment: Payment.decryptFields(payment),
      });
    }

    /**
     * Step 4: Atomic primary swap using a transaction
     *
     * This ensures that at no point in time will the user have
     * zero primary payments or multiple primary payments.
     */
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        /**
         * Step 4a: Remove primary status from ALL user's payments
         *
         * We use updateMany to handle the (unlikely but possible) case
         * where multiple payments were somehow marked as primary
         * (e.g., due to a race condition before transactions were added).
         */
        await Payment.updateMany(
          { user: req.user.id, isPrimary: true },
          { $set: { isPrimary: false } },
          { session }
        );

        /**
         * Step 4b: Set the target payment as primary
         *
         * We use updateOne directly instead of save() to avoid
         * triggering the pre-save encryption hook unnecessarily
         * (we're only changing isPrimary, not any sensitive fields).
         */
        await Payment.updateOne(
          { _id: id },
          { $set: { isPrimary: true } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    /**
     * Step 5: Fetch the updated payment and return it
     *
     * We re-fetch because the transaction used updateOne (not save),
     * so our local `payment` variable is stale.
     */
    const updatedPayment = await Payment.findById(id);
    const decryptedPayment = Payment.decryptFields(updatedPayment);

    res.status(200).json({
      success: true,
      message: 'Payment method set as primary successfully.',
      payment: decryptedPayment,
    });
  } catch (error) {
    console.error('❌ Set primary error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to set payment method as primary.',
    });
  }
};

module.exports = {
  getPayments,
  addPayment,
  updatePayment,
  deletePayment,
  setPrimary,
};
