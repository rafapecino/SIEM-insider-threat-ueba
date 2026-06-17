import type { AlertEvent } from "@/lib/types";
import { fmtDateTime } from "@/lib/constants";

const KIND_ICON: Record<string, string> = {
  status_change: "🔄",
  assignment: "👤",
  note: "📝",
  acknowledge: "✅",
};

export function EventThread({ events }: { events: AlertEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
        Aún no hay actividad. Asigna el caso o añade la primera nota.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <div className="text-lg leading-none mt-0.5">
            {KIND_ICON[e.kind] ?? "•"}
          </div>
          <div className="min-w-0">
            <div className="text-sm">{e.note || e.kind}</div>
            <div className="text-[11px]" style={{ color: "var(--fg-faint)" }}>
              {e.author_profile?.full_name || "Sistema"} ·{" "}
              {fmtDateTime(e.created_at)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
