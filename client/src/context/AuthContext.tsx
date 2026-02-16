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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [encryption, setEncryption] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUser({ username: storedUsername });
      // Note: masterKey must be re-derived on each login (not stored in localStorage for security)
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUsername: string, newMasterKey?: CryptoKey, encryptionEnabled?: boolean) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUser({ username: newUsername });
    if (newMasterKey) setMasterKey(newMasterKey);
    if (encryptionEnabled) setEncryption(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUser(null);
    setMasterKey(null);
    setEncryption(false);
  };

  if (isLoading) {
    return <div>Loading...</div>;
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
