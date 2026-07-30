import { Github } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useThemeStore } from '../../stores';

export function AboutModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);
  const { darkMode } = useThemeStore();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl p-8 w-96 flex flex-col items-center gap-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={darkMode ? '/logo-tui-studio_dark.svg' : '/logo-tui-studio_light.svg'}
          alt="sTUIdio"
          className="w-16 h-16"
        />
        <div>
          <h2 className="text-base font-semibold">sTUIdio</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Terminal UI Design Tool</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{__APP_VERSION__}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          A Figma-like visual editor for designing Terminal User Interface applications.
          Drag-and-drop components, edit properties visually, and export to multiple TUI frameworks.
        </p>
        <div className="text-xs text-muted-foreground">
          Made by <span className="text-foreground font-medium">Javier Alonso</span>
        </div>
        <a
          href="https://github.com/jalonsogo/tui-studio"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition-colors"
        >
          <Github className="w-4 h-4" />
          jalonsogo/tui-studio
        </a>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
