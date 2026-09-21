import { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Trash2 } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { uploadCover } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

const MAX_BYTES = 4 * 1024 * 1024;

export interface CoverFieldProps {
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}

export function CoverField({ value, onChange, onError }: CoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('只能上传图片文件');
      return;
    }
    if (file.size > MAX_BYTES) {
      onError('图片不能超过 4MB');
      return;
    }
    setBusy(true);
    try {
      const asset = await uploadCover(file);
      onChange(asset.url);
    } catch (error) {
      onError(`上传失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">封面图</span>
      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={cn(
            'relative flex h-24 items-center justify-center overflow-hidden rounded-control border border-dashed border-line bg-bg/60 text-xs text-muted transition',
            dragging && 'border-accent bg-accent/10',
          )}
        >
          {value ? (
            <img src={value} alt="封面预览" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center">拖拽图片到此，或点击下方上传</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted" />
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="图片地址，或上传后自动填入"
              aria-label="封面图地址"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = '';
              }}
            />
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {busy ? '上传中…' : '上传图片'}
            </Button>
            {value ? (
              <Button size="sm" variant="ghost" onClick={() => onChange('')}>
                <Trash2 className="h-3.5 w-3.5" />
                清除
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
