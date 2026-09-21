import { Link } from 'react-router-dom';
import { Command, Palette, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isMac } from '@/lib/utils';
import { useUiStore } from '@/features/projects/state/ui-store';

export function Header() {
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setThemePanelOpen = useUiStore((state) => state.setThemePanelOpen);
  const openCreate = useUiStore((state) => state.openCreate);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 ps-surface backdrop-blur-glass">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 transition hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-accent-fg">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-fg">个人空间</span>
            <span className="hidden text-[11px] text-muted sm:block">项目 · 代码片段 · 在线演示</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => setPaletteOpen(true)} title="打开命令面板">
            <Command className="h-4 w-4" />
            <span className="hidden sm:inline">{isMac() ? '⌘K' : 'Ctrl+K'}</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setThemePanelOpen(true)} aria-label="主题设置">
            <Palette className="h-4 w-4" />
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新建</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
