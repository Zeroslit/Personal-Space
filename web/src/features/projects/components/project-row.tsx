import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Github, GripVertical, Pencil, Pin, PinOff, Star, Trash2 } from 'lucide-react';
import type { Project } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { cn, gradientFor, relativeTime } from '@/lib/utils';
import type { DragHandle } from './sortable';
import { StatusBadge } from './status-badge';

export interface ProjectRowProps {
  project: Project;
  drag: DragHandle;
  canReorder: boolean;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onTogglePin: (project: Project) => void;
}

export function ProjectRow({ project, drag, canReorder, onEdit, onDelete, onTogglePin }: ProjectRowProps) {
  const navigate = useNavigate();
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
        'ps-card ps-surface flex cursor-pointer items-center gap-3 rounded-card border border-line p-2.5 shadow-card transition hover:border-accent/40',
        drag.isDragging && 'ring-2 ring-accent',
      )}
    >
      {canReorder ? (
        <button
          type="button"
          ref={drag.setActivatorNodeRef}
          {...drag.attributes}
          {...drag.listeners}
          aria-label="拖拽排序"
          className="cursor-grab rounded p-1 text-muted transition hover:text-fg active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}

      <div className="hidden h-14 w-20 shrink-0 rounded-control sm:block" style={coverStyle} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/p/${encodeURIComponent(project.id)}`}
            className="truncate text-sm font-semibold text-fg underline-offset-4 transition hover:text-accent hover:underline"
          >
            {project.title}
          </Link>
          <StatusBadge status={project.status} />
          {project.pinned ? (
            <Badge tone="accent">
              <Pin className="h-3 w-3" />
              置顶
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">{project.summary || '暂无简介'}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          {project.language ? <span>{project.language}</span> : null}
          {project.stars > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3 w-3" />
              {project.stars}
            </span>
          ) : null}
          <span>更新于 {relativeTime(project.updatedAt)}</span>
          {project.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-muted/80">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {project.repoUrl ? (
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="打开仓库"
            className="rounded p-2 text-muted transition hover:text-accent"
          >
            <Github className="h-4 w-4" />
          </a>
        ) : null}
        {project.siteUrl ? (
          <a
            href={project.siteUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="打开演示"
            className="rounded p-2 text-muted transition hover:text-accent"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => onTogglePin(project)}
          aria-label={project.pinned ? '取消置顶' : '置顶'}
          className="rounded p-2 text-muted transition hover:text-accent"
        >
          {project.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onEdit(project)}
          aria-label="编辑项目"
          className="rounded p-2 text-muted transition hover:text-accent"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(project)}
          aria-label="删除项目"
          className="rounded p-2 text-muted transition hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
