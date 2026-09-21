import { describe, expect, it } from 'vitest';
import { embedDecision, shouldOpenDirectly } from './embed';

describe('embedDecision', () => {
  it('普通站点按可内嵌处理', () => {
    expect(embedDecision('https://demo.example.com/app').embeddable).toBe(true);
    expect(embedDecision('https://my-notes.github.io/demo/').embeddable).toBe(true);
  });

  it('需要登录或禁止内嵌的站点改为直接跳转', () => {
    expect(embedDecision('https://github.com/openai/codex').embeddable).toBe(false);
    expect(embedDecision('https://accounts.google.com/signin').embeddable).toBe(false);
    expect(embedDecision('https://x.com/home').embeddable).toBe(false);
  });

  it('路径像登录页时改为直接跳转', () => {
    expect(embedDecision('https://app.example.com/login').embeddable).toBe(false);
    expect(embedDecision('https://app.example.com/oauth/authorize?client=x').embeddable).toBe(false);
    expect(embedDecision('https://app.example.com/sso/start').embeddable).toBe(false);
    expect(embedDecision('https://app.example.com/dashboard').embeddable).toBe(true);
  });

  it('标记了「需要登录」的项目一律直接跳转', () => {
    const decision = embedDecision('https://demo.example.com', true);
    expect(decision.embeddable).toBe(false);
    expect(decision.reason).toContain('登录');
  });

  it('没有演示网址时给出解释', () => {
    expect(embedDecision('').reason).toContain('没有填演示网址');
  });
});

describe('shouldOpenDirectly', () => {
  it('没有演示网址时谈不上跳转', () => {
    expect(shouldOpenDirectly({ siteUrl: null, demoLogin: true })).toBe(false);
  });

  it('普通演示仍然内嵌', () => {
    expect(shouldOpenDirectly({ siteUrl: 'https://demo.example.com', demoLogin: false })).toBe(false);
  });

  it('标记需要登录或命中登录站点时直接跳转', () => {
    expect(shouldOpenDirectly({ siteUrl: 'https://demo.example.com', demoLogin: true })).toBe(true);
    expect(shouldOpenDirectly({ siteUrl: 'https://github.com/a/b', demoLogin: false })).toBe(true);
  });
});
