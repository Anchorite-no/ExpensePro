/**
 * Client-side E2E encryption utilities using Web Crypto API.
 * Encrypts expense fields (title, category, note) before sending to server.
 * Amount and date are NOT encrypted.
 */

const PBKDF2_ITERATIONS = 100000;

/** Derive a 256-bit key from password + salt using PBKDF2 */
export async function deriveKeyFromPassword(password: string, saltBase64: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    const salt = base64ToBuffer(saltBase64);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true, // extractable for master key operations
        ["encrypt", "decrypt"]
    );
}

/** Decrypt the encrypted master key with the password-derived key */
export async function decryptMasterKey(
    encryptedMasterKeyStr: string,
    passwordKey: CryptoKey
): Promise<CryptoKey> {
    const masterKeyBase64 = await decryptString(encryptedMasterKeyStr, passwordKey);
    const masterKeyBytes = base64ToBuffer(masterKeyBase64);
    return crypto.subtle.importKey(
        "raw", masterKeyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
    );
}

/** Encrypt a string with AES-256-GCM. Returns "iv:ciphertext:tag" in base64 */
async function encryptString(plaintext: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(plaintext)
    );
    // AES-GCM appends the 16-byte tag to the ciphertext
    const ctBytes = new Uint8Array(ciphertext);
    const encryptedData = ctBytes.slice(0, ctBytes.length - 16);
    const tag = ctBytes.slice(ctBytes.length - 16);
    return `${bufferToBase64(iv)}:${bufferToBase64(encryptedData)}:${bufferToBase64(tag)}`;
}

/** Decrypt "iv:ciphertext:tag" format */
async function decryptString(encryptedStr: string, key: CryptoKey): Promise<string> {
    const parts = encryptedStr.split(":");
    if (parts.length !== 3) throw new Error("Invalid encrypted format");
    const iv = base64ToBuffer(parts[0]);
    const encBytes = new Uint8Array(base64ToBuffer(parts[1]));
    const tagBytes = new Uint8Array(base64ToBuffer(parts[2]));
    // Combine ciphertext + tag for AES-GCM
    const combined = new Uint8Array(encBytes.length + tagBytes.length);
    combined.set(encBytes, 0);
    combined.set(tagBytes, encBytes.length);
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        combined
    );
    return new TextDecoder().decode(decrypted);
}

/** Encrypt expense fields */
export async function encryptExpense(
    expense: { title: string; category: string; note?: string },
    masterKey: CryptoKey
): Promise<{ title: string; category: string; note?: string }> {
    const [title, category] = await Promise.all([
        encryptString(expense.title, masterKey),
        encryptString(expense.category, masterKey),
    ]);
    let note: string | undefined;
    if (expense.note) {
        note = await encryptString(expense.note, masterKey);
    }
    return { title, category, note };
}

/** Decrypt expense fields */
export async function decryptExpense<T extends { title: string; category: string; note?: string | null }>(
    expense: T,
    masterKey: CryptoKey
): Promise<T> {
    try {
        const [title, category] = await Promise.all([
            decryptString(expense.title, masterKey),
            decryptString(expense.category, masterKey),
        ]);
        let note = expense.note;
        if (note) {
            try { note = await decryptString(note, masterKey); } catch { /* keep as is */ }
        }
        return { ...expense, title, category, note };
    } catch {
        // [Safety Check] 拦截格式明显损坏的 E2EE 密文，防止污染前端视觉
        if (typeof expense.title === 'string' && expense.title.includes('==')) {
            return {
                ...expense,
                title: '【无效的加密数据】',
                category: '数据损坏',
                note: '解密失败，可能是旧的异常僵尸数据，请删除'
            };
        }
        // 如果不是密文特征（可能真的是早期未加密的明文），则保留向后兼容
        return expense;
    }
}

/** Batch decrypt expenses */
export async function decryptExpenses<T extends { title: string; category: string; note?: string | null }>(
    expenses: T[],
    masterKey: CryptoKey
): Promise<T[]> {
    return Promise.all(expenses.map(e => decryptExpense(e, masterKey)));
}

// === Helpers ===
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}
