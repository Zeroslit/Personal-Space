import type { Project } from '@/api/types';

export interface EmbedDecision {
  /** true 表示可以尝试用 iframe 内嵌 */
  embeddable: boolean;
  /** 不可内嵌时给用户看的原因 */
  reason: string | null;
}

/** 已知禁止被内嵌的站点（X-Frame-Options: DENY 或 CSP frame-ancestors none），多数是社交/登录类。 */
const NO_FRAME_HOSTS = new Set([
  'github.com',
  'gist.github.com',
  'google.com',
  'www.google.com',
  'accounts.google.com',
  'accounts.google.cn',
  'mail.google.com',
  'drive.google.com',
  'docs.google.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'linkedin.com',
  'www.linkedin.com',
  'reddit.com',
  'www.reddit.com',
  'stackoverflow.com',
  'appleid.apple.com',
  'login.microsoftonline.com',
  'discord.com',
  'slack.com',
  'youtube.com',
  'www.youtube.com',
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
]);

/** 路径本身就是登录 / 授权入口。 */
const LOGIN_PATH =
  /\/(login|log-in|signin|sign-in|sign_in|signup|sign-up|auth|oauth2?|authorize|sso|sessions?|users\/sign_in|account\/login|passport)(\/|$)/i;

/**
 * 判断演示地址能不能内嵌。
 * 需要 GitHub / Google 登录的站点基本都带 X-Frame-Options: DENY 或 CSP frame-ancestors 'none'，
 * 内嵌只会得到空白页或超时占位，这种情况直接改成「点击跳转」体验更好。
 * 判断不了的一律按可内嵌处理，交给 iframe 失败降级兜底。
 */
export function embedDecision(url: string, demoLogin = false): EmbedDecision {
  const value = (url ?? '').trim();
  if (!value) {
    return { embeddable: false, reason: '这个项目还没有填演示网址。' };
  }
  if (demoLogin) {
    return { embeddable: false, reason: '已标记为「需要登录」的演示，点击直接在新标签打开。' };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { embeddable: true, reason: null };
  }
  const host = parsed.hostname.toLowerCase();
  if (NO_FRAME_HOSTS.has(host)) {
    return {
      embeddable: false,
      reason: `${host} 需要登录或不允许被内嵌，内嵌拿不到页面，点击直接在新标签打开。`,
    };
  }
  if (LOGIN_PATH.test(parsed.pathname)) {
    return {
      embeddable: false,
      reason: '这个地址看着是登录 / 授权页，内嵌会停在空白页，点击直接在新标签打开。',
    };
  }
  return { embeddable: true, reason: null };
}

/** 卡片与详情页共用：演示是否应该「点击直接跳转」而不是内嵌。 */
export function shouldOpenDirectly(project: Pick<Project, 'siteUrl' | 'demoLogin'>): boolean {
  if (!project.siteUrl) return false;
  return !embedDecision(project.siteUrl, project.demoLogin ?? false).embeddable;
}
