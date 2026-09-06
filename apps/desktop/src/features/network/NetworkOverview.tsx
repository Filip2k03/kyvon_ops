import React, { useMemo } from 'react';
import { Globe, ShieldAlert } from 'lucide-react';
import { HostHeader, hostGate } from '../../components/ui/HostHeader';
import { NoDataState } from '../../components/ui/NoDataState';
import { formatBytes, useTelemetry } from '../../lib/useTelemetry';
import { useCollector, useSelectedServer } from '../../lib/useSelectedServer';
import { EXPOSURE_LABEL, SENSITIVE_PORTS, sortPorts } from '../../lib/hostViews';
import type { PortInfo } from '../../types';

/**
 * Listening sockets from `ss -H -lntup`, sampled every 30 collector ticks.
 *
 * Interface rates (rx/tx) arrive on the faster `network` frame. Ports arrive
 * separately because `ss` is slower and may be absent. An empty port list is
 * a real observation; a missing ports frame means `ss` was not run.
 *
 * A bind to 0.0.0.0 is highlighted, not declared open to the internet. Whether
 * the packet actually arrives depends on the firewall, which this screen has
 * not measured.
 */

export const NetworkOverview: React.FC = () => {
  const { servers, selectedId, select } = useSelectedServer();
  const collectorError = useCollector(selectedId);
  const live = useTelemetry(selectedId);

  const ports = live.ports?.ports ?? null;
  const ranked = useMemo(() => (ports ? sortPorts(ports) : []), [ports]);
  const publicBinds = ranked.filter((p) => p.exposure === 'all_interfaces');
  const sensitivePublic = publicBinds.filter((p) => SENSITIVE_PORTS.has(p.port));
  const interfaces = live.network?.interfaces ?? null;

  const gate = hostGate('The network overview', servers, collectorError);

  return (
    <div className="flex h-full flex-col gap-4 pb-8">
      <HostHeader
        icon={Globe}
        title="Network"
        subtitle={
          ports
            ? `${ports.length} listening socket${ports.length === 1 ? '' : 's'} · sampled every 30 s`
            : 'Listening sockets from ss, rates from /proc/net/dev'
        }
        servers={servers}
        selectedId={selectedId}
        onSelect={select}
        trailing={
          publicBinds.length > 0 ? (
            <span
              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400"
              title="Bound to 0.0.0.0 or ::. Reachability still depends on the firewall, which has not been measured."
            >
              {publicBinds.length} all-interface bind{publicBinds.length === 1 ? '' : 's'}
            </span>
          ) : null
        }
      />

      {gate}

      {!gate && live.stoppedReason && (
        <NoDataState variant="failed" title="Telemetry stopped" detail={live.stoppedReason} />
      )}

      {!gate && live.errors.ports && (
        <NoDataState
          variant="failed"
          title="Listening sockets could not be read"
          detail={`${live.errors.ports}. The host's ss output did not parse; nothing is shown rather than a guessed port list.`}
        />
      )}

      {!gate && !ports && !live.errors.ports && !live.stoppedReason && (
        <NoDataState
          variant="empty"
          title="Waiting for the first socket sample"
          detail="ss runs on the first collector tick and every 30 s after, and only if the host has ss. If nothing arrives, the SSH session may not be established, or ss is not installed."
        />
      )}

      {!gate && interfaces && interfaces.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {interfaces.map((iface) => (
            <div key={iface.name} className="rounded-xl border border-border/80 bg-surface/80 p-4">
              <div className="font-mono text-sm font-semibold text-white">{iface.name}</div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <dt className="text-secondary">RX</dt>
                  <dd className="font-mono tabular-nums text-white">
                    {formatBytes(iface.rx_bytes_per_sec)}/s
                  </dd>
                </div>
                <div>
                  <dt className="text-secondary">TX</dt>
                  <dd className="font-mono tabular-nums text-white">
                    {formatBytes(iface.tx_bytes_per_sec)}/s
                  </dd>
                </div>
                <div>
                  <dt className="text-secondary">RX errors / drop</dt>
                  <dd className="font-mono tabular-nums text-secondary">
                    {iface.rx_errors} / {iface.rx_dropped}
                  </dd>
                </div>
                <div>
                  <dt className="text-secondary">TX errors / drop</dt>
                  <dd className="font-mono tabular-nums text-secondary">
                    {iface.tx_errors} / {iface.tx_dropped}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {!gate && sensitivePublic.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {sensitivePublic.length} well-known service
            {sensitivePublic.length === 1 ? '' : 's'} bound to all interfaces
            {sensitivePublic.map((p) => ` (${p.port} ${SENSITIVE_PORTS.get(p.port)})`).join('')}.
            This is a bind address, not a confirmed firewall opening.
          </p>
        </div>
      )}

      {!gate && ports && ports.length === 0 && (
        <NoDataState
          variant="empty"
          title="No listening sockets in this sample"
          detail="ss ran and returned no LISTEN/UNCONN rows the parser recognised. That can be accurate on a host with no listeners the login can see."
        />
      )}

      {!gate && ranked.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-surface/80">
          <div className="max-h-[calc(100vh-18rem)] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 text-secondary backdrop-blur">
                <tr>
                  <th className="p-3 font-medium">Port</th>
                  <th className="p-3 font-medium">Protocol</th>
                  <th className="p-3 font-medium">Bind</th>
                  <th className="p-3 font-medium">Exposure</th>
                  <th className="p-3 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {ranked.map((p) => (
                  <PortRow key={`${p.protocol}:${p.address}:${p.port}:${p.pid ?? 'none'}`} port={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const PortRow: React.FC<{ port: PortInfo }> = ({ port }) => {
  const exposure = EXPOSURE_LABEL[port.exposure];
  const sensitive = SENSITIVE_PORTS.get(port.port);
  return (
    <tr className="transition-colors hover:bg-elevated/40">
      <td className="p-3 font-mono tabular-nums text-white">
        {port.port}
        {sensitive && <span className="ml-2 text-[10px] text-amber-400">{sensitive}</span>}
      </td>
      <td className="p-3 font-mono uppercase text-secondary">{port.protocol}</td>
      <td className="p-3 font-mono text-secondary">{port.address}</td>
      <td className="p-3">
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${exposure.tone}`}
          title={exposure.hint}
        >
          {exposure.label}
        </span>
      </td>
      <td className="p-3 font-mono text-secondary">
        {port.process ? (
          <>
            {port.process}
            {port.pid != null && <span className="ml-1 text-secondary/60">pid {port.pid}</span>}
          </>
        ) : (
          <span className="text-secondary/50" title="The login could not see the owning process">
            not visible
          </span>
        )}
      </td>
    </tr>
  );
};
