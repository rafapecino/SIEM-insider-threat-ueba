import type { Evidence, EvidenceKind, Severity } from "@/lib/types";
import { Icon } from "@/components/icons";

const KIND_ICON: Record<EvidenceKind, string> = {
  file_copy: "file",
  usb: "usb",
  email: "mail",
  logon: "logon",
};

const KIND_LABEL: Record<EvidenceKind, string> = {
  file_copy: "Copia a USB",
  usb: "Dispositivo",
  email: "Correo",
  logon: "Acceso",
};

const SEV_COLOR: Record<Severity, string> = {
  crit: "var(--risk-high)",
  warn: "var(--risk-med)",
  info: "var(--fg-faint)",
};

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-md"
      style={{ background: "rgba(139,151,173,0.1)", color: "var(--fg-muted)" }}
    >
      {children}
    </span>
  );
}

function details(e: Evidence): React.ReactNode {
  const d = e.detail ?? {};
  const chips: React.ReactNode[] = [];
  if (e.kind === "file_copy") {
    if (d.ext)
      chips.push(<Chip key="ext">.{String(d.ext).toUpperCase()}</Chip>);
    if (d.tipo_real) chips.push(<Chip key="real">{String(d.tipo_real)}</Chip>);
    if (d.extension_enganosa)
      chips.push(
        <span key="dec" className="badge badge-high text-[11px] py-0">
          ⚠ extensión engañosa
        </span>,
      );
    if (d.pc) chips.push(<Chip key="pc">{String(d.pc)}</Chip>);
  } else if (e.kind === "email") {
    if (d.destinatarios)
      chips.push(<Chip key="r">{String(d.destinatarios)} dest.</Chip>);
    const ext = (d.externos as string[]) || [];
    if (ext.length)
      chips.push(
        <span key="ext" className="badge badge-med text-[11px] py-0">
          {ext.join(", ")}
        </span>,
      );
    if (d.adjuntos)
      chips.push(<Chip key="a">{String(d.adjuntos)} adjunto(s)</Chip>);
    if (d.tamano_kb) chips.push(<Chip key="s">{String(d.tamano_kb)} KB</Chip>);
  } else {
    if (d.pc) chips.push(<Chip key="pc">{String(d.pc)}</Chip>);
    if (d.fuera_horario)
      chips.push(
        <span key="ah" className="badge badge-med text-[11px] py-0">
          fuera de horario
        </span>,
      );
  }
  return chips.length ? (
    <div className="flex flex-wrap gap-1.5 mt-1">{chips}</div>
  ) : null;
}

export function EvidenceLog({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
        Sin eventos registrados ese día en los logs (acceso, USB, ficheros,
        correo).
      </p>
    );
  }

  return (
    <ol className="relative">
      {evidence.map((e, i) => (
        <li key={e.id} className="flex gap-3 pb-3">
          {/* línea + nodo */}
          <div className="flex flex-col items-center">
            <span
              className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
              style={{ background: SEV_COLOR[e.severity] }}
            />
            {i < evidence.length - 1 && (
              <span
                className="flex-1 w-px my-1"
                style={{ background: "var(--border)" }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-mono text-xs"
                style={{ color: "var(--fg-faint)" }}
              >
                {fmtTime(e.ts)}
              </span>
              <Icon
                name={KIND_ICON[e.kind]}
                size={14}
                style={{ color: SEV_COLOR[e.severity] }}
              />
              <span
                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(56,189,248,0.1)",
                  color: "var(--accent)",
                }}
              >
                {KIND_LABEL[e.kind]}
              </span>
              <span className="text-sm" style={{ color: "var(--fg)" }}>
                {e.summary}
              </span>
            </div>
            {details(e)}
          </div>
        </li>
      ))}
    </ol>
  );
}
