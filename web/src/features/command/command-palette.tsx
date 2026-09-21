import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  CornerDownLeft,
  LayoutGrid,
  List,
  Palette,
  Pin,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, isMac } from '@/lib/utils';
import { matchesSearch } from '../projects/lib/filter';
import { useProjects } from '../projects/hooks/use-projects';
import { useUiStore } from '../projects/state/ui-store';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: typeof Plus;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);
  const openCreate = useUiStore((state) => state.openCreate);
  const setThemePanelOpen = useUiStore((state) => state.setThemePanelOpen);
  const setView = useUiStore((state) => state.setView);
  const setSearch = useUiStore((state) => state.setSearch);
  const resetFilters = useUiStore((state) => state.resetFilters);
  const projectsQuery = useProjects();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const projects = projectsQuery.data ?? [];
    const actions: CommandItem[] = [
      {
        id: 'action:new',
        label: '新建项目',
        group: '操作',
        icon: Plus,
        run: () => {
          setOpen(false);
          openCreate();
        },
      },
      {
        id: 'action:theme',
        label: '打开主题设置',
        group: '操作',
        icon: Palette,
        run: () => {
          setOpen(false);
          setThemePanelOpen(true);
        },
      },
      {
        id: 'action:grid',
        label: '切换到网格视图',
        group: '视图',
        icon: LayoutGrid,
        run: () => setView('grid'),
      },
      {
        id: 'action:list',
        label: '切换到列表视图',
        group: '视图',
        icon: List,
        run: () => setView('list'),
      },
      {
        id: 'action:timeline',
        label: '切换到时间线视图',
        group: '视图',
        icon: Clock,
        run: () => setView('timeline'),
      },
      {
        id: 'action:search',
        label: '聚焦搜索框',
        group: '视图',
        icon: Search,
        run: () => {
          setOpen(false);
          window.setTimeout(() => {
            document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
          }, 30);
        },
      },
      {
        id: 'action:reset',
        label: '清除全部筛选',
        group: '视图',
        icon: RotateCcw,
        run: () => {
          resetFilters();
          setSearch('');
        },
      },
    ];

    const matched = projects
      .filter((project) => (query.trim() ? matchesSearch(project, query) : true))
      .slice(0, 8)
      .map<CommandItem>((project) => ({
        id: 'project:' + project.id,
        label: project.title,
        hint: project.language || undefined,
        group: '项目',
        icon: project.pinned ? Pin : ArrowRight,
        run: () => {
          setOpen(false);
          navigate('/p/' + encodeURIComponent(project.id));
        },
      }));

    const lowered = query.trim().toLowerCase();
    const visibleActions = lowered
      ? actions.filter((action) => action.label.toLowerCase().includes(lowered))
      : actions;
    return [...matched, ...visibleActions];
  }, [projectsQuery.data, query, openCreate, setThemePanelOpen, setView, resetFilters, setSearch, setOpen, navigate]);

  const grouped = useMemo(() => {
    const acc = new Map<string, CommandItem[]>();
    for (const item of items) {
      const list = acc.get(item.group);
      if (list) {
        list.push(item);
      } else {
        acc.set(item.group, [item]);
      }
    }
    return Array.from(acc.entries());
  }, [items]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, items.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[cursor];
      if (item) item.run();
    }
  };

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="fixed inset-0 animate-fade-in bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-xl animate-slide-up overflow-hidden rounded-card border border-line ps-surface shadow-pop"
      >
        <div className="flex items-center gap-2 border-b border-line/70 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder="搜索项目，或执行操作…"
            aria-label="命令面板输入"
            className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted/70"
          />
          <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">没有匹配的项目或操作</p>
          ) : null}
          {grouped.map(([group, groupItems]) => (
            <div key={group} className="mb-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{group}</p>
              {groupItems.map((item) => {
                flatIndex += 1;
                const index = flatIndex;
                const active = index === cursor;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => item.run()}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm transition',
                      active ? 'bg-accent/20 text-accent' : 'text-fg hover:bg-line/40',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint ? <Badge tone="muted">{item.hint}</Badge> : null}
                    {active ? <CornerDownLeft className="h-3.5 w-3.5 opacity-70" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line/70 px-3 py-2 text-[11px] text-muted">
          <span>↑↓ 选择 · Enter 执行 · Esc 关闭</span>
          <span>{isMac() ? '⌘K' : 'Ctrl+K'} 随时唤起</span>
        </div>
      </div>
    </div>
  );
}
