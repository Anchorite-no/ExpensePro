import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearTrustedMasterKey, loadTrustedMasterKey, saveTrustedMasterKey } from '../utils/trustedDevice';

interface User {
  username: string;
}

interface LoginOptions {
  encryption?: boolean;
  masterKey?: CryptoKey;
  trustedDevice?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  masterKey: CryptoKey | null;
  encryption: boolean;
  login: (token: string, username: string, options?: LoginOptions) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type StorageKind = 'local' | 'session';

const AUTH_KEYS = ['token', 'username', 'encryption', 'masterKey'] as const;

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  return kind === 'local' ? window.localStorage : window.sessionStorage;
}

function readStoredValue(kind: StorageKind, key: typeof AUTH_KEYS[number]): string | null {
  return getStorage(kind)?.getItem(key) ?? null;
}

function writeStoredValue(kind: StorageKind, key: typeof AUTH_KEYS[number], value: string) {
  getStorage(kind)?.setItem(key, value);
}

function removeStoredValue(kind: StorageKind, key: typeof AUTH_KEYS[number]) {
  getStorage(kind)?.removeItem(key);
}

function clearStoredAuth(kind?: StorageKind) {
  const targets: StorageKind[] = kind ? [kind] : ['local', 'session'];
  targets.forEach((target) => {
    AUTH_KEYS.forEach((key) => removeStoredValue(target, key));
  });
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function exportMasterKey(masterKey: CryptoKey) {
  const rawMasterKey = await crypto.subtle.exportKey('raw', masterKey);
  return bufferToBase64(rawMasterKey);
}

async function importMasterKey(serializedMasterKey: string) {
  return crypto.subtle.importKey(
    'raw',
    base64ToBuffer(serializedMasterKey),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

function getStoredAuthSource() {
  const kinds: StorageKind[] = ['local', 'session'];

  for (const kind of kinds) {
    const token = readStoredValue(kind, 'token');
    const username = readStoredValue(kind, 'username');

    if (token && username) {
      return {
        kind,
        token,
        username,
        encryption: readStoredValue(kind, 'encryption') === 'true',
        masterKey: readStoredValue(kind, 'masterKey'),
      };
    }
  }

  return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [encryption, setEncryption] = useState(() => {
    const storedAuth = getStoredAuthSource();
    return storedAuth?.encryption ?? false;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedAuth = getStoredAuthSource();

    if (!storedAuth) {
      setIsLoading(false);
      return;
    }

    if (!storedAuth.encryption) {
      setToken(storedAuth.token);
      setUser({ username: storedAuth.username });
      setIsLoading(false);
      return;
    }

    if (storedAuth.kind === 'session') {
      if (!storedAuth.masterKey) {
        clearStoredAuth('session');
        setIsLoading(false);
        return;
      }

      importMasterKey(storedAuth.masterKey)
        .then((restoredMasterKey) => {
          setMasterKey(restoredMasterKey);
          setEncryption(true);
          setToken(storedAuth.token);
          setUser({ username: storedAuth.username });
        })
        .catch(() => {
          clearStoredAuth('session');
        })
        .finally(() => {
          setIsLoading(false);
        });
      return;
    }

    loadTrustedMasterKey(storedAuth.username)
      .then((restoredMasterKey) => {
        if (!restoredMasterKey) {
          clearStoredAuth('local');
          return;
        }

        setMasterKey(restoredMasterKey);
        setEncryption(true);
        setToken(storedAuth.token);
        setUser({ username: storedAuth.username });
      })
      .catch(() => {
        clearStoredAuth('local');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (newToken: string, newUsername: string, options?: LoginOptions) => {
    const encryptionEnabled = !!options?.encryption;
    const newMasterKey = options?.masterKey ?? null;
    const trustedDevice = options?.trustedDevice ?? true;

    clearStoredAuth();

    if (encryptionEnabled && newMasterKey) {
      if (trustedDevice) {
        writeStoredValue('local', 'token', newToken);
        writeStoredValue('local', 'username', newUsername);
        writeStoredValue('local', 'encryption', 'true');

        await saveTrustedMasterKey(newUsername, newMasterKey).catch(() => {
          console.warn('Failed to persist trusted device key material');
        });
      } else {
        writeStoredValue('session', 'token', newToken);
        writeStoredValue('session', 'username', newUsername);
        writeStoredValue('session', 'encryption', 'true');
        writeStoredValue('session', 'masterKey', await exportMasterKey(newMasterKey));

        await clearTrustedMasterKey(newUsername).catch(() => {
          console.warn('Failed to clear trusted device key material');
        });
      }

      setMasterKey(newMasterKey);
    } else {
      writeStoredValue('local', 'token', newToken);
      writeStoredValue('local', 'username', newUsername);
      setMasterKey(null);
    }

    setEncryption(encryptionEnabled);
    setToken(newToken);
    setUser({ username: newUsername });
  };

  const logout = () => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
    setMasterKey(null);
    setEncryption(false);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">
          <div className="loading-logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span className="loading-app-name">ExpensePro</span>
        </div>
        <div className="loading-spinner-container">
          <div className="loading-spinner" />
          <span className="loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, masterKey, encryption, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
