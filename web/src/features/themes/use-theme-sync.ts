import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';
import { useUiStore } from '../projects/state/ui-store';
import { useSettings } from '../projects/hooks/use-projects';

const STORAGE_KEY = 'pspace:settings';

/** 设置读回后：应用主题、写入 localStorage（供首屏内联脚本使用）、同步视图与排序。 */
export function useThemeSync() {
  const settings = useSettings();
  const setView = useUiStore((state) => state.setView);
  const setSort = useUiStore((state) => state.setSort);

  useEffect(() => {
    const data = settings.data;
    if (!data) return;
    applyTheme(data.theme, data.accent);
    setView(data.view);
    setSort(data.sort);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: data.theme, accent: data.accent }));
    } catch {
      // localStorage 不可用时忽略：主题仍然应用到当前会话
    }
  }, [settings.data, setView, setSort]);
}
