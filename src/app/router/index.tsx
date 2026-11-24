import { useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Feather,
  LayoutDashboard,
  Sparkles,
  History,
  Wallet,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useCurrentUser, useApi, useToast } from "../providers";
import { LoginPage } from "../../pages/LoginPage";
import { Dashboard } from "../../pages/Dashboard";
import {
  GeneratePage,
  HistoryPage,
  DetailPage,
} from "../../pages/GenerationPages";
import { BillingPage } from "../../pages/BillingPage";
import { useWallet, useGenerationSync } from "../../hooks/useData";
import { ErrorState, Loading, number } from "../../shared/components/common";
import { errorMessage } from "../../shared/errors/AppError";
function Guard() {
  const user = useCurrentUser();
  if (user.isPending) return <Loading />;
  if (user.error)
    return <ErrorState error={user.error} retry={() => user.refetch()} />;
  if (!user.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
const links = [
  ["/", "Главная", LayoutDashboard],
  ["/generate", "Генерация", Sparkles],
  ["/history", "История", History],
  ["/billing", "Баланс", Wallet],
] as const;
function Layout() {
  useGenerationSync();
  const { data: user } = useCurrentUser();
  const wallet = useWallet();
  const api = useApi();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [mobile, setMobile] = useState(false);
  const logout = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      client.clear();
      navigate("/login");
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const page =
    links.find(([path]) => path === location.pathname)?.[1] ?? "Стихотворение";
  return (
    <div className="app-layout">
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="Закрыть навигацию"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link className="brand" to="/" onClick={() => setMobile(false)}>
          <span className="brand-icon">
            <Feather size={23} />
          </span>
          <span>
            мини-кадрика<small>пространство для идей</small>
          </span>
        </Link>
        <span className="nav-caption">ВАША МАСТЕРСКАЯ</span>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setMobile(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="inspiration-note">
            <Sparkles size={19} />
            <strong>У каждой идеи есть голос</strong>
            <p>Дайте ему прозвучать.</p>
          </div>
          <div className="sidebar-foot">
            Мини-Кадрика <span>MVP · 1.0</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X /> : <Menu />}
            </button>
            <nav className="breadcrumb" aria-label="Навигационная цепочка">
              <Link to="/">Мастерская</Link>
              <span aria-hidden="true">/</span>
              <strong aria-current="page">{page}</strong>
            </nav>
          </div>
          <div className="topbar-right">
            <Link className="balance-pill" to="/billing">
              <span>✦</span>
              {wallet.data ? `${number(wallet.data.balance)} ед.` : "Баланс"}
            </Link>
            <span className="topbar-divider" />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="profile-trigger">
                <span className="avatar">{user?.displayName[0]}</span>
                <span className="profile-name">
                  {user?.displayName}
                  <small>Личный аккаунт</small>
                </span>
                <ChevronDown size={15} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="dropdown"
                  sideOffset={10}
                  align="end"
                >
                  <DropdownMenu.Label className="dropdown-label">
                    {user?.email}
                  </DropdownMenu.Label>
                  <DropdownMenu.Separator className="divider" />
                  <DropdownMenu.Item
                    disabled={logout.isPending}
                    onSelect={() => logout.mutate()}
                  >
                    <LogOut size={16} />
                    Выйти из аккаунта
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main className="workspace">
          <Outlet />
        </main>
        <footer className="main-footer">
          <span>Мини-Кадрика — идеи становятся словами</span>
          <span>Интерактивный прототип</span>
        </footer>
      </div>
    </div>
  );
}
export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Guard />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="generate" element={<GeneratePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="history/:id" element={<DetailPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route
              path="*"
              element={
                <div className="state">
                  <h1>Страница не найдена</h1>
                  <Link className="text-link" to="/">
                    Вернуться на главную
                  </Link>
                </div>
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
