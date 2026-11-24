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
export interface BillingGateway {
  getBalance(): Promise<Wallet>;
  getTransactions(): Promise<WalletTransaction[]>;
}
