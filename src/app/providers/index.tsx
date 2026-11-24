import { createContext, useContext, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Api } from "../../api/types";
const ApiContext = createContext<Api | null>(null);
const ToastContext = createContext<(message: string) => void>(() => {});
export function Providers({
  api,
  children,
}: {
  api: Api;
  children: ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  const [message, setMessage] = useState("");
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>();
  const toast = (value: string) => {
    clearTimeout(timer);
    setMessage(value);
    setTimer(setTimeout(() => setMessage(""), 4500));
  };
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <ToastContext.Provider value={toast}>
          {children}
          {message && (
            <div className="toast" role="status">
              {message}
              <button
                aria-label="Закрыть уведомление"
                onClick={() => setMessage("")}
              >
                ×
              </button>
            </div>
          )}
        </ToastContext.Provider>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
export function useApi() {
  const value = useContext(ApiContext);
  if (!value) throw new Error("API provider missing");
  return value;
}
export const useToast = () => useContext(ToastContext);
export function useCurrentUser() {
  const api = useApi();
  return useQuery({
    queryKey: ["session"],
    queryFn: () => api.getCurrentUser(),
  });
}
export function useRefresh() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
}
