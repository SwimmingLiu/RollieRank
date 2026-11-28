export interface SessionInfo {
  authenticated: boolean;
  needsSetup: boolean;
  authSource: "db" | "env" | null;
  user: { username: string; role: string; loginAt: number } | null;
  wechatSecEnabled: boolean;
  mediaCallbackReady: boolean;
}

export interface OverviewData {
  metrics: {
    totalUsers: number;
    mutedUsers: number;
    totalAttempts: number;
    todayAttempts: number;
    totalComments: number;
    pendingComments: number;
    blockedComments: number;
    pendingCorrections: number;
    totalFeedbacks?: number;
    pendingFeedbacks?: number;
    totalPointsBalance: number;
    totalPointsIssued: number;
  };
  feedbackNotify?: {
    enabled: boolean;
    wechatReady: boolean;
    templateConfigured: boolean;
    subscriberCount: number;
    totalQuota: number;
  };
  security: {
    wechatSecEnabled: boolean;
    mediaCallbackReady: boolean;
    callbackTokenConfigured: boolean;
    commentMode: "auto" | "manual";
    keywordCount: number;
  };
  topPapers: Array<{ title: string; institution: string; attempts: number; avgCents: number }>;
  recentQueue: Array<{ id: string; author: string; paperTitle: string; text: string; status: string; reason: string; createdAt: number }>;
  recentAudit: Array<{ id: string; action: string; target: string; operator?: string; createdAt: number }>;
}

export interface AdminComment {
  id: string;
  userId: string;
  userMuted: boolean;
  paperId: string;
  paperTitle: string;
  parentId: string | null;
  replyTo: { id: string; name: string } | null;
  author: { name: string };
  text: string;
  links: string[];
  images: Array<{ dataUri: string; alt?: string }>;
  audio: { dataUri: string; name?: string } | null;
  likeCount: number;
  createdAt: number;
  moderation: {
    status: "approved" | "pending" | "flagged" | "rejected";
    source: string;
    reason: string;
    labels: string[];
    traces: Array<{ traceId: string; kind: string; status: string; label?: string }>;
    reviewedAt: number | null;
  };
  reportCount: number;
  reports: Array<{ reason: string; createdAt: number }>;
}

export interface CommentsResponse {
  summary: {
    total: number;
    queue: number;
    approved: number;
    rejected: number;
    blocked: number;
    wechatSecEnabled: boolean;
    mediaCallbackReady: boolean;
  };
  settings: { mode: "auto" | "manual"; blockedKeywords: string[] };
  comments: AdminComment[];
  blockedLog: Array<{ id: string; nickname?: string; text?: string; source?: string; reason?: string; createdAt: number }>;
  total: number;
  page: number;
  pages: number;
}

export interface AdminUser {
  userId: string;
  nickname: string;
  positionId: string | null;
  positionLabel: string;
  attemptCount: number;
  bestScoreCents: number | null;
  avgScoreCents: number | null;
  commentCount: number;
  pointsBalance: number;
  muted: boolean;
  muteReason: string;
  mutedAt: number | null;
  lastActiveAt: number | null;
}

export interface UsersResponse {
  summary: { total: number; muted: number; withPoints: number; totalPoints: number };
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
}

export interface UserDetailResponse {
  user: AdminUser;
  attempts: Array<{ id: string; paperTitle: string; totalCents: number; correct: number; wrong: number; blank: number; createdAt: number }>;
  comments: Array<{ id: string; paperTitle: string; text: string; status: string; imageCount: number; createdAt: number }>;
  ledger: PointEntry[];
}

export interface PointEntry {
  id: string;
  userId: string;
  nickname: string;
  delta: number;
  balanceAfter: number;
  type: string;
  reason: string;
  operator?: string;
  createdAt: number;
}

export interface PointsResponse {
  summary: { totalIssued: number; totalDeducted: number; totalBalance: number; holders: number; ledgerCount: number };
  rules: { submitAttempt: number; approvedCorrection: number; featuredComment: number };
  ledger: PointEntry[];
  total: number;
  page: number;
  pages: number;
}

