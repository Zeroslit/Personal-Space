import { api } from './client';
import type { GitHubRepoInfo } from './types';

/** 走自家后端代取 GitHub 仓库信息：避开 CORS，并复用后端的 10 分钟缓存与可选 token。 */
export function fetchGitHubRepo(repoUrl: string, signal?: AbortSignal): Promise<GitHubRepoInfo> {
  return api.get<GitHubRepoInfo>(`/api/github/repo?url=${encodeURIComponent(repoUrl)}`, signal);
}
