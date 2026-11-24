import { Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  useTransactions,
  useWallet,
} from "../../generations/presentation/hooks";
import { Stat } from "../../generations/presentation/Dashboard";
import {
  ErrorState,
  Heading,
  Loading,
  number,
  Transactions,
} from "../../../shared/components/common";
import { summarize } from "../domain/summary";
export function BillingPage() {
  const wallet = useWallet();
  const tx = useTransactions();
  if (wallet.isPending || tx.isPending) return <Loading />;
  if (wallet.error || tx.error)
    return (
      <ErrorState
        error={wallet.error || tx.error}
        retry={() => {
          void wallet.refetch();
          void tx.refetch();
        }}
      />
    );
  const summary = summarize(tx.data);
  return (
    <>
      <Heading
        title="Баланс и операции"
        description="Прозрачная история всех единиц. Больше пространства для ваших идей."
      />
      <div className="stats">
        <Stat
          icon={<Wallet />}
          title="Доступно сейчас"
          value={`${number(wallet.data.balance)} ед.`}
          note="Одна генерация — 10 единиц"
        />
        <Stat
          icon={<ArrowUpRight />}
          title="Всего начислено"
          value={`${number(summary.credited)} ед.`}
          note="За всё время"
        />
        <Stat
          icon={<ArrowDownLeft />}
          title="Чистый расход"
          value={`${number(summary.spent)} ед.`}
          note="Списания за вычетом возвратов"
        />
      </div>
      <div className="balance-note">
        Для пополнения баланса обратитесь к администратору. Внутренние единицы
        не являются реальными деньгами.
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>История операций</h2>
          <span className="muted">{tx.data.length} операций</span>
        </div>
        <Transactions items={tx.data} />
      </section>
    </>
  );
}
