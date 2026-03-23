import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  username: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  masterKey: CryptoKey | null;
  encryption: boolean;
  login: (token: string, username: string, masterKey?: CryptoKey, encryption?: boolean) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getAuthStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function readStoredValue(key: string): string | null {
  return getAuthStorage()?.getItem(key) ?? null;
}

function writeStoredValue(key: string, value: string) {
  getAuthStorage()?.setItem(key, value);
}

function removeStoredValue(key: string) {
  getAuthStorage()?.removeItem(key);
}

function clearStoredAuth() {
  removeStoredValue('token');
  removeStoredValue('username');
  removeStoredValue('encryption');
  removeStoredValue('masterKey');
}

/** Persist the tab-scoped master key in sessionStorage. */
async function persistMasterKey(key: CryptoKey) {
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    const bytes = new Uint8Array(raw);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    writeStoredValue('masterKey', btoa(binary));
  } catch {
    removeStoredValue('masterKey');
  }
}

/** Restore the master key from sessionStorage for same-tab refreshes. */
async function restoreMasterKey(): Promise<CryptoKey | null> {
  const stored = readStoredValue('masterKey');
  if (!stored) return null;

  try {
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return await crypto.subtle.importKey(
      'raw',
      bytes.buffer,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  } catch {
    removeStoredValue('masterKey');
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [encryption, setEncryption] = useState(() => readStoredValue('encryption') === 'true');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = readStoredValue('token');
    const storedUsername = readStoredValue('username');
    const storedEncryption = readStoredValue('encryption') === 'true';

    if (storedToken && storedUsername) {
      if (storedEncryption) {
        restoreMasterKey().then((key) => {
          if (!key) {
            clearStoredAuth();
            setIsLoading(false);
            return;
          }

          setMasterKey(key);
          setEncryption(true);
          setToken(storedToken);
          setUser({ username: storedUsername });
          setIsLoading(false);
        });
        return;
      }

      setToken(storedToken);
      setUser({ username: storedUsername });
    }

    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUsername: string, newMasterKey?: CryptoKey, encryptionEnabled?: boolean) => {
    writeStoredValue('token', newToken);
    writeStoredValue('username', newUsername);

    if (encryptionEnabled) writeStoredValue('encryption', 'true');
    else removeStoredValue('encryption');

    if (newMasterKey) {
      setMasterKey(newMasterKey);
      void persistMasterKey(newMasterKey);
    } else {
      removeStoredValue('masterKey');
      setMasterKey(null);
    }

    setEncryption(!!encryptionEnabled);
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
