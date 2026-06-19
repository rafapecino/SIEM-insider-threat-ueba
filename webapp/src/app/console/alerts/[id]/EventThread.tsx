import type { AlertEvent } from "@/lib/types";
import { fmtDateTime } from "@/lib/constants";
import { Markdown } from "@/components/Markdown";

const KIND_ICON: Record<string, string> = {
  status_change: "🔄",
  assignment: "👤",
  note: "📝",
  acknowledge: "✅",
};

function isAI(e: AlertEvent): boolean {
  return e.kind === "note" && !!(e.payload as { ai?: boolean } | null)?.ai;
}

function AICard({ e }: { e: AlertEvent }) {
  const provider =
    (e.payload as { provider?: string } | null)?.provider || "Asistente IA";
  // Compatibilidad con notas antiguas que llevaban una cabecera "🤖 ..." embebida.
  const body = (e.note || "").replace(/^🤖[^\n]*\n+/, "");
  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{
        borderColor: "rgba(56,189,248,0.32)",
        background: "rgba(56,189,248,0.05)",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: "rgba(56,189,248,0.2)" }}
      >
        <span>✨</span>
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--accent)" }}
        >
          Análisis IA
        </span>
        <span className="badge badge-neutral text-[10px] py-0">{provider}</span>
      </div>
      <div className="p-3">
        <Markdown text={body} />
      </div>
    </div>
  );
}

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
          <div className="text-base leading-none mt-1 shrink-0">
            {isAI(e) ? "✨" : (KIND_ICON[e.kind] ?? "•")}
          </div>
          <div className="min-w-0 flex-1">
            {isAI(e) ? (
              <AICard e={e} />
            ) : e.kind === "note" ? (
              <Markdown text={e.note || ""} />
            ) : (
              <div className="text-sm break-words">{e.note || e.kind}</div>
            )}
            <div
              className="text-[11px] mt-1"
              style={{ color: "var(--fg-faint)" }}
            >
              {e.author_profile?.full_name || "Sistema"} ·{" "}
              {fmtDateTime(e.created_at)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
