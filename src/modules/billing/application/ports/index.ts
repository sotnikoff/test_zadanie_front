import type {
  Wallet,
  WalletTransaction,
} from "../../../../shared/types/models";
export interface BillingGateway {
  getBalance(): Promise<Wallet>;
  getTransactions(): Promise<WalletTransaction[]>;
}
