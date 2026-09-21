import type { Project } from '@/api/types';
import { useUiStore } from '../state/ui-store';
import { useProjectMutations } from './use-project-mutations';

/** 页面里到处都要用的三个动作，集中在这里避免层层透传。 */
export function useProjectActions() {
  const { remove, togglePin, reorder } = useProjectMutations();
  const openEdit = useUiStore((state) => state.openEdit);

  return {
    edit: (project: Project) => openEdit(project.id),
    remove: (project: Project) => remove.mutate(project.id),
    togglePin: (project: Project) => togglePin.mutate(project),
    reorder: (ids: string[]) => reorder.mutate(ids),
  };
}
