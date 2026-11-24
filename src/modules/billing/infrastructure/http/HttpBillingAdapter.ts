import type { BillingGateway } from "../../application/ports";

import { HttpClient, list } from "../../../../shared/api/client";
import * as d from "../../../../shared/api/decoders";
export class HttpBillingAdapter implements BillingGateway {
  constructor(private client: HttpClient) {}
  getBalance() {
    return this.client.request("/billing/wallet", d.wallet);
  }
  getTransactions() {
    return this.client.request("/billing/transactions", list(d.transaction));
  }
}
