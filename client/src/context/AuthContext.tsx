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

/** 将 CryptoKey 导出为 Base64 存入 localStorage */
async function persistMasterKey(key: CryptoKey) {
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    const bytes = new Uint8Array(raw);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    localStorage.setItem('masterKey', btoa(binary));
  } catch { /* non-extractable key, skip */ }
}

/** 从 localStorage 恢复 CryptoKey */
async function restoreMasterKey(): Promise<CryptoKey | null> {
  const stored = localStorage.getItem('masterKey');
  if (!stored) return null;
  try {
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return await crypto.subtle.importKey(
      'raw', bytes.buffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
  } catch {
    localStorage.removeItem('masterKey');
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [encryption, setEncryption] = useState(() => localStorage.getItem('encryption') === 'true');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    const storedEncryption = localStorage.getItem('encryption') === 'true';

    if (storedToken && storedUsername) {
      if (storedEncryption) {
        // 异步恢复 masterKey，完成后再设置登录态
        restoreMasterKey().then(key => {
          if (key) {
            setMasterKey(key);
            setEncryption(true);
          }
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
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    if (encryptionEnabled) localStorage.setItem('encryption', 'true');
    else localStorage.removeItem('encryption');
    // 先设置 masterKey 和 encryption，再设置 token，避免 token 触发 fetch 时 key 还没就绪
    if (newMasterKey) {
      setMasterKey(newMasterKey);
      persistMasterKey(newMasterKey);
    }
    if (encryptionEnabled) setEncryption(true);
    else setEncryption(false);
    setToken(newToken);
    setUser({ username: newUsername });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('encryption');
    localStorage.removeItem('masterKey');
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
