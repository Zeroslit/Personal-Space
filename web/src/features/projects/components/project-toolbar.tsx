import { useMemo } from 'react';
import {
  Check,
  Clock,
  LayoutGrid,
  List,
  Palette,
  Pin,
  Plus,
  RotateCcw,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type Project,
  type ProjectStatus,
  type Settings,
  type SortMode,
  type ViewMode,
} from '@/api/types';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Popover } from '@/components/ui/popover';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { isFilterActive, collectLanguages } from '../lib/filter';
import { useSaveSettings, useSettings, useTags } from '../hooks/use-projects';
import { useUiStore } from '../state/ui-store';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'grid', label: '网格', icon: LayoutGrid },
  { id: 'list', label: '列表', icon: List },
  { id: 'timeline', label: '时间线', icon: Clock },
];

const SORT_LABELS: Record<SortMode, string> = {
  manual: '自定义顺序',
  updated: '最近更新',
  created: '创建时间',
  stars: 'Star 数',
  title: '标题',
};

export interface ProjectToolbarProps {
  projects: Project[];
}

export function ProjectToolbar({ projects }: ProjectToolbarProps) {
  const tagsQuery = useTags();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const toast = useToast();

  const search = useUiStore((state) => state.search);
  const setSearch = useUiStore((state) => state.setSearch);
  const activeTags = useUiStore((state) => state.tags);
  const toggleTag = useUiStore((state) => state.toggleTag);
  const setTags = useUiStore((state) => state.setTags);
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);
  const status = useUiStore((state) => state.status);
  const setStatus = useUiStore((state) => state.setStatus);
  const pinnedOnly = useUiStore((state) => state.pinnedOnly);
  const setPinnedOnly = useUiStore((state) => state.setPinnedOnly);
  const resetFilters = useUiStore((state) => state.resetFilters);
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const setSort = useUiStore((state) => state.setSort);
  const openCreate = useUiStore((state) => state.openCreate);
  const setThemePanelOpen = useUiStore((state) => state.setThemePanelOpen);

  const languages = useMemo(() => collectLanguages(projects), [projects]);
  const current = settings.data;
  const filtersActive = isFilterActive({
    search,
    tags: activeTags,
    language,
    status,
    pinnedOnly,
  });

  const updateSetting = (patch: Partial<Settings>) => {
    saveSettings.mutate(patch, {
      onError: (error) => toast.error(`设置保存失败：${errorMessage(error)}`),
    });
  };

  const switchView = (next: ViewMode) => {
    setView(next);
    updateSetting({ view: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            data-search-input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索标题、简介、标签或代码内容…"
            aria-label="搜索项目"
            className="pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="清空搜索"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <Button variant="primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建项目
        </Button>
        <Button variant="outline" onClick={() => setThemePanelOpen(true)}>
          <Palette className="h-4 w-4" />
          主题
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Popover
          trigger={({ open, toggle }) => (
            <Button variant="outline" onClick={toggle} aria-expanded={open}>
              <SlidersHorizontal className="h-4 w-4" />
              标签
              {activeTags.length > 0 ? (
                <span className="ml-1 rounded-full bg-accent px-1.5 text-[11px] text-accent-fg">
                  {activeTags.length}
                </span>
              ) : null}
            </Button>
          )}
          panelClassName="w-72"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs font-medium text-muted">按标签筛选</span>
            {activeTags.length > 0 ? (
              <button
                type="button"
                onClick={() => setTags([])}
                className="text-[11px] text-muted transition hover:text-accent"
              >
                清空
              </button>
            ) : null}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {tagsQuery.isLoading ? <p className="px-1 py-2 text-xs text-muted">加载中…</p> : null}
            {tagsQuery.data?.length === 0 ? <p className="px-1 py-2 text-xs text-muted">还没有标签</p> : null}
            {tagsQuery.data?.map((tag) => {
              const active = activeTags.some((item) => item.toLowerCase() === tag.name.toLowerCase());
              return (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => toggleTag(tag.name)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition',
                    active ? 'bg-accent/10 text-accent' : 'text-fg hover:bg-line/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      active ? 'border-accent bg-accent text-accent-fg' : 'border-line',
                    )}
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="flex-1 truncate">#{tag.name}</span>
                  <span className="text-muted">{tag.count}</span>
                </button>
              );
            })}
          </div>
        </Popover>

        <Select
          value={language ?? ''}
          onChange={(event) => setLanguage(event.target.value || null)}
          aria-label="按语言筛选"
          className="w-36"
        >
          <option value="">全部语言</option>
          {languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>

        <Select
          value={status ?? ''}
          onChange={(event) => setStatus((event.target.value || null) as ProjectStatus | null)}
          aria-label="按状态筛选"
          className="w-32"
        >
          <option value="">全部状态</option>
          {STATUS_ORDER.map((item) => (
            <option key={item} value={item}>
              {STATUS_LABELS[item]}
            </option>
          ))}
        </Select>

        <Button
          variant={pinnedOnly ? 'primary' : 'outline'}
          onClick={() => setPinnedOnly(!pinnedOnly)}
          aria-pressed={pinnedOnly}
        >
          <Pin className="h-4 w-4" />
          只要置顶
        </Button>

        {filtersActive ? (
          <Button variant="ghost" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" />
            重置筛选
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Select
            value={current?.sort ?? 'manual'}
            onChange={(event) => {
              const next = event.target.value as SortMode;
              setSort(next);
              updateSetting({ sort: next });
            }}
            aria-label="排序方式"
            className="w-36"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </Select>

          <div
            className="flex items-center gap-0.5 rounded-control border border-line p-0.5"
            role="group"
            aria-label="视图切换"
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => switchView(option.id)}
                  aria-pressed={view === option.id}
                  title={`${option.label}视图`}
                  className={cn(
                    'rounded-[6px] p-2 text-muted transition',
                    view === option.id ? 'bg-accent/20 text-accent' : 'hover:text-fg',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{option.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={() =>
              updateSetting({ density: current?.density === 'compact' ? 'comfortable' : 'compact' })
            }
            title="切换信息密度"
          >
            <Rows3 className="h-4 w-4" />
            {current?.density === 'compact' ? '紧凑' : '舒适'}
          </Button>
        </div>
      </div>
    </div>
  );
}
