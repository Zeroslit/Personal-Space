import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/utils';
import { highlightCode, resolveLanguage } from '../lib/highlight';

export interface CodeBlockProps {
  filename?: string;
  language: string;
  code: string;
  defaultOpen?: boolean;
}

export function CodeBlock({ filename, language, code, defaultOpen = true }: CodeBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlightCode(code, language), [code, language]);
  const resolved = resolveLanguage(language);

  const handleCopy = async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="overflow-hidden rounded-control border border-line bg-bg/60">
      <div className="flex items-center gap-2 border-b border-line/70 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition hover:text-accent"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          )}
          <span className="truncate font-mono text-xs text-fg">{filename || '未命名片段'}</span>
        </button>
        <Badge tone="muted">{resolved}</Badge>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleCopy}
          aria-label={copied ? '已复制' : '复制代码'}
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {open ? (
        <pre className="m-0 max-h-[460px] overflow-auto p-3 text-xs leading-relaxed">
          <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      ) : null}
    </div>
  );
}
