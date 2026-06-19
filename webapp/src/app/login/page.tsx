"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";
import { Icon } from "@/components/icons";

const DEMO = [
  { role: "Analista SOC", email: "analyst@soc-demo.com", icon: "detector" },
  { role: "Cliente", email: "client@northcorp-demo.com", icon: "shield-check" },
];

const CAPS = [
  { icon: "alerts", t: "Cola de alertas priorizada (UEBA multi-detector)" },
  { icon: "search", t: "Investigación con evidencia forense y trazabilidad" },
  { icon: "ai", t: "Asistente de IA: triage y plantilla de investigación" },
  { icon: "audit", t: "Auditoría y gestión del ciclo de vida del caso" },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 border-r relative overflow-hidden"
        style={{ background: "var(--surface-1)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(700px 380px at 80% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(600px 360px at 0% 100%, rgba(129,140,248,0.1), transparent 55%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span
            className="grid place-items-center rounded-xl"
            style={{
              width: 40,
              height: 40,
              background:
                "linear-gradient(160deg, var(--accent), var(--accent-2))",
              color: "var(--accent-ink)",
            }}
          >
            <Icon name="shield" size={22} strokeWidth={2.4} />
          </span>
          <div>
            <div className="text-base font-semibold tracking-tight">
              Sentinel UEBA
            </div>
            <div className="kicker" style={{ letterSpacing: "0.12em" }}>
              Insider Threat · SOC Platform
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight">
            Detección y respuesta gestionada de amenazas internas
          </h1>
          <p
            className="mt-4 text-sm leading-relaxed"
            style={{ color: "var(--fg-muted)" }}
          >
            Una consola para el analista del SOC y un portal para el cliente,
            sobre un motor de detección de anomalías UEBA.
          </p>
          <ul className="mt-8 space-y-3">
            {CAPS.map((c) => (
              <li key={c.t} className="flex items-center gap-3 text-sm">
                <span
                  className="grid place-items-center rounded-lg shrink-0"
                  style={{
                    width: 30,
                    height: 30,
                    background: "rgba(56,189,248,0.1)",
                    color: "var(--accent)",
                    border: "1px solid rgba(56,189,248,0.22)",
                  }}
                >
                  <Icon name={c.icon} size={15} />
                </span>
                <span style={{ color: "var(--fg)" }}>{c.t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs" style={{ color: "var(--fg-faint)" }}>
          Datos: CERT r4.2 (CMU SEI) · Entorno de demostración
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <span
              className="grid place-items-center rounded-xl"
              style={{
                width: 36,
                height: 36,
                background:
                  "linear-gradient(160deg, var(--accent), var(--accent-2))",
                color: "var(--accent-ink)",
              }}
            >
              <Icon name="shield" size={20} />
            </span>
            <div className="text-base font-semibold">Sentinel UEBA</div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>
            Accede con tu cuenta de analista o de cliente.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label className="kicker">Email</label>
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="analyst@soc-demo.com"
                className="soc-input mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="kicker">Contraseña</label>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                className="soc-input mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {state?.error && (
              <div
                className="flex items-center gap-2 text-sm rounded-[10px] px-3 py-2"
                style={{
                  color: "#ffd2dc",
                  background: "rgba(251,94,124,0.12)",
                  border: "1px solid rgba(251,94,124,0.3)",
                }}
              >
                <Icon name="x" size={15} />
                {state.error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={pending}
            >
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="soc-spinner" /> Entrando…
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div className="mt-7">
            <div className="kicker mb-2">Cuentas de demostración</div>
            <div className="space-y-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("Sentinel#2026");
                  }}
                  className="w-full soc-card-2 soc-hover px-3 py-2.5 flex items-center gap-3 text-left"
                >
                  <span
                    className="grid place-items-center rounded-lg shrink-0"
                    style={{
                      width: 30,
                      height: 30,
                      background: "rgba(56,189,248,0.1)",
                      color: "var(--accent)",
                    }}
                  >
                    <Icon name={d.icon} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{d.role}</span>
                    <span
                      className="block text-[11px] font-mono truncate"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {d.email}
                    </span>
                  </span>
                  <span
                    className="ml-auto text-[11px]"
                    style={{ color: "var(--accent)" }}
                  >
                    Usar
                  </span>
                </button>
              ))}
            </div>
            <p
              className="mt-2 text-[11px]"
              style={{ color: "var(--fg-faint)" }}
            >
              Contraseña: <span className="font-mono">Sentinel#2026</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
