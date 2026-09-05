export const MetricCard = ({ title, value, unit, trend }: { title: string; value: string | number; unit?: string; trend?: React.ReactNode }) => (
  <div className="bg-surface border border-border rounded-lg p-4">
    <div className="text-secondary text-xs uppercase font-semibold mb-2">{title}</div>
    <div className="flex items-baseline">
      <span className="text-2xl font-bold font-mono text-primary">{value}</span>
      {unit && <span className="ml-1 text-sm text-secondary">{unit}</span>}
    </div>
    {trend && <div className="mt-2 text-xs">{trend}</div>}
  </div>
);