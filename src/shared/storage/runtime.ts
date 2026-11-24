import { LocalDatabase } from "./database";
import type { DatabaseState } from "./database";
import { fail } from "../errors/AppError";
export class LocalRuntime {
  readonly jobs = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(readonly db: LocalDatabase) {
    db.recover();
  }
  async pause() {
    if (this.db.read().demo.delay)
      await new Promise((resolve) => setTimeout(resolve, 250));
  }
  user(state: DatabaseState = this.db.read()) {
    const user = state.users.find((u) => u.id === state.session?.user.id);
    return user ?? fail("UNAUTHORIZED", "Войдите в аккаунт, чтобы продолжить.");
  }
  admin(state: DatabaseState = this.db.read()) {
    const user = this.user(state);
    if (user.role !== "ADMIN")
      fail("FORBIDDEN", "Это действие доступно только администратору.");
    return user;
  }
  stop() {
    this.jobs.forEach(clearTimeout);
    this.jobs.clear();
  }
}
