import { useMemo } from 'react';
import { FolderOpen, Plus, SearchX } from 'lucide-react';
import type { Project, ViewMode } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { splitPinned } from '../lib/filter';
import { useProjectActions } from '../hooks/use-project-actions';
import { useUiStore } from '../state/ui-store';
import { ProjectCard } from './project-card';
import { ProjectRow } from './project-row';
import { ProjectTimeline } from './project-timeline';
import { SortableList, type DragHandle } from './sortable';

export interface ProjectListProps {
  projects: Project[];
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  errorText?: string;
  hasFilters: boolean;
  onRetry: () => void;
}

const GRID_CLASS = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3';
const LIST_CLASS = 'flex flex-col gap-2';

function ListSkeleton({ view }: { view: ViewMode }) {
  const count = view === 'grid' ? 6 : 5;
  return (
    <div className={view === 'grid' ? GRID_CLASS : LIST_CLASS}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={view === 'grid' ? 'h-72 rounded-card' : 'h-20 rounded-card'} />
      ))}
    </div>
  );
}

export function ProjectList({
  projects,
  totalCount,
  isLoading,
  isError,
  errorText,
  hasFilters,
  onRetry,
}: ProjectListProps) {
  const view = useUiStore((state) => state.view);
  const sortMode = useUiStore((state) => state.sort);
  const openCreate = useUiStore((state) => state.openCreate);
  const resetFilters = useUiStore((state) => state.resetFilters);
  const actions = useProjectActions();

  const { pinned, rest } = useMemo(() => splitPinned(projects), [projects]);
  const canReorder = sortMode === 'manual' && view !== 'timeline';

  if (isLoading) {
    return <ListSkeleton view={view} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/10 p-8 text-center">
        <p className="text-sm font-medium text-danger">加载项目失败</p>
        <p className="max-w-md text-xs text-muted">{errorText}</p>
        <Button variant="outline" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line ps-surface">
          <FolderOpen className="h-5 w-5 text-muted" />
        </span>
        <h2 className="text-sm font-semibold text-fg">还没有项目</h2>
        <p className="max-w-md text-xs text-muted">
          把第一个项目记下来：填上仓库链接或演示网址，挂几段关键代码，随时可以立即预览。
        </p>
        <Button variant="primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建第一个项目
        </Button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line ps-surface">
          <SearchX className="h-5 w-5 text-muted" />
        </span>
        <h2 className="text-sm font-semibold text-fg">没有匹配的项目</h2>
        <p className="max-w-md text-xs text-muted">
          试试换个关键词，或者放宽标签、语言与状态条件。
        </p>
        {hasFilters ? (
          <Button variant="outline" onClick={resetFilters}>
            清除筛选条件
          </Button>
        ) : null}
      </div>
    );
  }

  const renderItem = (view: 'grid' | 'list') => (project: Project, drag: DragHandle) =>
    view === 'grid' ? (
      <ProjectCard
        project={project}
        drag={drag}
        canReorder={canReorder}
        onEdit={actions.edit}
        onDelete={actions.remove}
        onTogglePin={actions.togglePin}
      />
    ) : (
      <ProjectRow
        project={project}
        drag={drag}
        canReorder={canReorder}
        onEdit={actions.edit}
        onDelete={actions.remove}
        onTogglePin={actions.togglePin}
      />
    );

  if (view === 'timeline') {
    return (
      <ProjectTimeline
        projects={projects}
        onEdit={actions.edit}
        onDelete={actions.remove}
        onTogglePin={actions.togglePin}
      />
    );
  }

  const layout = view === 'grid' ? 'grid' : 'list';
  const containerClassName = view === 'grid' ? GRID_CLASS : LIST_CLASS;
  const byId = new Map(projects.map((project) => [project.id, project]));

  const renderGroup = (group: Project[]) => (
    <SortableList
      ids={group.map((project) => project.id)}
      layout={layout}
      disabled={!canReorder}
      containerClassName={containerClassName}
      onReorder={(ids) => {
        const otherIds = group === pinned ? rest.map((p) => p.id) : pinned.map((p) => p.id);
        actions.reorder(group === pinned ? [...ids, ...otherIds] : [...otherIds, ...ids]);
      }}
      render={(id, drag) => {
        const project = byId.get(id);
        if (!project) return null;
        return renderItem(view)(project, drag);
      }}
    />
  );

  return (
    <div className={cn('flex flex-col', pinned.length > 0 && rest.length > 0 ? 'gap-6' : 'gap-3')}>
      {pinned.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            置顶
            <span className="rounded-full border border-line px-1.5 text-[11px]">{pinned.length}</span>
          </h2>
          {renderGroup(pinned)}
        </section>
      ) : null}
      {rest.length > 0 ? (
        <section className="flex flex-col gap-3">
          {pinned.length > 0 ? (
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              全部项目
              <span className="rounded-full border border-line px-1.5 text-[11px]">{rest.length}</span>
            </h2>
          ) : null}
          {renderGroup(rest)}
        </section>
      ) : null}
    </div>
  );
}
