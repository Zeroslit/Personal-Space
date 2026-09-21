import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Github, Pencil, Pin, Star, Trash2 } from 'lucide-react';
import type { Project } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, gradientFor, monthKey } from '@/lib/utils';
import { StatusBadge } from './status-badge';

export interface ProjectTimelineProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onTogglePin: (project: Project) => void;
}

export function ProjectTimeline({ projects, onEdit, onDelete, onTogglePin }: ProjectTimelineProps) {
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const project of projects) {
      const key = monthKey(project.updatedAt);
      const list = map.get(key);
      if (list) {
        list.push(project);
      } else {
        map.set(key, [project]);
      }
    }
    return Array.from(map.entries());
  }, [projects]);

  return (
    <ol className="relative flex flex-col gap-8 border-l border-line pl-5">
      {groups.map(([label, items]) => (
        <li key={label} className="relative">
          <span
            className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-bg bg-accent"
            aria-hidden
          />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</h3>
          <div className="mt-3 flex flex-col gap-2">
            {items.map((project) => (
              <div
                key={project.id}
                onClick={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest('a, button, input, select, textarea, [role="button"]')) return;
                  navigate(`/p/${encodeURIComponent(project.id)}`);
                }}
                className={cn(
                  'ps-card ps-surface flex cursor-pointer items-center gap-3 rounded-card border border-line p-2.5 shadow-card transition hover:border-accent/40',
                )}
              >
                <div
                  className="hidden h-12 w-16 shrink-0 rounded-control sm:block"
                  style={
                    project.cover
                      ? { backgroundImage: `url(${project.cover})` }
                      : { backgroundImage: gradientFor(project.title) }
                  }
                  aria-hidden
                />
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
                    <span>{formatDate(project.updatedAt)}</span>
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
                    <Pin className="h-4 w-4" />
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
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
