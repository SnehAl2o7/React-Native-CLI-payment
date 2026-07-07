/**
 * ============================================================================
 * Admin Authorization Middleware — server/middleware/adminAuth.js
 * ============================================================================
 *
 * A role-checking middleware that restricts access to admin-only routes.
 *
 * IMPORTANT: This middleware MUST be placed AFTER the `auth` middleware
 * in the route chain. It assumes that `req.user` has already been populated
 * by the auth middleware with the decoded JWT payload ({ id, role }).
 *
 * Usage:
 *   router.get('/admin-only', auth, adminAuth, controller.handler);
 *                              ↑      ↑
 *                          runs 1st  runs 2nd
 *
 * Flow:
 *   1. auth middleware verifies the JWT and sets req.user = { id, role }
 *   2. adminAuth checks that req.user.role === 'admin'
 *   3. If the role matches, the request proceeds to the controller
 *   4. If not, a 403 Forbidden response is returned
 *
 * Why 403 and not 401?
 *   - 401 Unauthorized = "I don't know who you are" (identity problem)
 *   - 403 Forbidden = "I know who you are, but you don't have permission"
 *     (authorization problem)
 *   The user IS authenticated (auth middleware passed), but they lack
 *   the required role — hence 403.
 *
 * ============================================================================
 */

/**
 * adminAuth — Express middleware function
 *
 * @param {Object}   req  — Express request object (must have req.user from auth middleware)
 * @param {Object}   res  — Express response object
 * @param {Function} next — callback to pass control to the next middleware
 */
const adminAuth = (req, res, next) => {
  /**
   * Safety check: ensure req.user exists
   *
   * If this middleware is accidentally used without the auth middleware,
   * req.user will be undefined. We handle this gracefully with a
   * descriptive error instead of crashing with "Cannot read property
   * 'role' of undefined".
   */
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in first.',
    });
  }

  /**
   * Role check: only 'admin' users may proceed
   *
   * The role was set in the JWT payload during token generation
   * and extracted by the auth middleware. We compare against the
   * string 'admin' (as defined in the User model's enum).
   */
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }

  /**
   * The user is authenticated AND has admin role — proceed to the
   * next middleware or route handler.
   */
  next();
};

module.exports = adminAuth;
