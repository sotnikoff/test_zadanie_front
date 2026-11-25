# Документация Мини-Кадрики

Это упрощённый комплект по [arc42](https://arc42.org/overview/): один основной [архитектурный документ](architecture/architecture.md) с 12 короткими разделами и отдельные подробные материалы. Файлы сгруппированы по назначению; отдельная папка на каждый раздел arc42 не создаётся.

**As-Is** — работающий frontend-прототип. **To-Be / Draft** — предложения для Django MVP, а не реализованный и принятый backend. Организация документации не меняет статус согласования требований.

## Структура папок

```text
docs/
├── README.md       # карта документации
├── product/        # требования, предложение MVP и бизнес-правила
├── architecture/   # arc42, схема БД и API-контракты
├── testing/        # критерии приёмки и результаты проверок
├── prototype/      # устройство, границы, допущения и демонстрация
└── design/         # промпты изображений и иконок
```

## Как читать

1. Для знакомства и запуска — [корневой README](../README.md).
2. Для обсуждения продукта — [предложение MVP](product/mvp-proposal.md) и [требования](product/requirements.md).
3. Для проектирования — [архитектура](architecture/architecture.md), затем связанные бизнес-правила, модель БД и API.
4. Для проверки — [критерии приёмки](testing/acceptance-criteria.md) и [маршрут демонстрации](prototype/demo-scenarios.md).

## Карта arc42

| № | Раздел | Подробности |
| --- | --- | --- |
| 1 | Введение и цели | [Цели, роли, FR, границы и вопросы](product/requirements.md) |
| 2 | Ограничения | [Ограничения продукта и открытые NFR](product/requirements.md) |
| 3 | Контекст | [Пользователь, оператор и внешний AI](architecture/architecture.md#03-context) |
| 4 | Стратегия | [Django, Admin, PostgreSQL, синхронная генерация](architecture/architecture.md#04-strategy) |
| 5 | Структура | [ERD и модель хранения; модули — в архитектуре](architecture/data-model.md) |
| 6 | Выполнение | [Генерация, возврат и начисление](architecture/architecture.md#06-runtime) |
| 7 | Развёртывание | [Предлагаемое окружение backend](architecture/architecture.md#07-deployment) |
| 8 | Общие правила | [Доступ, финансы, повторы и восстановление](product/business-rules.md) |
| 9 | Решения | [Выбор решений и альтернативы](architecture/architecture.md#09-decisions) |
| 10 | Качество | [Критерии, методы и факты проверок](testing/acceptance-criteria.md) |
| 11 | Риски | [Ограничения и необходимые доработки](architecture/architecture.md#11-risks) |
| 12 | Глоссарий | [Основные термины](architecture/architecture.md#12-glossary) |

## Назначение отдельных материалов

| Документ | Область и статус |
| --- | --- |
| [mvp-proposal.md](product/mvp-proposal.md) | Продуктовое предложение, операторские сценарии, аналитика и подготовка к реализации. Дополнение к arc42, детальный план пока не составлен. |
| [requirements.md](product/requirements.md) | Основной реестр предлагаемых требований FR/NFR, допущений и вопросов Q. |
| [business-rules.md](product/business-rules.md) | Основной источник проектных правил BR; таблицы и интерфейс должны им соответствовать. |
| [data-model.md](architecture/data-model.md) | Предварительная схема PostgreSQL; моделей и миграций backend ещё нет. |
| [api-contracts.md](architecture/api-contracts.md) | Предварительные DTO frontend. Предлагаемые изменения для Django находятся в разделе 8 архитектуры; полного OpenAPI пока нет. |
| [acceptance-criteria.md](testing/acceptance-criteria.md) | Связь FR/NFR/BR с проверками AC и их статусом. Не акт приёмки backend. |
| [frontend-architecture.md](prototype/frontend-architecture.md) | Устройство текущего кода, дополнение к разделам 5–6. |
| [prototype-scope.md](prototype/prototype-scope.md) | Границы только демонстрационного прототипа. Исключение админки не относится к планируемому Django MVP. |
| [assumptions.md](prototype/assumptions.md) | Допущения локальной демонстрации; требования будущего продукта — в requirements.md. |
| [demo-scenarios.md](prototype/demo-scenarios.md) | Инструкция показа прототипа. |
| [prototype-limitations.md](prototype/prototype-limitations.md) | Ограничения локальной эмуляции и исторические проверки. Более свежие результаты — в acceptance-criteria.md. |
| [imagegen-prompts.txt](design/imagegen-prompts.txt), [icon-generation-prompts.txt](design/icon-generation-prompts.txt) | Исходные описания декоративных изображений; материалы дизайна, не требования к генерации контента. |

Идентификаторы FR/NFR/BR/AC/Q сохранены. Подробные правила хранятся в профильных документах; основной документ arc42 связывает их ссылками. При дальнейших изменениях обновляются источник правила и связанные критерии, а не создаётся ещё одна копия требований.
