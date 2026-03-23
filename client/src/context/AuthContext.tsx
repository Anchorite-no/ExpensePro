import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { loadTrustedMasterKey, saveTrustedMasterKey } from '../utils/trustedDevice';

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
  return window.localStorage;
}

function getLegacyStorage(): Storage | null {
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
}

function clearLegacyStoredAuth() {
  const legacyStorage = getLegacyStorage();
  legacyStorage?.removeItem('token');
  legacyStorage?.removeItem('username');
  legacyStorage?.removeItem('encryption');
  legacyStorage?.removeItem('masterKey');
}

function migrateLegacyStoredAuth() {
  const legacyStorage = getLegacyStorage();
  if (!legacyStorage) return;

  const legacyToken = legacyStorage.getItem('token');
  const legacyUsername = legacyStorage.getItem('username');
  const legacyEncryption = legacyStorage.getItem('encryption');

  if (!readStoredValue('token') && legacyToken && legacyUsername) {
    writeStoredValue('token', legacyToken);
    writeStoredValue('username', legacyUsername);
    if (legacyEncryption === 'true') {
      writeStoredValue('encryption', 'true');
    }
  }

  clearLegacyStoredAuth();
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [encryption, setEncryption] = useState(() => readStoredValue('encryption') === 'true');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    migrateLegacyStoredAuth();

    const storedToken = readStoredValue('token');
    const storedUsername = readStoredValue('username');
    const storedEncryption = readStoredValue('encryption') === 'true';

    if (!storedToken || !storedUsername) {
      setIsLoading(false);
      return;
    }

    if (!storedEncryption) {
      setToken(storedToken);
      setUser({ username: storedUsername });
      setIsLoading(false);
      return;
    }

    loadTrustedMasterKey(storedUsername)
      .then((restoredMasterKey) => {
        if (!restoredMasterKey) {
          clearStoredAuth();
          return;
        }

        setMasterKey(restoredMasterKey);
        setEncryption(true);
        setToken(storedToken);
        setUser({ username: storedUsername });
      })
      .catch(() => {
        clearStoredAuth();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = (newToken: string, newUsername: string, newMasterKey?: CryptoKey, encryptionEnabled?: boolean) => {
    writeStoredValue('token', newToken);
    writeStoredValue('username', newUsername);

    if (encryptionEnabled) {
      writeStoredValue('encryption', 'true');
    } else {
      removeStoredValue('encryption');
    }

    if (newMasterKey) {
      setMasterKey(newMasterKey);
      void saveTrustedMasterKey(newUsername, newMasterKey).catch(() => {
        console.warn('Failed to persist trusted device key material');
      });
    } else {
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
