import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@/api/client';
import { fetchGitHubRepo } from '@/api/github';
import { repoKeyOf } from '../lib/form';

const DEBOUNCE_MS = 500;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export interface GitHubLookup {
  /** idle：地址还不是 GitHub 仓库；loading / ready / error 对应后端代取的结果。 */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** GitHub 仓库描述（或 README 首段），用作简介建议；都没有时为 null。 */
  suggestion: string | null;
  /** suggestion 的来源：描述还是 README 首段；没有建议时为 null。 */
  source: 'description' | 'readme' | null;
  /** 这份建议对应的仓库 key（`owner/name` 小写）；地址还没成形时为空串。 */
  repoKey: string;
  error: string | null;
}

/**
 * 监听表单里的仓库地址，去抖后请后端代取 GitHub 信息。
 * 只有地址形如 github.com/owner/repo 时才会真正发请求。
 */
export function useGitHubLookup(repoUrl: string): GitHubLookup {
  const debounced = useDebounced(repoUrl.trim(), DEBOUNCE_MS);
  const key = repoKeyOf(debounced);
  const query = useQuery({
    queryKey: ['github-repo', key],
    enabled: key.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: ({ signal }) => fetchGitHubRepo(debounced, signal),
  });

  let status: GitHubLookup['status'] = 'idle';
  if (key) {
    if (query.isError) status = 'error';
    else if (query.data) status = query.isFetching ? 'loading' : 'ready';
    else status = 'loading';
  }

  return {
    status,
    suggestion: query.data?.summarySuggestion?.trim() || null,
    source: query.data?.summarySuggestion?.trim() ? query.data.summarySource ?? 'description' : null,
    repoKey: key,
    error: query.isError ? errorMessage(query.error) : null,
  };
}
