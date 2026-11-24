import type { AuthGateway } from "../../application/ports";
import type { LoginCredentials } from "../../../../shared/types/models";
import { HttpClient, empty } from "../../../../shared/api/client";
import * as d from "../../../../shared/api/decoders";
export class HttpAuthAdapter implements AuthGateway {
  constructor(private client: HttpClient) {}
  login(request: LoginCredentials) {
    return this.client.request("/auth/login", d.session, "POST", request);
  }
  logout() {
    return this.client.request("/auth/logout", empty, "POST");
  }
  getCurrentUser() {
    return this.client.request("/auth/me", d.currentUser);
  }
}
