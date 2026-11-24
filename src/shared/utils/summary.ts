import type { WalletTransaction } from "../../api/types";
export function summarize(transactions: WalletTransaction[]) {
  return transactions.reduce(
    (acc, t) => ({
      credited: acc.credited + (t.type === "CREDIT" ? t.amount : 0),
      spent: acc.spent + (t.type !== "CREDIT" ? -t.amount : 0),
    }),
    { credited: 0, spent: 0 },
  );
}
