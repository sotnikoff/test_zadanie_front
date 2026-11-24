import { AppError, fail } from "../shared/errors/AppError";
import { createDemoData } from "./demo-data";
import type { DemoState, User } from "./types";

export const DB_KEY = "mini-kadrika:db";
export type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

// This file only loads/saves JSON. Login, balances and jobs live in local.ts.
export function createStorage(storage: Storage) {
  let state: DemoState;
  function save(next: DemoState) {
    const snapshot = structuredClone(next);
    try {
      storage.setItem(DB_KEY, JSON.stringify(snapshot));
    } catch {
      fail(
        "STORAGE",
        "Не удалось сохранить данные. Освободите место или разрешите локальное хранение.",
      );
    }
    state = snapshot; // Do not change the in-memory state if writing fails.
  }
  try {
    const raw = storage.getItem(DB_KEY);
    if (!raw) save(createDemoData());
    else {
      const parsed = JSON.parse(raw) as Omit<DemoState, "version"> & {
        version: number;
      };
      if (
        ![1, 2].includes(parsed.version) ||
        !Array.isArray(parsed.users) ||
        !Array.isArray(parsed.generations) ||
        !Array.isArray(parsed.wallets) ||
        !Array.isArray(parsed.transactions) ||
        !parsed.credentials ||
        !parsed.demo
      ) {
        fail(
          "STORAGE_SCHEMA",
          "Демо-данные несовместимы или повреждены. Сбросьте их на экране восстановления.",
        );
      }
      // Keep old data; v1 roles and administrative request keys are no longer used.
      const user = (u: User): User => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        createdAt: u.createdAt,
      });
      state = {
        version: 2,
        users: parsed.users.map(user),
        credentials: parsed.credentials,
        wallets: parsed.wallets,
        transactions: parsed.transactions,
        generations: parsed.generations,
        session: parsed.session
          ? { ...parsed.session, user: user(parsed.session.user) }
          : null,
        demo: { failNext: parsed.demo.failNext },
      };
      if (parsed.version === 1 || "delay" in parsed.demo) save(state);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    fail(
      "STORAGE",
      "Не удалось прочитать демо-данные. Проверьте доступ к хранилищу браузера.",
    );
  }
  return { read: () => structuredClone(state), save };
}

export function resetBrowserData() {
  window.localStorage.setItem(DB_KEY, JSON.stringify(createDemoData()));
}
