// api/crypto.js
// AES-256-GCM Encryption & Decryption for sensitive user data

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Gets the 32-byte encryption key from environment.
 * Falls back to a deterministic dev key if not configured.
 */
function getKey() {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey || hexKey === '0'.repeat(64)) {
    // Development fallback - NOT secure for production!
    console.warn('[CRYPTO] WARNING: Using default dev encryption key. Set ENCRYPTION_KEY env var for production!');
    return Buffer.from('syntiox-dev-key-syntiox-dev-key!', 'utf8'); // 32 bytes
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a JSON string containing iv, authTag, and ciphertext (all base64).
 */
function encrypt(plaintext) {
  if (!plaintext || plaintext === '') return null;
  
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(String(plaintext), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted
  });
}

/**
 * Decrypts an encrypted payload created by encrypt().
 */
function decrypt(encryptedPayload) {
  if (!encryptedPayload) return null;
  
  try {
    const { iv, authTag, data } = JSON.parse(encryptedPayload);
    const key = getKey();
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[CRYPTO] Decryption failed:', error.message);
    return '[ENCRYPTED]';
  }
}

/**
 * Checks if a string looks like an encrypted payload.
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value);
    return !!(parsed.iv && parsed.authTag && parsed.data);
  } catch (_) {
    return false;
  }
}

module.exports = { encrypt, decrypt, isEncrypted };
