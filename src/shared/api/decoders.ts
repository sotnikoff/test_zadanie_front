import type {
  AuthSession,
  Generation,
  GenerationQuote,
  User,
  UserWithWallet,
  Wallet,
  WalletTransaction,
} from "../types/models";
import { moods } from "../types/models";
import { isObject, objectDecoder } from "./client";
const strings = (v: Record<string, unknown>, fields: string[]) =>
  fields.every((k) => typeof v[k] === "string");
const integer = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v);
const nullable = (v: unknown) => v === null || typeof v === "string";
const userCheck = (v: Record<string, unknown>) =>
  strings(v, ["id", "email", "displayName", "createdAt"]) &&
  ["USER", "ADMIN"].includes(String(v.role));
const walletCheck = (v: Record<string, unknown>) =>
  strings(v, ["id", "userId"]) && integer(v.balance) && Number(v.balance) >= 0;
export const user = objectDecoder<User>(userCheck);
export const currentUser = (v: unknown) => (v === null ? null : user(v));
export const wallet = objectDecoder<Wallet>(walletCheck);
export const userWithWallet = objectDecoder<UserWithWallet>(
  (v) => userCheck(v) && isObject(v.wallet) && walletCheck(v.wallet),
);
export const session = objectDecoder<AuthSession>(
  (v) =>
    strings(v, ["sessionId", "createdAt"]) &&
    isObject(v.user) &&
    userCheck(v.user),
);
export const generation = objectDecoder<Generation>(
  (v) =>
    strings(v, [
      "id",
      "userId",
      "requestId",
      "topic",
      "instructions",
      "createdAt",
    ]) &&
    typeof v.mood === "string" &&
    v.mood in moods &&
    integer(v.stanzaCount) &&
    Number(v.stanzaCount) >= 1 &&
    Number(v.stanzaCount) <= 4 &&
    integer(v.cost) &&
    Number(v.cost) >= 0 &&
    ["PENDING", "PROCESSING", "COMPLETED", "FAILED"].includes(
      String(v.status),
    ) &&
    ["result", "errorMessage", "startedAt", "completedAt"].every((k) =>
      nullable(v[k]),
    ),
);
export const transaction = objectDecoder<WalletTransaction>(
  (v) =>
    strings(v, ["id", "walletId", "userId", "description", "createdAt"]) &&
    ["CREDIT", "DEBIT", "REFUND"].includes(String(v.type)) &&
    integer(v.amount) &&
    integer(v.balanceAfter) &&
    Number(v.balanceAfter) >= 0 &&
    (v.generationId === undefined || typeof v.generationId === "string"),
);
export const quote = objectDecoder<GenerationQuote>(
  (v) =>
    integer(v.cost) &&
    integer(v.balance) &&
    integer(v.balanceAfter) &&
    typeof v.canGenerate === "boolean",
);
