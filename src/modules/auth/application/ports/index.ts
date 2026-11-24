import type {
  User,
  AuthSession,
  LoginCredentials,
} from "../../../../shared/types/models";
export interface AuthGateway {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}
