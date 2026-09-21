import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Github,
  GripVertical,
  Pencil,
  Pin,
  PinOff,
  Play,
  Star,
  Trash2,
} from 'lucide-react';
import type { Project } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DemoPreview } from '@/features/demo/demo-preview';
import { shouldOpenDirectly } from '@/features/demo/lib/embed';
import { cn, gradientFor, relativeTime } from '@/lib/utils';
import type { DragHandle } from './sortable';
import { StatusBadge } from './status-badge';

export interface ProjectCardProps {
  project: Project;
  drag: DragHandle;
  canReorder: boolean;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onTogglePin: (project: Project) => void;
}

export function ProjectCard({ project, drag, canReorder, onEdit, onDelete, onTogglePin }: ProjectCardProps) {
  const [showDemo, setShowDemo] = useState(false);
  const navigate = useNavigate();
  const directOpen = shouldOpenDirectly(project);
  const coverStyle = project.cover
    ? { backgroundImage: `url(${project.cover})` }
    : { backgroundImage: gradientFor(project.title) };

  return (
    <article
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('a, button, input, select, textarea, [role="button"]')) return;
        navigate(`/p/${encodeURIComponent(project.id)}`);
      }}
      className={cn(
        'group ps-card ps-surface flex h-full cursor-pointer flex-col overflow-hidden rounded-card border border-line shadow-card',
        drag.isDragging && 'ring-2 ring-accent',
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden" style={coverStyle}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <StatusBadge status={project.status} />
          {project.pinned ? (
            <Badge tone="accent">
              <Pin className="h-3 w-3" />
              置顶
            </Badge>
          ) : null}
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-control bg-black/35 p-0.5 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 focus-within:opacity-100 hover:opacity-100">
          {canReorder ? (
            <button
              type="button"
              ref={drag.setActivatorNodeRef}
              {...drag.attributes}
              {...drag.listeners}
              aria-label="拖拽排序"
              title="拖拽排序"
              className="cursor-grab rounded p-1.5 text-white/80 transition hover:text-white active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onTogglePin(project)}
            aria-label={project.pinned ? '取消置顶' : '置顶'}
            title={project.pinned ? '取消置顶' : '置顶'}
            className="rounded p-1.5 text-white/80 transition hover:text-white"
          >
            {project.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(project)}
            aria-label="编辑项目"
            title="编辑"
            className="rounded p-1.5 text-white/80 transition hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(project)}
            aria-label="删除项目"
            title="删除"
            className="rounded p-1.5 text-white/80 transition hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="absolute inset-x-3 bottom-2">
          <Link
            to={`/p/${encodeURIComponent(project.id)}`}
            className="block truncate text-sm font-semibold text-white drop-shadow transition hover:underline"
          >
            {project.title}
          </Link>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/85">
            {project.language ? <span>{project.language}</span> : null}
            {project.stars > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3" />
                {project.stars}
              </span>
            ) : null}
            <span>{relativeTime(project.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <p className="line-clamp-2 min-h-[2.4em] text-xs leading-relaxed text-muted">
          {project.summary || '暂无简介'}
        </p>

        {project.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {project.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} tone="muted">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {project.siteUrl && directOpen ? (
            <a
              href={project.siteUrl}
              target="_blank"
              rel="noreferrer noopener"
              title="这个演示需要登录或不允许内嵌，点击直接打开"
              className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-medium text-accent-fg transition hover:brightness-110"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打开演示
            </a>
          ) : null}
          {project.siteUrl && !directOpen ? (
            <Button size="sm" variant="primary" onClick={() => setShowDemo((value) => !value)} aria-expanded={showDemo}>
              <Play className="h-3.5 w-3.5" />
              {showDemo ? '收起预览' : '立即预览'}
            </Button>
          ) : null}
          {project.repoUrl ? (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-medium text-fg transition hover:border-accent/60 hover:text-accent"
            >
              <Github className="h-3.5 w-3.5" />
              仓库
            </a>
          ) : null}
          {project.siteUrl && !directOpen ? (
            <a
              href={project.siteUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="在新标签打开演示"
              title="新标签打开演示"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-line text-muted transition hover:border-accent/60 hover:text-accent"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <Link
            to={`/p/${encodeURIComponent(project.id)}`}
            className="ml-auto text-[11px] text-muted underline-offset-4 transition hover:text-accent hover:underline"
          >
            详情与片段 →
          </Link>
        </div>
      </div>

      {showDemo ? (
        <div className="border-t border-line p-2">
          <DemoPreview project={project} compact />
        </div>
      ) : null}
    </article>
  );
}
