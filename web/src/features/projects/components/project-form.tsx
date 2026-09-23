import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Github, Plus, X } from 'lucide-react';
import { STATUS_LABELS, STATUS_ORDER, type Project } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { CoverField } from './cover-field';
import { SnippetEditor } from './snippet-editor';
import { embedDecision } from '@/features/demo/lib/embed';
import { useProjectMutations } from '../hooks/use-project-mutations';
import { useGitHubLookup } from '../hooks/use-github-lookup';
import {
  addTag,
  formToPayload,
  projectToForm,
  repoKeyOf,
  shouldAdoptSummary,
  validateForm,
  type FormValues,
} from '../lib/form';

export interface ProjectFormDialogProps {
  open: boolean;
  project: Project | null;
  tagSuggestions: string[];
  onClose: () => void;
}

/**
 * 关闭时整块卸载、打开时重新挂载：每次打开都是一份全新的表单状态，
 * 上一轮自动填进去的简介、标签草稿都不会残留到下一轮。
 */
export function ProjectFormDialog({ open, project, tagSuggestions, onClose }: ProjectFormDialogProps) {
  if (!open) return null;
  return <ProjectForm project={project} tagSuggestions={tagSuggestions} onClose={onClose} />;
}

interface ProjectFormProps {
  project: Project | null;
  tagSuggestions: string[];
  onClose: () => void;
}

