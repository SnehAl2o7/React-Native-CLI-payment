/**
 * ============================================================================
 * Admin Controller — server/controllers/adminController.js
 * ============================================================================
 *
 * Handles admin-only operations for viewing and filtering all users' payments.
 *
 * These endpoints are protected by both the `auth` and `adminAuth` middleware,
 * ensuring that only authenticated admin users can access them.
 *
 * Endpoints:
 *   GET /api/admin/payments         — list all payments (paginated)
 *   GET /api/admin/payments/filter  — filter payments by various criteria
 *
 * Design decisions:
 *   1. Pagination is mandatory to prevent fetching thousands of records
 *   2. User data is populated (joined) via Mongoose's populate()
 *   3. Sensitive fields are decrypted before returning to the admin
 *   4. Encrypted field filtering is done in-memory after decryption
 *      (because you can't query encrypted values directly in the DB)
 *
 * ============================================================================
 */

const User = require('../models/User');
const { Payment } = require('../models/Payment');

/**
 * ============================================================================
 * getAllPayments — GET /api/admin/payments
 * ============================================================================
 *
 * Retrieves ALL payment methods across all users, with pagination.
 *
 * Query Parameters:
 *   - page  (default: 1)  — current page number
 *   - limit (default: 20) — number of results per page
 *
 * Response:
 *   {
 *     success: true,
 *     payments: [...],      // decrypted payment objects with user data
 *     currentPage: 1,
 *     totalPages: 5,
 *     totalCount: 100
 *   }
 *
 * @param {Object} req — Express request (query: { page, limit })
 * @param {Object} res — Express response
 */
const getAllPayments = async (req, res) => {
  try {
    /**
     * Parse pagination parameters from query string
     *
     * parseInt with a fallback ensures we get valid integers even if
     * the query params are missing or malformed (e.g., "abc").
     *
     * page: which page to return (1-indexed for human readability)
     * limit: maximum number of results per page
     */
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    /**
     * Calculate the number of documents to skip
     *
     * For page 1: skip 0 documents
     * For page 2: skip `limit` documents
     * For page N: skip (N-1) * limit documents
     *
     * This is the standard offset-based pagination approach.
     */
    const skip = (page - 1) * limit;

    /**
     * Count the total number of payment documents
     *
     * We need this to calculate totalPages and report totalCount.
     * countDocuments() is more accurate than estimatedDocumentCount()
     * for filtered queries, though here we're counting all documents.
     */
    const totalCount = await Payment.countDocuments();

    /**
     * Fetch the payments with pagination and population
     *
     * .populate('user', 'username email') performs a MongoDB $lookup
     * (join) to fetch the associated user's username and email.
     * The second argument is a space-separated whitelist of fields
     * to include from the User document — we don't want to leak
     * password hashes or other sensitive User fields to the admin.
     *
     * .sort({ createdAt: -1 }) orders by newest first.
     * .skip(skip) implements pagination offset.
     * .limit(limit) caps the number of results.
     */
    const payments = await Payment.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    /**
     * Decrypt sensitive fields for each payment
     *
     * Admins see the decrypted values (account numbers, UPI IDs, etc.)
     * because they need this data for support and verification purposes.
     */
    const decryptedPayments = payments.map((payment) =>
      Payment.decryptFields(payment)
    );

    /**
     * Calculate total pages
     *
     * Math.ceil ensures we round up: if there are 21 results and
     * limit is 20, we need 2 pages (not 1.05).
     */
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      payments: decryptedPayments,
      currentPage: page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error('❌ Get all payments error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payments.',
    });
  }
};

/**
 * ============================================================================
 * filterPayments — GET /api/admin/payments/filter
 * ============================================================================
 *
 * Advanced filtering endpoint for admins to search payments by various criteria.
 *
 * Supported query parameters:
 *   - username      — search users by name (regex, case-insensitive)
 *   - paymentType   — filter by type (Bank, Paytm, UPI, PayPal, USDT)
 *   - bankName      — filter Bank payments by bank name (regex)
 *   - ifscCode      — filter Bank payments by IFSC code (regex)
 *   - paytmNumber   — filter by Paytm number (decrypted, in-memory)
 *   - upiId         — filter by UPI ID (decrypted, in-memory)
 *   - paypalEmail   — filter by PayPal email (decrypted, in-memory)
 *   - usdtAddress   — filter by USDT address (decrypted, in-memory)
 *   - page          — pagination page (default: 1)
 *   - limit         — results per page (default: 20)
 *
 * Why are some filters DB-level and others in-memory?
 *   - bankName, ifscCode: stored in PLAINTEXT → can use MongoDB regex queries
 *   - paytmNumber, upiId, paypalEmail, usdtAddress: stored ENCRYPTED →
 *     cannot be queried directly; must decrypt first, then filter in JS
 *
 * This is a fundamental trade-off of field-level encryption:
 *   - You gain security (encrypted at rest)
 *   - You lose direct queryability for those fields
 *   For production systems with millions of records, consider:
 *     - Searchable encryption (MongoDB Client-Side Field Level Encryption)
 *     - Blind indexes
 *     - Storing a hash of the value for exact-match lookups
 *
 * @param {Object} req — Express request (query: filtering + pagination params)
 * @param {Object} res — Express response
 */
