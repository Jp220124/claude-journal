import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// Get encryption key from environment or generate a default one
// In production, this should be a secure environment variable
const getEncryptionKey = (): Buffer => {
  const secret = process.env.AI_ENCRYPTION_SECRET || 'claude-journal-default-key-change-in-prod'
  return scryptSync(secret, 'salt', 32)
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Encrypt a string (API key or token)
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Combine IV + authTag + encrypted data
  return iv.toString('hex') + authTag.toString('hex') + encrypted
}

/**
 * Decrypt a string (API key or token)
 */
export function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey()

  // Extract IV, authTag, and encrypted data
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex')
  const authTag = Buffer.from(encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2), 'hex')
  const encrypted = encryptedData.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Mask an API key for display (show first 4 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****'
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
}