function ProjectForm({ project, tagSuggestions, onClose }: ProjectFormProps) {
  const { create, update } = useProjectMutations();
  const toast = useToast();
  const projectId = project?.id ?? null;
  const [values, setValues] = useState<FormValues>(() => projectToForm(project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagDraft, setTagDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const lookup = useGitHubLookup(values.repoUrl);
  const suggestion = lookup.suggestion;
  /** 地址本身就注定不能内嵌（登录页 / 禁止内嵌的站点）时提示一下，省掉 8 秒的等待。 */
  const autoDirectOpen = Boolean(values.siteUrl.trim()) && !embedDecision(values.siteUrl).embeddable;
  /** 上一次自动填进去的原文；只在简介仍等于它时才会被新建议替换。 */
  const autoSummaryRef = useRef('');
  /** 用户在本轮亲手改过简介后，就不再自动填充。 */
  const summaryTouchedRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  // 只有编辑目标换人（例如从命令面板切到另一个项目）时才重置；列表后台刷新不动表单。
  const lastProjectId = useRef(projectId);
  useEffect(() => {
    if (lastProjectId.current === projectId) return;
    lastProjectId.current = projectId;
    setValues(projectToForm(projectRef.current));
    setErrors({});
    setTagDraft('');
    autoSummaryRef.current = '';
    summaryTouchedRef.current = false;
  }, [projectId]);

  // 地址来自 GitHub 且有描述时，只要简介还空着就自动带出来；用户自己写过就不动它。
  useEffect(() => {
    if (!suggestion) return;
    const adopt = shouldAdoptSummary({
      suggestion,
      suggestionKey: lookup.repoKey,
      currentKey: repoKeyOf(values.repoUrl),
      summary: values.summary,
      adopted: autoSummaryRef.current,
      touched: summaryTouchedRef.current,
    });
    if (!adopt) return;
    autoSummaryRef.current = suggestion;
    setValues((previous) =>
      previous.summary === values.summary ? { ...previous, summary: suggestion } : previous,
    );
  }, [suggestion, lookup.repoKey, values.repoUrl, values.summary]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  const commitTag = () => {
    setValues((previous) => ({ ...previous, tags: addTag(previous.tags, tagDraft) }));
    setTagDraft('');
  };

  const handleSummaryChange = (text: string) => {
    if (text !== autoSummaryRef.current) {
      autoSummaryRef.current = '';
    }
    summaryTouchedRef.current = true;
    set('summary', text);
  };

  /** 采用 GitHub 简介；带撤销，避免误按回车把刚写好的文案覆盖掉。 */
  const applySuggestion = () => {
    if (!suggestion) return;
    const previous = values.summary;
    autoSummaryRef.current = suggestion;
    summaryTouchedRef.current = false;
    set('summary', suggestion);
    toast.info('已采用 GitHub 简介', {
      description: '想改回自己写的版本，点「撤销」',
      action: {
        label: '撤销',
        onClick: () => {
          autoSummaryRef.current = '';
          summaryTouchedRef.current = true;
          set('summary', previous);
        },
      },
    });
  };

  const handleSummaryKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    if (!suggestion || suggestion === values.summary) return;
    event.preventDefault();
    applySuggestion();
  };

  /** 粘贴完 GitHub 地址直接按 Enter 就能用上自动带出的简介；不按就自己写。 */
  const handleRepoKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    if (!suggestion || suggestion === values.summary || summaryTouchedRef.current) return;
    event.preventDefault();
    applySuggestion();
  };

  const handleSubmit = async () => {
    const nextErrors = validateForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('表单还有需要修正的地方');
      return;
    }
    setSubmitting(true);
    try {
      const payload = formToPayload(values, project?.id, project?.ord);
      if (project) {
        await update.mutateAsync({ id: project.id, payload });
        toast.success(`已保存「${payload.title}」`);
      } else {
        await create.mutateAsync(payload);
        toast.success(`已创建「${payload.title}」`);
      }
      onClose();
    } catch {
      // 错误提示由 mutation 层统一处理
    } finally {
      setSubmitting(false);
    }
  };

  const suggestions = tagSuggestions
    .filter((tag) => !values.tags.some((item) => item.toLowerCase() === tag.toLowerCase()))
    .slice(0, 8);

  return (
    <Dialog
      open
      onClose={onClose}
      title={project ? '编辑项目' : '新建项目'}
      description="GitHub 仓库地址必填，演示网址可选；粘贴 GitHub 地址会自动带出简介，按 Enter 采用。"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中…' : project ? '保存修改' : '创建项目'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="标题" required error={errors.title}>
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                value={values.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder="项目名称"
                maxLength={140}
              />
            )}
          </Field>
          <Field label="主语言" error={errors.language} hint="例如 TypeScript / C++ / Python">
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                value={values.language}
                onChange={(event) => set('language', event.target.value)}
                placeholder="TypeScript"
                maxLength={40}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <Field
            label="简介"
            error={errors.summary}
            hint={
              suggestion && suggestion !== values.summary
                ? `按 Enter 采用 GitHub 简介，Shift+Enter 换行 · ${values.summary.length}/500`
                : `${values.summary.length}/500`
            }
          >
            {({ id, ...aria }) => (
              <Textarea
                id={id}
                {...aria}
                value={values.summary}
                onChange={(event) => handleSummaryChange(event.target.value)}
                onKeyDown={handleSummaryKeyDown}
                placeholder="一两句话说清这个项目解决了什么问题"
                maxLength={600}
              />
            )}
          </Field>
          {suggestion && suggestion !== values.summary ? (
            <div className="flex items-start gap-2 rounded-control border border-line bg-bg/60 p-2">
              <Github className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted">
                  {lookup.source === 'readme' ? 'GitHub README 的第一段' : 'GitHub 上的简介'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-fg/85">{suggestion}</p>
              </div>
              <Button size="sm" variant="outline" onClick={applySuggestion}>
                使用
              </Button>
            </div>
          ) : null}
          {lookup.status === 'loading' ? (
            <p className="text-[11px] text-muted">正在读取 GitHub 仓库信息…</p>
          ) : null}
          {lookup.status === 'ready' && !suggestion ? (
            <p className="text-[11px] text-muted">
              这个仓库在 GitHub 上没写描述，README 里也没找到能当简介的正文，简介只能自己写了。
            </p>
          ) : null}
          {lookup.status === 'error' ? (
            <p className="text-[11px] text-muted">没读到 GitHub 简介（{lookup.error}），自己写也完全可以。</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub 仓库" required error={errors.repoUrl} hint="必填；粘贴地址后自动带出简介">
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                onKeyDown={handleRepoKeyDown}
                value={values.repoUrl}
                onChange={(event) => set('repoUrl', event.target.value)}
                placeholder="https://github.com/you/project"
                inputMode="url"
              />
            )}
          </Field>
          <Field label="演示网址" error={errors.siteUrl} hint="用于「立即预览」内嵌演示">
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                value={values.siteUrl}
                onChange={(event) => set('siteUrl', event.target.value)}
                placeholder="https://your-demo.example.com"
                inputMode="url"
              />
            )}
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-control border border-line bg-bg/60 p-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={values.demoLogin}
            onChange={(event) => set('demoLogin', event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-accent))]"
          />
          <span>
            演示页需要登录（GitHub / Google 等）：不内嵌，点击直接新标签跳转
            {autoDirectOpen ? '（这个地址已经判定为不可内嵌，一般无需内嵌）' : ''}
          </span>
        </label>

        <CoverField
          value={values.cover}
          onChange={(next) => set('cover', next)}
          onError={(message) => toast.error(message)}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="状态">
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={values.status} onChange={(event) => set('status', event.target.value as FormValues['status'])}>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Star 数" error={errors.stars} hint="可选，手动记录">
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                value={values.stars}
                onChange={(event) => set('stars', event.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
            )}
          </Field>
          <Field label="置顶">
            {({ id }) => (
              <label
                htmlFor={id}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line bg-bg px-3 text-sm"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={values.pinned}
                  onChange={(event) => set('pinned', event.target.checked)}
                  className="h-4 w-4 accent-[rgb(var(--c-accent))]"
                />
                置顶显示
              </label>
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">标签</span>
          <div className="flex flex-wrap items-center gap-2">
            {values.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`移除标签 ${tag}`}
                  onClick={() => set('tags', values.tags.filter((item) => item !== tag))}
                  className="transition hover:text-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    commitTag();
                  }
                }}
                placeholder="回车添加标签"
                className="h-8 w-40 text-xs"
                aria-label="添加标签"
              />
              <Button size="icon-sm" variant="outline" onClick={commitTag} aria-label="添加标签">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {errors.tags ? <p className="text-xs text-danger">{errors.tags}</p> : null}
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted">常用：</span>
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setValues((previous) => ({ ...previous, tags: addTag(previous.tags, tag) }))}
                  className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted transition hover:border-accent/50 hover:text-accent"
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <SnippetEditor
          value={values.snippets}
          onChange={(next) => set('snippets', next)}
          error={errors.snippets}
        />
      </div>
    </Dialog>
  );
}
