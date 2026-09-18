'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSession {
  id: string;
  email: string;
  role: 'ADMIN' | 'ADMINISTRATOR' | 'CUSTOMER';
  firstName?: string;
  lastName?: string;
}

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
};

export const getStoredUser = (): UserSession | null => {
  if (typeof window === 'undefined') return null;
  const savedUser = localStorage.getItem('tilevista_admin_user') || sessionStorage.getItem('tilevista_admin_user');
  if (!savedUser) return null;
  try {
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
};

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<boolean>;
  register: (
    dto: {
      email: string;
      pass: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
    rememberMe?: boolean
  ) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check both local storage and session storage on mount
    const savedToken = localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
    const savedUserStr = localStorage.getItem('tilevista_admin_user') || sessionStorage.getItem('tilevista_admin_user');
    if (savedToken && savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        setToken(savedToken);
        setUser(savedUser);
      } catch (err) {
        console.error('Failed to parse stored user:', err);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string, rememberMe = false): Promise<boolean> => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const sessionId = localStorage.getItem('tilevista_cart_session');
      
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: pass, sessionId }),
      });

      if (!res.ok) {
        setIsLoading(false);
        return false;
      }

      const data = await res.json();
      const userSession: UserSession = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
      };

      const storage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;

      storage.setItem('tilevista_admin_token', data.access_token);
      storage.setItem('tilevista_admin_user', JSON.stringify(userSession));
      otherStorage.removeItem('tilevista_admin_token');
      otherStorage.removeItem('tilevista_admin_user');

      setToken(data.access_token);
      setUser(userSession);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (
    dto: {
      email: string;
      pass: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
    rememberMe = false
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const { pass, ...rest } = dto;
      const sessionId = localStorage.getItem('tilevista_cart_session');
      
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...rest,
          password: pass,
          sessionId,
        }),
      });

      if (!res.ok) {
        setIsLoading(false);
        return false;
      }

      const data = await res.json();
      const userSession: UserSession = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
      };

      const storage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;

      storage.setItem('tilevista_admin_token', data.access_token);
      storage.setItem('tilevista_admin_user', JSON.stringify(userSession));
      otherStorage.removeItem('tilevista_admin_token');
      otherStorage.removeItem('tilevista_admin_user');

      setToken(data.access_token);
      setUser(userSession);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      setIsLoading(false);
      return false;
    }
  };


  const logout = () => {
    localStorage.removeItem('tilevista_admin_token');
    localStorage.removeItem('tilevista_admin_user');
    sessionStorage.removeItem('tilevista_admin_token');
    sessionStorage.removeItem('tilevista_admin_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthContext;

