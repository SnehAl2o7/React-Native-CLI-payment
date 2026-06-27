/**
 * ============================================================================
 * Field-Level Encryption Utilities — server/config/encryption.js
 * ============================================================================
 *
 * Provides AES-256-GCM symmetric encryption for sensitive payment fields
 * (account numbers, UPI IDs, wallet numbers, etc.).
 *
 * Why AES-256-GCM?
 *   - AES-256 is the gold standard for symmetric encryption (256-bit key)
 *   - GCM (Galois/Counter Mode) provides both confidentiality AND integrity
 *     — it generates an authentication tag that detects tampering
 *   - Unlike CBC, GCM does not require padding and is resistant to
 *     padding-oracle attacks
 *
 * Encrypted format: "iv:authTag:ciphertext" (all hex-encoded, colon-separated)
 *   - iv        — 16-byte Initialisation Vector, randomly generated per encryption
 *   - authTag   — 16-byte authentication tag produced by GCM
 *   - ciphertext — the actual encrypted data
 *
 * Key management:
 *   - The encryption key is read from process.env.ENCRYPTION_KEY
 *   - It MUST be exactly 64 hex characters (= 32 bytes = 256 bits)
 *   - In production, this should be stored in a secrets manager (Vault, AWS KMS)
 *
 * ============================================================================
 */

const crypto = require('crypto');

/**
 * ALGORITHM constant
 *
 * We use 'aes-256-gcm' which requires a 32-byte key and produces
 * an authentication tag alongside the ciphertext.
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * IV_LENGTH — Initialisation Vector length in bytes
 *
 * NIST recommends 12 bytes for GCM, but 16 bytes is also widely used
 * and supported by Node's crypto module. We use 16 bytes here for
 * consistency with other AES modes and because it provides a larger
 * nonce space, reducing the (already negligible) risk of IV collision.
 */
const IV_LENGTH = 16;

/**
 * AUTH_TAG_LENGTH — GCM authentication tag length in bytes
 *
 * GCM supports tag lengths of 4, 8, 12, 13, 14, 15, or 16 bytes.
 * 16 bytes (128 bits) provides the maximum integrity protection.
 */
const AUTH_TAG_LENGTH = 16;

/**
 * getKey()
 *
 * Derives the 32-byte encryption key from the hex-encoded environment variable.
 * This is called every time encrypt/decrypt runs rather than cached at module
 * load so that:
 *   1. The key is not held in a module-level variable longer than necessary
 *   2. If the env var is missing, we get a clear error at call-time, not import-time
 *
 * @returns {Buffer} 32-byte Buffer suitable for AES-256
 * @throws  {Error}  If ENCRYPTION_KEY is missing or not 64 hex characters
 */
const getKey = () => {
  const keyHex = process.env.ENCRYPTION_KEY;

  /* Validate that the key exists and is the correct length */
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be set in .env and be exactly 64 hex characters (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  /**
   * Buffer.from(hex, 'hex') converts the 64-character hex string into
   * a 32-byte binary Buffer that the crypto functions expect.
   */
  return Buffer.from(keyHex, 'hex');
};

/**
 * encrypt(text)
 *
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Steps:
 *   1. Generate a cryptographically random IV (unique per encryption call)
 *   2. Create a Cipher instance with the key, IV, and auth-tag length
 *   3. Feed the plaintext through the cipher
 *   4. Finalise the cipher to flush remaining bytes
 *   5. Retrieve the authentication tag
 *   6. Concatenate iv + authTag + ciphertext in hex, separated by colons
 *
 * @param   {string} text — the plaintext to encrypt
 * @returns {string}       — formatted as "iv:authTag:ciphertext" (all hex)
 * @throws  {Error}        — if text is falsy or encryption fails
 */
const encrypt = (text) => {
  /**
   * Guard clause: if the text is empty/null/undefined, there is nothing
   * to encrypt. We return an empty string rather than crashing, because
   * Mongoose validation will catch required-field violations separately.
   */
  if (!text) return '';

  /* Step 1 — Generate a fresh random IV for this encryption operation */
  const iv = crypto.randomBytes(IV_LENGTH);

  /* Step 2 — Create the AES-256-GCM cipher with the derived key */
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  /**
   * Step 3 & 4 — Encrypt the plaintext
   * cipher.update() processes the bulk of the data
   * cipher.final() flushes any remaining bytes (in GCM, this is usually empty
   * because GCM is a stream cipher, but we still call it for correctness)
   */
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  /**
   * Step 5 — Retrieve the GCM authentication tag
   * This tag is what makes GCM an AEAD (Authenticated Encryption with
   * Associated Data) cipher. It allows the decryptor to verify that the
   * ciphertext was not tampered with.
   */
  const authTag = cipher.getAuthTag();

  /**
   * Step 6 — Return the composite string
   * Format: "iv:authTag:ciphertext"
   * Using colons as delimiters because they cannot appear in hex strings.
   */
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * decrypt(encryptedText)
 *
 * Decrypts a string that was encrypted by the `encrypt` function above.
 *
 * Steps:
 *   1. Split the composite string on ':' to extract iv, authTag, ciphertext
 *   2. Convert hex strings back to Buffers
 *   3. Create a Decipher instance with the same key and IV
 *   4. Set the authentication tag so GCM can verify integrity
 *   5. Feed the ciphertext through the decipher
 *   6. Finalise — this is where GCM verifies the auth tag; if tampering
 *      is detected, final() throws an error
 *
 * @param   {string} encryptedText — the "iv:authTag:ciphertext" string
 * @returns {string}                — the original plaintext
 * @throws  {Error}                 — if the format is wrong, the key is wrong,
 *                                    or the data has been tampered with
 */
const decrypt = (encryptedText) => {
  /**
   * Guard clause: if the encrypted text is empty/null/undefined,
   * return an empty string. This handles edge cases where a field
   * was never encrypted (e.g., during data migration).
   */
  if (!encryptedText) return '';

  /**
   * Step 1 — Parse the composite format
   * We expect exactly 3 parts: [iv, authTag, ciphertext]
   */
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted text format. Expected "iv:authTag:ciphertext".'
    );
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  /* Step 2 — Convert hex strings back to binary Buffers */
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  /* Step 3 — Create the decipher with the same algorithm, key, and IV */
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  /**
   * Step 4 — Set the authentication tag BEFORE calling update/final
   * GCM needs this tag to verify that the ciphertext has not been altered.
   * If the tag doesn't match, final() will throw an authentication error.
   */
  decipher.setAuthTag(authTag);

  /**
   * Step 5 & 6 — Decrypt and finalise
   * decipher.update() processes the ciphertext
   * decipher.final() flushes remaining data and verifies the auth tag
   */
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

module.exports = { encrypt, decrypt };
