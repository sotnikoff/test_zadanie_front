# Предварительная модель данных

Проект PostgreSQL для будущего backend. Миграций пока нет. Четыре сущности: пользователь, кошелёк, генерация и операция.

```mermaid
erDiagram
    User ||--|| Wallet : owns
    User ||--o{ Generation : requests
    Wallet ||--o{ WalletTransaction : records
    Generation o|--o{ WalletTransaction : relates_to
    User o|--o{ WalletTransaction : credit_author

    User {
        uuid id PK
        text email UK "max 254; normalized"
        text display_name "max 150"
        text password "Django hash, max 128"
        boolean is_active
        boolean is_staff
        boolean is_superuser
        timestamptz date_joined
        timestamptz last_login "NULL"
    }
    Wallet {
        uuid id PK
        uuid user_id FK,UK
        bigint balance "default 0"
    }
    Generation {
        uuid id PK
        uuid user_id FK
        uuid request_id "unique with user_id"
        text topic "max 120"
        text instructions "default empty"
        text mood "max 16"
        smallint stanza_count
        text status "max 16"
        bigint cost
        text result "NULL"
        text error_code "NULL; max 64"
        text error_message "NULL"
        timestamptz created_at
        timestamptz started_at
        timestamptz deadline_at
        timestamptz completed_at "NULL"
        text provider "max 100"
        text model "max 200"
        text provider_request_id "NULL; max 255"
        bigint input_tokens "NULL"
        bigint output_tokens "NULL"
        bigint total_tokens "NULL"
    }
    WalletTransaction {
        uuid id PK
        bigint sequence UK "generated identity"
        uuid wallet_id FK
        uuid generation_id FK "NULL for CREDIT"
        uuid actor_id FK "NULL for DEBIT and REFUND"
        uuid idempotency_key "NULL except CREDIT"
        text type "CREDIT, DEBIT, REFUND"
        bigint amount "signed"
        bigint balance_after
        text description
        timestamptz created_at
    }
```

## Основные правила

- User — расширение Django AbstractUser с UUID и уникальным нормализованным email для входа. `is_active`, `is_staff`, `is_superuser` сохраняются для блокировки и Django Admin; отдельной модели Admin нет.
- У пользователя один Wallet. Создание аккаунта и кошелька атомарно, начальный баланс 0.
- Generation хранит параметры, результат/ошибку, цену, даты, провайдера, модель и расход токенов. Неизвестный usage — NULL; цена от токенов пока не зависит.
- WalletTransaction хранит знаковую сумму, остаток после операции, связь с генерацией либо автора начисления. `sequence` задаёт порядок журнала при одинаковых датах.
- Денежные поля — BIGINT, но ограничиваются безопасным целым JavaScript. Масштаб 1:1: 10 в базе означает 10 неделимых единиц. Возможная дробность — Q-09.
- Уникальны email, кошелёк пользователя, пара (user_id, request_id), списание/возврат каждой генерации и ключ начисления в пределах автора.
- Баланс неотрицателен; CREDIT/REFUND положительны, DEBIT отрицателен. Сумма журнала совпадает с балансом. Межтабличные проверки выполняются общей логикой внутри транзакции.
- У COMPLETED есть результат и дата завершения; у FAILED — причина, дата и однократный возврат. PROCESSING ещё не имеет окончательного результата.
- История не удаляется через интерфейс; аккаунт можно отключить. Сроки хранения и обезличивание требуют Q-07.

Стандартные таблицы сессий, разрешений и журнала Django Admin на схеме не показаны. Демо-credentials и LocalStorage не переносятся в рабочую БД. Индексы истории и фильтров, конкретные CHECK и длины полей уточним перед миграциями; отметки в ERD предварительные.

[Бизнес-правила](../product/business-rules.md) · [Вопросы](../product/requirements.md#вопросы-для-согласования)
