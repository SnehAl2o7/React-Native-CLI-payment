/**
 * ============================================================================
 * Database Configuration — server/config/db.js
 * ============================================================================
 *
 * This module handles the MongoDB connection lifecycle using Mongoose.
 * It exports a single `connectDB` function that:
 *   1. Reads the connection URI from environment variables
 *   2. Establishes the connection to MongoDB
 *   3. Logs success or failure
 *   4. Registers a SIGINT handler for graceful shutdown
 *
 * Why a dedicated module?
 *   - Separation of concerns: connection logic stays out of server.js
 *   - Reusable: the seed script and tests can import the same function
 *   - Centralised error handling for DB connectivity
 * ============================================================================
 */

const mongoose = require('mongoose');

/**
 * connectDB()
 *
 * Establishes a connection to MongoDB using the URI defined in the MONGO_URI
 * environment variable. Mongoose 8.x no longer requires the deprecated options
 * like `useNewUrlParser` or `useUnifiedTopology` — they are enabled by default.
 *
 * @returns {Promise<void>} Resolves when the connection is established.
 * @throws  Will log the error and terminate the process on connection failure.
 */
const connectDB = async () => {
  try {
    /**
     * mongoose.connect() returns a Mongoose instance (not the native driver).
     * We destructure `connection` to access host and port for logging.
     *
     * The MONGO_URI should include the replica-set parameter if you need
     * multi-document transaction support (e.g., ?replicaSet=rs0).
     */
    const conn = await mongoose.connect(process.env.MONGO_URI);

    /**
     * Log the host so the developer can verify which MongoDB instance
     * the server has connected to (especially useful when switching between
     * local, staging, and production environments).
     */
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    /**
     * If the initial connection fails (wrong URI, network issue, auth failure),
     * log the error and exit immediately. There is no point in starting the
     * HTTP server if the database is unreachable.
     *
     * process.exit(1) indicates an abnormal termination — useful for process
     * managers (PM2, Docker) that can auto-restart the service.
     */
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 *
 * When the process receives SIGINT (Ctrl+C in the terminal, or a signal from
 * the process manager), we close the Mongoose connection cleanly before
 * exiting. This ensures:
 *   - In-flight operations are completed or properly aborted
 *   - Connection pools are drained
 *   - No zombie connections remain on the MongoDB server
 *
 * We use `process.on` rather than `process.once` because some environments
 * can send SIGINT multiple times; however, the first invocation will call
 * process.exit(0), making subsequent calls irrelevant.
 */
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed due to application termination');
    process.exit(0);
  } catch (error) {
    /**
     * If closing the connection itself fails (extremely rare), log it and
     * force-exit. We still use exit code 0 because the intent was a clean
     * shutdown, not a crash.
     */
    console.error('❌ Error closing MongoDB connection:', error.message);
    process.exit(0);
  }
});

module.exports = connectDB;
