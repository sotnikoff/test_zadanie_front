import type { GenerationGateway } from "../../application/ports";
import type {
  LoginCredentials,
  GeneratePoemRequest,
  CreateUserRequest,
  CreditWalletRequest,
} from "../../../../shared/types/models";
import { HttpClient, list, empty } from "../../../../shared/api/client";
import * as d from "../../../../shared/api/decoders";
export class HttpGenerationAdapter implements GenerationGateway {
  constructor(private client: HttpClient) {}
  getQuote() {
    return this.client.request("/generations/quote", d.quote);
  }
  generate(request: GeneratePoemRequest) {
    return this.client.request("/generations", d.generation, "POST", request);
  }
  findById(id: string) {
    return this.client.request(
      `/generations/${encodeURIComponent(id)}`,
      d.generation,
    );
  }
  findAll() {
    return this.client.request("/generations", list(d.generation));
  }
}
