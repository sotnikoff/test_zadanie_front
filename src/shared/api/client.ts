import { AppError } from "../errors/AppError";
export type Decoder<T> = (value: unknown) => T;
export class HttpClient {
  constructor(
    private baseUrl: string,
    private transport: typeof fetch = fetch,
  ) {}
  async request<T>(
    path: string,
    decode: Decoder<T>,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.transport(
        `${this.baseUrl.replace(/\/$/, "")}${path}`,
        {
          method,
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
    } catch {
      throw new AppError(
        "NETWORK",
        "Сервер недоступен. Проверьте подключение и повторите попытку.",
      );
    }
    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      let message =
        response.status === 401
          ? "Сессия завершена. Войдите снова."
          : response.status === 403
            ? "Недостаточно прав для этого действия."
            : "Не удалось выполнить запрос.";
      try {
        const payload: unknown = await response.json();
        if (isObject(payload) && isObject(payload.error)) {
          if (typeof payload.error.code === "string") code = payload.error.code;
          if (typeof payload.error.message === "string")
            message = payload.error.message;
        }
      } catch {
        /* use status fallback */
      }
      throw new AppError(code, message);
    }
    if (response.status === 204) return decode(undefined);
    try {
      return decode(await response.json());
    } catch {
      throw new AppError(
        "INVALID_RESPONSE",
        "Сервер вернул ответ в неподдерживаемом формате.",
      );
    }
  }
}
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
export function objectDecoder<T>(
  check: (v: Record<string, unknown>) => boolean,
): Decoder<T> {
  return (value) => {
    if (!isObject(value) || !check(value)) throw new Error("Invalid response");
    return value as T;
  };
}
export const list =
  <T>(decode: Decoder<T>): Decoder<T[]> =>
  (value) => {
    if (!Array.isArray(value)) throw new Error("Invalid list");
    return value.map(decode);
  };
export const empty: Decoder<void> = () => undefined;
