import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Globe,
  Laptop,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Tablet,
  TriangleAlert,
} from 'lucide-react';
import type { DemoViewport, Project } from '@/api/types';
import { VIEWPORT_LABELS, VIEWPORT_WIDTHS } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { cn, copyText, gradientFor, hostOf } from '@/lib/utils';
import { embedDecision } from './lib/embed';
import { useSaveSettings, useSettings } from '../projects/hooks/use-projects';

const LOAD_TIMEOUT_MS = 8000;

const VIEWPORT_ICONS: Record<DemoViewport, typeof Laptop> = {
  desktop: Laptop,
  tablet: Tablet,
  phone: Smartphone,
};

export interface DemoPreviewProps {
  project: Project;
  className?: string;
  /** 卡片里的紧凑模式：工具栏更小、iframe 更矮 */
  compact?: boolean;
}

export function DemoPreview({ project, className, compact = false }: DemoPreviewProps) {
  const toast = useToast();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const [viewport, setViewport] = useState<DemoViewport>(settings.data?.demoViewport ?? 'desktop');
  const [nonce, setNonce] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [forceInline, setForceInline] = useState(false);
  const loadedRef = useRef(false);

  const url = project.siteUrl ?? '';
  const host = hostOf(url);
  const decision = embedDecision(url, project.demoLogin ?? false);
  /** 用户点过「仍然内嵌试试」就尊重他的选择，不再拦他 */
  const allowInline = decision.embeddable || forceInline;

  useEffect(() => {
    if (settings.data?.demoViewport) {
      setViewport(settings.data.demoViewport);
    }
  }, [settings.data?.demoViewport]);

  useEffect(() => {
    if (!url || forceInline || !decision.embeddable) {
      setPhase('idle');
      return;
    }
    loadedRef.current = false;
    setPhase('loading');
    const timer = window.setTimeout(() => {
      if (!loadedRef.current) {
        setPhase('failed');
      }
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [url, nonce, forceInline, decision.embeddable]);

  const handleLoad = useCallback(() => {
    loadedRef.current = true;
    setPhase('ready');
  }, []);

  const switchViewport = (next: DemoViewport) => {
    setViewport(next);
    if (settings.data && settings.data.demoViewport !== next) {
      saveSettings.mutate({ demoViewport: next });
    }
  };

  const copyLink = async () => {
    const ok = await copyText(url);
    toast[ok ? 'success' : 'error'](ok ? '演示链接已复制' : '复制失败，请手动复制');
  };

  const coverStyle = project.cover
    ? { backgroundImage: `url(${project.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: gradientFor(project.title) };

  const showFallback = !url || (!forceInline && (phase === 'failed' || !decision.embeddable));
  const width = VIEWPORT_WIDTHS[viewport];

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-control border border-line bg-bg/60', className)}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line/70 px-2 py-1.5">
        <Globe className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">
          {url || '该项目没有演示网址'}
        </span>

        {url && allowInline ? (
          <div className="flex items-center gap-0.5 rounded-control border border-line p-0.5" role="group" aria-label="预览视口">
            {(Object.keys(VIEWPORT_LABELS) as DemoViewport[]).map((key) => {
              const Icon = VIEWPORT_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchViewport(key)}
                  aria-pressed={viewport === key}
                  title={`${VIEWPORT_LABELS[key]}视口`}
                  className={cn(
                    'rounded-[6px] p-1.5 text-muted transition',
                    viewport === key ? 'bg-accent/20 text-accent' : 'hover:text-fg',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="sr-only">{VIEWPORT_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {url && allowInline ? (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setForceInline(true);
              setNonce((value) => value + 1);
            }}
            aria-label="刷新预览"
            title="刷新预览"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {url ? (
          <Button size="icon-sm" variant="ghost" onClick={copyLink} aria-label="复制演示链接" title="复制链接">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-muted transition hover:bg-line/40 hover:text-fg"
            aria-label="在新标签打开演示"
            title="新标签打开"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      <div
        className={cn('relative flex items-center justify-center bg-bg/40', compact ? 'min-h-[180px]' : 'min-h-[360px]')}
      >
        {showFallback ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="absolute inset-0 opacity-25" style={coverStyle} aria-hidden />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line ps-surface">
                {url ? <TriangleAlert className="h-4 w-4 text-muted" /> : <Globe className="h-4 w-4 text-muted" />}
              </span>
              <p className="max-w-md text-xs text-muted">
                {!url
                  ? '这个项目只填了仓库链接，没有在线演示。'
                  : decision.reason
                    ?? '预览加载超时或被对方站点拒绝内嵌（X-Frame-Options / CSP）。已降级为封面占位。'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {url ? (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-medium text-accent-fg transition hover:brightness-110"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      打开 {host || '演示'}
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForceInline(true);
                        setNonce((value) => value + 1);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      仍然内嵌试试
                    </Button>
                  </>
                ) : null}
                {project.repoUrl ? (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-medium text-fg transition hover:border-accent/50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开仓库
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative flex h-full w-full items-stretch justify-center overflow-auto"
            style={width ? { padding: compact ? 8 : 16 } : undefined}
          >
            {phase === 'loading' ? (
              <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-muted">
                <Spinner className="h-5 w-5" />
              </span>
            ) : null}
            <iframe
              key={`${url}-${nonce}-${viewport}`}
              src={url}
              title={`${project.title} 在线演示`}
              onLoad={handleLoad}
              onError={() => setPhase('failed')}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
              className={cn(
                'border-0 bg-white transition-[width] duration-300',
                width ? 'rounded-control shadow-card' : 'h-full w-full',
                compact ? 'h-[180px]' : 'h-[360px]',
              )}
              style={width ? { width: `${width}px`, maxWidth: '100%' } : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
