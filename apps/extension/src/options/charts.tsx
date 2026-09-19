import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../components/ui/chart";
import type { Summary } from "./lib";

interface Slice {
  key: string;
  name: string;
  value: number;
  fill: string;
}

// ── Donut (pie) chart with a value in the middle and a legend beside it ──────

export function Donut({
  data,
  centerValue,
  centerLabel,
  size = 190,
  showLegend = true,
}: {
  data: Slice[];
  centerValue: React.ReactNode;
  centerLabel: string;
  size?: number;
  showLegend?: boolean;
}) {
  const config: ChartConfig = Object.fromEntries(data.map((d) => [d.key, { label: d.name, color: d.fill }]));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <ChartContainer config={config} className="aspect-square" style={{ width: size, height: size }}>
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius={size * 0.32}
            outerRadius={size * 0.46}
            isAnimationActive={false}
            paddingAngle={data.length > 1 ? 3 : 0}
            cornerRadius={5}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || viewBox.cx === undefined || viewBox.cy === undefined) return null;
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy - 4} className="fill-foreground text-3xl font-semibold">
                      {centerValue}
                    </tspan>
                    <tspan x={viewBox.cx} y={viewBox.cy + 20} className="fill-muted-foreground text-[11px]">
                      {centerLabel}
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      {showLegend && (
        <ul className="min-w-[130px] space-y-2 text-sm">
          {data.map((d) => (
            <li key={d.key} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: d.fill }} />
              <span className="flex-1 text-muted-foreground">{d.name}</span>
              <span className="font-medium tabular-nums">{d.value}</span>
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Disclosures over time (bar chart) ────────────────────────────────────────

const timelineConfig = { disclosures: { label: "Disclosures", color: "#818cf8" } } satisfies ChartConfig;

export function Timeline({ data }: { data: Summary["byDay"] }) {
  return (
    <ChartContainer config={timelineConfig} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={24} />
        <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }} content={<ChartTooltipContent />} />
        <Bar isAnimationActive={false} dataKey="disclosures" fill="var(--color-disclosures)" radius={[5, 5, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}
