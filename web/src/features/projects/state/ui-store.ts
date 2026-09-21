import { create } from 'zustand';
import type { ProjectStatus, SortMode, ViewMode } from '@/api/types';

export interface UiState {
  search: string;
  tags: string[];
  language: string | null;
  status: ProjectStatus | null;
  pinnedOnly: boolean;
  view: ViewMode;
  sort: SortMode;
  formOpen: boolean;
  editingId: string | null;
  paletteOpen: boolean;
  themePanelOpen: boolean;
  setSearch(value: string): void;
  toggleTag(tag: string): void;
  setTags(tags: string[]): void;
  setLanguage(language: string | null): void;
  setStatus(status: ProjectStatus | null): void;
  setPinnedOnly(value: boolean): void;
  resetFilters(): void;
  setView(view: ViewMode): void;
  setSort(sort: SortMode): void;
  openCreate(): void;
  openEdit(id: string): void;
  closeForm(): void;
  setPaletteOpen(open: boolean): void;
  setThemePanelOpen(open: boolean): void;
}

export const useUiStore = create<UiState>((set) => ({
  search: '',
  tags: [],
  language: null,
  status: null,
  pinnedOnly: false,
  view: 'grid',
  sort: 'manual',
  formOpen: false,
  editingId: null,
  paletteOpen: false,
  themePanelOpen: false,

  setSearch: (value) => set({ search: value }),
  toggleTag: (tag) =>
    set((state) => ({
      tags: state.tags.some((item) => item.toLowerCase() === tag.toLowerCase())
        ? state.tags.filter((item) => item.toLowerCase() !== tag.toLowerCase())
        : [...state.tags, tag],
    })),
  setTags: (tags) => set({ tags }),
  setLanguage: (language) => set({ language }),
  setStatus: (status) => set({ status }),
  setPinnedOnly: (pinnedOnly) => set({ pinnedOnly }),
  resetFilters: () => set({ search: '', tags: [], language: null, status: null, pinnedOnly: false }),
  setView: (view) => set({ view }),
  setSort: (sort) => set({ sort }),
  openCreate: () => set({ formOpen: true, editingId: null }),
  openEdit: (id) => set({ formOpen: true, editingId: id }),
  closeForm: () => set({ formOpen: false, editingId: null }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setThemePanelOpen: (themePanelOpen) => set({ themePanelOpen }),
}));
