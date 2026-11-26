# План реализации backend

## Архитектура и решения

Модульный монолит Django + DRF, PostgreSQL, синхронный HTTP-адаптер AI. Backend-модули: `users`, `billing`, `generations`, `common`. HTTP views и Django Admin вызывают одинаковые сервисы прикладных операций. Сериализаторы валидируют ввод, сервисы управляют транзакциями, ORM хранит состояние, provider adapter работает только с внешним API.

| Решение | Причина и последствие |
| --- | --- |
| Django Admin вместо отдельного интерфейса оператора | Используются штатные пользователи, permissions, формы и журнал действий. |
| PostgreSQL как единственная БД | Блокировки строк и ограничения проверяются в той же СУБД, что используется при запуске. |
| Один синхронный AI-вызов | Нет очереди и повторной доставки; сбой процесса требует служебного завершения PROCESSING. |
| Сессии вместо JWT | Сессия хранится на сервере; logout и блокировка проверяются сервером. |
| Frontend и API на одном origin | Reverse proxy исключает необходимость permissive CORS и упрощает CSRF. |
| Пагинация и отдельный summary | Интерфейс не загружает весь журнал для расчёта итогов. Это уточнение предварительного API, возвращавшего массивы. |
| Ограничения запросов в PostgreSQL | Лимиты общие для нескольких процессов; process-local cache не является источником истины. |

Базовые версии: Python 3.12, Django 5.2, совместимая DRF, PostgreSQL 17, Node.js 24 для существующего frontend. В T01 исполнитель выбирает доступные исправленные patch-версии совместимых веток, записывает точные версии/хеши в lockfiles и digest базовых образов. Теги `latest` и плавающая установка зависимостей запрещены. Переход на другую основную ветку требует записи решения и проверки совместимости.

## Целевая структура поставки

Следующие файлы должен создать исполнитель; список описывает будущий результат, а не уже существующие файлы.

```text
backend/
  pyproject.toml
  uv.lock
  manage.py
  Dockerfile
  config/                       # settings local/test/production, urls, wsgi
  apps/
    users/                      # пользователь, session auth, разрешения
    billing/                    # wallet, ledger, начисление, итоги
    generations/                # state machine, провайдер, история
    common/                     # ошибки, корреляция, health, throttling
  tests/
    unit/
    integration/
    concurrency/
    contracts/
  apps/billing/management/commands/
    reconcile_wallets.py
  apps/generations/management/commands/
    recover_generations.py
    smoke_ai.py
compose.yaml
compose.test.yaml
compose.production.yaml
.env.docker.example
.dockerignore
docker/
  web.Dockerfile
  nginx.conf
  acceptance.sh
  backup.sh
  restore.sh
tests/e2e/
tests/load/
docs/backend/contracts/openapi.yaml
docs/backend/runbook.md
docs/backend/ai-evaluation.md
docs/backend/acceptance-report.md
.github/workflows/backend.yml
```

Backend тесты выполняются `pytest` с pytest-django; линтер/форматтер — Ruff; статическая проверка — mypy с настройками для Django. OpenAPI 3.1 хранится в репозитории, валидируется и проверяется против реальных API-ответов. Frontend остаётся на существующем стеке; E2E — Playwright. `uv` и инструменты проверок устанавливаются только при сборке соответствующих образов. Если генератор схемы не поддерживает выбранную версию OpenAPI, решение принимается в T01 и согласованно отражается в контракте и проверках; молча выдавать другую версию нельзя.

## Данные и ограничения

Основные сущности соответствуют [предварительной модели](../architecture/data-model.md), со следующими уточнениями.

| Сущность | Обязательные дополнения/ограничения |
| --- | --- |
| User | UUID PK, нормализованный уникальный email, display_name, штатные Django password/permissions/is_active; создание только через сервис с Wallet. |
| Wallet | UUID PK, UNIQUE user_id, BIGINT balance default 0, CHECK 0…MAX_UNITS. |
| Generation | UNIQUE(user_id, request_id); cost > 0 и <= MAX_UNITS; статус enum, stanza_count 1…4, mood enum; параметры, normalization_version, prompt_version; provider/model/usage; started_at, deadline_at, completed_at. |
| WalletTransaction | UUID PK, BIGINT sequence generated identity UNIQUE; amount, balance_after, type, description, ссылки wallet/generation/actor, idempotency_key. |
| AdmissionControl | Одна служебная строка для сериализации принятия новых генераций и проверки глобальной ёмкости. |
| LoginRateLimit | Общие для процессов счётчики/окна попыток по email и IP; обновляются атомарно, истёкшие данные удаляет служебная очистка. |

