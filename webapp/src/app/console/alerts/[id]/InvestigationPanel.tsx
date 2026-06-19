import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { STATUS_ORDER, STATUS_LABEL } from "@/lib/constants";
import type { Alert, Profile } from "@/lib/types";
import {
  changeStatus,
  assignAlert,
  addNote,
  investigateWithAI,
} from "../../actions";

const labelCls = "text-[11px] uppercase tracking-wide font-medium";

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
      <div
        className="soc-card p-5"
        style={{
          borderColor: "rgba(56,189,248,0.32)",
          background:
            "linear-gradient(180deg, rgba(56,189,248,0.06), rgba(56,189,248,0) 70%), var(--bg-elev)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">✨</span>
          <h3 className="text-sm font-semibold">Asistente de investigación</h3>
        </div>
        {aiEnabled ? (
          <form action={investigateWithAI} className="space-y-3">
            <input type="hidden" name="alertId" value={alert.id} />
            <input type="hidden" name="userCert" value={alert.user_cert} />
            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--fg-muted)" }}
            >
              La IA analiza la alerta y la evidencia del día y redacta un triage
              (amenaza real / falso positivo), técnica MITRE y próximos pasos.
              Se guarda en el hilo del caso.
            </p>
            <SubmitButton
              className="btn btn-primary w-full text-sm"
              pendingText="Generando informe…"
            >
              ✨ Investigar con IA
            </SubmitButton>
          </form>
        ) : (
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--fg-muted)" }}
          >
            IA no configurada. Añade{" "}
            <span className="font-mono">GROQ_API_KEY</span> (gratis en
            console.groq.com) o{" "}
            <span className="font-mono">GEMINI_API_KEY</span> en las variables
            de entorno para activarla.
          </p>
        )}
      </div>

      <Card title="Gestión del caso">
        {/* Estado */}
        <form action={changeStatus} className="space-y-2">
          <input type="hidden" name="alertId" value={alert.id} />
          <input type="hidden" name="userCert" value={alert.user_cert} />
          <label className={labelCls} style={{ color: "var(--fg-muted)" }}>
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
          <SubmitButton pendingText="Actualizando…">
            Actualizar estado
          </SubmitButton>
        </form>

        <div className="my-4 border-t" />

        {/* Asignación */}
        <form action={assignAlert} className="space-y-2">
          <input type="hidden" name="alertId" value={alert.id} />
          <input type="hidden" name="userCert" value={alert.user_cert} />
          <label className={labelCls} style={{ color: "var(--fg-muted)" }}>
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
          <SubmitButton
            className="btn btn-primary w-full text-sm"
            pendingText="Asignando…"
          >
            Asignar caso
          </SubmitButton>
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
          <SubmitButton pendingText="Guardando…">Guardar nota</SubmitButton>
        </form>
      </Card>
    </>
  );
}
