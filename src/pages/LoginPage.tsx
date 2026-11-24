import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather, ArrowRight, LockKeyhole, RotateCcw } from "lucide-react";
import { useCurrentUser, useApi, useToast } from "../app/providers";
import { Button } from "../shared/components/ui/button";
import { ErrorState, Loading } from "../shared/components/common";
export function LoginPage() {
  const api = useApi();
  const user = useCurrentUser();
  const client = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api.login({ email, password }),
    onSuccess: async () => {
      client.clear();
      await client.invalidateQueries();
    },
  });
  const resetDemo = useMutation({
    mutationFn: () => api.demo!.reset(),
    onSuccess: async () => {
      setEmail("");
      setPassword("");
      login.reset();
      client.clear();
      await client.invalidateQueries();
      toast("Демо-данные сброшены. Начальные балансы и история восстановлены.");
    },
  });
  if (user.isPending) return <Loading />;
  if (user.data) return <Navigate to="/" replace />;
  return (
    <div className="login-page">
      <div className="login-story">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Feather />
          </span>
          мини-кадрика<span className="brand-dot">✦</span>
        </a>
        <div>
          <span className="eyebrow">ВАШЕ ПРОСТРАНСТВО ВДОХНОВЕНИЯ</span>
          <h1>
            Большие чувства.
            <br />
            Маленькие строки.
          </h1>
          <p>
            Превращайте идеи в стихотворения.
            <br />
            Вдохновение начинается с одной мысли.
          </p>
          <div className="login-verse">
            «И даже самый тихий голос
            <br />
            Однажды обретает высоту…»
          </div>
        </div>
        <span className="muted">Слова, в которых есть вы.</span>
      </div>
      <div className="login-panel">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!login.isPending && !resetDemo.isPending) login.mutate();
          }}
        >
          <span className="icon-tile">
            <LockKeyhole />
          </span>
          <h1>С возвращением</h1>
          <p className="muted">Войдите, чтобы продолжить создавать.</p>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Ваш пароль"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {login.isError && <ErrorState error={login.error} />}{" "}
          {user.isError && (
            <ErrorState error={user.error} retry={() => user.refetch()} />
          )}
          <Button className="w-full" disabled={login.isPending || resetDemo.isPending}>
            {login.isPending ? "Входим…" : "Войти"}
            <ArrowRight size={17} />
          </Button>
          <p className="login-note">
            Доступ по приглашению. Самостоятельная регистрация недоступна.
          </p>
          {api.demo && (
            <div className="demo-login">
              <strong>Попробовать демо</strong>
              <p>Выберите аккаунт — пароль заполним сами.</p>
              <div className="demo-accounts">
                {[
                  ["user", "Анна"],
                  ["user2", "Михаил"],
                  ["user3", "Алексей · 0 ед."],
                ].map(([name, label]) => (
                  <Button
                    type="button"
                    key={name}
                    variant="outline"
                    onClick={() => {
                      setEmail(`${name}@example.com`);
                      setPassword("demo1234");
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full mb-3"
                disabled={resetDemo.isPending || login.isPending}
                onClick={() => {
                  if (window.confirm(
                    "Сбросить демо-данные? Созданные стихотворения и изменения балансов будут удалены. Начальные данные восстановятся.",
                  )) resetDemo.mutate();
                }}
              >
                <RotateCcw size={15} />
                {resetDemo.isPending ? "Сбрасываем…" : "Сбросить демо-данные"}
              </Button>
              {resetDemo.isError && <ErrorState error={resetDemo.error} />}
              <small>Демонстрация · без реального AI и платежей</small>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
