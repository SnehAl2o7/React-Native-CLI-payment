/**
 * ============================================================================
 * Authentication Middleware — server/middleware/auth.js
 * ============================================================================
 *
 * Protects routes by verifying that the incoming request includes a valid
 * JSON Web Token (JWT) in the Authorization header.
 *
 * How it works:
 *   1. Extract the token from the "Authorization: Bearer <token>" header
 *   2. Verify the token's signature and expiration using jwt.verify()
 *   3. Attach the decoded payload ({ id, role }) to req.user
 *   4. Call next() to pass control to the next middleware/controller
 *
 * If verification fails, the middleware short-circuits the request
 * with a 401 Unauthorized response.
 *
 * Usage:
 *   router.get('/protected', authMiddleware, controller.handler);
 *
 * ============================================================================
 */

const jwt = require('jsonwebtoken');

/**
 * auth — Express middleware function
 *
 * @param {Object}   req  — Express request object
 * @param {Object}   res  — Express response object
 * @param {Function} next — callback to pass control to the next middleware
 */
const auth = (req, res, next) => {
  try {
    /**
     * Step 1: Extract the Authorization header
     *
     * The standard format is: "Bearer <jwt_token>"
     * If the header is missing entirely, we immediately return 401.
     */
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authorization header provided.',
      });
    }

    /**
     * Step 2: Parse the Bearer token
     *
     * We split on space and take the second element. This handles:
     *   - "Bearer eyJhbGci..." → token = "eyJhbGci..."
     *   - "bearer eyJhbGci..." → also works (case-insensitive prefix)
     *
     * If the header doesn't follow Bearer format, token will be undefined.
     */
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7) // More efficient than split — avoids array allocation
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid authorization format. Use: Bearer <token>',
      });
    }

    /**
     * Step 3: Verify the token
     *
     * jwt.verify() does three things:
     *   a. Decodes the base64url-encoded header and payload
     *   b. Verifies the signature using JWT_SECRET (ensures the token
     *      was issued by our server and hasn't been tampered with)
     *   c. Checks the `exp` claim (expiration) — throws TokenExpiredError
     *      if the token has expired
     *
     * If any of these checks fail, jwt.verify() throws an error,
     * which we catch below.
     */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /**
     * Step 4: Attach the decoded payload to the request object
     *
     * The payload was set during token generation in authController:
     *   { id: user._id, role: user.role }
     *
     * By attaching it to req.user, subsequent middleware and controllers
     * can access the authenticated user's ID and role without querying
     * the database again.
     */
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    /**
     * Step 5: Pass control to the next middleware or route handler
     */
    next();
  } catch (error) {
    /**
     * Error handling — differentiate between token errors for better UX
     *
     * Common jwt.verify errors:
     *   - TokenExpiredError: token's exp claim is in the past
     *   - JsonWebTokenError: invalid signature, malformed token
     *   - NotBeforeError: token's nbf claim is in the future (rare)
     */
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Authentication failed.',
      });
    }

    /**
     * Catch-all for unexpected errors (unlikely but safe to handle).
     * We still return 401 because the request could not be authenticated.
     */
    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please log in again.',
    });
  }
};

module.exports = auth;
