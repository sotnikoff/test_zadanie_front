# Предварительный API

Предложение для Django, не готовый сервер. Префикс `/api/v1`, JSON, cookie-сессия; изменяющие запросы защищены CSRF. Владелец определяется сессией, цена — сервером. Полную OpenAPI подготовим после согласования.

| Метод | Запрос → результат |
| --- | --- |
| GET /auth/csrf | → CSRF cookie и `{csrfToken}` |
| POST /auth/login | `{email,password}` → `{user,createdAt}` и session cookie |
| POST /auth/logout | → 204 |
| GET /auth/me | → User либо null |
| GET /generations/quote | → `{cost,balance,balanceAfter,canGenerate}` |
| POST /generations | `{requestId,topic,instructions,mood,stanzaCount}` → 200 Generation после синхронного выполнения |
| GET /generations | → Generation[] текущего пользователя |
| GET /generations/{id} | → своя Generation, иначе 404 |
| GET /generations/by-request/{requestId} | → своя Generation по ключу, иначе 404 |
| GET /billing/wallet | → `{id,userId,balance}` |
| GET /billing/transactions | → WalletTransaction[] текущего пользователя |

## Данные и ошибки

- User: id, email, displayName, createdAt. Служебные флаги Django не нужны в пользовательском ответе.
- Generation: id, userId, requestId, параметры, result, status, cost, errorMessage, createdAt, startedAt, completedAt. Токены и модель сохраняются в БД и доступны оператору.
- WalletTransaction: id, walletId, userId, type, amount, balanceAfter, description, createdAt; generationId — только для связанной генерации.
- UUID и даты ISO 8601 передаются строками; суммы — безопасными целыми числами, DEBIT отрицателен. Списки — новые первыми; пагинация пока не определена.
- Ошибки: `{error:{code,message}}`. Предлагаются 400 для валидации, 401 для отсутствия входа, 403 для запрета/CSRF, 404 для отсутствующей/чужой записи, 409 для недостатка средств или конфликта ключа, 500 для внутренней ошибки.

В backend предусмотрены статусы PROCESSING, COMPLETED и FAILED. Основной POST возвращает COMPLETED либо FAILED. Ошибка AI после списания сохраняется как FAILED с возвратом. Повтор принятого ключа возвращает ту же запись, включая PROCESSING, без нового списания; изменённые параметры дают 409. Транспортная ошибка не доказывает, что средства возвращены.

После обрыва нужно читать состояние по сохранённому ключу; поиск по ключу и восстановление формы ещё не реализованы. Ключи сессий Django не передаются в JSON. Текущие [frontend-типы](../../src/api/types.ts) и HTTP-адаптер потребуют доработки для CSRF и нового ответа авторизации.

Создание пользователей и начисление выполняются формами Django Admin, без отдельных публичных endpoints. Числовые ограничения и правила операций — в [бизнес-правилах](../product/business-rules.md).
