/**
 * ============================================================================
 * Payment Model — server/models/Payment.js
 * ============================================================================
 *
 * THE MOST CRITICAL FILE in the backend.
 *
 * This module implements the Mongoose Discriminator pattern to model
 * five different payment method types under a single MongoDB collection.
 *
 * What are Mongoose Discriminators?
 *   Discriminators allow you to define multiple models that share the same
 *   MongoDB collection but have different schemas. Each discriminator model
 *   adds its own fields on top of the base schema. The discriminator key
 *   (in our case `paymentType`) determines which sub-schema applies.
 *
 * Why Discriminators instead of separate collections?
 *   1. A single query can fetch ALL payment types for a user
 *   2. Atomic operations (like "set isPrimary") work across types
 *   3. Population and aggregation are simpler
 *   4. Shared fields (user, isPrimary, timestamps) are defined once
 *
 * Encryption:
 *   Sensitive fields (account numbers, UPI IDs, etc.) are encrypted at rest
 *   using AES-256-GCM via the pre-save middleware. The static `decryptFields`
 *   method reverses the encryption when data needs to be displayed.
 *
 * Payment types supported:
 *   1. Bank     — Indian bank account (account number, IFSC, etc.)
 *   2. Paytm    — Paytm wallet number
 *   3. UPI      — UPI Virtual Payment Address
 *   4. PayPal   — PayPal email address
 *   5. USDT     — USDT cryptocurrency wallet address (TRC20 or ERC20)
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { encrypt, decrypt } = require('../config/encryption');

/**
 * ============================================================================
 * SECTION 1: Base Payment Schema
 * ============================================================================
 *
 * This is the "parent" schema that all payment types inherit from.
 * It defines the fields common to every payment method.
 */
const paymentSchema = new Schema(
  {
    /**
     * user — Reference to the User who owns this payment method
     * - ObjectId: MongoDB's native 12-byte identifier type
     * - ref: 'User' enables Mongoose's populate() to join User data
     * - required: every payment must belong to a user
     * - index: true for fast lookups by user (most queries filter by user)
     */
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },

    /**
     * paymentType — the discriminator key
     * - This field determines which sub-schema (discriminator) applies
     * - The enum restricts values to the five supported payment types
     * - Mongoose uses this value to instantiate the correct model
     */
    paymentType: {
      type: String,
      required: [true, 'Payment type is required'],
      enum: {
        values: ['Bank', 'Paytm', 'UPI', 'PayPal', 'USDT'],
        message: 'Payment type must be one of: Bank, Paytm, UPI, PayPal, USDT',
      },
    },

    /**
     * isPrimary — marks this as the user's default/preferred payment method
     * - Only ONE payment per user should be primary at any time
     * - This invariant is enforced at the controller level using transactions
     * - default: false — new payment methods are not primary unless specified
     */
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    /**
     * discriminatorKey — tells Mongoose which field to use for discrimination
     * By default, Mongoose uses '__t', but we explicitly set it to 'paymentType'
     * so the discriminator key doubles as a meaningful business field.
     */
    discriminatorKey: 'paymentType',

    /**
     * timestamps — automatically adds createdAt and updatedAt fields
     * createdAt: when the payment method was first added
     * updatedAt: when it was last modified
     */
    timestamps: true,
  }
);

/**
 * ============================================================================
 * SECTION 2: Pre-save Middleware — Field-Level Encryption
 * ============================================================================
 *
 * This middleware runs BEFORE every save() on ANY payment document
 * (regardless of discriminator type). It encrypts sensitive fields
 * so they are stored as ciphertext in MongoDB.
 *
 * Key design decisions:
 *   1. We check `this.isModified(field)` to avoid re-encrypting already-
 *      encrypted data when non-sensitive fields are updated
 *   2. We check `this[field]` existence before encrypting to handle
 *      cases where the field doesn't exist on this discriminator type
 *   3. The encryption is applied to the Mongoose document before it reaches
 *      the MongoDB driver, so the driver never sees plaintext
 *
 * Sensitive fields per type:
 *   - Bank:   accountNumber
 *   - Paytm:  paytmNumber
 *   - UPI:    upiId
 *   - PayPal: paypalEmail
 *   - USDT:   usdtAddress
 */
paymentSchema.pre('save', async function (next) {
  try {
    /**
     * Map of paymentType → array of sensitive field names
     *
     * Each payment type has exactly one sensitive field (the identifier
     * that could be used for financial transactions). We use an object
     * for easy lookup and future extensibility — if a new payment type
     * has multiple sensitive fields, just add them to the array.
     */
    const sensitiveFieldsMap = {
      Bank: ['accountNumber'],
      Paytm: ['paytmNumber'],
      UPI: ['upiId'],
      PayPal: ['paypalEmail'],
      USDT: ['usdtAddress'],
    };

    /**
     * Look up which fields to encrypt for this document's payment type.
     * If the payment type is somehow not in the map, default to an empty
     * array (no fields to encrypt).
     */
    const fieldsToEncrypt = sensitiveFieldsMap[this.paymentType] || [];

    /**
     * Iterate over each sensitive field and encrypt it if:
     *   1. The field exists on this document (i.e., it has a value)
     *   2. The field has been modified (new value or first save)
     *
     * The isModified check is critical: without it, loading a document,
     * changing isPrimary, and saving would re-encrypt the already-encrypted
     * accountNumber, producing double-encrypted gibberish.
     */
    for (const field of fieldsToEncrypt) {
      if (this[field] && this.isModified(field)) {
        this[field] = encrypt(this[field]);
      }
    }

    next();
  } catch (error) {
    /**
     * If encryption fails (bad key, crypto error), propagate the error
     * to Mongoose — the save() call will reject with this error.
     */
    next(error);
  }
});