Generation CHECK проверяет соответствие nullable-полей состоянию. Transaction CHECK проверяет знак суммы, предел модуля суммы, допустимый balance_after и форму связей: CREDIT без generation, но с actor/key; DEBIT/REFUND с generation, без actor/key. Частичные UNIQUE: `(generation_id)` для DEBIT и REFUND отдельно; `(actor_id,idempotency_key)` для CREDIT. Повтор начисления сравнивает wallet, amount и нормализованный description; тот же ключ другого оператора относится к другому пространству ключей.

Внешние ключи истории защищены от каскадного удаления. Generation нельзя привязать к кошельку другого пользователя: сервис проверяет владельца под блокировкой; тесты проверяют и прямой вызов сервиса. Межтабличное равенство баланса журналу не объявляется обычным CHECK: его обеспечивают транзакционный сервис и независимая сверка.

БД запрещает UPDATE/DELETE журнала триггером; рабочая роль не имеет TRUNCATE/DDL/права отключения триггеров. Миграции выполняются отдельной ролью владельца схемы. Тестовая роль имеет необходимые права создания изолированной тестовой БД. Суперпользователь PostgreSQL не используется приложением. SQL-доступ владельца БД не входит в модель защиты от оператора Admin.

Индексы: Generation(user_id, created_at, id), Generation(user_id, status, created_at, id), Generation(status, deadline_at); Transaction(wallet_id, sequence), Transaction(wallet_id, created_at), Transaction(type, created_at). Миграции создаются вместе с моделями; custom User задаётся до первой миграции. Usage — nullable BIGINT с неотрицательным CHECK для известных полей.

## Алгоритмы операций

### Принятие генерации

1. Проверить активную сессию, CSRF, JSON и формат ключа. Найти существующий ключ владельца: нормализовать вход по сохранённой normalization_version, вернуть запись либо 409 при конфликте. Для нового ключа применять текущую версию нормализации.
2. Открыть короткий `transaction.atomic()`. Взять AdmissionControl, затем Wallet через `select_for_update()`. Повторно проверить ключ, чтобы закрыть гонку между шагами 1 и 2.
3. Проверить баланс, запас MAX_UNITS и лимиты. Под глобальной блокировкой посчитать активные PROCESSING и принятые за последнюю минуту записи; при превышении — rollback и 429. Для скользящей минуты учитывать все принятые статусы; отказы и повторы не расходуют квоту.
4. Создать PROCESSING с зафиксированной ценой, моделью, prompt_version, временем/deadline; создать DEBIT и обновить wallet.balance. Commit. Отсутствие commit означает отсутствие AI-вызова.
5. Отпустить все блокировки и выполнить ровно один вызов адаптера. Не оборачивать view в `ATOMIC_REQUESTS`. У провайдерского SDK/HTTP-клиента отключить встроенные retries.
6. Передать результат в общую финализацию. Если процесс погиб после шага 4, запись останется PROCESSING до recovery; повтор POST не запускает AI заново.

