import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import type { Project } from '@/api/types';
import { ProjectFormDialog } from './project-form';

/** 后端代取 GitHub 时给出的 README 首段（即用户截图里残留的那段文案）。 */
const SUMMARY = '面向全国高校的大学生教材循环交易平台，包含多校隔离、图书库、论坛、私信与资金托管。';
const REPO_URL = 'https://github.com/zeroslit/university-book-trading-market';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const editedProject: Project = {
  id: 'p_book',
  title: '教材交易平台',
  summary: '',
  repoUrl: REPO_URL,
  siteUrl: null,
  demoLogin: false,
  cover: '',
  tags: ['Java'],
  language: 'Java',
  status: 'active',
  stars: 0,
  pinned: false,
  ord: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  snippets: [],
};

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const body = {
        owner: 'zeroslit',
        name: 'university-book-trading-market',
        fullName: 'zeroslit/university-book-trading-market',
        htmlUrl: REPO_URL,
        description: null,
        summarySuggestion: SUMMARY,
        summarySource: 'readme',
      };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function renderForm(open: boolean, project: Project | null) {
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ProjectFormDialog open={open} project={project} tagSuggestions={[]} onClose={() => {}} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  });
}

function field<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`没找到表单控件：${selector}`);
  return element;
}

const repoField = () => field<HTMLInputElement>('input[placeholder="https://github.com/you/project"]');
const summaryField = () => field<HTMLTextAreaElement>('textarea[placeholder="一两句话说清这个项目解决了什么问题"]');

/** 模拟真人输入：绕过 React 的 value 追踪，再派发一次冒泡的 input 事件。 */
async function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function waitFor(check: () => boolean, timeout = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  throw new Error('等待超时');
}

const suggestionShown = () => document.body.textContent?.includes('GitHub README 的第一段') ?? false;

describe('ProjectFormDialog 的简介自动填充', () => {
  it('粘贴 GitHub 地址后自动带出简介', async () => {
    renderForm(true, null);
    await setValue(repoField(), REPO_URL);
    await waitFor(() => summaryField().value === SUMMARY);
    expect(summaryField().value).toBe(SUMMARY);
  });

  it('关掉再打开「新建项目」时不会残留上一轮自动填进去的简介', async () => {
    renderForm(true, null);
    await setValue(repoField(), REPO_URL);
    await waitFor(() => summaryField().value === SUMMARY);

    renderForm(false, null);
    renderForm(true, null);

    expect(repoField().value).toBe('');
    expect(summaryField().value).toBe('');
  });

  it('编辑过别的项目后再点「新建项目」，简介同样是空的', async () => {
    renderForm(true, editedProject);
    await waitFor(() => summaryField().value === SUMMARY);

    renderForm(false, null);
    renderForm(true, null);

    expect(summaryField().value).toBe('');
  });

  it('自己写的简介不会被自动填充覆盖', async () => {
    renderForm(true, null);
    await setValue(summaryField(), '我自己写的简介');
    await setValue(repoField(), REPO_URL);
    await waitFor(() => suggestionShown());
    expect(summaryField().value).toBe('我自己写的简介');
  });

  it('手动清空简介后不会再被填回来', async () => {
    renderForm(true, null);
    await setValue(repoField(), REPO_URL);
    await waitFor(() => summaryField().value === SUMMARY);

    await setValue(summaryField(), '');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(summaryField().value).toBe('');
  });
});
