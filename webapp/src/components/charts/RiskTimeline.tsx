"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  CartesianGrid,
} from "recharts";

export interface TimelinePoint {
  day: string;
  risk: number;
  insider?: boolean;
}

export function RiskTimeline({
  data,
  peakDay,
  threshold = 90,
}: {
  data: TimelinePoint[];
  peakDay?: string;
  threshold?: number;
}) {
  const peak = data.find((d) => d.day === peakDay);
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: -10 }}
        >
          <CartesianGrid stroke="#1c2740" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fill: "#5b6679", fontSize: 11 }}
            minTickGap={40}
          />
          <YAxis domain={[0, 100]} tick={{ fill: "#5b6679", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#111726",
              border: "1px solid #243049",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8b97ad" }}
          />
          <ReferenceLine
            y={threshold}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: "Umbral",
              fill: "#f59e0b",
              fontSize: 10,
              position: "insideTopLeft",
            }}
          />
          <Line
            type="monotone"
            dataKey="risk"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
          />
          {peak && (
            <ReferenceDot
              x={peak.day}
              y={peak.risk}
              r={5}
              fill="#f43f5e"
              stroke="#fff"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
