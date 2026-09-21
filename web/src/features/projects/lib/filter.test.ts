import { describe, expect, it } from 'vitest';
import type { Project } from '@/api/types';
import {
  collectLanguages,
  EMPTY_FILTER,
  filterProjects,
  matchesSearch,
  sortProjects,
  splitPinned,
} from './filter';

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: overrides.id ?? 'p_1',
    title: '标题',
    summary: '',
    repoUrl: null,
    siteUrl: null,
    cover: '',
    tags: [],
    language: '',
    status: 'active',
    stars: 0,
    pinned: false,
    ord: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    snippets: [],
    ...overrides,
  };
}

const projects: Project[] = [
  makeProject({
    id: 'p_a',
    title: 'Aurora Notes',
    summary: '本地优先的笔记应用',
    tags: ['笔记', 'Markdown'],
    language: 'TypeScript',
    stars: 120,
    pinned: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
    snippets: [{ id: 's1', filename: 'debounce.ts', language: 'typescript', code: 'const debounce = 1;', ord: 0 }],
  }),
  makeProject({
    id: 'p_b',
    title: 'httplite',
    language: 'C++',
    status: 'wip',
    stars: 30,
    pinned: false,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-20T00:00:00Z',
  }),
  makeProject({
    id: 'p_c',
    title: 'ledger-cli',
    language: 'Python',
    stars: 900,
    pinned: false,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-11T00:00:00Z',
  }),
];

describe('matchesSearch', () => {
  it('空查询命中全部', () => {
    expect(matchesSearch(projects[0], '   ')).toBe(true);
  });

  it('能命中标题', () => {
    expect(matchesSearch(projects[0], 'aurora')).toBe(true);
  });

  it('能命中代码片段内容', () => {
    expect(matchesSearch(projects[0], 'debounce')).toBe(true);
    expect(matchesSearch(projects[0], 'const debounce')).toBe(true);
  });

  it('能命中标签', () => {
    expect(matchesSearch(projects[0], 'markdown')).toBe(true);
  });

  it('多个关键词需要全部命中', () => {
    expect(matchesSearch(projects[0], 'aurora debounce')).toBe(true);
    expect(matchesSearch(projects[0], 'aurora ledger')).toBe(false);
  });
});

describe('filterProjects', () => {
  it('按标签与语言联合筛选', () => {
    const result = filterProjects(projects, {
      search: '',
      tags: ['Markdown'],
      language: 'TypeScript',
      status: null,
      pinnedOnly: false,
    });
    expect(result.map((project) => project.id)).toEqual(['p_a']);
  });

  it('只看置顶', () => {
    const result = filterProjects(projects, { ...EMPTY_FILTER, pinnedOnly: true });
    expect(result.map((project) => project.id)).toEqual(['p_a']);
  });

  it('按状态筛选', () => {
    const result = filterProjects(projects, { ...EMPTY_FILTER, status: 'wip' });
    expect(result.map((project) => project.id)).toEqual(['p_b']);
  });
});

describe('sortProjects', () => {
  it('manual 保持原顺序', () => {
    expect(sortProjects(projects, 'manual').map((project) => project.id)).toEqual(['p_a', 'p_b', 'p_c']);
  });

  it('stars 从高到低', () => {
    expect(sortProjects(projects, 'stars').map((project) => project.id)).toEqual(['p_c', 'p_a', 'p_b']);
  });

  it('updated 从新到旧', () => {
    expect(sortProjects(projects, 'updated').map((project) => project.id)).toEqual(['p_a', 'p_b', 'p_c']);
  });
});

describe('splitPinned', () => {
  it('置顶单独成组', () => {
    const { pinned, rest } = splitPinned(projects);
    expect(pinned.map((project) => project.id)).toEqual(['p_a']);
    expect(rest.map((project) => project.id)).toEqual(['p_b', 'p_c']);
  });
});

describe('collectLanguages', () => {
  it('去重并排序', () => {
    expect(collectLanguages(projects)).toEqual(['C++', 'Python', 'TypeScript']);
  });
});
