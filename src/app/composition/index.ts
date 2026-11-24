import type { AuthGateway } from "../../modules/auth/application/ports";
import type { GenerationGateway } from "../../modules/generations/application/ports";
import type { BillingGateway } from "../../modules/billing/application/ports";
import type { AdminGateway } from "../../modules/admin/application/ports";
import { LocalAuthAdapter } from "../../modules/auth/infrastructure/local/LocalAuthAdapter";
import { LocalGenerationAdapter } from "../../modules/generations/infrastructure/local/LocalGenerationAdapter";
import { LocalBillingAdapter } from "../../modules/billing/infrastructure/local/LocalBillingAdapter";
import { LocalAdminAdapter } from "../../modules/admin/infrastructure/local/LocalAdminAdapter";
import { HttpAuthAdapter } from "../../modules/auth/infrastructure/http/HttpAuthAdapter";
import { HttpGenerationAdapter } from "../../modules/generations/infrastructure/http/HttpGenerationAdapter";
import { HttpBillingAdapter } from "../../modules/billing/infrastructure/http/HttpBillingAdapter";
import { HttpAdminAdapter } from "../../modules/admin/infrastructure/http/HttpAdminAdapter";
import { LocalDatabase, type StoragePort } from "../../shared/storage/database";
import { LocalRuntime } from "../../shared/storage/runtime";
import { HttpClient } from "../../shared/api/client";
import { LocalDemoAdapter, type DemoGateway } from "./demo";
import type { Config } from "../config";
export interface Gateways {
  auth: AuthGateway;
  generations: GenerationGateway;
  billing: BillingGateway;
  admin: AdminGateway;
  demo?: DemoGateway;
}
export function createGateways(
  config: Config,
  storage?: StoragePort,
): Gateways {
  if (config.dataSource === "http") {
    const client = new HttpClient(config.apiBaseUrl);
    return {
      auth: new HttpAuthAdapter(client),
      generations: new HttpGenerationAdapter(client),
      billing: new HttpBillingAdapter(client),
      admin: new HttpAdminAdapter(client),
    };
  }
  const runtime = new LocalRuntime(
    new LocalDatabase(storage ?? window.localStorage),
  );
  return {
    auth: new LocalAuthAdapter(runtime),
    generations: new LocalGenerationAdapter(runtime),
    billing: new LocalBillingAdapter(runtime),
    admin: new LocalAdminAdapter(runtime),
    demo: new LocalDemoAdapter(runtime),
  };
}
