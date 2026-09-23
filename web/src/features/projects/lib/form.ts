import type { Project, ProjectPayload, ProjectStatus, SnippetDraft } from '@/api/types';

export interface FormValues {
  title: string;
  summary: string;
  repoUrl: string;
  siteUrl: string;
  cover: string;
  tags: string[];
  language: string;
  status: ProjectStatus;
  stars: string;
  pinned: boolean;
  demoLogin: boolean;
  snippets: SnippetDraft[];
}

export const EMPTY_FORM: FormValues = {
  title: '',
  summary: '',
  repoUrl: '',
  siteUrl: '',
  cover: '',
  tags: [],
  language: '',
  status: 'active',
  stars: '',
  pinned: false,
  demoLogin: false,
  snippets: [],
};

export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 24;
export const MAX_SNIPPETS = 30;

export function projectToForm(project: Project | null): FormValues {
  if (!project) return { ...EMPTY_FORM, snippets: [] };
  return {
    title: project.title,
    summary: project.summary ?? '',
    repoUrl: project.repoUrl ?? '',
    siteUrl: project.siteUrl ?? '',
    cover: project.cover ?? '',
    tags: [...(project.tags ?? [])],
    language: project.language ?? '',
    status: project.status,
    stars: project.stars ? String(project.stars) : '',
    pinned: project.pinned,
    demoLogin: project.demoLogin ?? false,
    snippets: (project.snippets ?? []).map((snippet) => ({
      id: snippet.id,
      filename: snippet.filename,
      language: snippet.language,
      code: snippet.code,
    })),
  };
}

export function isValidHttpUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname.length > 0;
  } catch {
    return false;
  }
}

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

/** 把 GitHub 链接拆成 owner/name；非 GitHub 链接返回 null（此时不做简介自动填充）。 */
export function githubRepoFromUrl(raw: string): { owner: string; name: string } | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const name = segments[1].replace(/\.git$/i, '');
  if (!owner || !name) return null;
  return { owner, name };
}

/** 仓库地址的规范化 key（`owner/name` 小写）；不是 GitHub 仓库地址时返回空串。 */
export function repoKeyOf(raw: string): string {
  const parsed = githubRepoFromUrl(raw);
  return parsed ? `${parsed.owner}/${parsed.name}`.toLowerCase() : '';
}

export interface SummaryAdoptInput {
  /** 后端给出的简介建议；没有建议时为 null。 */
  suggestion: string | null;
  /** 这份建议属于哪个仓库（`useGitHubLookup` 返回的 repoKey）。 */
  suggestionKey: string;
  /** 简介输入框里此刻的地址算出来的 key。 */
  currentKey: string;
  /** 简介输入框里此刻的文本。 */
  summary: string;
  /** 上一次自动填进去的原文。 */
  adopted: string;
  /** 本轮用户是否亲手改过简介。 */
  touched: boolean;
}

/**
 * 自动填充只在「建议确实属于当前地址」且「用户没动过简介」时才生效。
 * 表单关闭再打开时，上一轮的查询结果还留在 react-query 缓存里，
 * 这里用 key 对不上把过期建议挡掉，否则上一轮的简介会残留到新一轮。
 */
export function shouldAdoptSummary(input: SummaryAdoptInput): boolean {
  const next = input.suggestion?.trim();
  if (!next || !input.currentKey) return false;
  if (input.currentKey !== input.suggestionKey) return false;
  if (input.touched) return false;
  if (next === input.summary) return false;
  return input.summary.trim() === '' || input.summary === input.adopted;
}

/** 与后端 Validate 的规则保持一致，前端先拦一轮，减少 400 往返。 */
export function validateForm(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = values.title.trim();
  if (!title) {
    errors.title = 'title 不能为空';
  } else if (title.length > 120) {
    errors.title = 'title 长度不能超过 120 个字符';
  }
  if (values.summary.trim().length > 500) {
    errors.summary = 'summary 长度不能超过 500 个字符';
  }

  const repoUrl = values.repoUrl.trim();
  const siteUrl = values.siteUrl.trim();
  if (!repoUrl) {
    errors.repoUrl = 'GitHub 仓库地址必填';
  } else if (!isValidHttpUrl(repoUrl)) {
    errors.repoUrl = '必须以 http:// 或 https:// 开头，且包含主机名';
  }
  if (siteUrl && !isValidHttpUrl(siteUrl)) {
    errors.siteUrl = '必须以 http:// 或 https:// 开头，且包含主机名';
  }

  if (values.language.trim().length > 40) {
    errors.language = 'language 长度不能超过 40 个字符';
  }

  const stars = values.stars.trim();
  if (stars !== '' && !/^\d+$/.test(stars)) {
    errors.stars = 'stars 必须是非负整数';
  } else if (stars !== '' && Number(stars) > 1_000_000) {
    errors.stars = 'stars 数值过大';
  }

  if (values.tags.length > MAX_TAGS) {
    errors.tags = `标签最多 ${MAX_TAGS} 个`;
  } else if (values.tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    errors.tags = `单个标签不能超过 ${MAX_TAG_LENGTH} 个字符`;
  }

  if (values.snippets.length > MAX_SNIPPETS) {
    errors.snippets = `每个项目最多 ${MAX_SNIPPETS} 段代码`;
  } else if (values.snippets.some((snippet) => snippet.code.length > 20000)) {
    errors.snippets = '单段代码长度不能超过 20000 个字符';
  } else if (values.snippets.some((snippet) => snippet.filename.length > 120)) {
    errors.snippets = '文件名长度不能超过 120 个字符';
  }

  return errors;
}

export function formToPayload(values: FormValues, id?: string, ord?: number): ProjectPayload {
  return {
    ...(id ? { id } : {}),
    ...(ord !== undefined ? { ord } : {}),
    title: values.title.trim(),
    summary: values.summary.trim(),
    repoUrl: values.repoUrl.trim() || null,
    siteUrl: values.siteUrl.trim() || null,
    cover: values.cover.trim(),
    tags: values.tags,
    language: values.language.trim(),
    status: values.status,
    stars: values.stars.trim() === '' ? 0 : Number(values.stars.trim()),
    pinned: values.pinned,
    demoLogin: values.demoLogin,
    snippets: values.snippets.map((snippet) => ({
      ...(snippet.id ? { id: snippet.id } : {}),
      filename: snippet.filename.trim(),
      language: snippet.language || 'plaintext',
      code: snippet.code,
    })),
  };
}

export function addTag(tags: string[], raw: string): string[] {
  const value = raw.trim().slice(0, MAX_TAG_LENGTH);
  if (!value) return tags;
  if (tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) return tags;
  if (tags.length >= MAX_TAGS) return tags;
  return [...tags, value];
}
