import { AlertTriangle } from 'lucide-react';
export const ErrorState = ({ message }: { message: string }) => (
  <div className="bg-critical/10 border border-critical/20 rounded-lg p-4 flex items-start space-x-3 text-critical">
    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
    <div>
      <h4 className="font-medium text-sm">Error</h4>
      <p className="text-sm opacity-90 mt-1">{message}</p>
    </div>
  </div>
);