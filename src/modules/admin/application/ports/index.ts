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
export interface AdminGateway {
  getUsers(): Promise<UserWithWallet[]>;
  createUser(request: CreateUserRequest): Promise<User>;
  creditWallet(request: CreditWalletRequest): Promise<WalletTransaction>;
  getGenerations(userId?: string): Promise<Generation[]>;
  getTransactions(userId?: string): Promise<WalletTransaction[]>;
}
