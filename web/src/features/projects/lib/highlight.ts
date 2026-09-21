import hljs from 'highlight.js/lib/common';
import { escapeHtml } from '@/lib/text';

const ALIASES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  py: 'python',
  'c++': 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  yml: 'yaml',
  md: 'markdown',
  cmake: 'cmake',
  text: 'plaintext',
  txt: 'plaintext',
};

/** 片段编辑器里的语言下拉选项（全部随包内置，不依赖 CDN）。 */
export const LANGUAGE_OPTIONS: string[] = [
  'plaintext',
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'go',
  'graphql',
  'ini',
  'java',
  'javascript',
  'json',
  'kotlin',
  'less',
  'lua',
  'makefile',
  'markdown',
  'objectivec',
  'perl',
  'php',
  'python',
  'r',
  'ruby',
  'rust',
  'scss',
  'sql',
  'swift',
  'typescript',
  'vbnet',
  'xml',
  'yaml',
];

export function resolveLanguage(language: string | undefined | null): string {
  const raw = (language ?? '').trim().toLowerCase();
  if (!raw) return 'plaintext';
  const normalized = ALIASES[raw] ?? raw;
  return hljs.getLanguage(normalized) ? normalized : 'plaintext';
}

export function highlightCode(code: string, language: string): string {
  const resolved = resolveLanguage(language);
  if (resolved === 'plaintext') {
    return escapeHtml(code);
  }
  try {
    return hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}
