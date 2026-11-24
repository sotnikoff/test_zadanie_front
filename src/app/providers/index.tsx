import { createContext, useContext, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Gateways } from "../composition";
const GatewayContext = createContext<Gateways | null>(null);
const ToastContext = createContext<(message: string) => void>(() => {});
export function Providers({
  gateways,
  children,
}: {
  gateways: Gateways;
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
    <GatewayContext.Provider value={gateways}>
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
    </GatewayContext.Provider>
  );
}
export function useGateways() {
  const value = useContext(GatewayContext);
  if (!value) throw new Error("Gateway provider missing");
  return value;
}
export const useToast = () => useContext(ToastContext);
export function useCurrentUser() {
  const { auth } = useGateways();
  return useQuery({
    queryKey: ["session"],
    queryFn: () => auth.getCurrentUser(),
  });
}
export function useRefresh() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
}
