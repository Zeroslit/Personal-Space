import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line p-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line ps-surface">
        <Compass className="h-5 w-5 text-muted" />
      </span>
      <h1 className="text-sm font-semibold text-fg">页面不存在</h1>
      <p className="text-xs text-muted">你访问的地址没有对应的内容。</p>
      <Link to="/" className="text-xs text-accent underline-offset-4 hover:underline">
        返回项目列表
      </Link>
    </div>
  );
}
