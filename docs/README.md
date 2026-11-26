# Документация

Текущий результат — локальный прототип. Для следующего этапа подготовлена [спецификация backend для реализации AI-агентами](backend/README.md): требования, технический план, Docker, задачи и проверяемые критерии приёмки. Backend пока не реализован; оценка сроков и параметры рабочего размещения не утверждены.

| Папка | Что читать |
| --- | --- |
| backend | [Пакет spec-driven development](backend/README.md), [спецификация](backend/spec.md), [план](backend/plan.md), [55 критериев приёмки](backend/acceptance.md), [задачи для агента](backend/tasks.md). |
| product | [Требования и вопросы](product/requirements.md), [правила баланса](product/business-rules.md), [следующие шаги](product/next-steps.md). |
| architecture | [Краткая arc42](architecture/architecture.md), [схема БД](architecture/data-model.md), [API](architecture/api-contracts.md). |
| testing | [Критерии приёмки и фактические проверки](testing/acceptance-criteria.md). |
| prototype | [Что работает и ограничения](prototype/overview.md), [устройство кода](prototype/frontend-architecture.md), [демонстрация](prototype/demo-scenarios.md). |
| design | [Промпты изображений](design/imagegen-prompts.txt) и [иконок](design/icon-generation-prompts.txt). |

Для знакомства достаточно [README проекта](../README.md) и требований. Для реализации backend начинать с пакета `backend`; документы `architecture` и `product` сохраняют предварительный контекст. Идентификаторы FR/NFR, BR, AC и Q сохранены, трассировка к новым BFR/BNFR/BAC дана в пакете спецификации.
