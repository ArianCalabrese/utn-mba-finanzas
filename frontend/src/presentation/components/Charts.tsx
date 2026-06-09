import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/presentation/utils/format";

// ─── Shared tooltip style ─────────────────────────────────────────────────────

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 12,
  color: "var(--text-primary)",
  boxShadow: "var(--shadow-md)",
};

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--text-muted)",
};

// ─── CapitalLineChart ─────────────────────────────────────────────────────────

export type LineDataPoint = Record<string, number | string>;

interface CapitalLineChartProps {
  data: LineDataPoint[];
  lines: { key: string; label: string; color: string }[];
  xDataKey?: string;
  xLabel?: string;
  xFormatter?: (v: number | string) => string;
  yFormatter?: (v: number) => string;
  referenceY?: number;
}

export function CapitalLineChart({
  data,
  lines,
  xDataKey = "period",
  xLabel = "Período",
  xFormatter,
  yFormatter = formatCurrency,
  referenceY,
}: CapitalLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey={xDataKey}
          tick={AXIS_STYLE}
          tickFormatter={xFormatter as ((v: number) => string) | undefined}
          label={{ value: xLabel, position: "insideBottom", offset: -4, style: AXIS_STYLE }}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => yFormatter(v)}
          width={80}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [yFormatter(v as number)]}
          labelFormatter={(l) => `${xLabel}: ${xFormatter ? xFormatter(l as number) : l}`}
        />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {referenceY !== undefined && (
          <ReferenceLine y={referenceY} stroke="var(--negative)" strokeDasharray="4 2" />
        )}
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── StackedBarChart ──────────────────────────────────────────────────────────

interface StackedBarChartProps {
  data: LineDataPoint[];
  bars: { key: string; label: string; color: string }[];
  xDataKey?: string;
  xLabel?: string;
  yFormatter?: (v: number) => string;
}

export function StackedBarChart({
  data,
  bars,
  xDataKey = "period",
  xLabel = "Período",
  yFormatter = formatCurrency,
}: StackedBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={xDataKey} tick={AXIS_STYLE} />
        <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => yFormatter(v)} width={80} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [yFormatter(v as number)]}
          labelFormatter={(l) => `${xLabel} ${l}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.label} stackId="a" fill={b.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
