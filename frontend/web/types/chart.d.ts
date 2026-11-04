/** Props Recharts passes to a custom tooltip `content` component. */
interface ChartTooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  fill?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
}
