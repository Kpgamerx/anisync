/**
 * AES-256-GCM token encryption (Security rule S1).
 *
 * AniList access/refresh tokens MUST be encrypted before any database write.
 * Node.js runtime only (the crypto.subtle API cannot decrypt in one pass with
 * AAD semantics) — never import this module from Edge Runtime route handlers.
 *
 * Stored format: JSON string {"iv":"<hex>","tag":"<hex>","ciphertext":"<hex>"}
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export class CryptoError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CryptoError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

interface EncryptedEnvelope {
  iv: string;
  tag: string;
  ciphertext: string;
}

/** Reads and validates the 32-byte hex ENCRYPTION_KEY. Throws CryptoError on failure. */
function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new CryptoError(
      "ENCRYPTION_KEY environment variable is not set — token encryption is unavailable.",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new CryptoError(
      "ENCRYPTION_KEY must be a 32-byte value encoded as 64 hex characters.",
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext token with AES-256-GCM using a random 12-byte IV.
 * Returns the JSON envelope for database storage.
 *
 * @throws {CryptoError} if the key is missing/invalid or encryption fails.
 */
export function encryptToken(plain: string): string {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new CryptoError("encryptToken requires a non-empty plaintext token.");
  }

  let key: Buffer;
  try {
    key = getKey();
  } catch (error) {
    throw new CryptoError("Token encryption failed: key unavailable.", error);
  }

  const iv = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const envelope: EncryptedEnvelope = {
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      ciphertext: ciphertext.toString("hex"),
    };
    return JSON.stringify(envelope);
  } catch (error) {
    throw new CryptoError("Token encryption failed.", error);
  }
}

/**
 * Decrypts a stored JSON envelope back to the plaintext token.
 *
 * @throws {CryptoError} on malformed envelope, bad key, or authentication
 *   failure (tampered ciphertext). Never returns partial/empty data.
 */
export function decryptToken(stored: string): string {
  if (typeof stored !== "string" || stored.length === 0) {
    throw new CryptoError("decryptToken requires a stored envelope string.");
  }

  let key: Buffer;
  try {
    key = getKey();
  } catch (error) {
    throw new CryptoError("Token decryption failed: key unavailable.", error);
  }

  let envelope: EncryptedEnvelope;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("iv" in parsed) ||
      !("tag" in parsed) ||
      !("ciphertext" in parsed)
    ) {
      throw new CryptoError("Stored token envelope is malformed.");
    }
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.iv !== "string" ||
      typeof candidate.tag !== "string" ||
      typeof candidate.ciphertext !== "string"
    ) {
      throw new CryptoError("Stored token envelope has invalid field types.");
    }
    envelope = {
      iv: candidate.iv,
      tag: candidate.tag,
      ciphertext: candidate.ciphertext,
    };
  } catch (error) {
    if (error instanceof CryptoError) throw error;
    throw new CryptoError("Stored token envelope is not valid JSON.", error);
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(envelope.iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "hex")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (error) {
    throw new CryptoError(
      "Token decryption failed — ciphertext may be corrupted or tampered.",
      error,
    );
  }
}

/** Returns true only when the stored envelope decrypts cleanly. Never throws. */
export function isTokenDecryptable(stored: string): boolean {
  try {
    decryptToken(stored);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deterministic HMAC-style hash for non-reversible identifiers (e.g. OAuth
 * PKCE state binding). Uses SHA-256 keyed through a pre-hash; the ENCRYPTION_KEY
 * is never exposed in output. Returns hex.
 *
 * @throws {CryptoError} if the key is missing/invalid.
 */
export function hmacHash(input: string): string {
  const key = getKey();
  const pre = createHash("sha256").update(input).digest();
  const mac = createHash("sha256").update(Buffer.concat([key, pre])).digest();
  return mac.toString("hex");
}
