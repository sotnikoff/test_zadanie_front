import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGateways, useToast } from "../providers";
import { Button } from "../../shared/components/ui/button";
import { Dialog } from "../../shared/components/ui/dialog";
import { ErrorState } from "../../shared/components/common";
export function DemoTools() {
  const { demo } = useGateways();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const client = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useQuery({
    queryKey: ["demo-settings"],
    queryFn: () => demo!.getSettings(),
    enabled: !!demo,
  });
  const action = useMutation({
    mutationFn: async (kind: string) => {
      if (kind === "delay") await demo!.setDelay(!settings.data?.delay);
      else if (kind === "fail") await demo!.failNext();
      else if (kind === "reset") await demo!.reset();
      else await demo!.switchAccount(kind);
      return kind;
    },
    onSuccess: async (kind) => {
      if (kind === "delay" || kind === "fail") {
        await settings.refetch();
        toast(
          kind === "fail"
            ? "Следующая генерация завершится ошибкой"
            : "Настройка задержки изменена",
        );
      } else {
        client.clear();
        setOpen(false);
        setConfirm(false);
        navigate(kind === "reset" ? "/login" : "/");
        await client.invalidateQueries();
      }
    },
  });
  if (!demo) return null;
  return (
    <>
      <button className="demo-trigger" onClick={() => setOpen(true)}>
        <FlaskConical size={17} />
        Demo Tools<span>LOCAL</span>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Демонстрационные инструменты"
        description="Настройки локальной имитации. Настоящий backend не подключён."
      >
        <div className="demo-tools">
          <label className="switch-label">
            <span>Искусственная задержка</span>
            <input
              type="checkbox"
              checked={settings.data?.delay ?? true}
              disabled={action.isPending}
              onChange={() => action.mutate("delay")}
            />
          </label>
          <Button
            variant="outline"
            disabled={action.isPending || settings.data?.failNext}
            onClick={() => action.mutate("fail")}
          >
            {settings.data?.failNext
              ? "Ошибка следующей генерации включена"
              : "Вызвать ошибку следующей генерации"}
          </Button>
          <label>Переключить аккаунт</label>
          {["user@example.com", "user2@example.com", "admin@example.com"].map(
            (email) => (
              <Button
                variant="outline"
                key={email}
                disabled={action.isPending}
                onClick={() => action.mutate(email)}
              >
                {email}
              </Button>
            ),
          )}
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            Сбросить демо-данные
          </Button>
          {action.error && <ErrorState error={action.error} />}
        </div>
      </Dialog>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Сбросить все данные?"
        description="Созданные пользователи, стихотворения и операции будут удалены. Восстановится начальный демо-набор, сессия завершится."
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            disabled={action.isPending}
            onClick={() => action.mutate("reset")}
          >
            Да, сбросить
          </Button>
        </div>
      </Dialog>
    </>
  );
}
