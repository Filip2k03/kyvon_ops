import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { CommandCenter } from './features/command-center/CommandCenter';
import { ServerList } from './features/servers/ServerList';
import { ServerDetail } from './features/servers/ServerDetail';
import { TerminalView } from './features/terminal/TerminalView';
import { ProcessExplorer } from './features/processes/ProcessExplorer';
import { ServiceManager } from './features/services/ServiceManager';
import { NetworkOverview } from './features/network/NetworkOverview';
import { StorageOverview } from './features/storage/StorageOverview';
import { SecurityCenter } from './features/security/SecurityCenter';
import { LogCenter } from './features/logs/LogCenter';
import { DockerOverview } from './features/docker/DockerOverview';
import { VpsDiagnostics } from './features/diagnostics/VpsDiagnostics';
import { FileManager } from './features/files/FileManager';
import { NotesEditor } from './features/notes/NotesEditor';
import { CloudflareManager } from './features/cloudflare/CloudflareManager';
import { GeminiOperations } from './features/gemini/GeminiOperations';
import { MobileBuilder } from './features/mobile/MobileBuilder';
import { DownloadPortal } from './features/downloads/DownloadPortal';
import { VpsHealthMatrix } from './features/servers/VpsHealthMatrix';
import { DevicePairingCenter } from './features/security/DevicePairingCenter';
import { ClientWorkspaceManager } from './features/clients/ClientWorkspaceManager';
import { MobileCompanionView } from './features/mobile/MobileCompanionView';
import { PromotionsHub } from './features/promotions/PromotionsHub';
import { DigitalTwinExplorer } from './features/twin/DigitalTwinExplorer';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/command-center" replace />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/servers" element={<ServerList />} />
        <Route path="/servers/:id" element={<ServerDetail />} />
        <Route path="/clients" element={<ClientWorkspaceManager />} />
        <Route path="/vps-matrix" element={<VpsHealthMatrix />} />
        <Route path="/twin" element={<DigitalTwinExplorer />} />
        <Route path="/pairing" element={<DevicePairingCenter />} />
        <Route path="/cloudflare" element={<CloudflareManager />} />
        <Route path="/gemini" element={<GeminiOperations />} />
        <Route path="/mobile" element={<MobileBuilder />} />
        <Route path="/terminal" element={<TerminalView />} />
        <Route path="/processes" element={<ProcessExplorer />} />
        <Route path="/services" element={<ServiceManager />} />
        <Route path="/network" element={<NetworkOverview />} />
        <Route path="/storage" element={<StorageOverview />} />
        <Route path="/security" element={<SecurityCenter />} />
        <Route path="/logs" element={<LogCenter />} />
        <Route path="/docker" element={<DockerOverview />} />
        <Route path="/diagnostics" element={<VpsDiagnostics />} />
        <Route path="/files" element={<FileManager />} />
        <Route path="/notes" element={<NotesEditor />} />
        <Route path="/companion" element={<MobileCompanionView />} />
        <Route path="/promotions" element={<PromotionsHub />} />
        <Route path="/downloads" element={<DownloadPortal />} />
      </Route>
    </Routes>
  );
}