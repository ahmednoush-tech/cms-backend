import { createContext } from 'react';
import type { AuthContext as AuthContextShape } from '../types/auth';

export type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: SessionStatus;
  user: AuthContextShape | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthReactContext = createContext<AuthContextValue | undefined>(undefined);
