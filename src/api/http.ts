import {
  moods,
  type Api,
  type AuthSession,
  type Generation,
  type GenerationQuote,
  type User,
  type Wallet,
  type WalletTransaction,
} from "./types";
import { AppError } from "../shared/errors/AppError";
type Decoder<T> = (value: unknown) => T;
export function createHttpApi(
  baseUrl: string,
  transport: typeof fetch = fetch,
): Api {
  async function request<T>(
    path: string,
    decode: Decoder<T>,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await transport(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new AppError(
        "NETWORK",
        "Сервер недоступен. Проверьте подключение и повторите попытку.",
      );
    }
    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      let message =
        response.status === 401
          ? "Сессия завершена. Войдите снова."
          : response.status === 403
            ? "Недостаточно прав для этого действия."
            : "Не удалось выполнить запрос.";
      try {
        const payload: unknown = await response.json();
        if (isObject(payload) && isObject(payload.error)) {
          if (typeof payload.error.code === "string") code = payload.error.code;
          if (typeof payload.error.message === "string")
            message = payload.error.message;
        }
      } catch {
        /* use status fallback */
      }
      throw new AppError(code, message);
    }
    if (response.status === 204) return decode(undefined);
    try {
      return decode(await response.json());
    } catch {
      throw new AppError(
        "INVALID_RESPONSE",
        "Сервер вернул ответ в неподдерживаемом формате.",
      );
    }
  }
  return {
    login: (body) => request("/auth/login", session, "POST", body),
    logout: () => request("/auth/logout", empty, "POST"),
    getCurrentUser: () => request("/auth/me", currentUser),
    getQuote: () => request("/generations/quote", quote),
    generate: (body) => request("/generations", generation, "POST", body),
    getGeneration: (id) =>
      request(`/generations/${encodeURIComponent(id)}`, generation),
    getGenerations: () => request("/generations", list(generation)),
    getWallet: () => request("/billing/wallet", wallet),
    getTransactions: () => request("/billing/transactions", list(transaction)),
    dispose() {},
  };
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
function objectDecoder<T>(
  check: (v: Record<string, unknown>) => boolean,
): Decoder<T> {
  return (value) => {
    if (!isObject(value) || !check(value)) throw new Error("Invalid response");
    return value as T;
  };
}
const list =
  <T>(decode: Decoder<T>): Decoder<T[]> =>
  (value) => {
    if (!Array.isArray(value)) throw new Error("Invalid list");
    return value.map(decode);
  };
const empty: Decoder<void> = () => undefined;

const strings = (v: Record<string, unknown>, fields: string[]) =>
  fields.every((k) => typeof v[k] === "string");
const integer = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v);
const nullable = (v: unknown) => v === null || typeof v === "string";
const userCheck = (v: Record<string, unknown>) =>
  strings(v, ["id", "email", "displayName", "createdAt"]);
const walletCheck = (v: Record<string, unknown>) =>
  strings(v, ["id", "userId"]) && integer(v.balance) && Number(v.balance) >= 0;
const user = objectDecoder<User>(userCheck);
const currentUser = (v: unknown) => (v === null ? null : user(v));
const wallet = objectDecoder<Wallet>(walletCheck);
const session = objectDecoder<AuthSession>(
  (v) =>
    strings(v, ["sessionId", "createdAt"]) &&
    isObject(v.user) &&
    userCheck(v.user),
);
const generation = objectDecoder<Generation>(
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
const transaction = objectDecoder<WalletTransaction>(
  (v) =>
    strings(v, ["id", "walletId", "userId", "description", "createdAt"]) &&
    ["CREDIT", "DEBIT", "REFUND"].includes(String(v.type)) &&
    integer(v.amount) &&
    integer(v.balanceAfter) &&
    Number(v.balanceAfter) >= 0 &&
    (v.generationId === undefined || typeof v.generationId === "string"),
);
const quote = objectDecoder<GenerationQuote>(
  (v) =>
    integer(v.cost) &&
    integer(v.balance) &&
    integer(v.balanceAfter) &&
    typeof v.canGenerate === "boolean",
);
