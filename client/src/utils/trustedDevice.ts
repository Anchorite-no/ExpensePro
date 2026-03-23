const DB_NAME = "expensepro-secure-store";
const STORE_NAME = "secure-items";
const DEVICE_KEY_ID = "device-key";
const WRAPPED_KEY_PREFIX = "wrapped-master-key:";
const IV_LENGTH = 12;

function isSupported() {
  return typeof window !== "undefined" && "indexedDB" in window && !!window.crypto?.subtle;
}

function getWrappedKeyId(username: string) {
  return `${WRAPPED_KEY_PREFIX}${username}`;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error("Trusted device storage is not supported"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getOrCreateDeviceKey(store: IDBObjectStore) {
  const existingKey = await requestToPromise<CryptoKey | undefined>(store.get(DEVICE_KEY_ID));
  if (existingKey) return existingKey;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  await requestToPromise(store.put(key, DEVICE_KEY_ID));
  return key;
}

async function wrapMasterKey(masterKey: CryptoKey, deviceKey: CryptoKey) {
  const rawMasterKey = await crypto.subtle.exportKey("raw", masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, deviceKey, rawMasterKey);
  return `${bufferToBase64(iv)}:${bufferToBase64(encrypted)}`;
}

async function unwrapMasterKey(wrappedValue: string, deviceKey: CryptoKey) {
  const parts = wrappedValue.split(":");
  if (parts.length !== 2) throw new Error("Invalid trusted device payload");

  const iv = new Uint8Array(base64ToBuffer(parts[0]));
  const encrypted = base64ToBuffer(parts[1]);
  const rawMasterKey = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, deviceKey, encrypted);
  return crypto.subtle.importKey(
    "raw",
    rawMasterKey,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function saveTrustedMasterKey(username: string, masterKey: CryptoKey) {
  if (!isSupported()) return false;

  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const deviceKey = await getOrCreateDeviceKey(store);
    const wrappedMasterKey = await wrapMasterKey(masterKey, deviceKey);
    await requestToPromise(store.put(wrappedMasterKey, getWrappedKeyId(username)));
    await transactionDone(transaction);
    return true;
  } finally {
    database.close();
  }
}

export async function loadTrustedMasterKey(username: string) {
  if (!isSupported()) return null;

  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const deviceKey = await requestToPromise<CryptoKey | undefined>(store.get(DEVICE_KEY_ID));
    const wrappedMasterKey = await requestToPromise<string | undefined>(store.get(getWrappedKeyId(username)));
    await transactionDone(transaction);

    if (!deviceKey || !wrappedMasterKey) return null;
    return await unwrapMasterKey(wrappedMasterKey, deviceKey);
  } finally {
    database.close();
  }
}

export async function clearTrustedMasterKey(username: string) {
  if (!isSupported()) return;

  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.delete(getWrappedKeyId(username)));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
