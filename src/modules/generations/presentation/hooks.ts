import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser, useGateways } from "../../../app/providers";
import { pending } from "../../../shared/components/common";
export function useGenerations() {
  const { generations } = useGateways();
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["generations", user?.id],
    queryFn: () => generations.findAll(),
    enabled: !!user,
    refetchInterval: (query) => (query.state.data?.some(pending) ? 600 : false),
  });
}
export function useWallet() {
  const { billing } = useGateways();
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: () => billing.getBalance(),
    enabled: !!user,
  });
}
export function useTransactions() {
  const { billing } = useGateways();
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: () => billing.getTransactions(),
    enabled: !!user,
  });
}

// Keep wallet/history synchronized even when the user leaves a processing detail page.
export function useGenerationSync() {
  const generations = useGenerations();
  useFinancialSync(
    generations.data?.map((g) => `${g.id}:${g.status}`).join("|"),
  );
}
export function useFinancialSync(revision: string | undefined) {
  const client = useQueryClient();
  useEffect(() => {
    if (revision === undefined) return;
    void client.invalidateQueries({
      predicate: (query) =>
        ["wallet", "transactions", "quote"].includes(String(query.queryKey[0])),
    });
  }, [revision, client]);
}
