import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Clinic } from '../types';
import { apiRequest, getStoredToken, setStoredToken, removeStoredToken } from '../api';

interface AuthContextType {
  user: User | null;
  clinic: Clinic | null;
  token: string | null;
  loading: boolean;
  loginPlatform: (email: string, pass: string) => Promise<User>;
  loginClinic: (email: string, pass: string) => Promise<{ user: User; clinic?: Clinic; isPlatformAdmin?: boolean }>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshMe: () => Promise<void>;
  switchViewingClinic?: (clinic: Clinic) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setClinic(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: User; clinic?: Clinic }>('/api/auth/me');
      setUser(data.user);
      if (data.clinic) {
        setClinic(data.clinic);
      }
    } catch (err) {
      console.warn('Session check failed, clearing token:', err);
      removeStoredToken();
      setToken(null);
      setUser(null);
      setClinic(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const loginPlatform = async (email: string, pass: string): Promise<User> => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/platform/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setClinic(null);
    return res.user;
  };

  const loginClinic = async (
    email: string,
    pass: string
  ): Promise<{ user: User; clinic?: Clinic; isPlatformAdmin?: boolean }> => {
    const res = await apiRequest<{ token: string; user: User; clinic?: Clinic; isPlatformAdmin?: boolean }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      }
    );
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    if (res.clinic) {
      setClinic(res.clinic);
    }
    return res;
  };

  const logout = () => {
    removeStoredToken();
    setToken(null);
    setUser(null);
    setClinic(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        clinic,
        token,
        loading,
        loginPlatform,
        loginClinic,
        logout,
        updateUser,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
