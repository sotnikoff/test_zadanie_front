# Предварительные REST-контракты

Это предложение frontend-команды для согласования, не окончательный API PostgreSQL/Python. Реальный сервер не подключался и интеграция не тестировалась.

Base URL: `http://localhost:8000/api/v1`. JSON. Cookie-сессия (`credentials: include`), без frontend API-ключей. Успешные ответы возвращают сам объект/массив без дополнительного envelope. UUID — строки; даты — ISO 8601; суммы — безопасные целые JS. Текущий пользователь определяется серверной сессией, не переданным из UI userId.

## Формы данных

```ts
type Mood =
  | "neutral"
  | "romantic"
  | "cheerful"
  | "sad"
  | "philosophical"
  | "dark";
type Status = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
type TransactionType = "CREDIT" | "DEBIT" | "REFUND";
interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}
interface Wallet {
  id: string;
  userId: string;
  balance: number;
}
interface AuthSession {
  user: User;
  sessionId: string;
  createdAt: string;
}
interface GeneratePoemRequest {
  requestId: string;
  topic: string;
  instructions: string;
  mood: Mood;
  stanzaCount: number;
}
interface Generation extends GeneratePoemRequest {
  id: string;
  userId: string;
  result: string | null;
  status: Status;
  cost: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  generationId?: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}
interface GenerationQuote {
  cost: number;
  balance: number;
  balanceAfter: number;
  canGenerate: boolean;
}
```

## Методы

| Метод и URL               | Запрос              | Успешный ответ                                                  |
| ------------------------- | ------------------- | --------------------------------------------------------------- |
| POST /auth/login          | `{email, password}` | 200 AuthSession, Set-Cookie                                     |
| POST /auth/logout         | Без тела            | 204                                                             |
| GET /auth/me              | Без тела            | 200 User или null при отсутствии сессии                         |
| GET /generations/quote    | Без тела            | 200 GenerationQuote                                             |
| POST /generations         | GeneratePoemRequest | 202 Generation; повтор может вернуть 200 с существующей записью |
| GET /generations          | Без тела            | 200 Generation[] текущего пользователя                          |
| GET /generations/:id      | UUID в path         | 200 Generation текущего пользователя; чужой ID — 404            |
| GET /billing/wallet       | Без тела            | 200 Wallet текущего пользователя                                |
| GET /billing/transactions | Без тела            | 200 WalletTransaction[] текущего пользователя                   |

Списки упорядочены от новых к старым по createdAt. Пагинация пока отсутствует. UI опрашивает запись генерации примерно раз в 500 мс до COMPLETED/FAILED. Запуск не ждёт окончания AI-обработки.

Стоимость в GeneratePoemRequest отсутствует. Quote — информационный снимок; сервер повторно проверяет актуальный баланс при принятии запроса. В quote balanceAfter может быть отрицательным, но реальный Wallet.balance никогда не становится отрицательным. UI вместо отрицательного прогноза показывает недостаток единиц.

## Идемпотентность и ошибки

requestId создаётся клиентом как UUID. Генерация дедуплицируется по (session.userId, requestId). Повтор идентичного запроса возвращает ранее принятую запись. Изменение параметров с тем же ключом — 409. Срок хранения ключей для production пока не согласован; локально они живут до сброса данных.

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Недостаточно единиц. Пополнение в прототипе недоступно."
  }
}
```

| HTTP    | Примеры code                      |
| ------- | --------------------------------- |
| 400/422 | VALIDATION                        |
| 401     | INVALID_CREDENTIALS, UNAUTHORIZED |
| 403     | FORBIDDEN                         |
| 404     | NOT_FOUND                         |
| 409     | CONFLICT, INSUFFICIENT_BALANCE    |
| 500     | INTERNAL_ERROR                    |

Ошибка AI после принятия запроса представлена FAILED/errorMessage и REFUND в истории, а не повторным HTTP-списанием. Недоступность сети даёт клиентский NETWORK; невалидный успешный ответ — INVALID_RESPONSE. Ошибки LocalStorage имеют локальные STORAGE/STORAGE_SCHEMA.

Для production отдельно согласовать HttpOnly/Secure/SameSite cookies, CSRF, CORS с точным origin, rate limits, валидацию ответов/запросов, транзакции БД, авторизацию и семантику восстановления фоновых задач. Эти меры не реализуются данным frontend-прототипом.

Контракты управления пользователями и начисления средств удалены. User не содержит role. Все доступные данные ограничены текущей сессией.
