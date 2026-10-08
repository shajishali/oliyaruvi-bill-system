import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const AUTH_KEY = 'oliyaruvi_auth';
const USERS_KEY = 'oliyaruvi_users';
const ADMIN_AUTH_KEY = 'admin_authenticated';

// RFC 5322 simplified - valid email format
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

interface StoredUser {
  email: string;
  password: string;
  name: string;
  username?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  hasUsers: boolean;
  hasUserWithEmail: (email: string) => boolean;
  login: (username: string, password: string) => { success: boolean; error?: string };
  register: (name: string, username: string, password: string) => { success: boolean; error?: string };
  resetPassword: (email: string, newPassword: string) => { success: boolean; error?: string };
  listAccounts: () => { email: string; name: string; username: string }[];
  setSystemPassword: (accountKey: string, password: string) => { success: boolean; error?: string };
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

function sameText(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findUserIndex(users: StoredUser[], loginName: string) {
  const typed = loginName.trim();
  if (!typed) return -1;
  return users.findIndex((user) => {
    const username = (user.username || '').trim();
    const name = (user.name || '').trim();
    const email = (user.email || '').trim();
    return sameText(username, typed) || sameText(name, typed) || (email !== '' && sameText(email, typed));
  });
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage synchronously so ProtectedRoute never flashes a redirect
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(AUTH_KEY) === 'true'
  );

  const login = (username: string, password: string) => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, error: 'Username is required' };
    }
    if (!password) {
      return { success: false, error: 'Password is required' };
    }
    const users = getUsers();
    const idx = findUserIndex(users, trimmed);
    if (idx === -1) {
      return { success: false, error: 'No account found with this username.' };
    }
    if (users[idx].password !== password) {
      return { success: false, error: 'Incorrect password' };
    }
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
    return { success: true };
  };

  const register = (name: string, username: string, password: string) => {
    const trimmedName = name.trim();
    const trimmedUser = username.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      return { success: false, error: 'Name is required' };
    }
    if (trimmedUser.length < 2) {
      return { success: false, error: 'Username must be at least 2 characters' };
    }
    if (trimmedUser.length > 40) {
      return { success: false, error: 'Username must be 40 characters or less' };
    }
    if (!password) {
      return { success: false, error: 'Password is required' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    const users = getUsers();
    if (users.length > 0) {
      return { success: false, error: 'An account already exists. Sign in with that username.' };
    }
    if (findUserIndex(users, trimmedUser) !== -1) {
      return { success: false, error: 'This username is already registered. Please login instead.' };
    }
    users.push({ email: '', password, name: trimmedName, username: trimmedUser });
    saveUsers(users);
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
    return { success: true };
  };

  const resetPassword = (email: string, newPassword: string) => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      return { success: false, error: 'Please enter a valid email address' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    const users = getUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === trimmed.toLowerCase());
    if (idx === -1) {
      return { success: false, error: 'No account found with this email.' };
    }
    users[idx] = { ...users[idx], password: newPassword };
    saveUsers(users);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    try {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch {
      /* ignore */
    }
    setIsAuthenticated(false);
  };

  const listAccounts = () => getUsers().map((u) => ({
    email: u.email,
    name: u.name,
    username: (u.username || u.name || '').trim(),
  }));

  const setSystemPassword = (accountKey: string, password: string) => {
    if (!password || password.length < 6) {
      return { success: false, error: 'System password must be at least 6 characters' };
    }
    const users = getUsers();
    const idx = findUserIndex(users, accountKey);
    if (idx === -1) {
      return { success: false, error: 'No system account found for that username' };
    }
    users[idx] = { ...users[idx], password };
    saveUsers(users);
    return { success: true };
  };

  const hasUsers = getUsers().length > 0;
  const hasUserWithEmail = (email: string) =>
    getUsers().some((u) => u.email.toLowerCase() === (email || '').trim().toLowerCase());

  return (
    <AuthContext.Provider value={{ isAuthenticated, hasUsers, hasUserWithEmail, login, register, resetPassword, listAccounts, setSystemPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
