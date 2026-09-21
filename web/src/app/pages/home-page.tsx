import { useMemo } from 'react';
import { errorMessage } from '@/api/client';
import { ProjectFormDialog } from '@/features/projects/components/project-form';
import { ProjectList } from '@/features/projects/components/project-list';
import { ProjectToolbar } from '@/features/projects/components/project-toolbar';
import { useProjects } from '@/features/projects/hooks/use-projects';
import { filterProjects, isFilterActive, sortProjects } from '@/features/projects/lib/filter';
import { useUiStore } from '@/features/projects/state/ui-store';
import { ThemePanel } from '@/features/themes/theme-panel';

export function HomePage() {
  const projectsQuery = useProjects();
  const search = useUiStore((state) => state.search);
  const tags = useUiStore((state) => state.tags);
  const language = useUiStore((state) => state.language);
  const status = useUiStore((state) => state.status);
  const pinnedOnly = useUiStore((state) => state.pinnedOnly);
  const sort = useUiStore((state) => state.sort);
  const formOpen = useUiStore((state) => state.formOpen);
  const editingId = useUiStore((state) => state.editingId);
  const closeForm = useUiStore((state) => state.closeForm);
  const themePanelOpen = useUiStore((state) => state.themePanelOpen);
  const setThemePanelOpen = useUiStore((state) => state.setThemePanelOpen);

  const all = projectsQuery.data ?? [];

  const filtered = useMemo(
    () => sortProjects(filterProjects(all, { search, tags, language, status, pinnedOnly }), sort),
    [all, search, tags, language, status, pinnedOnly, sort],
  );

  const tagSuggestions = useMemo(() => {
    const counter = new Map<string, number>();
    for (const project of all) {
      for (const tag of project.tags ?? []) {
        counter.set(tag, (counter.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [all]);

  const snippetCount = useMemo(
    () => all.reduce((total, project) => total + (project.snippets?.length ?? 0), 0),
    [all],
  );

  const editing = editingId ? all.find((project) => project.id === editingId) ?? null : null;
  const hasFilters = isFilterActive({ search, tags, language, status, pinnedOnly });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          共 <strong className="text-fg">{all.length}</strong> 个项目
        </span>
        <span>
          <strong className="text-fg">{snippetCount}</strong> 段代码
        </span>
        {hasFilters ? (
          <span>
            当前筛出 <strong className="text-fg">{filtered.length}</strong> 个
          </span>
        ) : null}
      </div>

      <ProjectToolbar projects={all} />

      <ProjectList
        projects={filtered}
        totalCount={all.length}
        isLoading={projectsQuery.isPending}
        isError={projectsQuery.isError}
        errorText={projectsQuery.error ? errorMessage(projectsQuery.error) : undefined}
        hasFilters={hasFilters}
        onRetry={() => {
          void projectsQuery.refetch();
        }}
      />

      <ProjectFormDialog
        open={formOpen}
        project={editing}
        tagSuggestions={tagSuggestions}
        onClose={closeForm}
      />
      <ThemePanel open={themePanelOpen} onClose={() => setThemePanelOpen(false)} />
    </div>
  );
}
