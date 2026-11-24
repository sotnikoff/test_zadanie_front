import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser, useApi } from "../app/providers";
import { pending } from "../shared/components/common";
export function useGenerations() {
  const api = useApi();
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["generations", user?.id],
    queryFn: () => api.getGenerations(),
    enabled: !!user,
    refetchInterval: (query) => (query.state.data?.some(pending) ? 600 : false),
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

// Keep wallet/history synchronized even when the user leaves a processing detail page.
export function useGenerationSync() {
  const generations = useGenerations();
  const revision = generations.data
    ?.map((g) => `${g.id}:${g.status}`)
    .join("|");
  const client = useQueryClient();
  useEffect(() => {
    if (revision === undefined) return;
    void client.invalidateQueries({
      predicate: (query) =>
        ["wallet", "transactions", "quote"].includes(String(query.queryKey[0])),
    });
  }, [revision, client]);
}
