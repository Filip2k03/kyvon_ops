export const EmptyState = ({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border rounded-lg bg-surface/50">
    <h3 className="text-lg font-medium text-primary mb-2">{title}</h3>
    <p className="text-secondary text-sm text-center mb-6 max-w-md">{description}</p>
    {action}
  </div>
);