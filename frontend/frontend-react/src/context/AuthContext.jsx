import { createContext, useCallback, useContext, useState } from "react";
import { Auth, apiRequest } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => Auth.getUser());

  const login = useCallback((token, userData) => {
    Auth.setToken(token);
    Auth.setUser(userData);
    setUserState(userData);
  }, []);

  const logout = useCallback(() => {
    Auth.clear();
    setUserState(null);
    window.location.href = "/login";
  }, []);

  const setUser = useCallback((userData) => {
    Auth.setUser(userData);
    setUserState(userData);
  }, []);

  // Pulls the latest user object from the API (points, profile fields,
  // wallet address, etc. may have changed) and syncs it into context +
  // localStorage.
  const refreshUser = useCallback(async () => {
    const { user: fresh } = await apiRequest("/profile");
    setUser(fresh);
    return fresh;
  }, [setUser]);

  const value = {
    user,
    isLoggedIn: Auth.isLoggedIn(),
    login,
    logout,
    setUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
