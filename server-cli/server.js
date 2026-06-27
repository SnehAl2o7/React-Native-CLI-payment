/**
 * ============================================================================
 * Express Application Entry Point — server/server.js
 * ============================================================================
 *
 * This is the main file that bootstraps the entire backend application.
 *
 * Responsibilities:
 *   1. Load environment variables from .env
 *   2. Initialise Express and configure global middleware
 *   3. Mount route modules at their respective API paths
 *   4. Register a global error handler (catch-all for unhandled errors)
 *   5. Connect to MongoDB and start the HTTP server
 *
 * Architecture:
 *   The application follows a layered architecture:
 *     Routes → Controllers → Models → Database
 *
 *   - Routes:      define HTTP endpoints and apply middleware
 *   - Controllers: contain business logic and call models
 *   - Models:      define data schemas and interact with MongoDB
 *   - Middleware:   cross-cutting concerns (auth, validation, error handling)
 *
 * Startup order:
 *   1. Environment config is loaded (synchronous)
 *   2. Express is configured (synchronous)
 *   3. Routes are mounted (synchronous)
 *   4. MongoDB connection is established (async)
 *   5. HTTP server starts listening (async, after DB connection)
 *
 * ============================================================================
 */

/**
 * Step 1: Load Environment Variables
 *
 * dotenv reads the .env file and injects its key-value pairs into
 * process.env. This MUST happen before any other imports that
 * reference process.env (e.g., config/db.js uses MONGO_URI).
 *
 * In production, environment variables are typically set by the
 * hosting platform (Docker, AWS, Heroku) — .env is for local dev only.
 */
require('dotenv').config();

/**
 * Step 2: Import Dependencies
 *
 * We import everything after dotenv so that process.env is populated
 * by the time these modules initialise.
 */
const express = require('express');
const cors = require('cors');

/* Database connection function */
const connectDB = require('./config/db');

/* Route modules — each handles a subset of the API */
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');

/**
 * Step 3: Create the Express Application
 *
 * express() returns a new Express application instance.
 * This object is the core of the server — it handles requests,
 * applies middleware, and dispatches to route handlers.
 */
const app = express();

/**
 * Step 4: Configure Global Middleware
 *
 * Middleware functions run in the order they are registered (app.use).
 * Global middleware applies to ALL incoming requests, regardless of route.
 */

/**
 * CORS (Cross-Origin Resource Sharing)
 *
 * Browsers enforce the Same-Origin Policy: a web page at origin A
 * cannot make requests to origin B unless B explicitly allows it.
 *
 * Our frontend runs on http://localhost:5173 (Vite dev server) while
 * the backend runs on http://localhost:5000. Without CORS headers,
 * the browser would block all API requests from the frontend.
 *
 * cors() adds the necessary headers:
 *   - Access-Control-Allow-Origin: http://localhost:5173
 *   - Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE
 *   - Access-Control-Allow-Headers: Content-Type, Authorization
 *
 * In production, replace the origin with your actual frontend domain.
 */
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:5173',
        'https://multiple-payment-agent.netlify.app'
      ];
      
      // Allow local development origins or allowed origins list
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:') || origin.startsWith('http://10.0.2.2:')) {
        return callback(null, true);
      }
      
      return callback(null, true); // Fallback to allow all for development ease
    },
    credentials: true, // Allow cookies/auth headers to be sent
  })
);

/**
 * JSON Body Parser
 *
 * express.json() parses incoming requests with JSON payloads
 * (Content-Type: application/json) and populates req.body with
 * the parsed JavaScript object.
 *
 * The { limit: '10mb' } option sets the maximum request body size.
 * This prevents denial-of-service attacks where an attacker sends
 * an extremely large JSON payload to consume server memory.
 * 10MB is generous for our use case (payment data is small).
 */
app.use(express.json({ limit: '10mb' }));

/**
 * URL-encoded Body Parser
 *
 * express.urlencoded() parses bodies sent with Content-Type:
 * application/x-www-form-urlencoded (standard HTML form submissions).
 *
 * extended: true allows nested objects in the URL-encoded data
 * (using the qs library). While our API primarily uses JSON,
 * this ensures compatibility with form-based clients.
 */
app.use(express.urlencoded({ extended: true }));

/**
 * Step 5: Mount Route Modules
 *
 * Each route module handles a specific API domain:
 *
 * /api/auth            — authentication (register, login)
 * /api/payments        — payment method CRUD (user-scoped)
 * /api/admin/payments  — admin payment management (all users)
 *
 * The mount path is prepended to every route defined in the module.
 * For example, authRoutes defines POST /register, which becomes
 * POST /api/auth/register when mounted at /api/auth.
 */
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/payments', adminRoutes);

/**
 * Step 6: Health Check Endpoint
 *
 * A simple GET endpoint that returns 200 OK.
 * Used by load balancers, monitoring tools, and Docker health checks
 * to verify the server is running and responsive.
 *
 * This route is intentionally NOT behind authentication — health
 * checks need to work without a JWT.
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment Info System API is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Step 7: 404 Handler
 *
 * This middleware catches requests to undefined routes.
 * It runs after all route modules, so if no route matched,
 * execution reaches here.
 *
 * Without this, Express would return its default HTML error page,
 * which is not useful for an API client expecting JSON.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/**
 * Step 8: Global Error Handler
 *
 * Express identifies error-handling middleware by its 4-parameter
 * signature (err, req, res, next). This is the catch-all for
 * any unhandled errors that bubble up from routes or middleware.
 *
 * When a middleware or route handler calls next(error) or throws
 * an unhandled error, Express skips all remaining non-error middleware
 * and jumps directly to this handler.
 *
 * This ensures:
 *   - All errors return consistent JSON responses
 *   - Error details are logged for debugging
 *   - Internal error details are NOT leaked to the client
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  /**
   * Log the full error stack for debugging.
   * In production, this should go to a logging service (Winston, Pino,
   * Datadog, etc.) rather than stdout.
   */
  console.error('❌ Unhandled error:', err.stack || err.message);

  /**
   * Determine the HTTP status code.
   *
   * If the error has a statusCode property (set by a middleware or
   * library), use it. Otherwise, default to 500 Internal Server Error.
   *
   * We also check res.statusCode in case a middleware set the status
   * before calling next(error).
   */
  const statusCode = err.statusCode || res.statusCode === 200
    ? 500
    : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    /**
     * Only include the error stack trace in development mode.
     * In production, the stack trace could reveal internal file paths,
     * library versions, and other information useful to attackers.
     */
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

/**
 * Step 9: Connect to Database and Start Server
 *
 * We establish the MongoDB connection BEFORE starting the HTTP server.
 * This ensures that when the server starts accepting requests, the
 * database is ready to handle queries.
 *
 * If the database connection fails, connectDB() calls process.exit(1),
 * so the server never starts.
 *
 * The PORT defaults to 5000 if not set in .env.
 */
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('============================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API base URL: http://localhost:${PORT}/api`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log('============================================');
    console.log('');
  });
});

module.exports = app;
