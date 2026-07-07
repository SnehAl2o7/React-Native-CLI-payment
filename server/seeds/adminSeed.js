/**
 * ============================================================================
 * Admin Seed Script — server/seeds/adminSeed.js
 * ============================================================================
 *
 * A standalone script to create the initial admin user account.
 *
 * Usage:
 *   npm run seed:admin
 *   — or —
 *   node seeds/adminSeed.js
 *
 * This script:
 *   1. Loads environment variables from .env
 *   2. Connects to MongoDB
 *   3. Checks if an admin account (admin@admin.com) already exists
 *   4. If not, creates one with default credentials
 *   5. Disconnects from MongoDB and exits
 *
 * The admin account has:
 *   - username: 'admin'
 *   - email:    'admin@admin.com'
 *   - password: 'Admin@123' (hashed by the User model's pre-save hook)
 *   - role:     'admin'
 *
 * IMPORTANT: In production, change the admin password immediately after
 * running this script. The default password is intentionally simple for
 * initial setup convenience only.
 *
 * ============================================================================
 */

/**
 * Load environment variables from .env file
 *
 * We use path.resolve to construct an absolute path to the .env file,
 * relative to this script's location (seeds/ directory). This ensures
 * the script works regardless of the current working directory.
 *
 * __dirname is the directory containing this script file.
 * '../.env' navigates up one level to the server/ directory.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * seedAdmin()
 *
 * Async function that performs the seeding operation.
 * We wrap the logic in an async function so we can use await
 * for the database operations.
 */
const seedAdmin = async () => {
  try {
    /**
     * Step 1: Connect to MongoDB
     *
     * We connect directly using mongoose.connect() instead of importing
     * the connectDB function from config/db.js because:
     *   - This is a standalone script, not part of the Express app
     *   - We want to disconnect immediately after seeding
     *   - The SIGINT handler in db.js would interfere with the script's exit
     */
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding');

    /**
     * Step 2: Check if the admin account already exists
     *
     * We search by email because it's the unique identifier.
     * This prevents duplicate admin accounts if the script is run
     * multiple times (idempotent operation).
     */
    const existingAdmin = await User.findOne({ email: 'admin@admin.com' });

    if (existingAdmin) {
      /**
       * Admin already exists — log a message and skip creation.
       * This is not an error; the script is designed to be safe to re-run.
       */
      console.log('ℹ️  Admin user already exists. Skipping creation.');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role:  ${existingAdmin.role}`);
    } else {
      /**
       * Step 3: Create the admin user
       *
       * User.create() is equivalent to `new User({...}).save()`.
       * The pre-save hook on the User model will automatically hash
       * the password before storing it in MongoDB.
       *
       * We explicitly set role to 'admin' (the default is 'user').
       */
      const admin = await User.create({
        username: 'admin',
        email: 'admin@admin.com',
        password: 'Admin@123',
        role: 'admin',
      });

      console.log('✅ Admin user created successfully!');
      console.log(`   Username: ${admin.username}`);
      console.log(`   Email:    ${admin.email}`);
      console.log(`   Role:     ${admin.role}`);
      console.log('');
      console.log('⚠️  IMPORTANT: Change the admin password in production!');
    }
  } catch (error) {
    /**
     * Error handling
     *
     * Common errors:
     *   - MongoDB not running (ECONNREFUSED)
     *   - Wrong MONGO_URI in .env
     *   - Validation errors (shouldn't happen with the hardcoded values)
     */
    console.error('❌ Seeding error:', error.message);
  } finally {
    /**
     * Step 4: Disconnect from MongoDB
     *
     * Always disconnect, whether seeding succeeded or failed.
     * This closes the connection pool and allows the script to exit cleanly.
     *
     * mongoose.disconnect() is different from mongoose.connection.close():
     *   - disconnect() closes ALL connections across ALL models
     *   - connection.close() closes a specific connection
     * For a seed script, disconnect() is the right choice.
     */
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

    /**
     * Exit the process explicitly
     *
     * Node.js would eventually exit on its own after all async operations
     * complete, but process.exit(0) makes it immediate and explicit.
     * Exit code 0 indicates successful completion.
     */
    process.exit(0);
  }
};

/**
 * Execute the seed function
 *
 * This is the entry point of the script. When you run `node seeds/adminSeed.js`,
 * this line triggers the entire seeding process.
 */
seedAdmin();
