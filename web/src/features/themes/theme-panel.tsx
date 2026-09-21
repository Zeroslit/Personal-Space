import { useEffect, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import type { Settings } from '@/api/types';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ACCENT_PRESETS, THEMES, normalizeHex, type ThemeId } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useSaveSettings, useSettings } from '../projects/hooks/use-projects';

export interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}

export function ThemePanel({ open, onClose }: ThemePanelProps) {
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const toast = useToast();
  const [hexDraft, setHexDraft] = useState('');

  const theme = settings.data?.theme ?? 'minimal';
  const accent = settings.data?.accent ?? '';

  useEffect(() => {
    if (open) setHexDraft(accent);
  }, [open, accent]);

  const update = (patch: Partial<Settings>) => {
    saveSettings.mutate(patch, {
      onError: (error) => toast.error(`主题保存失败：${errorMessage(error)}`),
    });
  };

  const applyCustomAccent = () => {
    const normalized = normalizeHex(hexDraft);
    if (!normalized) {
      toast.error('请输入 6 位十六进制颜色，例如 #7c5cff');
      return;
    }
    setHexDraft(normalized);
    update({ accent: normalized });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="主题与主色"
      description="6 套内置主题；主色会覆盖主题的强调色，并同步到浏览器本地存储。"
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          完成
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((item) => {
            const active = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => update({ theme: item.id as ThemeId })}
                aria-pressed={active}
                className={cn(
                  'flex flex-col gap-2 rounded-card border p-3 text-left transition',
                  active ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/50',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {item.swatch.map((color) => (
                    <span
                      key={color}
                      className="h-5 w-5 rounded-full border border-line/60"
                      style={{ background: color }}
                    />
                  ))}
                  <span className="ml-auto">
                    {active ? <Check className="h-4 w-4 text-accent" /> : null}
                  </span>
                </span>
                <span className="text-sm font-medium text-fg">{item.name}</span>
                <span className="text-[11px] leading-relaxed text-muted">{item.description}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-line/70 pt-4">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted" />
            <span className="text-sm font-medium text-fg">自定义主色</span>
            <span className="text-[11px] text-muted">覆盖当前主题的强调色</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setHexDraft(preset);
                  update({ accent: preset });
                }}
                aria-label={`使用主色 ${preset}`}
                className={cn(
                  'h-7 w-7 rounded-full border transition',
                  accent.toLowerCase() === preset.toLowerCase()
                    ? 'border-fg ring-2 ring-accent/40'
                    : 'border-line hover:scale-110',
                )}
                style={{ background: preset }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setHexDraft('');
                update({ accent: null });
              }}
              className={cn(
                'h-7 rounded-full border px-3 text-[11px] transition',
                accent ? 'border-line text-muted hover:text-fg' : 'border-accent text-accent',
              )}
            >
              跟随主题
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={hexDraft}
              onChange={(event) => setHexDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyCustomAccent();
                }
              }}
              placeholder="#7c5cff"
              aria-label="自定义主色十六进制值"
              className="w-40 font-mono"
              maxLength={7}
            />
            <input
              type="color"
              value={normalizeHex(hexDraft) ?? '#4f46e5'}
              onChange={(event) => {
                setHexDraft(event.target.value);
                update({ accent: event.target.value });
              }}
              aria-label="取色器"
              className="h-10 w-12 cursor-pointer rounded-control border border-line bg-bg"
            />
            <Button variant="outline" onClick={applyCustomAccent}>
              应用
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
