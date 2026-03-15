import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const AUTH_KEY = 'oliyaruvi_auth';
const USERS_KEY = 'oliyaruvi_users';

// RFC 5322 simplified - valid email format
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

interface StoredUser {
  email: string;
  password: string;
  name: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  register: (name: string, email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function getUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    setIsAuthenticated(stored === 'true');
  }, []);

  const login = (email: string, password: string) => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      return { success: false, error: 'Please enter a valid email address' };
    }
    if (!password) {
      return { success: false, error: 'Password is required' };
    }
    const users = getUsers();
    const user = users.find((u) => u.email.toLowerCase() === trimmed.toLowerCase());
    if (!user) {
      return { success: false, error: 'No account found with this email. Please register first.' };
    }
    if (user.password !== password) {
      return { success: false, error: 'Incorrect password' };
    }
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
    return { success: true };
  };

  const register = (name: string, email: string, password: string) => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      return { success: false, error: 'Please enter a valid email address' };
    }
    if (!name.trim()) {
      return { success: false, error: 'Name is required' };
    }
    if (!password) {
      return { success: false, error: 'Password is required' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    const users = getUsers();
    const exists = users.some((u) => u.email.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, error: 'This email is already registered. Please login instead.' };
    }
    users.push({ email: trimmed.toLowerCase(), password, name: name.trim() });
    saveUsers(users);
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
