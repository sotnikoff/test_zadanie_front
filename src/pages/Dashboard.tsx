import { DecorativeIcon } from "../shared/components/DecorativeIcon";
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, ArrowDownLeft } from "lucide-react";
import { useCurrentUser } from "../app/providers";
import { useGenerations, useTransactions, useWallet } from "../hooks/useData";
import { summarize } from "../shared/utils/summary";
import {
  Empty,
  ErrorState,
  GenerationRows,
  Heading,
  Loading,
  number,
} from "../shared/components/common";
import { Button } from "../shared/components/ui/button";
export function Dashboard() {
  const { data: user } = useCurrentUser();
  const gs = useGenerations();
  const wallet = useWallet();
  const ts = useTransactions();
  if (gs.isPending || wallet.isPending || ts.isPending) return <Loading />;
  if (gs.error || wallet.error || ts.error)
    return (
      <ErrorState
        error={gs.error || wallet.error || ts.error}
        retry={() => {
          void gs.refetch();
          void wallet.refetch();
          void ts.refetch();
        }}
      />
    );
  return (
    <>
      <Heading
        eyebrow="ВАШ ТВОРЧЕСКИЙ КАБИНЕТ"
        title={`Привет, ${user?.displayName} ✦`}
        description="Хороший день, чтобы придумать что-то красивое."
      />
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-tag">
            <Sparkles size={14} /> ОТ ИДЕИ К СТИХОТВОРЕНИЮ
          </span>
          <h2>
            Дайте вашим мыслям
            <br />
            красивую форму
          </h2>
          <p>
            Расскажите, что вас вдохновляет.
            <br />
            Мы поможем подобрать слова.
          </p>
          <Button asChild>
            <Link to="/generate">
              Создать стихотворение
              <ArrowUpRight size={18} />
            </Link>
          </Button>
          <small>Одна идея · несколько строк · 10 единиц</small>
        </div>
        <div className="hero-art" aria-hidden="true">
          <DecorativeIcon name="quill" className="hero-quill" />
        </div>
      </section>
      <div className="stats">
        <Stat
          icon={<DecorativeIcon name="credits" />}
          title="Доступный баланс"
          value={`${number(wallet.data.balance)} ед.`}
          note="Для новых идей и вдохновения"
        />
        <Stat
          icon={<DecorativeIcon name="quill" />}
          title="Создано стихотворений"
          value={String(gs.data.filter((g) => g.status === "COMPLETED").length)}
          note="Каждое начинается с вашей идеи"
        />
        <Stat
          icon={<ArrowDownLeft />}
          title="Всего потрачено"
          value={`${number(summarize(ts.data).spent)} ед.`}
          note="С учётом возвращённых единиц"
        />
      </div>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Последние стихотворения</h2>
            <p>Ваши идеи, которые уже стали строками</p>
          </div>
          <Link className="text-link" to="/history">
            Вся история <ArrowUpRight size={16} />
          </Link>
        </div>
        {gs.data.length ? (
          <GenerationRows items={gs.data.slice(0, 4)} />
        ) : (
          <Empty />
        )}
      </section>
      <div className="subtle-note">
        <Sparkles size={16} />
        <span>
          Не знаете, с чего начать? Попробуйте написать о моменте, который
          хочется сохранить.
        </span>
      </div>
    </>
  );
}
export function Stat({
  icon,
  title,
  value,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat card">
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
