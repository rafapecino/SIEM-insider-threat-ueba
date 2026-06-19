"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="font-mono text-xs tabular-nums"
      style={{ color: "var(--fg-muted)" }}
    >
      {now || "--:--:--"}
    </span>
  );
}
