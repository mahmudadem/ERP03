import { User } from 'firebase/auth';

export interface LoginCredentials {
  email: string;
  password: string;
}

export type CurrentUser = User;

export interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  login: (creds: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}
