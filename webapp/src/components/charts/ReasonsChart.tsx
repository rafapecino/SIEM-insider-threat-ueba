"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { AlertReason } from "@/lib/types";

export function ReasonsChart({ reasons }: { reasons: AlertReason[] }) {
  const data = reasons.map((r) => ({
    label: r.label,
    "Su media diaria": Number(r.avg.toFixed(2)),
    "Día más anómalo": Number(r.value.toFixed(2)),
  }));

  return (
    <div style={{ width: "100%", height: Math.max(160, data.length * 54) }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
          barGap={2}
        >
          <CartesianGrid stroke="#1c2740" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#5b6679", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={170}
            tick={{ fill: "#8b97ad", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#111726",
              border: "1px solid #243049",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Su media diaria" fill="#475569" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Día más anómalo" fill="#f43f5e" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
