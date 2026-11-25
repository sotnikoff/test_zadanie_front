import { useQuery } from "@tanstack/react-query";
import { useCurrentUser, useApi } from "../app/providers";
export function useGenerations() {
  const api = useApi();
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["generations", user?.id],
    queryFn: () => api.getGenerations(),
    enabled: !!user,
  });
}
export function useWallet() {
  const api = useApi();
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: () => api.getWallet(),
    enabled: !!user,
  });
}
export function useTransactions() {
  const api = useApi();
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: () => api.getTransactions(),
    enabled: !!user,
  });
}
