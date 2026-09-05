import { useUiStore } from '../../stores/uiStore';
export const CommandPalette = () => {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  if (!commandPaletteOpen) return null;
  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-start justify-center pt-[20vh]">
      <div className="bg-surface border border-border rounded-lg w-full max-w-xl shadow-2xl p-4">
        <input autoFocus type="text" placeholder="Type a command or search..." className="w-full bg-transparent border-none outline-none text-lg text-primary placeholder-secondary" />
        <div className="mt-4 border-t border-border pt-4">
          <button onClick={() => setCommandPaletteOpen(false)} className="text-xs text-secondary">Close (Esc)</button>
        </div>
      </div>
    </div>
  );
};