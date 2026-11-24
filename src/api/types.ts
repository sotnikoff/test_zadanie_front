export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}
export interface Wallet {
  id: string;
  userId: string;
  balance: number;
}
export type TransactionType = "CREDIT" | "DEBIT" | "REFUND";
export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  generationId?: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}
export const moods = {
  neutral: "Нейтральное",
  romantic: "Романтическое",
  cheerful: "Весёлое",
  sad: "Грустное",
  philosophical: "Философское",
  dark: "Мрачное",
} as const;
export type Mood = keyof typeof moods;
export type GenerationStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";
export interface GeneratePoemRequest {
  requestId: string;
  topic: string;
  instructions: string;
  mood: Mood;
  stanzaCount: number;
}
export interface Generation extends GeneratePoemRequest {
  id: string;
  userId: string;
  result: string | null;
  status: GenerationStatus;
  cost: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
export interface AuthSession {
  user: User;
  sessionId: string;
  createdAt: string;
}
export interface LoginCredentials {
  email: string;
  password: string;
}
export interface GenerationQuote {
  cost: number;
  balance: number;
  balanceAfter: number;
  canGenerate: boolean;
}

// One API for the UI. Local emulation and HTTP expose the same methods.
export interface Api {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  getQuote(): Promise<GenerationQuote>;
  generate(request: GeneratePoemRequest): Promise<Generation>;
  getGeneration(id: string): Promise<Generation>;
  getGenerations(): Promise<Generation[]>;
  getWallet(): Promise<Wallet>;
  getTransactions(): Promise<WalletTransaction[]>;
  // Local test controls; no corresponding user interface or HTTP endpoints.
  demo?: {
    failNext(): Promise<void>;
    reset(): Promise<void>;
  };
}

export interface DemoState {
  version: 2;
  users: User[];
  credentials: Record<string, string>;
  wallets: Wallet[];
  transactions: WalletTransaction[];
  generations: Generation[];
  session: AuthSession | null;
  demo: { failNext: boolean };
}