Успешная предварительная проверка ключа не заменяет UNIQUE в БД. При конфликте вставки откатить соответствующую транзакцию/savepoint и прочитать победившую запись; не продолжать запросы в сломанной транзакции. Транзакции и обработка ошибок должны следовать семантике [Django atomic](https://docs.djangoproject.com/en/5.2/topics/db/transactions/).

### Финализация, начисление и восстановление

Во всех операциях, затрагивающих кошелёк и генерацию, порядок блокировок: Wallet → Generation. Принятие дополнительно берёт AdmissionControl первым. Финализация, CREDIT и recovery не захватывают AdmissionControl после Wallet. Это исключает цикл взаимного ожидания.

Финализатор перечитывает Generation под блокировкой. Если состояние уже финальное, возвращает его без изменений. Если `now >= deadline_at`, даже корректный поздний текст переводит ещё активную запись в FAILED с TIMEOUT и возвратом. Иначе валидный текст сохраняется как COMPLETED; техническая ошибка — FAILED + REFUND + изменение balance в одном commit. Блокировка кошелька охватывает проверку и запись balance_after.

Начисление проверяет права перед операцией и повторный ключ под Wallet lock. Новый CREDIT разрешён только при `balance + amount + sum(processing.cost) <= MAX_UNITS`. Двойная отправка формы возвращает прежнюю операцию; иной payload того же ключа — ошибка конфликта в форме без изменения данных. Прямое изменение balance в ModelAdmin отключено, в том числе через поддельный POST.

`recover_generations --dry-run` выводит количество/ID просроченных записей без изменения данных. `recover_generations --apply --batch-size 100` обрабатывает записи небольшими транзакциями, повторно проверяя срок/статус под теми же блокировками. Команда не вызывает AI. Параллельные команды безопасны; не держат одну транзакцию на весь batch. Ошибки отдельных записей попадают в итог, команда возвращает ненулевой код при необработанной ошибке. В MVP её запускает оператор после аварии; постоянного worker/scheduler нет.

При неопределённом исходе commit соединение закрывается, результат проверяется новым чтением по ключу. Если подтверждение недоступно, не выполнять компенсацию вслепую: 503, событие диагностики, затем recovery. Независимый `reconcile_wallets` проверяет сумму, balance_after по sequence, единственность DEBIT/REFUND, цену, владельцев и соответствие состоянию; возвращает exit 1 при расхождении и никогда не «чинит» журнал.

Конкурентные проверки используют реальные commit и отдельные соединения PostgreSQL, `TransactionTestCase` либо pytest `django_db(transaction=True)`. Обычный Django TestCase может скрыть неправильное использование блокировки; см. [документацию select_for_update](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update).

## Безопасность и интеграция

CSRF bootstrap выполняется перед login и изменяющими запросами. После login frontend повторно получает CSRF, поскольку секрет меняется при входе; logout также защищён. Заголовок `X-CSRFToken` отправляется только своему API. Получение токена и AJAX-запросы реализуются по [инструкции Django](https://docs.djangoproject.com/en/5.2/howto/csrf/). Защита anonymous login проверяется отдельно: одного DRF SessionAuthentication недостаточно как обоснования.

Production: DEBUG=false, конкретные ALLOWED_HOSTS/CSRF_TRUSTED_ORIGINS, session cookie HttpOnly/Secure/SameSite=Lax, CSRF cookie Secure/SameSite=Lax, HTTP→HTTPS на ingress. Session key обновляется при входе; пароль хранится стандартным Django hasher. Forwarded-заголовки доверяются только контролируемому proxy, который перезаписывает клиентские значения. CORS по умолчанию выключен; добавление другого origin требует точного allowlist, не `*` с credentials.

Счётчики login работают между процессами; IP берётся из проверенного источника. Ошибки login не раскрывают существование аккаунта. Production не стартует с пустым/демонстрационным SECRET_KEY, fake provider, отсутствующим ключом реального AI либо некорректными hosts. Host, входные данные и текст модели никогда не выбирают произвольный URL внешнего запроса: AI_BASE_URL задаётся только конфигурацией. Redirect на другой host с секретным заголовком запрещён.

Для same-origin сборки frontend `VITE_API_BASE_URL=/api/v1`; в `src/api/index.ts` нужно разрешить именно безопасный относительный путь с одним начальным `/`, исключив `//host`, либо сохранить явно заданный HTTP(S) URL для отдельного dev-сервера. Browser не использует внутреннее имя `api:8000`. Vite-переменные задаются во время сборки; runtime env контейнера со статикой не меняет уже собранный JS.

## Docker Compose

| Сервис | Назначение | Готовность и зависимости |
| --- | --- | --- |
| db | PostgreSQL, named volume `postgres_data`, внутренний порт 5432 | healthcheck pg_isready; порт хоста не публикуется |
| migrate | Одноразовый запуск миграций тем же backend image, роль владельца схемы | ждёт db service_healthy, завершается exit 0 |
| api | Gunicorn и Django, непривилегированный пользователь | ждёт migrate service_completed_successfully; healthcheck /health/ready |
| web | Собранная React SPA, reverse proxy /api, /admin и Django static | ждёт готовый api; локальный адрес http://localhost:8080 |
| tests | Backend test image и изолированная test DB | только тестовый compose/profile; не подключается к рабочему volume |
| frontend-checks | npm ci, lint/typecheck/test/build в Node image | только проверки |
| e2e | Playwright против web/api с fake provider | только тестовый compose/profile |

Compose ожидает готовность БД через `service_healthy`, а успешное завершение миграций — через `service_completed_successfully`, как описано в [Docker startup order](https://docs.docker.com/compose/how-tos/startup-order/). Само по себе «контейнер запущен» не означает готовность приложения. Последующий отказ БД не исправляется depends_on: API должен отдавать 503 readiness и восстановить соединение после возвращения БД.

`/health/live` проверяет процесс без БД; `/health/ready` проверяет соединение и отсутствие неприменённых миграций. Недоступный AI не делает liveness ошибочным и не вызывает платные healthcheck-запросы. Schema mismatch/DB outage дают readiness 503 без внутренних деталей.

Local: `.env.docker.example` содержит fake-провайдер и безопасные локальные настройки без настоящих секретов; `.env.docker` игнорируется Git. По умолчанию публикуется только `127.0.0.1:8080`. Production override использует реального провайдера, секреты из env/смонтированных secret files, внешний контролируемый TLS ingress и запрещает debug/fake/test routes. Конкретные TLS/ingress команды и адреса тестовой среды записываются в runbook до production-проверки.

Backend Dockerfile — multi-stage, зависимости из frozen lock, код и миграции включены, системные build tools отсутствуют в финальном image. Backend UID не 0, без Docker socket, privileged mode и лишних capabilities. Файловая система api read-only; необходимый `/tmp` — tmpfs, логи — stdout/stderr. Собранные admin static включаются в поставку и обслуживаются без dev runserver. Production не монтирует исходники хоста. `.dockerignore` исключает `.git`, `.env*` с секретами, backups, caches и node_modules; пример env можно включить отдельно.

Gunicorn начально: 2 процесса × 8 threads, максимум 8 активных AI-вызовов глобально. Timeout внешнего AI 45 с < deadline записи 90 с < Gunicorn timeout 105 с < proxy_read_timeout 115 с < клиентское ожидание 120 с. Уровень HTTP-клиента обеспечивает общий deadline, а не только idle read timeout. Graceful shutdown — до 110 с; принудительное убийство оставляет запись для recovery. Блокировки БД/обычные SQL имеют ограниченные таймауты, ошибки ожидания возвращаются без частичных записей.

### Контракт запуска

Исполнитель обязан обеспечить команды ниже. Они являются требованиями к будущей поставке и сейчас не свидетельствуют о наличии compose-файлов.

```sh
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d --wait
docker compose --env-file .env.docker exec api python manage.py createsuperuser
docker compose --env-file .env.docker exec api python manage.py reconcile_wallets
docker compose --env-file .env.docker exec api python manage.py recover_generations --dry-run
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d --wait
```

В PowerShell вместо первой команды используется `Copy-Item .env.docker.example .env.docker`; остальные команды идентичны. Установка Docker с Compose plugin и доступ на скачивание образов/пакетов — единственные обязательные требования хоста. Для повторного старта уже собранного fake-окружения сеть провайдера не нужна. Volume сохраняется после down; `down -v` не включается в штатный restart/runbook. После обновления кода процедура deploy обязана заново выполнить migrate новым image; полагаться на старый завершившийся контейнер миграций нельзя.

Тестовая точка входа:

```sh
docker compose -p kadrika-acceptance -f compose.yaml -f compose.test.yaml run --build --rm tests sh /app/docker/acceptance.sh
docker compose -p kadrika-acceptance -f compose.yaml -f compose.test.yaml run --build --rm frontend-checks
docker compose -p kadrika-acceptance -f compose.yaml -f compose.test.yaml up --build -d --wait web
docker compose -p kadrika-acceptance -f compose.yaml -f compose.test.yaml run --build --rm e2e
```

Test override обязан задавать все безопасные test env без `.env.docker`, отдельный volume/DB, fake и test credentials. Скрипт acceptance.sh выполняет Ruff, mypy, проверку миграций, OpenAPI, pytest и exit != 0 при любом сбое. Нельзя монтировать Docker socket в tests для управления sibling containers: оркестрацию выполняет CI/хост указанными командами. Инъекции ошибок доступны только тестам или test profile и не имеют публичного endpoint в production.

## Конфигурация

| Группа | Обязательные настройки |
| --- | --- |
| Среда | APP_ENV=local/test/production, DJANGO_SECRET_KEY или *_FILE, DEBUG, ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS |
| БД | DB_HOST=db, DB_PORT, DB_NAME, runtime credentials; migration credentials только migrate; connect/lock/statement timeouts |
| AI | AI_PROVIDER=fake/openai_compatible, AI_BASE_URL, AI_MODEL, AI_API_KEY или *_FILE, AI_TIMEOUT_SECONDS=45, AI_CONNECT_TIMEOUT_SECONDS=5, AI_MAX_OUTPUT_TOKENS=2048 |
| Учёт | GENERATION_COST=10, MAX_UNITS=1000000000, GENERATION_DEADLINE_SECONDS=90 |
| Лимиты | SESSION_TTL_SECONDS=43200, LOGIN_* limits, GENERATION_RATE_PER_MINUTE=6, USER_CONCURRENCY=2, GLOBAL_CONCURRENCY=8 |
| UI | VITE_DATA_SOURCE=http, VITE_API_BASE_URL=/api/v1, HOST_PORT=8080 |
| Наблюдаемость | LOG_LEVEL, BUILD_SHA; формат JSON |

Все настройки описаны с единицами и допустимыми диапазонами в runbook. Конфликт env и *_FILE разрешается документированно, предпочтительно отказом старта. SECRET_KEY и ключ провайдера не передаются build args или VITE_*. Цена и версия промпта записываются до AI-вызова и не меняются у уже созданной генерации.

## Наблюдаемость и эксплуатация

JSON-события: auth failure, generation accepted/completed/failed, refund committed, credit committed, recovery, reconciliation mismatch, provider error, DB unavailable. Поля: timestamp UTC, level, event, correlation_id, generation_id/request_id при наличии, user_id/actor_id как UUID, duration_ms, provider/model, безопасный error_code. Пароли, cookie, authorization headers, API key, email, prompt, пожелания, стих и необработанное тело provider response в лог не попадают. Аудит начисления хранится в БД, поэтому потеря stdout не теряет автора и основание.

Runbook содержит запуск, обновление/миграции, смену ключей, создание/блокировку оператора, восстановление PROCESSING, сверку, проверку лимитов и чтение диагностических событий. После сбоя порядок: восстановить БД → проверить readiness → dry-run recovery → apply recovery → reconcile → проверить пользовательскую историю. Автоматически исправлять ledger или повторно вызывать AI запрещено.

Backup/restore выполняются средствами PostgreSQL из контейнеров. `docker/backup.sh` создаёт консистентный pg_dump custom format без вывода бинарного dump через PowerShell pipeline. Копия хранится вне образа и вне основного DB volume; доступ ограничен оператором. `docker/restore.sh` восстанавливает в явно указанную отдельную БД/Compose project и отказывается перезаписывать рабочую БД по умолчанию. Секреты БД не попадают в лог команды. После restore выполняются миграционная проверка, reconcile и проверка количества/связей/хешей контрольных записей. В отчёте фиксируются длительность восстановления и фактическая точка копии; соответствие RPO/RTO проверяется после задания этих значений владельцем среды.

## Порядок реализации

Работа идёт по [tasks.md](tasks.md). До изменения кода уточняются контракты и миграции; для учёта, безопасности и гонок сначала фиксируются тестовые сценарии с ожидаемым исходом, затем реализация. Каждая задача заканчивается проверками связанных BAC. Рефакторинг не меняет наблюдаемое поведение без изменения spec. Фактические результаты записываются в отчёт, а этот план остаётся описанием целевого решения.