export interface CorrectionFeedback {
  id: string;
  paperTitle: string;
  versionLabel: string;
  currentRevision: number;
  affectedAttempts: number;
  status: string;
  createdAt: number;
  items: Array<{ question: number; originalAnswer: string; suggestedAnswer: string; evidence: string; status: string }>;
}

export interface CorrectionsResponse {
  feedbacks: CorrectionFeedback[];
  pendingCount: number;
  rules: { submitAttempt: number; approvedCorrection: number; featuredComment: number };
}

export interface AuditResponse {
  items: Array<{ id: string; action: string; target: string; operator?: string; createdAt: number }>;
  total: number;
}

export interface ToolCreditPackage {
  credits: number;
  cents: number;
}

export interface ToolCreditRules {
  welcome: {
    newAccount: number;
    existingMember: number;
  };
  costs: Record<string, number>;
  invite: {
    enabled: boolean;
    groups: boolean;
    reward: number;
    monthlyLimit: number;
    registerDays: number;
    useDays: number;
  };
  referral?: {
    enabled: boolean;
    reward: number;
    monthlyLimit: number;
  };
  purchase: {
    directPurchase: boolean;
    tokenRecharge: boolean;
    packages: ToolCreditPackage[];
  };
  ads: {
    enabled: boolean;
    reward: number;
    dailyLimit: number;
  };
}

export interface ToolCreditAccount {
  id: string;
  uid?: number | null;
  createdAt: number;
  legacyMember: number;
  balance: number;
  held: number;
}

export interface ToolCreditRecord {
  id: number;
  accountId: string | null;
  accountUid?: number | null;
  source: "welcome" | "manual" | "tool" | "invite" | "rules" | string;
  amount: number;
  balanceAfter: number | null;
  reference: string;
  reason: string;
  tool: string | null;
  operator: string | null;
  createdAt: number;
}

export interface ToolCreditsResponse {
  rules: ToolCreditRules;
  groupApproved: boolean;
  accounts: ToolCreditAccount[];
  records: ToolCreditRecord[];
}

export interface ToolCreditAdjustResponse {
  accountId: string;
  balance: number;
  held: number;
}

export interface AdminUserFeedback {
  id: string;
  guestId: string;
  nickname: string;
  category: "suggestion" | "bug" | "paper" | "other";
  categoryLabel: string;
  content: string;
  contact: string;
  images: Array<{ dataUri: string; alt?: string }>;
  status: "pending" | "processing" | "replied" | "closed";
  statusLabel: string;
  reply: { text: string; operator: string; repliedAt: number } | null;
  clientMeta?: { platform?: string; envVersion?: string; appVersion?: string; page?: string };
  notifySummary?: { attempted: number; sent: number; failed: number; skippedReason?: string; lastError?: string; at: number } | null;
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackNotifySubscriber {
  id: string;
  openidMask: string;
  label: string;
  quota: number;
  totalSent: number;
  lastSubscribedAt: number | null;
  lastNotifiedAt: number | null;
  lastError: string;
}

export interface FeedbackNotifyLog {
  id: string;
  feedbackId: string;
  subscriberId: string;
  subscriberLabel: string;
  ok: boolean;
  errcode: number;
  errmsg: string;
  createdAt: number;
}

export interface FeedbackNotifyView {
  enabled: boolean;
  wechatReady: boolean;
  templateId: string;
  templateConfigured: boolean;
  miniprogramState: "formal" | "trial" | "developer";
  page: string;
  fieldMap: {
    categoryKey: string;
    contentKey: string;
    timeKey: string;
    userKey: string;
  };
  subscriberCount: number;
  totalQuota: number;
  subscribers: FeedbackNotifySubscriber[];
  logs: FeedbackNotifyLog[];
}

export interface UserFeedbackResponse {
  items: AdminUserFeedback[];
  total: number;
  page: number;
  pages: number;
  summary: { total: number; pending: number; processing: number; replied: number; closed: number };
  notify: FeedbackNotifyView;
}

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export async function consoleApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !["login", "session", "setup"].includes(path)) {
    unauthorizedHandler?.();
    throw new Error(data.error || "登录状态已失效");
  }
  if (!res.ok) throw new Error(data.error || "操作失败");
  return data as T;
}

export function formatScore(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  return (cents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function formatTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
