import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGateways, type Gateways } from "../app/composition";
import { parseConfig } from "../app/config";
import {
  DB_KEY,
  LocalDatabase,
  type StoragePort,
} from "../shared/storage/database";
import { LocalRuntime } from "../shared/storage/runtime";
import { LocalAuthAdapter } from "../modules/auth/infrastructure/local/LocalAuthAdapter";
import { LocalGenerationAdapter } from "../modules/generations/infrastructure/local/LocalGenerationAdapter";
import { HttpAuthAdapter } from "../modules/auth/infrastructure/http/HttpAuthAdapter";
import { HttpClient } from "../shared/api/client";
import * as decoders from "../shared/api/decoders";
class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  blocked = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.blocked) throw new Error("Quota");
    this.values.set(key, value);
  }
}
const local = {
  dataSource: "local" as const,
  apiBaseUrl: "http://localhost/api/v1",
};
const request = () => ({
  requestId: crypto.randomUUID(),
  topic: "Тихий вечер",
  instructions: "О природе",
  mood: "neutral" as const,
  stanzaCount: 2,
});
let storage: MemoryStorage;
let api: Gateways;
async function login(name = "user") {
  return api.auth.login({ email: `${name}@example.com`, password: "demo1234" });
}
beforeEach(async () => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  api = createGateways(local, storage);
  await api.demo!.setDelay(false);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("Local adapter business scenarios", () => {
  it("authenticates, persists session and logs out", async () => {
    const session = await login();
    expect(session.user.role).toBe("USER");
    const next = createGateways(local, storage);
    expect((await next.auth.getCurrentUser())?.id).toBe(session.user.id);
    await next.auth.logout();
    expect(await next.auth.getCurrentUser()).toBeNull();
  });
  it("rejects incorrect credentials and unauthorized queries", async () => {
    await expect(
      api.auth.login({ email: "user@example.com", password: "bad" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(api.generations.findAll()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("creates, debits once, processes and completes correct stanza count", async () => {
    await login();
    const before = await api.billing.getBalance();
    const g = await api.generations.generate(request());
    expect(g.status).toBe("PENDING");
    expect((await api.billing.getBalance()).balance).toBe(before.balance - 10);
    await vi.advanceTimersByTimeAsync(0);
    expect((await api.generations.findById(g.id)).status).toBe("PROCESSING");
    await vi.runAllTimersAsync();
    const done = await api.generations.findById(g.id);
    expect(done.status).toBe("COMPLETED");
    expect(done.result!.split("\n\n")).toHaveLength(2);
    expect(
      done.result!.split("\n\n").every((s) => s.split("\n").length === 4),
    ).toBe(true);
    expect(
      (await api.billing.getTransactions()).filter(
        (t) => t.generationId === g.id,
      ),
    ).toHaveLength(1);
  });
  it("rejects insufficient funds without partial changes", async () => {
    await login("user2");
    await api.generations.generate(request());
    const before = storage.getItem(DB_KEY);
    await expect(api.generations.generate(request())).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    expect(storage.getItem(DB_KEY)).toBe(before);
    expect((await api.billing.getBalance()).balance).toBe(0);
  });
  it("refunds failure once, including retries and repeated recovery", async () => {
    await login();
    const before = (await api.billing.getBalance()).balance;
    await api.demo!.failNext();
    const input = request();
    const g = await api.generations.generate(input);
    await vi.runAllTimersAsync();
    expect((await api.generations.findById(g.id)).status).toBe("FAILED");
    expect((await api.billing.getBalance()).balance).toBe(before);
    await api.generations.generate(input);
    const next = createGateways(local, storage);
    createGateways(local, storage);
    const tx = await next.billing.getTransactions();
    expect(
      tx.filter((t) => t.generationId === g.id && t.type === "REFUND"),
    ).toHaveLength(1);
    expect(
      tx.filter((t) => t.generationId === g.id && t.type === "DEBIT"),
    ).toHaveLength(1);
  });
  it("deduplicates concurrent form submissions and rejects changed payload", async () => {
    await login();
    const input = request();
    const [a, b] = await Promise.all([
      api.generations.generate(input),
      api.generations.generate(input),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      (await api.billing.getTransactions()).filter(
        (t) => t.generationId === a.id,
      ),
    ).toHaveLength(1);
    await expect(
      api.generations.generate({ ...input, topic: "Другая тема" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("isolates user history, wallets and direct access by id", async () => {
    const anna = await login();
    const gs = await api.generations.findAll();
    await login("user2");
    const current = await api.auth.getCurrentUser();
    expect(
      (await api.generations.findAll()).every((g) => g.userId === current!.id),
    ).toBe(true);
    expect(
      (await api.billing.getTransactions()).every(
        (t) => t.userId === current!.id,
      ),
    ).toBe(true);
    expect((await api.billing.getBalance()).userId).not.toBe(anna.user.id);
    await expect(api.generations.findById(gs[0].id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("keeps in-flight work assigned to its original user", async () => {
    const owner = await login();
    const g = await api.generations.generate(request());
    await login("user2");
    await vi.runAllTimersAsync();
    await login();
    const done = await api.generations.findById(g.id);
    expect(done.userId).toBe(owner.user.id);
    expect(done.status).toBe("COMPLETED");
  });
  it("admin creates user, normalizes email and credits exactly once", async () => {
    await login("admin");
    const user = await api.admin.createUser({
      email: " New@Example.com ",
      displayName: "Новый",
      password: "password123",
    });
    expect(user.role).toBe("USER");
    expect(
      (await api.admin.getUsers()).find((u) => u.id === user.id)?.wallet
        .balance,
    ).toBe(0);
    const req = {
      requestId: crypto.randomUUID(),
      userId: user.id,
      amount: 40,
      comment: "Для показа",
    };
    const a = await api.admin.creditWallet(req);
    const b = await api.admin.creditWallet(req);
    expect(a.id).toBe(b.id);
    expect(a.balanceAfter).toBe(40);
    await api.auth.login({ email: "new@example.com", password: "password123" });
    expect((await api.billing.getBalance()).balance).toBe(40);
  });
  it("prevents normal users from all admin operations", async () => {
    const u = await login();
    const calls = [
      api.admin.getUsers(),
      api.admin.getGenerations(),
      api.admin.getTransactions(),
      api.admin.createUser({
        email: "a@b.com",
        displayName: "A",
        password: "password",
      }),
      api.admin.creditWallet({
        requestId: crypto.randomUUID(),
        userId: u.user.id,
        amount: 10,
        comment: "test",
      }),
    ];
    for (const call of calls)
      await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("validates integer credits, overflow, and duplicate emails", async () => {
    await login("admin");
    const user = (await api.admin.getUsers())[0];
    for (const amount of [
      -1,
      0,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.MAX_SAFE_INTEGER,
    ]) {
      await expect(
        api.admin.creditWallet({
          requestId: crypto.randomUUID(),
          userId: user.id,
          amount,
          comment: "test",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    }
    await expect(
      api.admin.createUser({
        email: "USER@example.com",
        displayName: "X",
        password: "password",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("recovers an interrupted job with refund after reload", async () => {
    const runtime = new LocalRuntime(new LocalDatabase(storage));
    const auth = new LocalAuthAdapter(runtime);
    const generations = new LocalGenerationAdapter(runtime);
    await auth.login({ email: "user@example.com", password: "demo1234" });
    const before = runtime.db
      .read()
      .wallets.find(
        (w) => w.userId === runtime.db.read().session!.user.id,
      )!.balance;
    const g = await generations.generate(request());
    await vi.advanceTimersByTimeAsync(0);
    runtime.stop();
    const next = createGateways(local, storage);
    expect((await next.generations.findById(g.id)).status).toBe("FAILED");
    expect((await next.billing.getBalance()).balance).toBe(before);
    expect(
      (await next.billing.getTransactions()).filter(
        (t) => t.generationId === g.id && t.type === "REFUND",
      ),
    ).toHaveLength(1);
  });
  it("does not change balance in memory or storage if writing fails", async () => {
    await login();
    const before = await api.billing.getBalance();
    const raw = storage.getItem(DB_KEY);
    storage.blocked = true;
    await expect(api.generations.generate(request())).rejects.toMatchObject({
      code: "STORAGE",
    });
    expect(storage.getItem(DB_KEY)).toBe(raw);
    expect(await api.billing.getBalance()).toEqual(before);
  });
  it("persists completed generations and admin changes", async () => {
    await login();
    const g = await api.generations.generate(request());
    await vi.runAllTimersAsync();
    const next = createGateways(local, storage);
    expect((await next.generations.findById(g.id)).status).toBe("COMPLETED");
    expect(await next.billing.getTransactions()).toEqual(
      await api.billing.getTransactions(),
    );
  });
  it("resets demo data and cancels active jobs", async () => {
    await login();
    await api.generations.generate(request());
    await api.demo!.reset();
    await vi.runAllTimersAsync();
    await api.demo!.setDelay(false);
    expect(await api.auth.getCurrentUser()).toBeNull();
    await login();
    expect(await api.generations.findAll()).toHaveLength(3);
  });
});
describe("Configuration and HTTP preparation", () => {
  it("selects local and HTTP adapters without touching storage for HTTP", () => {
    expect(api.auth).toBeInstanceOf(LocalAuthAdapter);
    const storage: StoragePort = {
      getItem: () => {
        throw new Error("must not touch");
      },
      setItem: () => {
        throw new Error("must not touch");
      },
    };
    const http = createGateways({ ...local, dataSource: "http" }, storage);
    expect(http.auth).toBeInstanceOf(HttpAuthAdapter);
    expect(http.demo).toBeUndefined();
    expect(parseConfig({}).dataSource).toBe("local");
    expect(() => parseConfig({ VITE_DATA_SOURCE: "unknown" })).toThrow();
  });
  it("sends credentials, JSON request and decodes response", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "w", userId: "u", balance: 10 })),
      );
    const client = new HttpClient("http://example.com/api/", transport);
    expect(
      await client.request("/wallet", decoders.wallet, "POST", { hello: true }),
    ).toEqual({ id: "w", userId: "u", balance: 10 });
    expect(transport).toHaveBeenCalledWith(
      "http://example.com/api/wallet",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: '{"hello":true}',
      }),
    );
  });
  it("maps API errors, network failures and malformed responses", async () => {
    const transport = vi.fn<typeof fetch>();
    const client = new HttpClient("http://example.com", transport);
    transport.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "Нет доступа" },
        }),
        { status: 403 },
      ),
    );
    await expect(
      client.request("/wallet", decoders.wallet),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    transport.mockRejectedValueOnce(new Error("offline"));
    await expect(
      client.request("/wallet", decoders.wallet),
    ).rejects.toMatchObject({ code: "NETWORK" });
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify({ balance: "bad" })),
    );
    await expect(
      client.request("/wallet", decoders.wallet),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("keeps unsupported schema intact", () => {
    storage.setItem(DB_KEY, '{"version":99}');
    expect(() => new LocalDatabase(storage)).toThrow();
    expect(storage.getItem(DB_KEY)).toBe('{"version":99}');
  });
});
