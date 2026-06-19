import { Card } from "@/components/ui";
import { STATUS_ORDER, STATUS_LABEL } from "@/lib/constants";
import type { Alert, Profile } from "@/lib/types";
import {
  changeStatus,
  assignAlert,
  addNote,
  investigateWithAI,
} from "../../actions";

export function InvestigationPanel({
  alert,
  analysts,
  aiEnabled,
}: {
  alert: Alert;
  analysts: Profile[];
  aiEnabled: boolean;
}) {
  return (
    <>
      {/* Asistente de investigación con IA */}
      <Card title="Asistente de investigación (IA)">
        {aiEnabled ? (
          <form action={investigateWithAI} className="space-y-2">
            <input type="hidden" name="alertId" value={alert.id} />
            <input type="hidden" name="userCert" value={alert.user_cert} />
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Genera un triage (amenaza real / falso positivo), un resumen y los
              próximos pasos a partir de la evidencia. Se añade al hilo del
              caso.
            </p>
            <button className="btn btn-primary w-full text-sm" type="submit">
              ✨ Investigar con IA
            </button>
          </form>
        ) : (
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            IA no configurada. Añade{" "}
            <span className="font-mono">GROQ_API_KEY</span> (gratis en
            console.groq.com) o{" "}
            <span className="font-mono">GEMINI_API_KEY</span> en las variables
            de entorno para activarla.
          </p>
        )}
      </Card>

      <Card title="Gestión del caso">
        {/* Estado */}
        <form action={changeStatus} className="space-y-2">
          <input type="hidden" name="alertId" value={alert.id} />
          <input type="hidden" name="userCert" value={alert.user_cert} />
          <label
            className="text-[11px] uppercase tracking-wide"
            style={{ color: "var(--fg-muted)" }}
          >
            Estado
          </label>
          <select
            name="status"
            defaultValue={alert.status}
            className="soc-input"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost w-full text-sm" type="submit">
            Actualizar estado
          </button>
        </form>

        <div className="my-4 border-t" />

        {/* Asignación */}
        <form action={assignAlert} className="space-y-2">
          <input type="hidden" name="alertId" value={alert.id} />
          <input type="hidden" name="userCert" value={alert.user_cert} />
          <label
            className="text-[11px] uppercase tracking-wide"
            style={{ color: "var(--fg-muted)" }}
          >
            Asignar a
          </label>
          <select
            name="assignee"
            defaultValue={alert.assigned_to ?? ""}
            className="soc-input"
          >
            <option value="">Sin asignar</option>
            {analysts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name || a.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <button className="btn btn-primary w-full text-sm" type="submit">
            Asignar caso
          </button>
        </form>
      </Card>

      {/* Nota de investigación */}
      <Card title="Añadir nota de investigación">
        <form action={addNote} className="space-y-2">
          <input type="hidden" name="alertId" value={alert.id} />
          <input type="hidden" name="userCert" value={alert.user_cert} />
          <textarea
            name="note"
            rows={4}
            placeholder="Observaciones, hallazgos, próximos pasos…"
            className="soc-input"
            style={{ resize: "vertical" }}
          />
          <button className="btn btn-ghost w-full text-sm" type="submit">
            Guardar nota
          </button>
        </form>
      </Card>
    </>
  );
}
