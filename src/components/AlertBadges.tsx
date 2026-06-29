import type { IAlert } from "@/lib/operator/alerts";

interface IAlertBadgesProps {
  alerts: IAlert[];
}

// Chips de motivo de las alertas de monto en la cola del operador.
export function AlertBadges({ alerts }: IAlertBadgesProps) {
  if (alerts.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {alerts.map((alert) => (
        <li
          key={alert.type}
          className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
        >
          {alert.label}
        </li>
      ))}
    </ul>
  );
}