const filterPayments = async (req, res) => {
  try {
    const {
      username,
      paymentType,
      bankName,
      ifscCode,
      paytmNumber,
      upiId,
      paypalEmail,
      usdtAddress,
      page: pageParam,
      limit: limitParam,
    } = req.query;

    /**
     * Parse pagination parameters with defaults
     */
    const page = parseInt(pageParam, 10) || 1;
    const limit = parseInt(limitParam, 10) || 20;

    /**
     * ----------------------------------------------------------------
     * Phase 1: Build the MongoDB query object
     * ----------------------------------------------------------------
     *
     * We start with an empty query object and add filters incrementally.
     * Only filters that are actually provided in the request are added.
     */
    const query = {};

    /**
     * Username filter — requires a sub-query to find matching User IDs
     *
     * Since 'username' lives in the User collection (not Payment),
     * we first find all users whose username matches the regex,
     * then filter payments by those user IDs.
     *
     * The regex is case-insensitive ('i' flag) and partial-match
     * (no ^ or $ anchors), so searching "john" matches "John Doe",
     * "johnsmith", etc.
     */
    if (username) {
      const matchingUsers = await User.find(
        { username: { $regex: username, $options: 'i' } },
        '_id' // Only select the _id field — we don't need anything else
      );

      /**
       * Extract the ObjectId values into an array.
       * Use $in to match payments belonging to ANY of these users.
       *
       * If no users match, the query will match zero payments (correct behavior).
       */
      const userIds = matchingUsers.map((user) => user._id);
      query.user = { $in: userIds };
    }

    /**
     * Payment type filter — exact match (not regex)
     *
     * The paymentType field is an enum, so we use an exact match.
     * This also leverages the discriminator to narrow the results.
     */
    if (paymentType) {
      query.paymentType = paymentType;
    }

    /**
     * Bank-specific plaintext filters (DB-level query)
     *
     * bankName and ifscCode are stored in plaintext, so we can use
     * MongoDB's $regex operator for partial, case-insensitive matching.
     */
    if (bankName) {
      query.bankName = { $regex: bankName, $options: 'i' };
    }
    if (ifscCode) {
      query.ifscCode = { $regex: ifscCode, $options: 'i' };
    }

    /**
     * ----------------------------------------------------------------
     * Phase 2: Determine if in-memory filtering is needed
     * ----------------------------------------------------------------
     *
     * Check if any encrypted-field filters are requested.
     * If so, we need to:
     *   1. Fetch a larger set of results from the DB
     *   2. Decrypt the sensitive fields
     *   3. Filter in JavaScript
     *   4. Apply pagination to the filtered results
     */
    const encryptedFilters = {};
    if (paytmNumber) encryptedFilters.paytmNumber = paytmNumber.toLowerCase();
    if (upiId) encryptedFilters.upiId = upiId.toLowerCase();
    if (paypalEmail) encryptedFilters.paypalEmail = paypalEmail.toLowerCase();
    if (usdtAddress) encryptedFilters.usdtAddress = usdtAddress.toLowerCase();

    const hasEncryptedFilters = Object.keys(encryptedFilters).length > 0;

    let payments;
    let totalCount;

    if (hasEncryptedFilters) {
      /**
       * IN-MEMORY FILTERING PATH
       *
       * When filtering by encrypted fields, we CANNOT use skip/limit
       * at the DB level because we need to decrypt ALL matching records
       * first, then filter, then paginate.
       *
       * This is less efficient than DB-level pagination, but it's the
       * only correct approach for encrypted field searches.
       *
       * Performance note: for large datasets, consider adding blind indexes
       * or using MongoDB's Queryable Encryption feature.
       */
      const allPayments = await Payment.find(query)
        .populate('user', 'username email')
        .sort({ createdAt: -1 });

      /**
       * Decrypt all fetched payments
       */
      let decryptedPayments = allPayments.map((payment) =>
        Payment.decryptFields(payment)
      );

      /**
       * Filter decrypted payments by the encrypted field values
       *
       * We use case-insensitive partial matching (includes) to be
       * consistent with the regex behavior of DB-level filters.
       */
      decryptedPayments = decryptedPayments.filter((payment) => {
        for (const [field, searchValue] of Object.entries(encryptedFilters)) {
          const fieldValue = payment[field];
          /**
           * If the field doesn't exist on this payment type (e.g., searching
           * for upiId on a Bank payment), skip it — it's not a match for
           * that field, but other criteria might still match.
           */
          if (!fieldValue) return false;

          /**
           * Case-insensitive partial match
           * Convert both to lowercase and use includes() for substring search
           */
          if (!fieldValue.toLowerCase().includes(searchValue)) {
            return false;
          }
        }
        return true;
      });

      /**
       * Apply pagination to the filtered results
       *
       * Since filtering happened in-memory, pagination must also
       * be applied in-memory using Array.slice().
       */
      totalCount = decryptedPayments.length;
      const startIndex = (page - 1) * limit;
      payments = decryptedPayments.slice(startIndex, startIndex + limit);
    } else {
      /**
       * DB-LEVEL PAGINATION PATH
       *
       * No encrypted field filters → we can use efficient DB-level
       * skip/limit pagination.
       */
      totalCount = await Payment.countDocuments(query);

      const skip = (page - 1) * limit;

      const rawPayments = await Payment.find(query)
        .populate('user', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      /**
       * Decrypt the paginated results
       */
      payments = rawPayments.map((payment) =>
        Payment.decryptFields(payment)
      );
    }

    /**
     * Calculate total pages and return the response
     */
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      payments,
      currentPage: page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error('❌ Filter payments error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to filter payments.',
    });
  }
};

module.exports = { getAllPayments, filterPayments };
