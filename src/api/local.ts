import { fail } from "../shared/errors/AppError";
import { createStorage, type Storage } from "./storage";
import { createDemoData, makePoem } from "./demo-data";
import {
  moods,
  type Api,
  type DemoState,
  type Generation,
  type WalletTransaction,
} from "./types";

const COST = 10;
const now = () => new Date().toISOString();

// All local actions are here: read a snapshot, change it, then save once.
export function createLocalApi(storage: Storage = window.localStorage): Api {
  const store = createStorage(storage);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let backgroundError: unknown;
  const pause = async () => {
    if (store.read().demo.delay)
      await new Promise((resolve) => setTimeout(resolve, 250));
  };
  function currentUser(state: DemoState) {
    return (
      state.users.find((user) => user.id === state.session?.user.id) ??
      fail("UNAUTHORIZED", "Войдите в аккаунт, чтобы продолжить.")
    );
  }
  function walletFor(state: DemoState, userId: string) {
    return (
      state.wallets.find((wallet) => wallet.userId === userId) ??
      fail("NOT_FOUND", "Кошелёк не найден.")
    );
  }
  function addTransaction(
    state: DemoState,
    generation: Generation,
    type: WalletTransaction["type"],
    amount: number,
    description: string,
  ) {
    const wallet = walletFor(state, generation.userId);
    const balance = wallet.balance + amount;
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(balance))
      fail(
        "VALIDATION",
        "Количество единиц должно быть безопасным целым числом.",
      );
    if (balance < 0)
      fail(
        "INSUFFICIENT_BALANCE",
        "Недостаточно единиц. Пополнение в прототипе недоступно.",
      );
    wallet.balance = balance;
    state.transactions.push({
      id: crypto.randomUUID(),
      walletId: wallet.id,
      userId: generation.userId,
      generationId: generation.id,
      type,
      amount,
      balanceAfter: balance,
      description,
      createdAt: now(),
    });
  }
  function refund(state: DemoState, generation: Generation, message: string) {
    if (generation.status === "COMPLETED" || generation.status === "FAILED")
      return;
    if (
      !state.transactions.some(
        (t) => t.generationId === generation.id && t.type === "REFUND",
      )
    ) {
      addTransaction(
        state,
        generation,
        "REFUND",
        generation.cost,
        "Возврат за неуспешную генерацию",
      );
    }
    generation.status = "FAILED";
    generation.errorMessage = message;
    generation.completedAt = now();
  }

  // Reloading interrupts local timers. Refund unfinished work on startup.
  const saved = store.read();
  const unfinished = saved.generations.filter(
    (g) => g.status === "PENDING" || g.status === "PROCESSING",
  );
  if (unfinished.length) {
    unfinished.forEach((g) =>
      refund(saved, g, "Обработка прервана перезагрузкой. Единицы возвращены."),
    );
    store.save(saved);
  }

  function later(action: () => void, ms: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      try {
        action();
      } catch (error) {
        backgroundError = error;
      }
    }, ms);
    timers.add(timer);
  }
  function finishGeneration(id: string, shouldFail: boolean) {
    const state = store.read();
    const generation = state.generations.find((g) => g.id === id);
    if (!generation || generation.status !== "PROCESSING") return;
    if (shouldFail)
      refund(
        state,
        generation,
        "Демонстрационный сбой AI. Все 10 единиц возвращены.",
      );
    else {
      generation.result = makePoem(generation);
      generation.status = "COMPLETED";
      generation.completedAt = now();
    }
    store.save(state);
  }
  function processGeneration(id: string, shouldFail: boolean) {
    const delay = store.read().demo.delay;
    later(
      () => {
        const state = store.read();
        const generation = state.generations.find((g) => g.id === id);
        if (!generation || generation.status !== "PENDING") return;
        generation.status = "PROCESSING";
        generation.startedAt = now();
        store.save(state);
        later(() => finishGeneration(id, shouldFail), delay ? 2200 : 20);
      },
      delay ? 350 : 0,
    );
  }
  function dispose() {
    timers.forEach(clearTimeout);
    timers.clear();
  }

  return {
    async login({ email, password }) {
      await pause();
      const state = store.read();
      const user = state.users.find(
        (u) => u.email === email.trim().toLowerCase(),
      );
      if (!user || state.credentials[user.id] !== password)
        return fail("INVALID_CREDENTIALS", "Неверный email или пароль.");
      const session = {
        user,
        sessionId: crypto.randomUUID(),
        createdAt: now(),
      };
      state.session = session;
      store.save(state);
      return session;
    },
    async logout() {
      await pause();
      const state = store.read();
      state.session = null;
      store.save(state);
    },
    async getCurrentUser() {
      await pause();
      const state = store.read();
      return state.users.find((u) => u.id === state.session?.user.id) ?? null;
    },
    async getWallet() {
      await pause();
      const state = store.read();
      return walletFor(state, currentUser(state).id);
    },
    async getTransactions() {
      await pause();
      const state = store.read();
      const user = currentUser(state);
      return state.transactions
        .filter((t) => t.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async getQuote() {
      await pause();
      const state = store.read();
      const balance = walletFor(state, currentUser(state).id).balance;
      return {
        cost: COST,
        balance,
        balanceAfter: balance - COST,
        canGenerate: balance >= COST,
      };
    },
    async generate(request) {
      await pause();
      const state = store.read();
      const user = currentUser(state);
      const { requestId, mood, stanzaCount } = request;
      const topic = request.topic.trim();
      const instructions = request.instructions.trim();
      if (
        !requestId ||
        !topic ||
        topic.length > 120 ||
        request.instructions.length > 1000 ||
        !Object.hasOwn(moods, mood) ||
        !Number.isInteger(stanzaCount) ||
        stanzaCount < 1 ||
        stanzaCount > 4
      ) {
        fail(
          "VALIDATION",
          "Проверьте тему, пожелания и параметры стихотворения.",
        );
      }
      const existing = state.generations.find(
        (g) => g.userId === user.id && g.requestId === requestId,
      );
      if (existing) {
        if (
          existing.topic !== topic ||
          existing.instructions !== instructions ||
          existing.mood !== mood ||
          existing.stanzaCount !== stanzaCount
        )
          fail(
            "CONFLICT",
            "Этот идентификатор уже использован для другого запроса.",
          );
        return existing;
      }
      const generation: Generation = {
        id: crypto.randomUUID(),
        userId: user.id,
        requestId,
        topic,
        instructions,
        mood,
        stanzaCount,
        result: null,
        status: "PENDING",
        cost: COST,
        errorMessage: null,
        createdAt: now(),
        startedAt: null,
        completedAt: null,
      };
      addTransaction(
        state,
        generation,
        "DEBIT",
        -COST,
        `Стихотворение «${topic}»`,
      );
      state.generations.push(generation);
      const shouldFail = state.demo.failNext;
      state.demo.failNext = false;
      store.save(state); // Balance, DEBIT and generation are saved together.
      processGeneration(generation.id, shouldFail);
      return generation;
    },
    async getGeneration(id) {
      await pause();
      const state = store.read();
      const user = currentUser(state);
      const generation =
        state.generations.find((g) => g.id === id && g.userId === user.id) ??
        fail("NOT_FOUND", "Генерация не найдена.");
      if (
        backgroundError &&
        ["PENDING", "PROCESSING"].includes(generation.status)
      )
        throw backgroundError;
      return generation;
    },
    async getGenerations() {
      await pause();
      const state = store.read();
      const user = currentUser(state);
      return state.generations
        .filter((g) => g.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    demo: {
      async setDelay(enabled) {
        const state = store.read();
        state.demo.delay = enabled;
        store.save(state);
      },
      async failNext() {
        const state = store.read();
        state.demo.failNext = true;
        store.save(state);
      },
      async reset() {
        store.save(createDemoData());
        dispose();
        backgroundError = undefined;
      },
    },
    dispose,
  };
}
