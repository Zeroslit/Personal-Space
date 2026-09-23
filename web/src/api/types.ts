export type ProjectStatus = 'active' | 'wip' | 'paused' | 'archived' | 'idea';

export type ViewMode = 'grid' | 'list' | 'timeline';
export type SortMode = 'manual' | 'updated' | 'created' | 'stars' | 'title';
export type Density = 'comfortable' | 'compact';
export type DemoViewport = 'desktop' | 'tablet' | 'phone';

export interface Snippet {
  id: string;
  filename: string;
  language: string;
  code: string;
  ord: number;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  repoUrl?: string | null;
  siteUrl?: string | null;
  cover: string;
  tags: string[];
  language: string;
  status: ProjectStatus;
  stars: number;
  pinned: boolean;
  /** 演示页需要登录（GitHub / Google 等），不内嵌、点击直接跳转 */
  demoLogin?: boolean;
  ord: number;
  createdAt: string;
  updatedAt: string;
  snippets: Snippet[];
}

export interface SnippetDraft {
  id?: string;
  filename: string;
  language: string;
  code: string;
}

/** 写入用的载荷：id 可选（撤销删除时用于还原同一个 id）。 */
export interface ProjectPayload {
  id?: string;
  title: string;
  summary: string;
  repoUrl: string | null;
  siteUrl: string | null;
  demoLogin?: boolean;
  cover: string;
  tags: string[];
  language: string;
  status: ProjectStatus;
  stars: number;
  pinned: boolean;
  ord?: number;
  snippets: SnippetDraft[];
}

export interface Settings {
  theme: string;
  accent: string | null;
  view: ViewMode;
  sort: SortMode;
  density: Density;
  demoViewport: DemoViewport;
  showSnippets: boolean;
  updatedAt: string;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface Asset {
  id: string;
  mime: string;
  size: number;
  createdAt: string;
  url: string;
}

/** GET /api/github/repo 的返回：仓库元信息与简介建议。 */
export interface GitHubRepoInfo {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string | null;
  description: string | null;
  summarySuggestion: string | null;
  /** suggestion 的来源：仓库描述，还是 README 首段兜底 */
  summarySource?: 'description' | 'readme' | null;
  homepage: string | null;
  language: string | null;
  defaultBranch: string | null;
  license: string | null;
  pushedAt: string | null;
  archived: boolean;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  fetchedAt: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '进行中',
  wip: '开发中',
  paused: '已暂停',
  archived: '已归档',
  idea: '想法',
};

export const STATUS_ORDER: ProjectStatus[] = ['active', 'wip', 'paused', 'idea', 'archived'];

export const VIEWPORT_LABELS: Record<DemoViewport, string> = {
  desktop: '桌面',
  tablet: '平板',
  phone: '手机',
};

/** 演示 iframe 的视口宽度（null 表示自适应铺满）。 */
export const VIEWPORT_WIDTHS: Record<DemoViewport, number | null> = {
  desktop: null,
  tablet: 834,
  phone: 390,
};
