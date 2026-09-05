import React from 'react';
import { CloudOff, AlertTriangle, Inbox } from 'lucide-react';
import type { Loaded } from '../../lib/backend';

/**
 * How the product says "I do not have this" (PROMPTS.md §108, §118).
 *
 * Every screen that reads infrastructure state renders through here when it
 * has nothing real to show, so the absence of data is always visible as
 * absence — never as a zero, a dash, or a plausible placeholder figure.
 *
 * The three variants are deliberately distinct: an operator needs to know
 * whether a host has no servers configured, whether this build simply cannot
 * reach a backend, or whether something broke.
 */

type Variant = 'unavailable' | 'failed' | 'empty';

const PRESENTATION: Record<Variant, { icon: typeof CloudOff; tone: string; ring: string }> = {
  unavailable: { icon: CloudOff, tone: 'text-secondary', ring: 'border-border/80' },
  failed: { icon: AlertTriangle, tone: 'text-amber-400', ring: 'border-amber-500/30' },
  empty: { icon: Inbox, tone: 'text-info', ring: 'border-border/80' },
};

interface NoDataStateProps {
  variant: Variant;
  title: string;
  detail: string;
  action?: React.ReactNode;
}

export const NoDataState: React.FC<NoDataStateProps> = ({ variant, title, detail, action }) => {
  const { icon: Icon, tone, ring } = PRESENTATION[variant];
  return (
    <div className={`rounded-xl border ${ring} bg-surface/40 px-6 py-10 text-center`}>
      <Icon className={`mx-auto mb-4 h-8 w-8 ${tone}`} aria-hidden />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-secondary">{detail}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
};

/**
 * Render the non-`ok` half of a `Loaded<T>`.
 *
 * Returns `null` for `ok` so a caller can write
 * `<LoadedFallback result={r} .../>` above its real content and let the type
 * checker keep the two branches in step.
 */
export const LoadedFallback = <T,>({
  result,
  emptyTitle,
  emptyDetail,
  action,
}: {
  result: Loaded<T>;
  emptyTitle: string;
  emptyDetail: string;
  action?: React.ReactNode;
}) => {
  if (result.state === 'ok') return null;
  return (
    <NoDataState
      variant={result.state === 'unavailable' ? 'unavailable' : 'failed'}
      title={result.reason}
      detail={result.detail}
      action={result.state === 'unavailable' ? action : undefined}
    />
  );
};

export { type Variant as NoDataVariant };
export const emptyTitles = { emptyTitle: '', emptyDetail: '' };
