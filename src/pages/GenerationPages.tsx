import { DecorativeIcon } from "../shared/components/DecorativeIcon";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Feather, Sparkles, WandSparkles } from "lucide-react";
import { useCurrentUser, useApi, useRefresh } from "../app/providers";
import { moods, type Mood } from "../api/types";
import {
  date,
  ErrorState,
  GenerationRows,
  Heading,
  Loading,
  pending,
  Poem,
} from "../shared/components/common";
import { Button } from "../shared/components/ui/button";
import { useGenerations } from "../hooks/useData";
export function GeneratePage() {
  const api = useApi();
  const { data: user } = useCurrentUser();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
  const [mood, setMood] = useState<Mood>("neutral");
  const [count, setCount] = useState(2);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const quote = useQuery({
    queryKey: ["quote", user?.id],
    queryFn: () => api.getQuote(),
  });
  const generate = useMutation({
    mutationFn: () =>
      api.generate({
        requestId,
        topic,
        instructions,
        mood,
        stanzaCount: count,
      }),
    onSuccess: (g) => {
      void refresh();
      navigate(`/history/${g.id}`);
    },
    onError: () => {
      void quote.refetch();
    },
  });
  const changed = () => {
    setRequestId(crypto.randomUUID());
    generate.reset();
  };
  return (
    <>
      <Heading
        eyebrow="МАСТЕРСКАЯ СЛОВ"
        title="Новое стихотворение"
        description="Ваша идея — отправная точка. Всё остальное сложится в строки."
      />
      <div className="creation-grid">
        <form
          className="card creation-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!generate.isPending && quote.data?.canGenerate)
              generate.mutate();
          }}
        >
          <div className="section-heading">
            <h2>
              <Feather size={19} /> О чём напишем?
            </h2>
            <span className="muted">01 / Идея</span>
          </div>
          <fieldset disabled={generate.isPending}>
            <label>
              Тема стихотворения<span className="required">*</span>
              <input
                value={topic}
                maxLength={120}
                onChange={(e) => {
                  setTopic(e.target.value);
                  changed();
                }}
                required
                placeholder="Например, первый снег или встреча после разлуки"
              />
            </label>
            <label>
              Пожелания <span className="optional">необязательно</span>
              <textarea
                value={instructions}
                maxLength={1000}
                onChange={(e) => {
                  setInstructions(e.target.value);
                  changed();
                }}
                rows={4}
                placeholder="Добавьте детали, образы или особые слова…"
              />
            </label>
            <div className="field-hint">
              Чем больше деталей, тем яснее ваша идея. В демо пожелания
              сохраняются.
            </div>
            <label>Настроение</label>
            <div className="mood-grid">
              {Object.entries(moods).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={mood === key}
                  className={`choice ${mood === key ? "selected" : ""}`}
                  onClick={() => {
                    setMood(key as Mood);
                    changed();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label>Количество четверостиший</label>
            <div className="stanzas">
              {[1, 2, 3, 4].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={count === n}
                  className={`choice ${count === n ? "selected" : ""}`}
                  onClick={() => {
                    setCount(n);
                    changed();
                  }}
                >
                  {n}
                  <small>
                    {n * 4} {n === 1 ? "строки" : "строк"}
                  </small>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="quote-box">
            {quote.isPending ? (
              <Loading />
            ) : quote.error ? (
              <ErrorState error={quote.error} retry={() => quote.refetch()} />
            ) : (
              <>
                <div>
                  <span>Стоимость</span>
                  <strong>{quote.data.cost} ед.</strong>
                </div>
                <div>
                  <span>Ваш баланс</span>
                  <strong>{quote.data.balance} ед.</strong>
                </div>
                <div>
                  <span>После генерации</span>
                  <strong>
                    {quote.data.canGenerate
                      ? `${quote.data.balanceAfter} ед.`
                      : "Недостаточно единиц"}
                  </strong>
                </div>
              </>
            )}
          </div>
          {quote.data && !quote.data.canGenerate && (
            <p className="inline-error">
              Для генерации нужно {quote.data.cost} единиц. Пополнение в
              прототипе недоступно.
            </p>
          )}
          {generate.error && <ErrorState error={generate.error} />}
          <Button
            className="w-full"
            disabled={
              generate.isPending || !topic.trim() || !quote.data?.canGenerate
            }
          >
            <WandSparkles size={18} />
            {generate.isPending ? "Запускаем…" : "Создать стихотворение"}
          </Button>
        </form>
        <aside className="creation-aside">
          <div className="preview-card">
            <DecorativeIcon name="quill" className="preview-quill" />
            <h2>
              Здесь начинается
              <br />
              вдохновение
            </h2>
            <p>
              Один момент. Одно чувство.
              <br />
              Одна история, которую хочется рассказать.
            </p>

            <span>А дальше — магия слов</span>
          </div>
          <div className="tip-card">
            <h3>Маленькая подсказка</h3>
            <p>
              Вместо «о любви» попробуйте «о первой встрече в осеннем парке».
              Конкретная идея помогает найти нужное настроение.
            </p>
          </div>
          <p className="muted small-text">
            Демонстрационный генератор использует подготовленные тексты.
            Реальный AI не подключён.
          </p>
        </aside>
      </div>
    </>
  );
}
export function HistoryPage() {
  const query = useGenerations();
  const [filter, setFilter] = useState("ALL");
  return (
    <>
      <Heading
        title="История вдохновения"
        description="Все ваши стихотворения и идеи — в одном месте."
        action={
          <Button asChild>
            <Link to="/generate">
              <Sparkles size={17} />
              Создать стихотворение
            </Link>
          </Button>
        }
      />
      <section className="card">
        <div className="section-heading">
          <h2>Ваши генерации</h2>
          <select
            aria-label="Фильтр по статусу"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">Все статусы</option>
            <option value="COMPLETED">Готово</option>
            <option value="FAILED">Ошибка</option>
            <option value="PROCESSING">Создаётся</option>
            <option value="PENDING">В очереди</option>
          </select>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : (
          <GenerationRows
            items={query.data.filter(
              (g) => filter === "ALL" || g.status === filter,
            )}
          />
        )}
      </section>
    </>
  );
}
export function DetailPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const { data: user } = useCurrentUser();
  const query = useQuery({
    queryKey: ["generation", user?.id, id],
    queryFn: () => api.getGeneration(id),
    refetchInterval: (q) =>
      q.state.data && pending(q.state.data) ? 500 : false,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const g = query.data;
  return (
    <>
      <Link className="back-link" to="/history">
        <ArrowLeft size={16} />К истории
      </Link>
      <Heading
        title={g.topic}
        description={`${moods[g.mood]} · ${g.stanzaCount} четв. · ${date(g.createdAt)} · ${g.cost} ед.`}
        action={
          <Button asChild variant="outline">
            <Link to="/generate">Новое стихотворение</Link>
          </Button>
        }
      />
      <section className="card poem-card">
        <Poem generation={g} />
      </section>
      {g.instructions && (
        <section className="card instructions">
          <h3>Ваши пожелания</h3>
          <p>{g.instructions}</p>
        </section>
      )}
      <p className="center muted small-text">
        Демонстрационный текст · создан для согласования сценария генерации
      </p>
    </>
  );
}
