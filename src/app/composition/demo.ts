import { LocalRuntime } from "../../shared/storage/runtime";
import { LocalAuthAdapter } from "../../modules/auth/infrastructure/local/LocalAuthAdapter";
export interface DemoGateway {
  getSettings(): Promise<{ delay: boolean; failNext: boolean }>;
  setDelay(value: boolean): Promise<void>;
  failNext(): Promise<void>;
  reset(): Promise<void>;
  switchAccount(email: string): Promise<void>;
}
export class LocalDemoAdapter implements DemoGateway {
  constructor(private runtime: LocalRuntime) {}
  async getSettings() {
    return this.runtime.db.read().demo;
  }
  async setDelay(value: boolean) {
    this.runtime.db.update((s) => {
      s.demo.delay = value;
    });
  }
  async failNext() {
    this.runtime.db.update((s) => {
      s.demo.failNext = true;
    });
  }
  async reset() {
    this.runtime.stop();
    this.runtime.db.reset();
  }
  async switchAccount(email: string) {
    if (
      !["admin@example.com", "user@example.com", "user2@example.com"].includes(
        email,
      )
    )
      throw new Error("Неизвестный демо-аккаунт");
    await new LocalAuthAdapter(this.runtime).login({
      email,
      password: "demo1234",
    });
  }
}
