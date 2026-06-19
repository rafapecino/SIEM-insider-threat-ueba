import React from "react";

// Renderizador de un subconjunto de markdown (encabezados, viñetas, negrita).
// Suficiente para los informes de IA; sin dependencias externas.

function inline(text: string, keyBase: string): React.ReactNode[] {
  // **negrita** y `código`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong
          key={`${keyBase}-${i}`}
          style={{ fontWeight: 600, color: "var(--fg)" }}
        >
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={`${keyBase}-${i}`}
          className="font-mono text-[0.85em] px-1 py-0.5 rounded"
          style={{
            background: "rgba(139,151,173,0.12)",
            color: "var(--accent)",
          }}
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyBase}-${i}`}>{p}</span>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="space-y-1 my-1.5 ml-1">
          {items.map((b, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm"
              style={{ color: "var(--fg)" }}
            >
              <span style={{ color: "var(--accent)" }}>•</span>
              <span className="min-w-0">
                {inline(b, `li-${blocks.length}-${i}`)}
              </span>
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^#{1,6}\s/.test(line)) {
      flush();
      const content = line.replace(/^#{1,6}\s/, "");
      blocks.push(
        <h4
          key={`h-${idx}`}
          className="text-[11px] uppercase tracking-wide font-semibold mt-3 first:mt-0"
          style={{ color: "var(--accent)" }}
        >
          {content}
        </h4>,
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      blocks.push(
        <p
          key={`p-${idx}`}
          className="text-sm leading-relaxed"
          style={{ color: "var(--fg)" }}
        >
          {inline(line, `p-${idx}`)}
        </p>,
      );
    }
  });
  flush();

  return <div className="space-y-1.5">{blocks}</div>;
}
