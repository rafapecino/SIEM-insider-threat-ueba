"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export function BarBreakdown({
  data,
  color = "#38bdf8",
  height = 260,
}: {
  data: { name: string; value: number; color?: string }[];
  color?: string;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
        >
          <CartesianGrid
            stroke="#1c2740"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "#5b6679", fontSize: 11 }}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fill: "#5b6679", fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(56,189,248,0.06)" }}
            contentStyle={{
              background: "#111726",
              border: "1px solid #243049",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
