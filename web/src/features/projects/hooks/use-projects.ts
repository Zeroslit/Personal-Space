import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Settings } from '@/api/types';
import { fetchProjects, fetchSettings, fetchTags, saveSettings } from '@/api/projects';

export const queryKeys = {
  projects: ['projects'] as const,
  tags: ['tags'] as const,
  settings: ['settings'] as const,
};

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: fetchProjects, staleTime: 20_000 });
}

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: fetchTags, staleTime: 20_000 });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: fetchSettings, staleTime: Infinity });
}

/** 设置改成乐观写入，切换主题/视图立即生效，失败再回滚。 */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => saveSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      const previous = queryClient.getQueryData<Settings>(queryKeys.settings);
      if (previous) {
        queryClient.setQueryData<Settings>(queryKeys.settings, { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings, context.previous);
      }
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings, settings);
    },
  });
}
