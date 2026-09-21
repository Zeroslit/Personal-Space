import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, errorMessage } from '@/api/client';
import {
  createProject,
  deleteProject,
  reorderProjects,
  toPayload,
  updateProject,
} from '@/api/projects';
import type { Project, ProjectPayload } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import { shortId } from '@/lib/utils';
import { queryKeys } from './use-projects';

function draftToProject(payload: ProjectPayload, id: string): Project {
  const now = new Date().toISOString();
  return {
    id,
    title: payload.title,
    summary: payload.summary,
    repoUrl: payload.repoUrl,
    siteUrl: payload.siteUrl,
    demoLogin: payload.demoLogin ?? false,
    cover: payload.cover,
    tags: payload.tags,
    language: payload.language,
    status: payload.status,
    stars: payload.stars,
    pinned: payload.pinned,
    ord: payload.ord ?? Number.MAX_SAFE_INTEGER,
    createdAt: now,
    updatedAt: now,
    snippets: payload.snippets.map((snippet, index) => ({
      id: snippet.id ?? `tmp_s_${index}`,
      filename: snippet.filename,
      language: snippet.language,
      code: snippet.code,
      ord: index,
    })),
  };
}

function mergePayload(project: Project, payload: ProjectPayload): Project {
  return {
    ...project,
    title: payload.title,
    summary: payload.summary,
    repoUrl: payload.repoUrl,
    siteUrl: payload.siteUrl,
    demoLogin: payload.demoLogin ?? false,
    cover: payload.cover,
    tags: payload.tags,
    language: payload.language,
    status: payload.status,
    stars: payload.stars,
    pinned: payload.pinned,
    updatedAt: new Date().toISOString(),
    snippets: payload.snippets.map((snippet, index) => ({
      id: snippet.id ?? `tmp_s_${index}`,
      filename: snippet.filename,
      language: snippet.language,
      code: snippet.code,
      ord: index,
    })),
  };
}

export function useProjectMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tags });
  }, [queryClient]);

  const create = useMutation({
    mutationFn: (payload: ProjectPayload) => createProject(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects });
      const previous = queryClient.getQueryData<Project[]>(queryKeys.projects) ?? [];
      const optimisticId = `tmp_${shortId()}`;
      queryClient.setQueryData<Project[]>(queryKeys.projects, [
        ...previous,
        draftToProject(payload, optimisticId),
      ]);
      return { previous, optimisticId };
    },
    onError: (error, _payload, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.projects, context.previous);
      }
      toast.error(`新建失败：${errorMessage(error)}`);
    },
    onSuccess: (project, _payload, context) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (previous) =>
        (previous ?? []).map((item) => (item.id === context?.optimisticId ? project : item)),
      );
      refresh();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectPayload }) => updateProject(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects });
      const previous = queryClient.getQueryData<Project[]>(queryKeys.projects) ?? [];
      queryClient.setQueryData<Project[]>(
        queryKeys.projects,
        previous.map((project) => (project.id === id ? mergePayload(project, payload) : project)),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.projects, context.previous);
      }
      toast.error(`保存失败：${errorMessage(error)}`);
    },
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderProjects(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects });
      const previous = queryClient.getQueryData<Project[]>(queryKeys.projects) ?? [];
      const byId = new Map(previous.map((project) => [project.id, project]));
      const ordered: Project[] = [];
      ids.forEach((id) => {
        const project = byId.get(id);
        if (project) {
          ordered.push(project);
          byId.delete(id);
        }
      });
      queryClient.setQueryData<Project[]>(queryKeys.projects, [...ordered, ...byId.values()]);
      return { previous };
    },
    onError: (error, _ids, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.projects, context.previous);
      }
      toast.error(`排序失败：${errorMessage(error)}`);
    },
    onSettled: refresh,
  });

  const restoreDeleted = useCallback(
    async (project: Project) => {
      const payload = toPayload(project);
      try {
        const restored = await createProject(payload);
        queryClient.setQueryData<Project[]>(queryKeys.projects, (previous) => {
          const list = previous ?? [];
          return list.some((item) => item.id === restored.id) ? list : [...list, restored];
        });
        refresh();
        toast.success(`已恢复「${project.title}」`);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 409) {
          const retryPayload: ProjectPayload = {
            title: payload.title,
            summary: payload.summary,
            repoUrl: payload.repoUrl,
            siteUrl: payload.siteUrl,
            cover: payload.cover,
            tags: payload.tags,
            language: payload.language,
            status: payload.status,
            stars: payload.stars,
            pinned: payload.pinned,
            ord: payload.ord,
            snippets: payload.snippets,
          };
          try {
            const restored = await createProject(retryPayload);
            queryClient.setQueryData<Project[]>(queryKeys.projects, (previous) => [
              ...(previous ?? []),
              restored,
            ]);
            refresh();
            toast.success(`已恢复「${project.title}」`);
            return;
          } catch (retryError) {
            toast.error(`恢复失败：${errorMessage(retryError)}`);
            return;
          }
        }
        toast.error(`恢复失败：${errorMessage(error)}`);
      }
    },
    [queryClient, refresh, toast],
  );

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects });
      const previous = queryClient.getQueryData<Project[]>(queryKeys.projects) ?? [];
      const removed = previous.find((project) => project.id === id) ?? null;
      queryClient.setQueryData<Project[]>(
        queryKeys.projects,
        previous.filter((project) => project.id !== id),
      );
      return { previous, removed };
    },
    onError: (error, _id, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.projects, context.previous);
      }
      toast.error(`删除失败：${errorMessage(error)}`);
    },
    onSuccess: (_result, _id, context) => {
      const removed = context?.removed;
      if (!removed) return;
      toast.info(`已删除「${removed.title}」`, {
        description: '5 秒内可撤销',
        duration: 5000,
        action: { label: '撤销', onClick: () => restoreDeleted(removed) },
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });

  const togglePin = useMutation({
    mutationFn: (project: Project) => updateProject(project.id, toPayload({ ...project, pinned: !project.pinned })),
    onMutate: async (project) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects });
      const previous = queryClient.getQueryData<Project[]>(queryKeys.projects) ?? [];
      queryClient.setQueryData<Project[]>(
        queryKeys.projects,
        previous.map((item) => (item.id === project.id ? { ...item, pinned: !item.pinned } : item)),
      );
      return { previous };
    },
    onError: (error, project, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.projects, context.previous);
      }
      toast.error(`${project.pinned ? '取消置顶' : '置顶'}失败：${errorMessage(error)}`);
    },
    onSettled: refresh,
  });

  return { create, update, remove, reorder, togglePin, restoreDeleted };
}
