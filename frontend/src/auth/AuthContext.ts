import { createContext, useContext } from 'react';
import type { Me, Role } from '../types/api';

export interface AuthValue {
  user: Me | null;
  /** True until the initial /api/me bootstrap settles. */
  loading: boolean;
  role: Role | null;
  isElevated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | undefined>(undefined);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
