import type {
  User,
  AuthSession,
  LoginCredentials,
  GenerationQuote,
  GeneratePoemRequest,
  Generation,
  Wallet,
  WalletTransaction,
  UserWithWallet,
  CreateUserRequest,
  CreditWalletRequest,
} from "../../../../shared/types/models";
export interface AuthGateway {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}
