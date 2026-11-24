import { DecorativeIcon } from "../shared/components/DecorativeIcon";
import { useTransactions, useWallet } from "../hooks/useData";
import { Stat } from "./Dashboard";
import {
  ErrorState,
  Heading,
  Loading,
  number,
  Transactions,
} from "../shared/components/common";
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
  return (
    <>
      <Heading
        title="Баланс и операции"
        description="Прозрачная история всех единиц. Больше пространства для ваших идей."
      />
      <div className="stats balance-summary">
        <Stat
          icon={<DecorativeIcon name="credits" />}
          title="Баланс"
          value={`${number(wallet.data.balance)} ед.`}
          note="Одна генерация — 10 единиц"
        />
      </div>
      <div className="balance-note">
        Пополнение баланса в прототипе недоступно. Внутренние единицы не
        являются реальными деньгами.
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
