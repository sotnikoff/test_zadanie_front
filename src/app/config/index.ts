export interface Config {
  dataSource: "local" | "http";
  apiBaseUrl: string;
}
export function parseConfig(env: Record<string, unknown>): Config {
  const source = env.VITE_DATA_SOURCE ?? "local";
  if (source !== "local" && source !== "http")
    throw new Error("VITE_DATA_SOURCE должен быть local или http.");
  const apiBaseUrl = String(
    env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
  );
  if (!/^https?:\/\//.test(apiBaseUrl))
    throw new Error("VITE_API_BASE_URL должен быть HTTP(S) URL.");
  return { dataSource: source, apiBaseUrl };
}
