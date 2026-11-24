import {
  ArrowRight,
  Copy,
  Feather,
  LoaderCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { errorMessage } from "../errors/AppError";
import {
  moods,
  type Generation,
  type WalletTransaction,
} from "../types/models";
import { useToast } from "../../app/providers";
export const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const number = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value);
export const statuses = {
  PENDING: "В очереди",
  PROCESSING: "Создаётся",
  COMPLETED: "Готово",
  FAILED: "Ошибка",
};
export const pending = (g: Generation) =>
  g.status === "PENDING" || g.status === "PROCESSING";
export function Loading() {
  return (
    <div className="state">
      <LoaderCircle className="animate-spin" />
      <span>Загружаем данные…</span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => unknown;
}) {
  return (
    <div className="state error">
      <AlertCircle />
      <p>{errorMessage(error)}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          <RefreshCw size={16} />
          Повторить
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title = "Здесь пока ничего нет",
  text = "Создайте первое стихотворение — и здесь появится его история.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="state">
      <span className="icon-tile">
        <Feather />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Badge({ status }: { status: Generation["status"] }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <i />
      {statuses[status]}
    </span>
  );
}
export function CopyButton({ text }: { text: string }) {
  const toast = useToast();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast("Стихотворение скопировано");
        } catch {
          toast(
            "Копирование недоступно. Выделите текст стихотворения и скопируйте вручную.",
          );
        }
      }}
    >
      <Copy size={15} />
      Скопировать
    </Button>
  );
}
export function GenerationRows({ items }: { items: Generation[] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="generation-list">
      {items.map((g) => (
        <div className="generation-row" key={g.id}>
          <span className="icon-tile small">
            <Feather size={19} />
          </span>
          <div className="generation-title">
            <Link to={`/history/${g.id}`}>{g.topic}</Link>
            <span>
              {moods[g.mood]} · {g.stanzaCount} четв. · {date(g.createdAt)}
            </span>
          </div>
          <Badge status={g.status} />
          <span className="row-cost">{g.cost} ед.</span>
          <Link
            className="arrow-link"
            aria-label={`Открыть ${g.topic}`}
            to={`/history/${g.id}`}
          >
            <ArrowRight size={18} />
          </Link>
        </div>
      ))}
    </div>
  );
}
export function Poem({ generation }: { generation: Generation }) {
  const g = generation;
  return (
    <>
      <div className="result-heading">
        <Badge status={g.status} />
        {g.result && <CopyButton text={g.result} />}
      </div>
      {pending(g) ? (
        <div className="state">
          <LoaderCircle className="animate-spin" />
          <h3>Слова обретают форму</h3>
          <p>Создаём ваше стихотворение. Это займёт несколько секунд.</p>
        </div>
      ) : g.result ? (
        <div className="poem">
          <h2>{g.topic}</h2>
          <div>{g.result}</div>
          <span className="poem-end">✧</span>
        </div>
      ) : (
        <div className="state error">
          <AlertCircle />
          <h3>Не удалось создать стихотворение</h3>
          <p>{g.errorMessage}</p>
        </div>
      )}
    </>
  );
}
export function Transactions({ items }: { items: WalletTransaction[] }) {
  if (!items.length)
    return (
      <Empty
        title="Операций пока нет"
        text="Начисления, списания и возвраты появятся здесь."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Операция / дата</th>
            <th>Описание</th>
            <th>Сумма</th>
            <th>Баланс после</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <span className={`transaction-type ${t.type.toLowerCase()}`}>
                  {
                    {
                      CREDIT: "Начисление",
                      DEBIT: "Списание",
                      REFUND: "Возврат",
                    }[t.type]
                  }
                </span>
                <small>{date(t.createdAt)}</small>
              </td>
              <td>
                {t.description}
                {t.generationId && (
                  <Link
                    className="text-link block"
                    to={`/history/${t.generationId}`}
                  >
                    Посмотреть генерацию ↗
                  </Link>
                )}
              </td>
              <td className={t.amount > 0 ? "positive nowrap" : "nowrap"}>
                {t.amount > 0 ? "+" : ""}
                {number(t.amount)} ед.
              </td>
              <td className="nowrap">{number(t.balanceAfter)} ед.</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
