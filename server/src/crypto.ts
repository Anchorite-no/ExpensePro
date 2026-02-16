import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;

/** Generate a random 32-byte master key */
export function generateMasterKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
}

/** Generate a random salt for PBKDF2 */
export function generateSalt(): string {
    return crypto.randomBytes(32).toString("base64");
}

/** Derive a 256-bit key from password + salt using PBKDF2 */
export function deriveKeyFromPassword(password: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(password, Buffer.from(salt, "base64"), PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

/** Encrypt plaintext with AES-256-GCM. Returns "iv:ciphertext:tag" in base64 */
export function encrypt(plaintext: string, key: Buffer): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

/** Decrypt "iv:ciphertext:tag" format with AES-256-GCM */
export function decrypt(encryptedStr: string, key: Buffer): string {
    const parts = encryptedStr.split(":");
    if (parts.length !== 3) throw new Error("Invalid encrypted format");
    const iv = Buffer.from(parts[0], "base64");
    const encrypted = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Encrypt master key with password-derived key */
export function encryptMasterKey(masterKey: Buffer, passwordKey: Buffer): string {
    return encrypt(masterKey.toString("base64"), passwordKey);
}

/** Decrypt master key with password-derived key */
export function decryptMasterKey(encryptedMasterKey: string, passwordKey: Buffer): Buffer {
    const decoded = decrypt(encryptedMasterKey, passwordKey);
    return Buffer.from(decoded, "base64");
}
