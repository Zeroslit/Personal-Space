import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Github,
  Pencil,
  Pin,
  PinOff,
  Star,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DemoPreview } from '@/features/demo/demo-preview';
import { CodeBlock } from '@/features/projects/components/code-block';
import { ProjectFormDialog } from '@/features/projects/components/project-form';
import { StatusBadge } from '@/features/projects/components/status-badge';
import { useProjectActions } from '@/features/projects/hooks/use-project-actions';
import { useProjects } from '@/features/projects/hooks/use-projects';
import { useUiStore } from '@/features/projects/state/ui-store';
import { formatDate, gradientFor, relativeTime } from '@/lib/utils';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectsQuery = useProjects();
  const actions = useProjectActions();
  const formOpen = useUiStore((state) => state.formOpen);
  const editingId = useUiStore((state) => state.editingId);
  const closeForm = useUiStore((state) => state.closeForm);

  const projects = projectsQuery.data ?? [];
  const project = useMemo(
    () => (id ? projects.find((item) => item.id === id) ?? null : null),
    [projects, id],
  );

  const tagSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const item of projects) {
      for (const tag of item.tags ?? []) set.add(tag);
    }
    return Array.from(set);
  }, [projects]);

  const editing = editingId ? projects.find((item) => item.id === editingId) ?? null : null;

  if (projectsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line p-16 text-center">
        <h1 className="text-sm font-semibold text-fg">找不到这个项目</h1>
        <p className="text-xs text-muted">它可能已经被删除了。</p>
        <Link to="/" className="text-xs text-accent underline-offset-4 hover:underline">
          返回项目列表
        </Link>
      </div>
    );
  }

  const coverStyle = project.cover
    ? { backgroundImage: `url(${project.cover})` }
    : { backgroundImage: gradientFor(project.title) };

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-muted transition hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回项目列表
      </Link>

      <section className="overflow-hidden rounded-card border border-line ps-surface shadow-card">
        <div className="relative aspect-[21/9] w-full" style={coverStyle}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={project.status} />
                {project.pinned ? (
                  <Badge tone="accent">
                    <Pin className="h-3 w-3" />
                    置顶
                  </Badge>
                ) : null}
                {project.language ? <Badge tone="muted">{project.language}</Badge> : null}
                {project.stars > 0 ? (
                  <Badge tone="muted">
                    <Star className="h-3 w-3" />
                    {project.stars}
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-2 truncate text-xl font-semibold text-white drop-shadow sm:text-2xl">
                {project.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
            {project.summary || '这个项目还没有写简介。'}
          </p>

          {project.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <Badge key={tag} tone="muted">
                  #{tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {project.repoUrl ? (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-4 text-sm font-medium text-fg transition hover:border-accent/60 hover:text-accent"
              >
                <Github className="h-4 w-4" />
                仓库
              </a>
            ) : null}
            {project.siteUrl ? (
              <a
                href={project.siteUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-accent-fg transition hover:brightness-110"
              >
                <ExternalLink className="h-4 w-4" />
                打开演示
              </a>
            ) : null}
            <Button variant="outline" onClick={() => actions.edit(project)}>
              <Pencil className="h-4 w-4" />
              编辑
            </Button>
            <Button variant="outline" onClick={() => actions.togglePin(project)}>
              {project.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {project.pinned ? '取消置顶' : '置顶'}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                actions.remove(project);
                navigate('/');
              }}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line/70 pt-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              创建于 {formatDate(project.createdAt)}
            </span>
            <span>最近更新 {relativeTime(project.updatedAt)}</span>
            <span>排序位 #{project.ord + 1}</span>
            <span>{project.snippets.length} 段代码</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg">立即预览</h2>
        <DemoPreview project={project} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg">代码片段</h2>
        {project.snippets.length === 0 ? (
          <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
            还没有代码片段，点上面的「编辑」可以为主角实现挂上几段代码。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {project.snippets.map((snippet) => (
              <CodeBlock
                key={snippet.id}
                filename={snippet.filename}
                language={snippet.language}
                code={snippet.code}
              />
            ))}
          </div>
        )}
      </section>

      <ProjectFormDialog
        open={formOpen}
        project={editing}
        tagSuggestions={tagSuggestions}
        onClose={closeForm}
      />
    </div>
  );
}
