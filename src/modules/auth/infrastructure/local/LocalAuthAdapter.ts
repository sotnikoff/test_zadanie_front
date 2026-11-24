import type { AuthGateway } from "../../application/ports";
import type { LoginCredentials } from "../../domain";
import { LocalRuntime } from "../../../../shared/storage/runtime";
import { now, uid } from "../../../../shared/storage/database";
import { fail } from "../../../../shared/errors/AppError";
export class LocalAuthAdapter implements AuthGateway {
  constructor(private runtime: LocalRuntime) {}
  async login(credentials: LoginCredentials) {
    await this.runtime.pause();
    return this.runtime.db.update((s) => {
      const user = s.users.find(
        (u) => u.email === credentials.email.trim().toLowerCase(),
      );
      if (!user || s.credentials[user.id] !== credentials.password)
        return fail("INVALID_CREDENTIALS", "Неверный email или пароль.");
      const session = { user, sessionId: uid(), createdAt: now() };
      s.session = session;
      return session;
    });
  }
  async logout() {
    await this.runtime.pause();
    this.runtime.db.update((s) => {
      s.session = null;
    });
  }
  async getCurrentUser() {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    return s.users.find((u) => u.id === s.session?.user.id) ?? null;
  }
}
