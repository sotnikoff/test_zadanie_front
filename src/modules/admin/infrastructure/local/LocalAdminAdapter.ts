import type { AdminGateway } from "../../application/ports";
import type {
  CreateUserRequest,
  CreditWalletRequest,
  User,
} from "../../../../shared/types/models";
import { LocalRuntime } from "../../../../shared/storage/runtime";
import {
  now,
  safeAmount,
  transact,
  uid,
} from "../../../../shared/storage/database";
import { fail } from "../../../../shared/errors/AppError";
export class LocalAdminAdapter implements AdminGateway {
  constructor(private runtime: LocalRuntime) {}
  async getUsers() {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    this.runtime.admin(s);
    return s.users.map((u) => ({
      ...u,
      wallet: s.wallets.find((w) => w.userId === u.id)!,
    }));
  }
  async createUser(request: CreateUserRequest) {
    await this.runtime.pause();
    return this.runtime.db.update((s) => {
      this.runtime.admin(s);
      const email = request.email.trim().toLowerCase();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !request.displayName.trim() ||
        request.displayName.length > 80 ||
        request.password.length < 8
      )
        fail(
          "VALIDATION",
          "Введите имя, корректный email и пароль от 8 символов.",
        );
      if (s.users.some((u) => u.email === email))
        fail("CONFLICT", "Пользователь с этим email уже существует.");
      const user: User = {
        id: uid(),
        email,
        displayName: request.displayName.trim(),
        role: "USER",
        createdAt: now(),
      };
      s.users.push(user);
      s.credentials[user.id] = request.password;
      s.wallets.push({ id: uid(), userId: user.id, balance: 0 });
      return user;
    });
  }
  async creditWallet(request: CreditWalletRequest) {
    await this.runtime.pause();
    return this.runtime.db.update((s) => {
      this.runtime.admin(s);
      safeAmount(request.amount, true);
      if (
        !request.requestId ||
        !request.comment.trim() ||
        request.comment.length > 300
      )
        fail(
          "VALIDATION",
          "Укажите комментарий к начислению (до 300 символов).",
        );
      const key = request.requestId;
      const old = s.credits[key];
      if (old) {
        if (
          old.request.userId !== request.userId ||
          old.request.amount !== request.amount ||
          old.request.comment !== request.comment
        )
          fail("CONFLICT", "Идентификатор начисления уже использован.");
        return s.transactions.find((t) => t.id === old.transactionId)!;
      }
      const tx = transact(
        s,
        request.userId,
        "CREDIT",
        request.amount,
        request.comment.trim(),
      );
      s.credits[key] = { request, transactionId: tx.id };
      return tx;
    });
  }
  async getGenerations(userId?: string) {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    this.runtime.admin(s);
    return s.generations
      .filter((g) => !userId || g.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getTransactions(userId?: string) {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    this.runtime.admin(s);
    return s.transactions
      .filter((t) => !userId || t.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
