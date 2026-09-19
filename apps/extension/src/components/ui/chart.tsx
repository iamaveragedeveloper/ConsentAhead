import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "../../lib/utils";

// shadcn/ui chart primitives (Recharts wrapper): a config maps each series/slice to a label
// and colour, exposed to the chart as the CSS variable --color-<key>.

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>;

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const entries = Object.entries(config).filter(([, c]) => c.color);
  if (!entries.length) return null;
  const css = `[data-chart=${id}] {\n${entries.map(([key, c]) => `  --color-${key}: ${c.color};`).join("\n")}\n}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
};

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId().replace(/:/g, "");
  const chartId = `chart-${id || uniqueId}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/60",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartTooltip = RechartsPrimitive.Tooltip;

interface TooltipItem {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown> & { fill?: string };
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    active?: boolean;
    payload?: TooltipItem[];
    label?: React.ReactNode;
    hideLabel?: boolean;
    hideIndicator?: boolean;
    nameKey?: string;
    labelFormatter?: (label: React.ReactNode) => React.ReactNode;
    valueSuffix?: string;
  }
>(({ active, payload, className, hideLabel = false, hideIndicator = false, label, labelFormatter, nameKey, valueSuffix }, ref) => {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  const heading = !hideLabel && label ? (
    <div className="font-medium">{labelFormatter ? labelFormatter(label) : label}</div>
  ) : null;

  return (
    <div
      ref={ref}
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl",
        className
      )}
    >
      {heading}
      <div className="grid gap-1.5">
        {payload.map((item, i) => {
          const key = String(nameKey ? (item.payload?.[nameKey] ?? item.name) : (item.name ?? item.dataKey ?? "value"));
          const itemConfig = config[key];
          const indicator = item.payload?.fill ?? item.color;
          return (
            <div key={`${key}-${i}`} className="flex items-center gap-2">
              {!hideIndicator && (
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: indicator }} />
              )}
              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                  {valueSuffix}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    payload?: { value?: string; dataKey?: string | number; color?: string }[];
    nameKey?: string;
  }
>(({ className, payload, nameKey }, ref) => {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div ref={ref} className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5", className)}>
      {payload.map((item) => {
        const key = String(nameKey ?? item.dataKey ?? item.value ?? "value");
        return (
          <div key={item.value} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            {config[key]?.label ?? item.value}
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegend";

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
