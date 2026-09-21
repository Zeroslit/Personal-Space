import { api } from './client';
import type { Asset, ListResponse, Project, ProjectPayload, Settings, TagCount } from './types';

export function fetchProjects(): Promise<Project[]> {
  return api.get<ListResponse<Project>>('/api/projects').then((response) => response.items);
}

export function fetchProject(id: string): Promise<Project> {
  return api.get<Project>(`/api/projects/${encodeURIComponent(id)}`);
}

export function createProject(payload: ProjectPayload): Promise<Project> {
  return api.post<Project>('/api/projects', payload);
}

export function updateProject(id: string, payload: ProjectPayload): Promise<Project> {
  return api.put<Project>(`/api/projects/${encodeURIComponent(id)}`, payload);
}

export function deleteProject(id: string): Promise<{ ok: boolean; id: string }> {
  return api.delete<{ ok: boolean; id: string }>(`/api/projects/${encodeURIComponent(id)}`);
}

export function reorderProjects(ids: string[]): Promise<Project[]> {
  return api
    .patch<ListResponse<Project>>('/api/projects/order', { ids })
    .then((response) => response.items);
}

export function fetchTags(): Promise<TagCount[]> {
  return api.get<ListResponse<TagCount>>('/api/tags').then((response) => response.items);
}

export function fetchSettings(): Promise<Settings> {
  return api.get<Settings>('/api/settings');
}

export function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return api.put<Settings>('/api/settings', patch);
}

export function uploadCover(file: File): Promise<Asset> {
  return api.uploadAsset(file) as Promise<Asset>;
}

/** Project → 写入载荷，用于编辑保存与撤销恢复。 */
export function toPayload(project: Project): ProjectPayload {
  return {
    id: project.id,
    title: project.title,
    summary: project.summary,
    repoUrl: project.repoUrl ?? null,
    siteUrl: project.siteUrl ?? null,
    demoLogin: project.demoLogin ?? false,
    cover: project.cover ?? '',
    tags: project.tags ?? [],
    language: project.language ?? '',
    status: project.status,
    stars: project.stars,
    pinned: project.pinned,
    ord: project.ord,
    snippets: (project.snippets ?? []).map((snippet) => ({
      id: snippet.id,
      filename: snippet.filename,
      language: snippet.language,
      code: snippet.code,
    })),
  };
}
