import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApi, parseConfig } from "../api";
import type { Api } from "../api/types";
import { createStorage, DB_KEY, type Storage } from "../api/storage";
import { createHttpApi } from "../api/http";
import { createDemoData } from "../api/demo-data";
class MemoryStorage implements Storage {
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
let api: Api;
async function login(name = "user") {
  return api.login({ email: `${name}@example.com`, password: "demo1234" });
}
beforeEach(() => {
  storage = new MemoryStorage();
  api = createApi(local, storage);
});
describe("Local API business scenarios", () => {
  it("authenticates the zero-balance account and refuses generation without changes", async () => {
    await login("user3");
    expect((await api.getWallet()).balance).toBe(0);
    expect((await api.getQuote()).canGenerate).toBe(false);
    expect(await api.getTransactions()).toEqual([]);
    expect(await api.getGenerations()).toEqual([]);
    const before = storage.getItem(DB_KEY);
    await expect(api.generate(request())).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    expect(storage.getItem(DB_KEY)).toBe(before);
  });
  it("authenticates, persists session and logs out", async () => {
    const session = await login();
    expect(session.user.email).toBe("user@example.com");
    const next = createApi(local, storage);
    expect((await next.getCurrentUser())?.id).toBe(session.user.id);
    await next.logout();
    expect(await next.getCurrentUser()).toBeNull();
  });
  it("rejects incorrect credentials and unauthorized queries", async () => {
    await expect(
      api.login({ email: "user@example.com", password: "bad" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(api.getGenerations()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("returns a completed poem and debits once in the same call", async () => {
    await login();
    const before = await api.getWallet();
    const g = await api.generate(request());
    expect(g.status).toBe("COMPLETED");
    expect((await api.getWallet()).balance).toBe(before.balance - 10);
    const done = await api.getGeneration(g.id);
    expect(done).toEqual(g);
    expect(done.result!.split("\n\n")).toHaveLength(2);
    expect(
      done.result!.split("\n\n").every((s) => s.split("\n").length === 4),
    ).toBe(true);
    expect(
      (await api.getTransactions()).filter((t) => t.generationId === g.id),
    ).toHaveLength(1);
  });
  it("rejects insufficient funds without partial changes", async () => {
    await login("user2");
    await api.generate(request());
    const before = storage.getItem(DB_KEY);
    await expect(api.generate(request())).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    expect(storage.getItem(DB_KEY)).toBe(before);
    expect((await api.getWallet()).balance).toBe(0);
  });
  it("refunds failure once, including retries and repeated recovery", async () => {
    await login();
    const before = (await api.getWallet()).balance;
    await api.demo!.failNext();
    const input = request();
    const g = await api.generate(input);
    expect(g.status).toBe("FAILED");
    expect((await api.getGeneration(g.id)).status).toBe("FAILED");
    expect((await api.getWallet()).balance).toBe(before);
    await api.generate(input);
    const next = createApi(local, storage);
    createApi(local, storage);
    const tx = await next.getTransactions();
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
      api.generate(input),
      api.generate(input),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      (await api.getTransactions()).filter((t) => t.generationId === a.id),
    ).toHaveLength(1);
    await expect(
      api.generate({ ...input, topic: "Другая тема" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("isolates user history, wallets and direct access by id", async () => {
    const anna = await login();
    const gs = await api.getGenerations();
    await login("user2");
    const current = await api.getCurrentUser();
    expect(
      (await api.getGenerations()).every((g) => g.userId === current!.id),
    ).toBe(true);
    expect(
      (await api.getTransactions()).every((t) => t.userId === current!.id),
    ).toBe(true);
    expect((await api.getWallet()).userId).not.toBe(anna.user.id);
    await expect(api.getGeneration(gs[0].id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("keeps an accepted generation assigned to its original user", async () => {
    const owner = await login();
    const result = api.generate(request());
    await login("user2");
    const g = await result;
    await login();
    const done = await api.getGeneration(g.id);
    expect(done.userId).toBe(owner.user.id);
    expect(done.status).toBe("COMPLETED");
  });
  it.each(["PENDING", "PROCESSING"] as const)(
    "refunds a legacy %s generation once on startup",
    async (status) => {
      await login();
      const before = (await api.getWallet()).balance;
      const g = await api.generate(request());
      const store = createStorage(storage);
      const legacy = store.read();
      const unfinished = legacy.generations.find((item) => item.id === g.id)!;
      unfinished.status = status;
      unfinished.result = null;
      unfinished.completedAt = null;
      unfinished.startedAt = status === "PENDING" ? null : g.startedAt;
      store.save(legacy);
      createApi(local, storage);
      const next = createApi(local, storage);
      expect((await next.getGeneration(g.id)).status).toBe("FAILED");
      expect((await next.getWallet()).balance).toBe(before);
      expect(
        (await next.getTransactions()).filter(
          (t) => t.generationId === g.id && t.type === "REFUND",
        ),
      ).toHaveLength(1);
    },
  );
  it("does not change balance in memory or storage if writing fails", async () => {
    await login();
    const before = await api.getWallet();
    const raw = storage.getItem(DB_KEY);
    storage.blocked = true;
    await expect(api.generate(request())).rejects.toMatchObject({
      code: "STORAGE",
    });
    expect(storage.getItem(DB_KEY)).toBe(raw);
    expect(await api.getWallet()).toEqual(before);
  });
  it("does not expose mutable storage through API responses", async () => {
    const session = await login();
    session.user.displayName = "Changed outside API";
    expect((await api.getCurrentUser())?.displayName).toBe("Анна");
    const wallet = await api.getWallet();
    const balance = wallet.balance;
    wallet.balance = -100;
    expect((await api.getWallet()).balance).toBe(balance);
    const generation = await api.generate(request());
    generation.cost = 0;
    expect((await api.getGeneration(generation.id)).cost).toBe(10);
  });
  it("keeps a failed generation and its refund together when saving fails", async () => {
    await login();
    const balance = (await api.getWallet()).balance;
    await api.demo!.failNext();
    const input = request();
    const before = storage.getItem(DB_KEY);
    storage.blocked = true;
    await expect(api.generate(input)).rejects.toMatchObject({
      code: "STORAGE",
    });
    expect(storage.getItem(DB_KEY)).toBe(before);
    expect((await api.getWallet()).balance).toBe(balance);
    storage.blocked = false;
    const generation = await api.generate(input);
    const reloaded = createApi(local, storage);
    expect((await reloaded.getGeneration(generation.id)).status).toBe("FAILED");
    expect((await reloaded.getWallet()).balance).toBe(balance);
    expect(
      (await reloaded.getTransactions()).filter(
        (t) => t.generationId === generation.id && t.type === "REFUND",
      ),
    ).toHaveLength(1);
  });
  it("persists completed generations and transactions", async () => {
    await login();
    const g = await api.generate(request());
    const next = createApi(local, storage);
    expect((await next.getGeneration(g.id)).status).toBe("COMPLETED");
    expect(await next.getTransactions()).toEqual(await api.getTransactions());
  });
  it("resets demo data", async () => {
    await login();
    await api.generate(request());
    await api.demo!.reset();
    expect(await api.getCurrentUser()).toBeNull();
    await login();
    expect(await api.getGenerations()).toHaveLength(3);
  });
});
describe("User-only storage migration", () => {
  it("adds the zero-balance account to existing data once without resetting other users", async () => {
    await login();
    await api.generate(request());
    const store = createStorage(storage);
    const before = store.read();
    const testUser = before.users.find((user) => user.email === "user3@example.com")!;
    before.users = before.users.filter((user) => user.id !== testUser.id);
    before.wallets = before.wallets.filter((wallet) => wallet.userId !== testUser.id);
    delete before.credentials[testUser.id];
    store.save(before);

    const migrated = createStorage(storage).read();
    const added = migrated.users.find((user) => user.email === "user3@example.com")!;
    expect(migrated.users).toEqual([...before.users, added]);
    expect(migrated.wallets.filter((wallet) => wallet.userId !== added.id)).toEqual(before.wallets);
    expect(migrated.transactions).toEqual(before.transactions);
    expect(migrated.generations).toEqual(before.generations);
    expect(migrated.session).toEqual(before.session);
    expect(migrated.credentials).toEqual({ ...before.credentials, [added.id]: "demo1234" });
    expect(createStorage(storage).read()).toEqual(migrated);
    api = createApi(local, storage);
    await login("user3");
    expect((await api.getWallet()).balance).toBe(0);
  });
  it("removes the old delay setting while preserving saved data", async () => {
    await login();
    const before = createStorage(storage).read();
    storage.setItem(
      DB_KEY,
      JSON.stringify({
        ...before,
        demo: { ...before.demo, delay: true },
      }),
    );
    const next = createApi(local, storage);
    expect(JSON.parse(storage.getItem(DB_KEY)!)).toEqual(before);
    expect((await next.generate(request())).status).toBe("COMPLETED");
  });
  it("seeds only regular accounts and exposes no administrative gateway", async () => {
    const state = createStorage(storage).read();
    expect(state.version).toBe(2);
    expect(state.users.map((u) => u.email)).toEqual([
      "user@example.com",
      "user2@example.com",
      "user3@example.com",
    ]);
    expect(state.users.every((u) => !("role" in u))).toBe(true);
    expect(api).not.toHaveProperty("admin");
    expect(
      createApi({ ...local, dataSource: "http" }, storage),
    ).not.toHaveProperty("admin");
    await expect(
      api.login({ email: "admin@example.com", password: "demo1234" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("migrates legacy privileged sessions without losing any user's balance or history", async () => {
    await login();
    const before = createStorage(storage).read();
    const legacy = {
      ...before,
      version: 1,
      users: before.users.map((u) => ({
        ...u,
        role: u.id === before.session!.user.id ? "ADMIN" : "USER",
      })),
      session: {
        ...before.session!,
        user: { ...before.session!.user, role: "ADMIN" },
      },
      credits: {
        "old-request": {
          request: { amount: 50 },
          transactionId: "old-operation",
        },
      },
    };
    storage.setItem(DB_KEY, JSON.stringify(legacy));
    const next = createApi(local, storage);
    const migrated = createStorage(storage).read();
    expect(migrated.version).toBe(2);
    expect(migrated.users).toEqual(before.users);
    expect(migrated.wallets).toEqual(before.wallets);
    expect(migrated.transactions).toEqual(before.transactions);
    expect(migrated.generations).toEqual(before.generations);
    expect(migrated.credentials).toEqual(before.credentials);
    expect(migrated.session).toEqual(before.session);
    expect(migrated).not.toHaveProperty("credits");
    expect(await next.getCurrentUser()).toEqual(before.session!.user);
    expect(JSON.parse(storage.getItem(DB_KEY)!)).toEqual(migrated);
    const g = await next.generate(request());
    expect((await next.getGeneration(g.id)).status).toBe("COMPLETED");
  });
  it("leaves legacy data intact when migration cannot be saved", () => {
    const legacy = {
      ...createStorage(storage).read(),
      version: 1,
      credits: {},
    };
    storage.setItem(DB_KEY, JSON.stringify(legacy));
    const before = storage.getItem(DB_KEY);
    storage.blocked = true;
    expect(() => createStorage(storage)).toThrowError(
      expect.objectContaining({ code: "STORAGE" }),
    );
    expect(storage.getItem(DB_KEY)).toBe(before);
    storage.blocked = false;
    expect(createStorage(storage).read().version).toBe(2);
  });
});
describe("Configuration and HTTP preparation", () => {
  it("selects local and HTTP APIs without touching storage for HTTP", () => {
    expect(api.demo).toBeDefined();
    const storage: Storage = {
      getItem: () => {
        throw new Error("must not touch");
      },
      setItem: () => {
        throw new Error("must not touch");
      },
    };
    const http = createApi({ ...local, dataSource: "http" }, storage);
    expect(http.demo).toBeUndefined();
    expect(parseConfig({}).dataSource).toBe("local");
    expect(() => parseConfig({ VITE_DATA_SOURCE: "unknown" })).toThrow();
  });
  it("sends credentials and JSON through the HTTP API", async () => {
    const result = createDemoData().generations[0];
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(result)));
    const http = createHttpApi("http://example.com/api/", transport);
    const input = request();
    expect(await http.generate(input)).toEqual(result);
    expect(transport).toHaveBeenCalledWith(
      "http://example.com/api/generations",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });
  it("maps API errors, network failures and malformed responses", async () => {
    const transport = vi.fn<typeof fetch>();
    const client = createHttpApi("http://example.com", transport);
    transport.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "Нет доступа" },
        }),
        { status: 403 },
      ),
    );
    await expect(client.getWallet()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    transport.mockRejectedValueOnce(new Error("offline"));
    await expect(client.getWallet()).rejects.toMatchObject({ code: "NETWORK" });
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify({ balance: "bad" })),
    );
    await expect(client.getWallet()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("keeps unsupported schema intact", () => {
    storage.setItem(DB_KEY, '{"version":99}');
    expect(() => createStorage(storage)).toThrow();
    expect(storage.getItem(DB_KEY)).toBe('{"version":99}');
  });
});
