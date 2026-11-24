import type { AdminGateway } from "../../application/ports";
import type {
  LoginCredentials,
  GeneratePoemRequest,
  CreateUserRequest,
  CreditWalletRequest,
} from "../../../../shared/types/models";
import { HttpClient, list, empty } from "../../../../shared/api/client";
import * as d from "../../../../shared/api/decoders";
export class HttpAdminAdapter implements AdminGateway {
  constructor(private client: HttpClient) {}
  getUsers() {
    return this.client.request("/admin/users", list(d.userWithWallet));
  }
  createUser(request: CreateUserRequest) {
    return this.client.request("/admin/users", d.user, "POST", request);
  }
  creditWallet(request: CreditWalletRequest) {
    return this.client.request(
      "/admin/credits",
      d.transaction,
      "POST",
      request,
    );
  }
  getGenerations(userId?: string) {
    return this.client.request(
      "/admin/generations" +
        (userId ? `?userId=${encodeURIComponent(userId)}` : ""),
      list(d.generation),
    );
  }
  getTransactions(userId?: string) {
    return this.client.request(
      "/admin/transactions" +
        (userId ? `?userId=${encodeURIComponent(userId)}` : ""),
      list(d.transaction),
    );
  }
}
