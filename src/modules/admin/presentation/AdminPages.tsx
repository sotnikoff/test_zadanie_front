import { useFinancialSync } from "../../generations/presentation/hooks";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { useGateways, useRefresh, useToast } from "../../../app/providers";
import { Button } from "../../../shared/components/ui/button";
import { Dialog } from "../../../shared/components/ui/dialog";
import {
  ErrorState,
  GenerationRows,
  Heading,
  Loading,
  number,
  Poem,
  Transactions,
} from "../../../shared/components/common";
import type { Generation, UserWithWallet } from "../../../shared/types/models";
export function AdminPages({
  page,
}: {
  page: "users" | "generations" | "transactions";
}) {
  const { admin } = useGateways();
  const refresh = useRefresh();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creditUser, setCreditUser] = useState<UserWithWallet | null>(null);
  const [selected, setSelected] = useState<Generation | null>(null);
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => admin.getUsers(),
  });
  const gs = useQuery({
    queryKey: ["admin-generations", filter],
    queryFn: () => admin.getGenerations(filter || undefined),
    enabled: page !== "users",
    refetchInterval: (q) =>
      q.state.data?.some(
        (g) => g.status === "PROCESSING" || g.status === "PENDING",
      )
        ? 800
        : false,
  });
  useFinancialSync(gs.data?.map((g) => `${g.id}:${g.status}`).join("|"));
  const tx = useQuery({
    queryKey: ["admin-transactions", filter],
    queryFn: () => admin.getTransactions(filter || undefined),
    enabled: page === "transactions",
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [amount, setAmount] = useState("50");
  const [comment, setComment] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const create = useMutation({
    mutationFn: () => admin.createUser({ displayName: name, email, password }),
    onSuccess: () => {
      void refresh();
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      toast("Пользователь создан. Начальный баланс — 0 единиц.");
    },
  });
  const credit = useMutation({
    mutationFn: () =>
      admin.creditWallet({
        requestId,
        userId: creditUser!.id,
        amount: Number(amount),
        comment,
      }),
    onSuccess: () => {
      void refresh();
      setCreditUser(null);
      setComment("");
      toast("Единицы начислены. Операция сохранена.");
    },
  });
  const names = Object.fromEntries(
    (users.data ?? []).map((u) => [u.id, u.displayName]),
  );
  const titles = {
    users: ["Пользователи", "Участники вашего пространства и их баланс."],
    generations: [
      "Все генерации",
      "Результаты и статусы генераций всех пользователей.",
    ],
    transactions: [
      "Денежные операции",
      "Начисления, списания и возвраты по всем аккаунтам.",
    ],
  };
  const error =
    users.error ||
    (page !== "users" && gs.error) ||
    (page === "transactions" && tx.error);
  const loading =
    users.isPending ||
    (page !== "users" && gs.isPending) ||
    (page === "transactions" && tx.isPending);
  return (
    <>
      <Heading
        eyebrow="АДМИНИСТРИРОВАНИЕ"
        title={titles[page][0]}
        description={titles[page][1]}
        action={
          page === "users" && (
            <Button
              onClick={() => {
                create.reset();
                setCreateOpen(true);
              }}
            >
              <Plus size={17} />
              Создать пользователя
            </Button>
          )
        }
      />
      <section className="card">
        <div className="section-heading">
          <h2>
            {page === "users" ? (
              <>
                <Users size={19} />
                Участники · {users.data?.length ?? 0}
              </>
            ) : (
              "Все записи"
            )}
          </h2>
          {page === "users" ? (
            <input
              className="search"
              aria-label="Поиск пользователей"
              placeholder="Имя или email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          ) : (
            <select
              aria-label="Фильтр по пользователю"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Все пользователи</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} · {u.email}
                </option>
              ))}
            </select>
          )}
        </div>
        {error ? (
          <ErrorState
            error={error}
            retry={() => {
              void refresh();
            }}
          />
        ) : loading ? (
          <Loading />
        ) : page === "users" ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Баланс</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {users.data
                  ?.filter((u) =>
                    `${u.displayName} ${u.email}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar">{u.displayName[0]}</span>
                          <div>
                            <strong>{u.displayName}</strong>
                            <small>{u.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="role-badge">
                          {u.role === "ADMIN"
                            ? "Администратор"
                            : "Пользователь"}
                        </span>
                      </td>
                      <td>
                        <strong>{number(u.wallet.balance)} ед.</strong>
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCreditUser(u);
                            setRequestId(crypto.randomUUID());
                            setAmount("50");
                            setComment("");
                            credit.reset();
                          }}
                        >
                          <Plus size={15} />
                          Начислить
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {users.data?.filter((u) =>
              `${u.displayName} ${u.email}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ).length === 0 && <p className="state">Пользователи не найдены</p>}
          </div>
        ) : page === "generations" ? (
          <GenerationRows
            items={gs.data ?? []}
            admin
            names={names}
            onSelect={setSelected}
          />
        ) : (
          <Transactions
            items={tx.data ?? []}
            names={names}
            admin
            onGeneration={(id) =>
              setSelected(gs.data?.find((g) => g.id === id) ?? null)
            }
          />
        )}
      </section>
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          if (!create.isPending) setCreateOpen(v);
        }}
        title="Новый пользователь"
        description="Закрытый доступ. Передайте пользователю созданные учётные данные."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!create.isPending) create.mutate();
          }}
        >
          <fieldset disabled={create.isPending}>
            <label>
              Имя
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Пароль
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </fieldset>
          <p className="muted small-text">
            Роль: пользователь · Начальный баланс: 0 единиц
          </p>
          {create.error && <ErrorState error={create.error} />}
          <Button disabled={create.isPending} className="w-full">
            {create.isPending ? "Создаём…" : "Создать пользователя"}
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={!!creditUser}
        onOpenChange={(v) => {
          if (!v && !credit.isPending) setCreditUser(null);
        }}
        title="Начислить единицы"
        description={`${creditUser?.displayName ?? ""} · ${creditUser?.email ?? ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!credit.isPending) credit.mutate();
          }}
        >
          <fieldset disabled={credit.isPending}>
            <label>
              Количество единиц
              <input
                type="number"
                required
                min={1}
                step={1}
                max={Number.MAX_SAFE_INTEGER}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setRequestId(crypto.randomUUID());
                }}
              />
            </label>
            <label>
              Комментарий
              <textarea
                required
                maxLength={300}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  setRequestId(crypto.randomUUID());
                }}
                placeholder="Например, единицы для тестирования"
              />
            </label>
          </fieldset>
          <p className="balance-note">
            Подтвердите начисление {amount || "0"} ед. Операция будет сохранена
            в истории и недоступна для редактирования.
          </p>
          {credit.error && <ErrorState error={credit.error} />}
          <Button disabled={credit.isPending} className="w-full">
            {credit.isPending ? "Начисляем…" : "Подтвердить начисление"}
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={selected?.topic ?? "Генерация"}
        description={
          selected
            ? `${names[selected.userId]} · ${selected.cost} ед. · ${selected.stanzaCount} четв.`
            : ""
        }
      >
        {selected && (
          <>
            <Poem
              generation={
                gs.data?.find((g) => g.id === selected.id) ?? selected
              }
            />
            {selected.instructions && <p>Пожелания: {selected.instructions}</p>}
          </>
        )}
      </Dialog>
    </>
  );
}
