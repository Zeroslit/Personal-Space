import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { SnippetDraft } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { LANGUAGE_OPTIONS } from '../lib/highlight';
import { MAX_SNIPPETS } from '../lib/form';

export interface SnippetEditorProps {
  value: SnippetDraft[];
  onChange: (next: SnippetDraft[]) => void;
  error?: string | null;
}

export function SnippetEditor({ value, onChange, error }: SnippetEditorProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const patch = (index: number, changes: Partial<SnippetDraft>) => {
    onChange(value.map((snippet, position) => (position === index ? { ...snippet, ...changes } : snippet)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
    setOpenIndex(target);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">
          代码片段（{value.length}/{MAX_SNIPPETS}）
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (value.length >= MAX_SNIPPETS) return;
            onChange([...value, { filename: '', language: 'plaintext', code: '' }]);
            setOpenIndex(value.length);
          }}
          disabled={value.length >= MAX_SNIPPETS}
        >
          <Plus className="h-3.5 w-3.5" />
          添加片段
        </Button>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {value.length === 0 ? (
        <p className="rounded-control border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
          还没有代码片段，可以为这个项目挂上关键实现。
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {value.map((snippet, index) => {
          const open = openIndex === index;
          return (
            <div key={snippet.id ?? index} className="overflow-hidden rounded-control border border-line">
              <div className="flex items-center gap-2 bg-line/20 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                  className="min-w-0 flex-1 truncate text-left font-mono text-xs text-fg transition hover:text-accent"
                >
                  {snippet.filename || `片段 ${index + 1}`}
                </button>
                <span className="hidden text-[11px] text-muted sm:inline">{snippet.language}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="上移片段"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                  disabled={index === value.length - 1}
                  aria-label="下移片段"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onChange(value.filter((_, position) => position !== index))}
                  aria-label="删除片段"
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
              {open ? (
                <div className="flex flex-col gap-2 p-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={snippet.filename}
                      onChange={(event) => patch(index, { filename: event.target.value })}
                      placeholder="文件名，例如 src/main.ts"
                      aria-label="文件名"
                    />
                    <Select
                      value={snippet.language}
                      onChange={(event) => patch(index, { language: event.target.value })}
                      aria-label="语言"
                    >
                      {LANGUAGE_OPTIONS.map((language) => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Textarea
                    value={snippet.code}
                    onChange={(event) => patch(index, { code: event.target.value })}
                    placeholder="粘贴代码…"
                    spellCheck={false}
                    className="min-h-40 font-mono text-xs"
                    aria-label="代码内容"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
