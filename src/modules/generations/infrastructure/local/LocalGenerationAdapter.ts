import type { GenerationGateway } from "../../application/ports";
import type { Generation, GeneratePoemRequest } from "../../domain";
import { moods } from "../../../../shared/types/models";
import { LocalRuntime } from "../../../../shared/storage/runtime";
import {
  compensate,
  now,
  transact,
  uid,
} from "../../../../shared/storage/database";
import { fail } from "../../../../shared/errors/AppError";
import { MockAIProvider } from "./MockAIProvider";
const COST = 10;
export class LocalGenerationAdapter implements GenerationGateway {
  constructor(
    private runtime: LocalRuntime,
    private ai = new MockAIProvider(),
  ) {}
  async getQuote() {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    const user = this.runtime.user(s);
    const balance = s.wallets.find((w) => w.userId === user.id)!.balance;
    return {
      cost: COST,
      balance,
      balanceAfter: balance - COST,
      canGenerate: balance >= COST,
    };
  }
  async generate(request: GeneratePoemRequest) {
    await this.runtime.pause();
    if (
      !request.requestId ||
      !request.topic.trim() ||
      request.topic.trim().length > 120 ||
      request.instructions.length > 1000 ||
      !(request.mood in moods) ||
      !Number.isInteger(request.stanzaCount) ||
      request.stanzaCount < 1 ||
      request.stanzaCount > 4
    )
      fail(
        "VALIDATION",
        "Проверьте тему, пожелания и параметры стихотворения.",
      );
    let shouldFail = false;
    let created = false;
    const generation = this.runtime.db.update((s) => {
      const user = this.runtime.user(s);
      const existing = s.generations.find(
        (g) => g.userId === user.id && g.requestId === request.requestId,
      );
      if (existing) {
        if (
          existing.topic !== request.topic.trim() ||
          existing.instructions !== request.instructions.trim() ||
          existing.mood !== request.mood ||
          existing.stanzaCount !== request.stanzaCount
        )
          fail(
            "CONFLICT",
            "Этот идентификатор уже использован для другого запроса.",
          );
        return existing;
      }
      const g: Generation = {
        ...request,
        topic: request.topic.trim(),
        instructions: request.instructions.trim(),
        id: uid(),
        userId: user.id,
        result: null,
        status: "PENDING",
        cost: COST,
        errorMessage: null,
        createdAt: now(),
        startedAt: null,
        completedAt: null,
      };
      transact(s, user.id, "DEBIT", -COST, `Стихотворение «${g.topic}»`, g.id);
      s.generations.push(g);
      shouldFail = s.demo.failNext;
      s.demo.failNext = false;
      created = true;
      return g;
    });
    if (created) this.schedule(generation.id, shouldFail);
    return generation;
  }
  private schedule(id: string, shouldFail: boolean) {
    const delay = this.runtime.db.read().demo.delay;
    const start = setTimeout(
      () => {
        try {
          this.runtime.db.update((s) => {
            const g = s.generations.find((g) => g.id === id);
            if (g?.status === "PENDING") {
              g.status = "PROCESSING";
              g.startedAt = now();
            }
          });
        } catch {
          this.runtime.jobs.delete(id);
          return;
        }
        const complete = setTimeout(
          () => {
            try {
              this.runtime.db.update((s) => {
                const g = s.generations.find((g) => g.id === id);
                if (!g || g.status !== "PROCESSING") return;
                if (shouldFail)
                  compensate(
                    s,
                    g,
                    "Демонстрационный сбой AI. Все 10 единиц возвращены.",
                  );
                else {
                  g.result = this.ai.render(g);
                  g.status = "COMPLETED";
                  g.completedAt = now();
                }
              });
            } catch {
              /* Persistent pending record is recovered on next initialization. */
            } finally {
              this.runtime.jobs.delete(id);
            }
          },
          delay ? 2200 : 20,
        );
        this.runtime.jobs.set(id, complete);
      },
      delay ? 350 : 0,
    );
    this.runtime.jobs.set(id, start);
  }
  async findById(id: string) {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    const user = this.runtime.user(s);
    return (
      s.generations.find((g) => g.id === id && g.userId === user.id) ??
      fail("NOT_FOUND", "Генерация не найдена.")
    );
  }
  async findAll() {
    await this.runtime.pause();
    const s = this.runtime.db.read();
    const user = this.runtime.user(s);
    return s.generations
      .filter((g) => g.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
