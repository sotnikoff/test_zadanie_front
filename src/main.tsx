import React from "react";
import ReactDOM from "react-dom/client";
import { Providers } from "./app/providers";
import { Router } from "./app/router";
import { createGateways } from "./app/composition";
import { parseConfig } from "./app/config";
import { resetBrowserDatabase } from "./shared/storage/database";
import { errorMessage } from "./shared/errors/AppError";
import "./styles.css";
const root = ReactDOM.createRoot(document.getElementById("root")!);
try {
  const gateways = createGateways(parseConfig(import.meta.env));
  root.render(
    <React.StrictMode>
      <Providers gateways={gateways}>
        <Router />
      </Providers>
    </React.StrictMode>,
  );
} catch (error) {
  root.render(
    <div className="state startup-error">
      <h1>Не удалось запустить приложение</h1>
      <p>{errorMessage(error)}</p>
      <button className="btn btn-outline" onClick={() => location.reload()}>
        Повторить
      </button>
      {import.meta.env.VITE_DATA_SOURCE !== "http" && (
        <button
          className="btn btn-danger"
          onClick={() => {
            if (
              window.confirm(
                "Удалить текущие демо-данные и восстановить начальные?",
              )
            ) {
              try {
                resetBrowserDatabase();
                location.reload();
              } catch {
                window.alert(
                  "Хранилище недоступно. Разрешите локальное хранение в настройках браузера.",
                );
              }
            }
          }}
        >
          Сбросить демо-данные
        </button>
      )}
    </div>,
  );
}
