export interface User {
  email: string;
  password?: string;
  name: string;
}

export interface AuthState {
  user: Omit<User, 'password'> | null;
  isAuthenticated: boolean;
}