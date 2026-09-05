import clsx from 'clsx';
export const StatusBadge = ({ status, label }: { status: 'healthy' | 'warning' | 'critical' | 'info'; label?: string }) => {
  const colors = {
    healthy: 'bg-healthy',
    warning: 'bg-warning',
    critical: 'bg-critical',
    info: 'bg-info',
  };
  return (
    <div className="flex items-center space-x-2">
      <div className={clsx('w-2 h-2 rounded-full', colors[status])} />
      {label && <span className="text-xs text-secondary capitalize">{label}</span>}
    </div>
  );
};