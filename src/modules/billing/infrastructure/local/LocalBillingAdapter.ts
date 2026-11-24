import type { BillingGateway } from "../../application/ports";
import { LocalRuntime } from "../../../../shared/storage/runtime";
export class LocalBillingAdapter implements BillingGateway {
  constructor(private runtime: LocalRuntime) {}
  async getBalance() {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    const user = this.runtime.user(s);
    return s.wallets.find((w) => w.userId === user.id)!;
  }
  async getTransactions() {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    const user = this.runtime.user(s);
    return s.transactions
      .filter((t) => t.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
