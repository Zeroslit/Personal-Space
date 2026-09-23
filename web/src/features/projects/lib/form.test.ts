import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  addTag,
  formToPayload,
  githubRepoFromUrl,
  isValidHttpUrl,
  repoKeyOf,
  shouldAdoptSummary,
  validateForm,
} from './form';

const base = { ...EMPTY_FORM, title: '示例项目' };

describe('isValidHttpUrl', () => {
  it('接受 http 与 https', () => {
    expect(isValidHttpUrl('https://github.com/a/b')).toBe(true);
    expect(isValidHttpUrl('http://127.0.0.1:8787/')).toBe(true);
  });

  it('拒绝其它协议与无主机名', () => {
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('https://')).toBe(false);
    expect(isValidHttpUrl('example.com')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
});

describe('validateForm', () => {
  it('没填 GitHub 地址时报错', () => {
    const errors = validateForm(base);
    expect(errors.repoUrl).toContain('必填');
  });

  it('只填演示网址不合法：GitHub 地址必填', () => {
    const errors = validateForm({ ...base, siteUrl: 'https://example.com' });
    expect(errors.repoUrl).toContain('必填');
    expect(errors.siteUrl).toBeUndefined();
  });

  it('只填 GitHub 仓库合法，演示网址可以省略', () => {
    const errors = validateForm({ ...base, repoUrl: 'https://github.com/a/b' });
    expect(errors).toEqual({});
  });

  it('两个都填合法', () => {
    const errors = validateForm({
      ...base,
      repoUrl: 'https://github.com/a/b',
      siteUrl: 'https://example.com',
    });
    expect(errors).toEqual({});
  });

  it('一个合法、另一个非法时只报非法的一侧', () => {
    const errors = validateForm({
      ...base,
      repoUrl: 'https://github.com/a/b',
      siteUrl: 'demo.example.com',
    });
    expect(errors.siteUrl).toContain('http://');
    expect(errors.repoUrl).toBeUndefined();
  });

  it('只有空白的 GitHub 地址等同于没填', () => {
    const errors = validateForm({ ...base, repoUrl: '   ', siteUrl: '\t' });
    expect(errors.repoUrl).toContain('必填');
    expect(errors.siteUrl).toBeUndefined();
  });

  it('演示网址填了但不合法时报错', () => {
    const errors = validateForm({ ...base, repoUrl: 'https://github.com/a/b', siteUrl: 'demo.example.com' });
    expect(errors.siteUrl).toContain('http://');
    expect(errors.repoUrl).toBeUndefined();
  });

  it('标题为空报错', () => {
    expect(validateForm({ ...base, title: '  ', repoUrl: 'https://a.com' }).title).toContain('不能为空');
  });

  it('stars 必须是数字', () => {
    expect(validateForm({ ...base, repoUrl: 'https://a.com', stars: 'abc' }).stars).toBeTruthy();
    expect(validateForm({ ...base, repoUrl: 'https://a.com', stars: '12' }).stars).toBeUndefined();
  });
});

describe('formToPayload', () => {
  it('空字符串链接转成 null', () => {
    const payload = formToPayload({ ...base, repoUrl: ' https://github.com/a/b ', siteUrl: '' });
    expect(payload.repoUrl).toBe('https://github.com/a/b');
    expect(payload.siteUrl).toBeNull();
    expect(payload.stars).toBe(0);
  });

  it('编辑时保留 id 与 ord', () => {
    const payload = formToPayload(base, 'p_1', 3);
    expect(payload.id).toBe('p_1');
    expect(payload.ord).toBe(3);
  });
});

describe('githubRepoFromUrl', () => {
  it('解析常见的 GitHub 链接', () => {
    expect(githubRepoFromUrl('https://github.com/openai/codex')).toEqual({ owner: 'openai', name: 'codex' });
    expect(githubRepoFromUrl('https://www.github.com/a/b/')).toEqual({ owner: 'a', name: 'b' });
    expect(githubRepoFromUrl('https://github.com/a/b.git')).toEqual({ owner: 'a', name: 'b' });
    expect(githubRepoFromUrl('https://github.com/a/b/tree/main/src')).toEqual({ owner: 'a', name: 'b' });
  });

  it('非 GitHub 链接返回 null', () => {
    expect(githubRepoFromUrl('https://gitlab.com/a/b')).toBeNull();
    expect(githubRepoFromUrl('https://github.com/a')).toBeNull();
    expect(githubRepoFromUrl('https://github.com/')).toBeNull();
    expect(githubRepoFromUrl('git@github.com:a/b.git')).toBeNull();
    expect(githubRepoFromUrl('github.com/a/b')).toBeNull();
    expect(githubRepoFromUrl('')).toBeNull();
  });
});

describe('addTag', () => {
  it('去重、裁剪长度、限制数量', () => {
    expect(addTag(['a'], 'A')).toEqual(['a']);
    expect(addTag([], '  React  ')).toEqual(['React']);
    expect(addTag([], 'x'.repeat(30))[0]).toHaveLength(24);
  });
});

describe('repoKeyOf', () => {
  it('归一化成小写的 owner/name', () => {
    expect(repoKeyOf('https://github.com/OpenAI/Codex')).toBe('openai/codex');
    expect(repoKeyOf('https://github.com/openai/codex/tree/main/src')).toBe('openai/codex');
  });

  it('空地址与非 GitHub 地址都是空串', () => {
    expect(repoKeyOf('')).toBe('');
    expect(repoKeyOf('   ')).toBe('');
    expect(repoKeyOf('https://gitlab.com/a/b')).toBe('');
  });
});

describe('shouldAdoptSummary', () => {
  const baseAdopt = {
    suggestion: '一个用来展示项目的个人空间',
    suggestionKey: 'zeroslit/personal-space',
    currentKey: 'zeroslit/personal-space',
    summary: '',
    adopted: '',
    touched: false,
  };

  it('简介空着、地址也对得上就自动填充', () => {
    expect(shouldAdoptSummary(baseAdopt)).toBe(true);
  });

  it('地址还空着时不吃缓存里的旧建议（关闭再打开不残留简介）', () => {
    expect(shouldAdoptSummary({ ...baseAdopt, currentKey: '' })).toBe(false);
  });

  it('地址换成别的仓库后旧建议作废', () => {
    expect(shouldAdoptSummary({ ...baseAdopt, currentKey: 'zeroslit/other-project' })).toBe(false);
  });

  it('用户自己写过简介就不覆盖', () => {
    expect(shouldAdoptSummary({ ...baseAdopt, summary: '我自己写的简介' })).toBe(false);
  });

  it('用户手动清空过简介也不再回填', () => {
    expect(shouldAdoptSummary({ ...baseAdopt, touched: true })).toBe(false);
  });

  it('此刻显示的正是上次自动填的内容时可以换成新建议', () => {
    expect(
      shouldAdoptSummary({
        ...baseAdopt,
        suggestion: '换了仓库描述',
        summary: '一个用来展示项目的个人空间',
        adopted: '一个用来展示项目的个人空间',
      }),
    ).toBe(true);
  });

  it('没有建议时什么都不做', () => {
    expect(shouldAdoptSummary({ ...baseAdopt, suggestion: null })).toBe(false);
    expect(shouldAdoptSummary({ ...baseAdopt, suggestion: '   ' })).toBe(false);
  });
});
