"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { STATUS_ORDER, STATUS_LABEL, THREAT_TYPES } from "@/lib/constants";

export function AlertFilters({
  departments,
  showScenario,
}: {
  departments: string[];
  showScenario: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/console/alerts?${next.toString()}`);
  }

  const sel = (k: string) => params.get(k) ?? "";

  return (
    <div className="soc-card p-4 mb-5 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <div>
        <label
          className="text-[11px] uppercase tracking-wide"
          style={{ color: "var(--fg-muted)" }}
        >
          Buscar empleado
        </label>
        <input
          defaultValue={sel("q")}
          placeholder="ACM2278…"
          className="soc-input mt-1"
          onKeyDown={(e) => {
            if (e.key === "Enter")
              update("q", (e.target as HTMLInputElement).value);
          }}
        />
      </div>

      <Select
        label="Estado"
        value={sel("status")}
        onChange={(v) => update("status", v)}
        options={STATUS_ORDER.map((s) => ({
          value: s,
          label: STATUS_LABEL[s],
        }))}
      />
      <Select
        label="Tipo de amenaza"
        value={sel("threat")}
        onChange={(v) => update("threat", v)}
        options={THREAT_TYPES.map((t) => ({ value: t, label: t }))}
      />
      <Select
        label="Departamento"
        value={sel("department")}
        onChange={(v) => update("department", v)}
        options={departments.map((d) => ({ value: d, label: d }))}
      />
      {showScenario && (
        <Select
          label="Escenario (demo)"
          value={sel("scenario")}
          onChange={(v) => update("scenario", v)}
          options={[
            { value: "1", label: "Esc. 1" },
            { value: "2", label: "Esc. 2" },
            { value: "3", label: "Esc. 3" },
          ]}
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label
        className="text-[11px] uppercase tracking-wide"
        style={{ color: "var(--fg-muted)" }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="soc-input mt-1"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