/**
 * ============================================================================
 * SECTION 3: Static Method — decryptFields
 * ============================================================================
 *
 * Decrypts sensitive fields on a payment document (plain JS object).
 *
 * Why a static method instead of a virtual or getter?
 *   - Virtuals don't work well with lean() queries or toObject()
 *   - We need explicit control over when decryption happens (only when
 *     sending data to the client, never during internal operations)
 *   - Static methods can operate on plain objects, not just Mongoose docs
 *
 * @param   {Object} paymentDoc — a plain JS object representing a payment
 * @returns {Object}            — the same object with sensitive fields decrypted
 */
paymentSchema.statics.decryptFields = function (paymentDoc) {
  /**
   * Guard clause: if no document is provided, return null to prevent
   * TypeError on property access.
   */
  if (!paymentDoc) return null;

  /**
   * Convert Mongoose document to plain object if needed.
   * toObject() strips Mongoose internals (__v, getters, etc.) and
   * gives us a simple JS object we can safely mutate.
   */
  const doc =
    typeof paymentDoc.toObject === 'function'
      ? paymentDoc.toObject()
      : { ...paymentDoc };

  /**
   * Decrypt based on the payment type.
   * Each case handles the specific sensitive field(s) for that type.
   *
   * We use a try-catch around each decrypt call to handle edge cases:
   *   - Data that was stored before encryption was enabled
   *   - Corrupted data
   *   - Key rotation scenarios
   * In these cases, we fall back to the original (possibly garbled) value
   * rather than crashing the entire response.
   */
  try {
    switch (doc.paymentType) {
      case 'Bank':
        /**
         * Bank accounts store the account number encrypted.
         * Other fields (bankName, ifscCode, branchName, accountHolderName)
         * are stored in plaintext because they are not sensitive enough
         * to warrant the performance cost of encryption, and they need
         * to be queryable for admin filtering.
         */
        if (doc.accountNumber) {
          doc.accountNumber = decrypt(doc.accountNumber);
        }
        break;

      case 'Paytm':
        if (doc.paytmNumber) {
          doc.paytmNumber = decrypt(doc.paytmNumber);
        }
        break;

      case 'UPI':
        if (doc.upiId) {
          doc.upiId = decrypt(doc.upiId);
        }
        break;

      case 'PayPal':
        if (doc.paypalEmail) {
          doc.paypalEmail = decrypt(doc.paypalEmail);
        }
        break;

      case 'USDT':
        if (doc.usdtAddress) {
          doc.usdtAddress = decrypt(doc.usdtAddress);
        }
        break;

      default:
        /**
         * Unknown payment type — log a warning but don't crash.
         * This handles forward-compatibility if new types are added
         * but the decryptFields switch hasn't been updated yet.
         */
        console.warn(
          `⚠️ Unknown payment type "${doc.paymentType}" — no decryption applied`
        );
    }
  } catch (error) {
    /**
     * If decryption fails for any reason (wrong key, corrupted data),
     * log the error but return the document as-is. The API consumer
     * will see encrypted gibberish, which is better than a 500 error.
     */
    console.error(
      `❌ Decryption failed for payment ${doc._id}:`,
      error.message
    );
  }

  return doc;
};

/**
 * ============================================================================
 * SECTION 4: Create the Base Model
 * ============================================================================
 *
 * Register the base Payment model with Mongoose. This creates the 'payments'
 * collection in MongoDB. All discriminator models will share this collection.
 */
const Payment = mongoose.model('Payment', paymentSchema);

/**
 * ============================================================================
 * SECTION 5: Discriminator Schemas and Models
 * ============================================================================
 *
 * Each discriminator adds type-specific fields on top of the base schema.
 * When you create a document using a discriminator model (e.g., BankPayment),
 * Mongoose automatically sets the discriminator key (paymentType) to the
 * discriminator name ('Bank').
 *
 * Querying:
 *   - Payment.find({ user: userId })     → returns ALL types
 *   - BankPayment.find({ user: userId }) → returns ONLY Bank payments
 */

/**
 * ---------------------------------------------------------------------------
 * 5a. Bank Payment Discriminator
 * ---------------------------------------------------------------------------
 *
 * Indian bank account details. accountNumber is encrypted; other fields
 * are stored in plaintext for queryability (admin filtering by bankName, IFSC).
 */
