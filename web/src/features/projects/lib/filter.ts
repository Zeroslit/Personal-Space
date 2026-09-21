import type { Project, ProjectStatus, SortMode } from '@/api/types';

export interface FilterState {
  search: string;
  tags: string[];
  language: string | null;
  status: ProjectStatus | null;
  pinnedOnly: boolean;
}

export const EMPTY_FILTER: FilterState = {
  search: '',
  tags: [],
  language: null,
  status: null,
  pinnedOnly: false,
};

export function isFilterActive(filter: FilterState): boolean {
  return (
    filter.search.trim() !== '' ||
    filter.tags.length > 0 ||
    filter.language !== null ||
    filter.status !== null ||
    filter.pinnedOnly
  );
}

/** 搜索范围：标题 / 简介 / 语言 / 状态 / 标签 / 代码片段的文件名与内容。 */
export function projectHaystack(project: Project): string {
  const parts: string[] = [
    project.title,
    project.summary,
    project.language ?? '',
    project.status,
    ...(project.tags ?? []),
  ];
  for (const snippet of project.snippets ?? []) {
    parts.push(snippet.filename ?? '', snippet.language ?? '', snippet.code ?? '');
  }
  return parts.join('\n').toLowerCase();
}

/** 空格分隔的多个关键词需要全部命中。 */
export function matchesSearch(project: Project, search: string): boolean {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = projectHaystack(project);
  return terms.every((term) => haystack.includes(term));
}

export function filterProjects(projects: Project[], filter: FilterState): Project[] {
  return projects.filter((project) => {
    if (!matchesSearch(project, filter.search)) return false;
    if (filter.pinnedOnly && !project.pinned) return false;
    if (filter.language && (project.language ?? '') !== filter.language) return false;
    if (filter.status && project.status !== filter.status) return false;
    if (filter.tags.length > 0) {
      const owned = new Set((project.tags ?? []).map((tag) => tag.toLowerCase()));
      const hitAll = filter.tags.every((tag) => owned.has(tag.toLowerCase()));
      if (!hitAll) return false;
    }
    return true;
  });
}

export function sortProjects(projects: Project[], mode: SortMode): Project[] {
  if (mode === 'manual') return projects;
  const sorted = projects.slice();
  switch (mode) {
    case 'updated':
      sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      break;
    case 'created':
      sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      break;
    case 'stars':
      sorted.sort((a, b) => b.stars - a.stars || a.title.localeCompare(b.title, 'zh-CN'));
      break;
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
      break;
    default:
      break;
  }
  return sorted;
}

/** 置顶项目单独成组，拖拽排序只在组内生效。 */
export function splitPinned(projects: Project[]): { pinned: Project[]; rest: Project[] } {
  const pinned: Project[] = [];
  const rest: Project[] = [];
  for (const project of projects) {
    (project.pinned ? pinned : rest).push(project);
  }
  return { pinned, rest };
}

export function collectLanguages(projects: Project[]): string[] {
  const set = new Set<string>();
  for (const project of projects) {
    if (project.language) set.add(project.language);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'en'));
}
