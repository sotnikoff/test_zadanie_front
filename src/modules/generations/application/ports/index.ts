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
export interface GenerationGateway {
  getQuote(): Promise<GenerationQuote>;
  generate(request: GeneratePoemRequest): Promise<Generation>;
  findById(id: string): Promise<Generation>;
  findAll(): Promise<Generation[]>;
}
