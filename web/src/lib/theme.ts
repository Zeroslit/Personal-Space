export type ThemeId = 'minimal' | 'midnight' | 'glass' | 'terminal' | 'paper' | 'neon';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** 用于主题选择器上的预览小方块 */
  swatch: [string, string, string];
  dark: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'minimal',
    name: '极简明亮',
    description: '白底、克制的阴影，适合白天长时间浏览',
    swatch: ['#ffffff', '#4f46e5', '#11141c'],
    dark: false,
  },
  {
    id: 'midnight',
    name: '午夜暗黑',
    description: '深色低对比背景，夜间不刺眼',
    swatch: ['#0b0d12', '#7c9cff', '#e6e9f0'],
    dark: true,
  },
  {
    id: 'glass',
    name: '玻璃拟态',
    description: '渐变背景 + 毛玻璃卡片，层次感更强',
    swatch: ['#0f0c22', '#a78bfa', '#38bdf8'],
    dark: true,
  },
  {
    id: 'terminal',
    name: '终端绿',
    description: '等宽字体与磷光绿，命令行风格',
    swatch: ['#060a07', '#22c55e', '#b8ffcf'],
    dark: true,
  },
  {
    id: 'paper',
    name: '暖阳纸感',
    description: '米色纸面与琥珀色点缀，阅读舒适',
    swatch: ['#f6efe3', '#b45309', '#2f2a22'],
    dark: false,
  },
  {
    id: 'neon',
    name: '霓虹赛博',
    description: '洋红霓虹与青色辉光，夜之城氛围',
    swatch: ['#08040f', '#ff2ea6', '#22d3ee'],
    dark: true,
  },
];

export const DEFAULT_THEME: ThemeId = 'minimal';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((theme) => theme.id === value);
}

export function themeById(id: string): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export const ACCENT_PRESETS: string[] = [
  '#4f46e5',
  '#7c9cff',
  '#a78bfa',
  '#22c55e',
  '#b45309',
  '#ff2ea6',
  '#22d3ee',
  '#ef4444',
];

export function normalizeHex(input: string): string | null {
  const match = input.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toLowerCase()}` : null;
}

export function hexToTriplet(hex: string): string | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = parseInt(normalized.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** 相对亮度决定用黑字还是白字，保证主色上的文字可读。 */
export function readableForeground(triplet: string): string {
  const [r, g, b] = triplet.split(' ').map(Number);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '17 20 28' : '255 255 255';
}

export function applyTheme(theme: string, accent?: string | null): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', isThemeId(theme) ? theme : DEFAULT_THEME);
  const triplet = accent ? hexToTriplet(accent) : null;
  if (triplet) {
    root.style.setProperty('--c-accent', triplet);
    root.style.setProperty('--c-accent-fg', readableForeground(triplet));
    root.setAttribute('data-accent', 'custom');
  } else {
    root.style.removeProperty('--c-accent');
    root.style.removeProperty('--c-accent-fg');
    root.removeAttribute('data-accent');
  }
}
