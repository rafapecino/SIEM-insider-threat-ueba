"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="hidden lg:flex flex-col justify-between p-12 soc-card-2 m-0 rounded-none border-0 border-r">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🛡️</div>
          <div>
            <div className="text-lg font-bold tracking-tight">
              Sentinel UEBA
            </div>
            <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Insider Threat · SOC Platform
            </div>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            Detección y respuesta gestionada de amenazas internas
          </h1>
          <p
            className="mt-4 text-sm leading-relaxed"
            style={{ color: "var(--fg-muted)" }}
          >
            Cola de alertas priorizada por un motor multi-detector (UEBA),
            investigación con trazabilidad completa y gestión del ciclo de vida
            de cada caso. Una consola para el analista del SOC y un portal para
            el cliente.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Detección", "Ticketing", "Investigación", "Auditoría"].map(
              (t) => (
                <span key={t} className="badge badge-accent">
                  {t}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="text-xs" style={{ color: "var(--fg-faint)" }}>
          Datos: CERT r4.2 (CMU SEI) · Entorno de demostración
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="text-2xl">🛡️</div>
            <div className="text-lg font-bold">Sentinel UEBA</div>
          </div>

          <h2 className="text-xl font-bold">Iniciar sesión</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>
            Accede con tu cuenta de analista o de cliente.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label
                className="text-xs font-medium"
                style={{ color: "var(--fg-muted)" }}
              >
                Email
              </label>
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="analyst@soc-demo.com"
                className="soc-input mt-1"
                required
              />
            </div>
            <div>
              <label
                className="text-xs font-medium"
                style={{ color: "var(--fg-muted)" }}
              >
                Contraseña
              </label>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="soc-input mt-1"
                required
              />
            </div>

            {state?.error && (
              <div className="badge badge-high w-full justify-center py-2">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={pending}
            >
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div className="mt-8 soc-card p-4 text-xs leading-relaxed">
            <div
              className="font-semibold mb-1"
              style={{ color: "var(--fg-muted)" }}
            >
              Cuentas de demostración
            </div>
            <div style={{ color: "var(--fg-faint)" }}>
              Analista SOC ·{" "}
              <span className="font-mono">analyst@soc-demo.com</span>
              <br />
              Cliente ·{" "}
              <span className="font-mono">client@northcorp-demo.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
