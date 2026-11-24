import type {
  AuthSession,
  Generation,
  User,
  Wallet,
  WalletTransaction,
} from "../types/models";
import { AppError, fail } from "../errors/AppError";
import { MockAIProvider } from "../../modules/generations/infrastructure/local/MockAIProvider";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface DatabaseState {
  version: 2;
  users: User[];
  credentials: Record<string, string>;
  wallets: Wallet[];
  transactions: WalletTransaction[];
  generations: Generation[];
  session: AuthSession | null;
  demo: { delay: boolean; failNext: boolean };
}
export const DB_KEY = "mini-kadrika:db";
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function safeAmount(value: number, positive = false) {
  if (!Number.isSafeInteger(value) || (positive && value <= 0))
    fail(
      "VALIDATION",
      "Количество единиц должно быть положительным безопасным целым числом.",
    );
}
export function transact(
  state: DatabaseState,
  userId: string,
  type: WalletTransaction["type"],
  amount: number,
  description: string,
  generationId?: string,
) {
  safeAmount(amount);
  const wallet = state.wallets.find((w) => w.userId === userId);
  if (!wallet) return fail("NOT_FOUND", "Кошелёк не найден.");
  const next = wallet.balance + amount;
  safeAmount(next);
  if (next < 0)
    fail(
      "INSUFFICIENT_BALANCE",
      "Недостаточно единиц. Пополнение в прототипе недоступно.",
    );
  wallet.balance = next;
  const tx: WalletTransaction = {
    id: uid(),
    walletId: wallet.id,
    userId,
    generationId,
    type,
    amount,
    balanceAfter: next,
    description,
    createdAt: now(),
  };
  state.transactions.push(tx);
  return tx;
}
export function compensate(
  state: DatabaseState,
  generation: Generation,
  message: string,
) {
  if (generation.status === "COMPLETED" || generation.status === "FAILED")
    return;
  if (
    !state.transactions.some(
      (t) => t.generationId === generation.id && t.type === "REFUND",
    )
  )
    transact(
      state,
      generation.userId,
      "REFUND",
      generation.cost,
      "Возврат за неуспешную генерацию",
      generation.id,
    );
  generation.status = "FAILED";
  generation.errorMessage = message;
  generation.completedAt = now();
}
export function seed(): DatabaseState {
  const state: DatabaseState = {
    version: 2,
    users: [],
    credentials: {},
    wallets: [],
    transactions: [],
    generations: [],
    session: null,
    demo: { delay: true, failNext: false },
  };
  const ai = new MockAIProvider();
  [
    ["user@example.com", "Анна"],
    ["user2@example.com", "Михаил"],
  ].forEach(([email, displayName], index) => {
    const user: User = {
      id: uid(),
      email,
      displayName,
      createdAt: now(),
    };
    state.users.push(user);
    state.credentials[user.id] = "demo1234";
    state.wallets.push({ id: uid(), userId: user.id, balance: 0 });
    transact(
      state,
      user.id,
      "CREDIT",
      index === 1 ? 20 : 150,
      "Приветственные единицы",
    );
    const topics =
      index === 1
        ? ["Дорога домой"]
        : ["Утро в большом городе", "Тёплые воспоминания", "Разговор с осенью"];
    topics.forEach((topic, i) => {
      const date = new Date(
        Date.now() - (topics.length - i) * 86400000,
      ).toISOString();
      const g: Generation = {
        id: uid(),
        requestId: uid(),
        userId: user.id,
        topic,
        instructions: "",
        mood: i === 1 ? "romantic" : "neutral",
        stanzaCount: 2,
        result: null,
        status: "PROCESSING",
        cost: 10,
        errorMessage: null,
        createdAt: date,
        startedAt: date,
        completedAt: date,
      };
      state.generations.push(g);
      const tx = transact(
        state,
        user.id,
        "DEBIT",
        -10,
        `Стихотворение «${topic}»`,
        g.id,
      );
      tx.createdAt = date;
      if (i === 2) {
        compensate(state, g, "Демонстрационный сбой AI. Единицы возвращены.");
        state.transactions[state.transactions.length - 1].createdAt = date;
        g.completedAt = date;
      } else {
        g.status = "COMPLETED";
        g.result = ai.render(g);
      }
    });
    state.transactions.find((t) => t.userId === user.id)!.createdAt = new Date(
      Date.now() - 5 * 86400000,
    ).toISOString();
  });
  return state;
}
export class LocalDatabase {
  private state: DatabaseState;
  constructor(private storage: StoragePort) {
    try {
      const raw = storage.getItem(DB_KEY);
      if (!raw) {
        this.state = seed();
        this.persist(this.state);
      } else {
        const parsed = JSON.parse(raw) as Omit<DatabaseState, "version"> & {
          version: number;
        };
        if (
          (parsed.version !== 1 && parsed.version !== 2) ||
          !Array.isArray(parsed.users) ||
          !Array.isArray(parsed.generations) ||
          !Array.isArray(parsed.wallets) ||
          !Array.isArray(parsed.transactions) ||
          !parsed.demo ||
          !parsed.credentials
        )
          fail(
            "STORAGE_SCHEMA",
            "Демо-данные несовместимы или повреждены. Сбросьте их на экране восстановления.",
          );
        const normalizeUser = (user: User): User => ({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt,
        });
        this.state = {
          version: 2,
          users: parsed.users.map(normalizeUser),
          credentials: parsed.credentials,
          wallets: parsed.wallets,
          transactions: parsed.transactions,
          generations: parsed.generations,
          session: parsed.session
            ? { ...parsed.session, user: normalizeUser(parsed.session.user) }
            : null,
          demo: parsed.demo,
        };
        if (parsed.version === 1) this.persist(this.state);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "STORAGE",
        "Не удалось прочитать демо-данные. Проверьте доступ к хранилищу браузера.",
      );
    }
  }
  read(): DatabaseState {
    return structuredClone(this.state);
  }
  update<T>(change: (state: DatabaseState) => T): T {
    const next = this.read();
    const result = change(next);
    this.persist(next);
    this.state = next;
    return structuredClone(result);
  }
  private persist(state: DatabaseState) {
    try {
      this.storage.setItem(DB_KEY, JSON.stringify(state));
    } catch {
      fail(
        "STORAGE",
        "Не удалось сохранить данные. Освободите место или разрешите локальное хранение.",
      );
    }
  }
  reset() {
    const next = seed();
    this.persist(next);
    this.state = next;
  }
  recover() {
    this.update((state) => {
      state.generations.forEach((g) => {
        if (g.status === "PENDING" || g.status === "PROCESSING")
          compensate(
            state,
            g,
            "Обработка прервана перезагрузкой. Единицы возвращены.",
          );
      });
    });
  }
}

export function resetBrowserDatabase() {
  window.localStorage.setItem(DB_KEY, JSON.stringify(seed()));
}