const bankSchema = new Schema({
  /**
   * accountNumber — the bank account number
   * - Stored encrypted in the database
   * - Required when creating a Bank payment
   */
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
  },

  /**
   * accountHolderName — name of the account holder
   * - trim: strips whitespace
   * - Stored in plaintext (not sensitive enough to encrypt)
   */
  accountHolderName: {
    type: String,
    required: [true, 'Account holder name is required'],
    trim: true,
  },

  /**
   * bankName — name of the bank (e.g., "State Bank of India")
   * - Stored in plaintext for admin filtering/searching
   * - trim: normalises whitespace
   */
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true,
  },

  /**
   * ifscCode — Indian Financial System Code (e.g., "SBIN0001234")
   * - uppercase: normalises to uppercase (IFSC codes are always uppercase)
   * - Stored in plaintext for admin filtering
   * - trim: strips whitespace
   */
  ifscCode: {
    type: String,
    required: [true, 'IFSC code is required'],
    uppercase: true,
    trim: true,
  },

  /**
   * branchName — the specific bank branch
   * - trim: normalises whitespace
   */
  branchName: {
    type: String,
    required: [true, 'Branch name is required'],
    trim: true,
  },
});

/**
 * Create the Bank discriminator model.
 * The first argument ('Bank') becomes the value stored in paymentType.
 */
const BankPayment = Payment.discriminator('Bank', bankSchema);

/**
 * ---------------------------------------------------------------------------
 * 5b. Paytm Payment Discriminator
 * ---------------------------------------------------------------------------
 *
 * Paytm mobile wallet. Only the wallet number is stored (encrypted).
 */
const paytmSchema = new Schema({
  /**
   * paytmNumber — the Paytm-registered mobile number
   * - Stored encrypted in the database
   * - Required when creating a Paytm payment
   */
  paytmNumber: {
    type: String,
    required: [true, 'Paytm number is required'],
  },
});

const PaytmPayment = Payment.discriminator('Paytm', paytmSchema);

/**
 * ---------------------------------------------------------------------------
 * 5c. UPI Payment Discriminator
 * ---------------------------------------------------------------------------
 *
 * Unified Payments Interface (UPI) — India's real-time payment system.
 * UPI IDs look like "username@bankname" (e.g., "john@upi").
 */
const upiSchema = new Schema({
  /**
   * upiId — the UPI Virtual Payment Address (VPA)
   * - Stored encrypted in the database
   * - Required when creating a UPI payment
   */
  upiId: {
    type: String,
    required: [true, 'UPI ID is required'],
  },
});

const UPIPayment = Payment.discriminator('UPI', upiSchema);

/**
 * ---------------------------------------------------------------------------
 * 5d. PayPal Payment Discriminator
 * ---------------------------------------------------------------------------
 *
 * PayPal international payment method. Identified by email address.
 */
const paypalSchema = new Schema({
  /**
   * paypalEmail — the email address linked to the PayPal account
   * - Stored encrypted in the database
   * - Required when creating a PayPal payment
   */
  paypalEmail: {
    type: String,
    required: [true, 'PayPal email is required'],
  },
});

const PayPalPayment = Payment.discriminator('PayPal', paypalSchema);

/**
 * ---------------------------------------------------------------------------
 * 5e. USDT Payment Discriminator
 * ---------------------------------------------------------------------------
 *
 * Tether (USDT) — a stablecoin cryptocurrency.
 * Requires both the wallet address and the network (TRC20 or ERC20).
 *
 * Why does network matter?
 *   USDT exists on multiple blockchains:
 *   - TRC20 (Tron network): lower fees, faster transactions
 *   - ERC20 (Ethereum network): wider adoption, higher fees
 *   Sending USDT to the wrong network results in permanent loss of funds.
 */
const usdtSchema = new Schema({
  /**
   * usdtAddress — the cryptocurrency wallet address
   * - Stored encrypted in the database
   * - Required when creating a USDT payment
   */
  usdtAddress: {
    type: String,
    required: [true, 'USDT address is required'],
  },

  /**
   * network — the blockchain network for the USDT address
   * - Must be either 'TRC20' or 'ERC20'
   * - Required to prevent cross-network transfer errors
   */
  network: {
    type: String,
    required: [true, 'USDT network is required (TRC20 or ERC20)'],
    enum: {
      values: ['TRC20', 'ERC20'],
      message: 'Network must be either "TRC20" or "ERC20"',
    },
  },
});

const USDTPayment = Payment.discriminator('USDT', usdtSchema);

/**
 * ============================================================================
 * SECTION 6: Exports
 * ============================================================================
 *
 * Export the base Payment model and all discriminator models.
 *
 * Usage patterns:
 *   - Payment.find()       → queries ALL payment types
 *   - BankPayment.create() → creates a Bank payment (auto-sets paymentType)
 *   - Payment.decryptFields(doc) → decrypts sensitive fields
 */
module.exports = {
  Payment,
  BankPayment,
  PaytmPayment,
  UPIPayment,
  PayPalPayment,
  USDTPayment,
};
