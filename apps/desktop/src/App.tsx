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

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/command-center" replace />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/servers" element={<ServerList />} />
        <Route path="/servers/:id" element={<ServerDetail />} />
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
      </Route>
    </Routes>
  );
}