# Устройство frontend

React и TypeScript, один интерфейс Api, две реализации: локальная и HTTP. Отдельных Domain/Application-слоёв и классов адаптеров нет.

| Где | Назначение |
| --- | --- |
| [src/api/local.ts](../../src/api/local.ts) | Вход, генерация, списание, возврат и чтение данных. |
| [src/api/storage.ts](../../src/api/storage.ts) | Загрузка JSON и сохранение единого снимка; при ошибке записи память не обновляется. |
| [src/api/demo-data.ts](../../src/api/demo-data.ts) | Аккаунты, начальная история и готовые стихи. |
| [src/api/types.ts](../../src/api/types.ts) | Общие типы и интерфейс Api. |
| [src/api/http.ts](../../src/api/http.ts) | Запросы, декодирование ответов и ошибки сети. Реальный backend не подключён. |
| [src/api/index.ts](../../src/api/index.ts) | Выбор реализации по конфигурации. |
| [src/pages](../../src/pages) | Страницы; доступ к Api через React Context. |

TanStack Query управляет чтением и кэшем. После генерации `useRefresh` обновляет активные запросы, затем открывается результат. Периодического опроса и слежения за статусами нет. Финансовая логика находится в local API.

В `.env`: `VITE_DATA_SOURCE=local` по умолчанию; для будущего backend — `http` и `VITE_API_BASE_URL`. После изменения нужна перезагрузка dev-сервера/пересборка. Подключение Django потребует доработок из [архитектуры](../architecture/architecture.md#11-risks), одного переключения недостаточно.
