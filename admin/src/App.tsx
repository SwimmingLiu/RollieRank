import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  Award,
  Ban,
  Check,
  CheckCircle2,
  Coins,
  Eye,
  Flag,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import {
  consoleApi,
  formatScore,
  formatTime,
  onUnauthorized,
  type AdminComment,
  type AdminUser,
  type AuditResponse,
  type CommentsResponse,
  type CorrectionFeedback,
  type CorrectionsResponse,
  type OverviewData,
  type PointsResponse,
  type SessionInfo,
  type ToolCreditsResponse,
  type UserDetailResponse,
  type UserFeedbackResponse,
  type UsersResponse,
} from "./api";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  FilterTabs,
  HelpPopover,
  IconButton,
  Modal,
  ToggleSwitch,
} from "./components/ui";
import { ToolCreditsView } from "./components/ToolCreditsView";
import { FeedbackView } from "./components/FeedbackView";
import { cn } from "@/lib/utils";

type ViewId = "dashboard" | "comments" | "users" | "points" | "credits" | "corrections" | "feedback" | "audit";

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "总览", icon: LayoutDashboard },
  { id: "comments", label: "评论审查", icon: MessageSquare },
  { id: "users", label: "用户", icon: Users },
  { id: "points", label: "积分", icon: Coins },
  { id: "credits", label: "卷豆", icon: Sparkles },
  { id: "corrections", label: "答案纠错", icon: Flag },
  { id: "feedback", label: "用户反馈", icon: Inbox },
  { id: "audit", label: "操作日志", icon: ScrollText },
];

const COMMENT_BADGE: Record<string, { label: string; tone: "success" | "warn" | "danger" | "neutral" }> = {
  approved: { label: "已公开", tone: "success" },
  pending: { label: "审核中", tone: "warn" },
  flagged: { label: "待复核", tone: "danger" },
  rejected: { label: "已屏蔽", tone: "neutral" },
};

const POINT_TYPE_LABEL: Record<string, string> = {
  reward: "任务奖励",
  activity: "活动发放",
  correction: "纠错奖励",
  comment: "评论奖励",
  manual: "手动调整",
  deduct: "积分扣减",
};

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-[#dcd6cc] bg-white px-3.5 text-[14px] text-[#1c1917] placeholder:text-[#9c948b] outline-none transition focus:border-[#1c1917] focus:ring-2 focus:ring-[#1c1917]/10";

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[#dcd6cc] bg-white p-3 text-[14px] leading-relaxed text-[#1c1917] placeholder:text-[#9c948b] outline-none transition focus:border-[#1c1917] focus:ring-2 focus:ring-[#1c1917]/10";

function viewFromHash(): ViewId {
  const hash = location.hash.replace(/^#\/?/, "").trim() as ViewId;
  return NAV_ITEMS.some((item) => item.id === hash) ? hash : "dashboard";
}

export function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [view, setView] = useState<ViewId>(viewFromHash);
  const [toastMsg, setToastMsg] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Data per view
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [commentsData, setCommentsData] = useState<CommentsResponse | null>(null);
  const [commentFilter, setCommentFilter] = useState("queue");
  const [commentQuery, setCommentQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [usersData, setUsersData] = useState<UsersResponse | null>(null);
  const [userFilter, setUserFilter] = useState("all");
  const [userQuery, setUserQuery] = useState("");
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);

  const [pointsData, setPointsData] = useState<PointsResponse | null>(null);
  const [pointType, setPointType] = useState("all");
  const [pointQuery, setPointQuery] = useState("");

  const [creditsData, setCreditsData] = useState<ToolCreditsResponse | null>(null);
  const [creditsError, setCreditsError] = useState("");
  const [creditAccountFilter, setCreditAccountFilter] = useState("");

  const [correctionsData, setCorrectionsData] = useState<CorrectionsResponse | null>(null);
  const [feedbackData, setFeedbackData] = useState<UserFeedbackResponse | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState("pending");
  const [feedbackQuery, setFeedbackQuery] = useState("");
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [auditQuery, setAuditQuery] = useState("");

  // Modals & Drawers
  const [drawerUser, setDrawerUser] = useState<UserDetailResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [grantModal, setGrantModal] = useState<{ open: boolean; userId: string; nickname: string }>({
    open: false,
    userId: "",
    nickname: "",
  });
  const [grantDelta, setGrantDelta] = useState("");
  const [grantType, setGrantType] = useState("reward");
  const [grantReason, setGrantReason] = useState("");

  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsManual, setSettingsManual] = useState(false);
  const [settingsKeywords, setSettingsKeywords] = useState("");

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null);
  const [activeFeedback, setActiveFeedback] = useState<CorrectionFeedback | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    onUnauthorized(() => {
      setSession((prev) => (prev ? { ...prev, authenticated: false, user: null } : prev));
    });
  }, []);

  const fetchCredits = useCallback(
    async (accountId?: string) => {
      const targetId = (accountId ?? creditAccountFilter).trim();
      const qs = targetId ? `?${new URLSearchParams({ accountId: targetId })}` : "";
      setCreditsError("");
      try {
        setCreditsData(await consoleApi<ToolCreditsResponse>(`tool-credits${qs}`));
      } catch (err) {
        const message = (err as Error).message;
        setCreditsError(message);
        throw err;
      }
    },
    [creditAccountFilter],
  );

  const loadView = useCallback(
    async (target: ViewId) => {
      try {
        if (target === "dashboard") {
          setOverview(await consoleApi<OverviewData>("overview"));
        } else if (target === "comments") {
          const qs = new URLSearchParams({ status: commentFilter, q: commentQuery, pageSize: "30" });
          const res = await consoleApi<CommentsResponse>(`comments?${qs}`);
          setCommentsData(res);
          setSelectedIds([]);
          setSettingsManual(res.settings.mode === "manual");
          setSettingsKeywords(res.settings.blockedKeywords.join("\n"));
        } else if (target === "users") {
          const qs = new URLSearchParams({ status: userFilter, q: userQuery, pageSize: "30" });
          setUsersData(await consoleApi<UsersResponse>(`users?${qs}`));
        } else if (target === "points") {
          const qs = new URLSearchParams({ type: pointType, q: pointQuery, pageSize: "30" });
          const [pts, usr] = await Promise.all([
            consoleApi<PointsResponse>(`points?${qs}`),
            consoleApi<UsersResponse>("users?page=1&pageSize=100"),
          ]);
          setPointsData(pts);
          setAllUsers(usr.users);
        } else if (target === "credits") {
          await fetchCredits();
        } else if (target === "corrections") {
          setCorrectionsData(await consoleApi<CorrectionsResponse>("corrections"));
        } else if (target === "feedback") {
          const qs = new URLSearchParams({ status: feedbackStatus, q: feedbackQuery, pageSize: "30" });
          setFeedbackData(await consoleApi<UserFeedbackResponse>(`feedback?${qs}`));
        } else if (target === "audit") {
          const qs = new URLSearchParams({ q: auditQuery });
          setAuditData(await consoleApi<AuditResponse>(`audit?${qs}`));
        }
        if (target !== "dashboard") {
          consoleApi<OverviewData>("overview").then(setOverview).catch(() => {});
        }
      } catch (err) {
        showToast((err as Error).message);
      }
    },
    [auditQuery, commentFilter, commentQuery, feedbackQuery, feedbackStatus, fetchCredits, pointQuery, pointType, showToast, userFilter, userQuery],
  );

  useEffect(() => {
    consoleApi<SessionInfo>("session")
      .then((info) => {
        setSession(info);
      })
      .catch((err) => showToast((err as Error).message));
  }, [showToast]);

  useEffect(() => {
    if (session?.authenticated) {
      void loadView(view);
    }
  }, [session?.authenticated, view, loadView]);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (next: ViewId) => {
    setView(next);
    if (location.hash !== `#${next}`) history.replaceState(null, "", `#${next}`);
  };

  async function handleSetup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "");
    const confirmPassword = String(fd.get("confirmPassword") || "");
    if (password !== confirmPassword) {
      setLoginError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      const res = await consoleApi<SessionInfo>("setup", {
        username,
        password,
        confirmPassword,
      });
      setSession((prev) => ({ ...(prev ?? res), ...res, authenticated: true, needsSetup: false }));
      showToast("密码已保存");
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "");
    setSubmitting(true);
    try {
      const res = await consoleApi<SessionInfo>("login", { username, password });
      setSession((prev) => ({ ...(prev ?? res), ...res, authenticated: true, needsSetup: false }));
      showToast(`已登录 ${res.user?.username ?? ""}`);
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await consoleApi("logout", {}).catch(() => {});
    setSession((prev) => (prev ? { ...prev, authenticated: false, user: null } : prev));
    showToast("已退出登录");
  }

  async function openUserDetail(userId: string) {
    setDrawerOpen(true);
    setDrawerUser(null);
    try {
      setDrawerUser(await consoleApi<UserDetailResponse>(`users/detail?userId=${encodeURIComponent(userId)}`));
    } catch (err) {
      setDrawerOpen(false);
      showToast((err as Error).message);
    }
  }

  async function openGrant(userId = "", nickname = "") {
    if (!allUsers.length && !usersData?.users.length) {
      try {
        const res = await consoleApi<UsersResponse>("users?page=1&pageSize=100");
        setAllUsers(res.users);
      } catch {
        // ignore
      }
    }
    setGrantDelta("");
    setGrantType("reward");
    setGrantReason("");
    setGrantModal({ open: true, userId, nickname });
  }

  async function submitGrant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = grantModal.userId || String(new FormData(e.currentTarget).get("target") || "");
    const pool = allUsers.length ? allUsers : (usersData?.users ?? []);
    const userIds = target === "__ALL__" ? pool.map((u) => u.userId) : [target];
    if (!userIds.length || !userIds[0]) {
      showToast("请选择目标用户");
      return;
    }
    const delta = Number(grantDelta);
    try {
      const res = await consoleApi<{ count: number }>("points/grant", {
        userIds,
        delta,
        type: grantType,
        reason: grantReason.trim(),
      });
      setGrantModal({ open: false, userId: "", nickname: "" });
      showToast(`已为 ${res.count} 人${delta > 0 ? `发放 +${delta}` : `扣减 ${delta}`} 积分`);
      await loadView(view);
      if (drawerOpen && userIds.length === 1) await openUserDetail(userIds[0]);
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function submitPasswordChange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get("currentPassword") || "");
    const newPassword = String(fd.get("newPassword") || "");
    const confirmPassword = String(fd.get("confirmPassword") || "");
    if (newPassword !== confirmPassword) {
      showToast("两次输入的新密码不一致");
      return;
    }
    try {
      await consoleApi("password", { currentPassword, newPassword, confirmPassword });
      setPasswordModalOpen(false);
      showToast("密码已更新");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function submitCommentSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await consoleApi("comments/settings", {
        mode: settingsManual ? "manual" : "auto",
        blockedKeywords: settingsKeywords,
      });
      setSettingsModalOpen(false);
      showToast("审核策略已保存");
      await loadView("comments");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function submitRules(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await consoleApi("points/rules", {
        submitAttempt: Number(fd.get("submitAttempt")),
        approvedCorrection: Number(fd.get("approvedCorrection")),
        featuredComment: Number(fd.get("featuredComment")),
      });
      setRulesModalOpen(false);
      showToast("积分规则已保存");
      await loadView("points");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function reviewComments(
    ids: string[],
    action: "approve" | "reject" | "delete",
    extra?: { rewardPoints?: number; muteAuthor?: boolean; reason?: string },
  ) {
    try {
      await consoleApi("comments/review", { commentIds: ids, action, ...extra });
      showToast(
        extra?.rewardPoints
          ? `已通过并发放 +${extra.rewardPoints} 积分`
          : extra?.muteAuthor
            ? "已屏蔽并禁言作者"
            : action === "approve"
              ? "已通过"
              : action === "reject"
                ? "已屏蔽"
                : "已删除",
      );
      await loadView("comments");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function toggleMute(user: AdminUser) {
    if (user.muted) {
      try {
        await consoleApi("users/mute", { userId: user.userId, muted: false });
        showToast(`已解禁 ${user.nickname}`);
        await loadView(view);
        if (drawerOpen) await openUserDetail(user.userId);
      } catch (err) {
        showToast((err as Error).message);
      }
      return;
    }
    setConfirmState({
      open: true,
      title: `禁言 ${user.nickname}`,
      description: "禁言后该用户将无法在评论区发言，可随时恢复。",
      confirmLabel: "确认禁言",
      destructive: true,
      onConfirm: async () => {
        await consoleApi("users/mute", { userId: user.userId, muted: true, reason: "管理员禁言" });
        setConfirmState(null);
        showToast(`已禁言 ${user.nickname}`);
        await loadView(view);
        if (drawerOpen) await openUserDetail(user.userId);
      },
    });
  }

  async function submitCorrectionReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeFeedback) return;
    const fd = new FormData(e.currentTarget);
    const questionNumbers = fd.getAll("q").map(Number);
    const decision = String(fd.get("decision") || "approve");
    const reason = String(fd.get("reason") || "").trim();
    const rewardPoints = Number(fd.get("rewardPoints") || 0);
    try {
      const res = await consoleApi<{ recalculated: number }>("corrections/review", {
        feedbackId: activeFeedback.id,
        questionNumbers,
        decision,
        reason,
        rewardPoints: decision === "approve" ? rewardPoints : 0,
      });
      setActiveFeedback(null);
      showToast(res.recalculated ? `已订正并重算 ${res.recalculated} 份答卷` : "审核已保存");
      await loadView("corrections");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  // Loading state
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] text-[15px] text-[#6b645c]">
        正在加载…
      </div>
    );
  }

  // Auth / First-time Setup Screen — clean, centered, zero fluff
  if (!session.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-4 py-12">
        <div className="w-full max-w-[400px] rounded-3xl border border-[#e5e0d8] bg-white p-8 shadow-sm">
          <div className="mb-7 flex items-center gap-3">
            <img
              src="/ios-v3/assets/brand/rollierank-logo-transparent.png"
              alt="卷卷小榜"
              className="h-10 w-10 rounded-xl bg-[#faf9f6] p-1"
            />
            <span className="text-[18px] font-semibold tracking-tight text-[#1c1917]">卷卷小榜</span>
          </div>

          {session.needsSetup ? (
            <>
              <h1 className="text-[22px] font-semibold tracking-tight text-[#1c1917]">设置管理员密码</h1>
              <form id="setup-form" onSubmit={handleSetup} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="setup-user" className="block text-[14px] font-medium text-[#44403c]">
                    账号
                  </label>
                  <input
                    id="setup-user"
                    name="username"
                    defaultValue="admin"
                    minLength={3}
                    maxLength={32}
                    autoComplete="username"
                    required
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="setup-pass" className="block text-[14px] font-medium text-[#44403c]">
                    密码
                  </label>
                  <input
                    id="setup-pass"
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    placeholder="至少 8 位"
                    autoComplete="new-password"
                    autoFocus
                    required
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="setup-confirm" className="block text-[14px] font-medium text-[#44403c]">
                    确认密码
                  </label>
                  <input
                    id="setup-confirm"
                    name="confirmPassword"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    placeholder="再次输入"
                    autoComplete="new-password"
                    required
                    className={INPUT_CLASS}
                  />
                </div>
                {loginError ? (
                  <p role="alert" className="rounded-xl bg-[#fbe9e7] px-3.5 py-2.5 text-[14px] text-[#a93b32]">
                    {loginError}
                  </p>
                ) : null}
                <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
                  保存并登录
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-[22px] font-semibold tracking-tight text-[#1c1917]">管理员登录</h1>
              <form id="login-form" onSubmit={handleLogin} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-user" className="block text-[14px] font-medium text-[#44403c]">
                    账号
                  </label>
                  <input
                    id="login-user"
                    name="username"
                    defaultValue="admin"
                    autoComplete="username"
                    required
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="login-pass" className="block text-[14px] font-medium text-[#44403c]">
                    密码
                  </label>
                  <input
                    id="login-pass"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    required
                    className={INPUT_CLASS}
                  />
                </div>
                {loginError ? (
                  <p role="alert" className="rounded-xl bg-[#fbe9e7] px-3.5 py-2.5 text-[14px] text-[#a93b32]">
                    {loginError}
                  </p>
                ) : null}
                <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
                  登录
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  const pendingComments = overview?.metrics.pendingComments ?? 0;
  const pendingCorrections = overview?.metrics.pendingCorrections ?? 0;
  const pendingFeedbacks = overview?.metrics.pendingFeedbacks ?? 0;
  const userPool = allUsers.length ? allUsers : (usersData?.users ?? []);

  return (
    <Tooltip.Provider delay={250}>
      <div className="console grid min-h-screen grid-cols-1 bg-[#f7f5f0] lg:grid-cols-[228px_minmax(0,1fr)]">
        {/* Clean Warm-Paper Sidebar — no group labels, no fluff */}
        <aside className="flex flex-col border-b border-[#e5e0d8] bg-white px-3.5 py-5 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
          <div className="flex items-center gap-2.5 px-2.5 pb-5">
            <img
              src="/ios-v3/assets/brand/rollierank-logo-transparent.png"
              alt=""
              className="h-8 w-8 rounded-lg"
            />
            <span className="text-[16px] font-semibold tracking-tight text-[#1c1917]">卷卷小榜</span>
          </div>

          <nav aria-label="后台导航" className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = view === id;
              const badge = id === "comments" ? pendingComments : id === "corrections" ? pendingCorrections : id === "feedback" ? pendingFeedbacks : 0;
              return (
                <button
                  key={id}
                  type="button"
                  data-nav={id}
                  onClick={() => navigate(id)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-[14px] font-medium transition",
                    active
                      ? "bg-[#1c1917] text-white"
                      : "text-[#575049] hover:bg-[#f3efe8] hover:text-[#1c1917]",
                  )}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  <span>{label}</span>
                  {badge > 0 ? (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums",
                        active ? "bg-white/20 text-white" : "bg-[#fbe9e7] text-[#a93b32]",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto hidden items-center justify-between gap-2 border-t border-[#eeeae3] pt-4 lg:flex">
            <div className="flex min-w-0 items-center gap-2.5 px-1">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0ede7] text-[13px] font-semibold text-[#1c1917]">
                {(session.user?.username || "A")[0].toUpperCase()}
              </span>
              <span className="truncate text-[14px] font-medium text-[#1c1917]">{session.user?.username}</span>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="修改密码" dataTest="open-password-modal" onClick={() => setPasswordModalOpen(true)}>
                <KeyRound className="h-4 w-4" />
              </IconButton>
              <IconButton label="退出登录" dataTest="logout" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </aside>

        {/* Main Workspace — side nav identifies current view, no duplicated header copy */}
        <div className="min-w-0 flex flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#e5e0d8] bg-[#f7f5f0]/90 px-6 backdrop-blur-md">
            <h1 className="text-[18px] font-semibold tracking-tight text-[#1c1917]">
              {NAV_ITEMS.find((i) => i.id === view)?.label}
            </h1>
            <div className="flex items-center gap-2">
              <HelpPopover
                label="微信内容安全状态"
                trigger={
                  <>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        session.wechatSecEnabled ? "bg-[#286346]" : "bg-[#b0a89d]",
                      )}
                    />
                    <span>{session.wechatSecEnabled ? "微信安全" : "本地审核"}</span>
                  </>
                }
              >
                <p className="font-medium text-[#1c1917]">
                  {session.wechatSecEnabled
                    ? session.mediaCallbackReady
                      ? "已启用微信免费内容安全（文本 + 图片文字 OCR）"
                      : "已启用微信文本安全，配置公网回调域名后可开启图片异步检测"
                    : "未配置小程序密钥，当前使用敏感词库与人工审核"}
                </p>
              </HelpPopover>
              {view !== "credits" ? (
                <Button size="sm" variant="primary" onClick={() => void openGrant()}>
                  <Plus className="h-4 w-4" />
                  <span>发积分</span>
                </Button>
              ) : null}
              <IconButton label="刷新" onClick={() => void loadView(view)}>
                <RefreshCw className="h-4 w-4" />
              </IconButton>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1220px] flex-1 space-y-6 px-6 py-6">
            {/* 1. 总览 */}
            {view === "dashboard" && overview ? (
              <>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                  {[
                    { label: "用户", value: overview.metrics.totalUsers, nav: "users" as ViewId },
                    { label: "交卷", value: overview.metrics.totalAttempts, nav: "users" as ViewId },
                    { label: "待审评论", value: overview.metrics.pendingComments, nav: "comments" as ViewId },
                    { label: "待处理反馈", value: overview.metrics.pendingFeedbacks ?? 0, nav: "feedback" as ViewId },
                    { label: "流通积分", value: overview.metrics.totalPointsBalance, nav: "points" as ViewId },
                  ].map((card) => (
                    <button
                      key={card.label}
                      type="button"
                      onClick={() => navigate(card.nav)}
                      className="rounded-2xl border border-[#e5e0d8] bg-white p-5 text-left transition hover:border-[#cfc8bc]"
                    >
                      <div className="text-[14px] font-medium text-[#6b645c]">{card.label}</div>
                      <div className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-[#1c1917] tabular-nums">
                        {card.value}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <section className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[15px] font-semibold text-[#1c1917]">热门练习</h2>
                    </div>
                    {overview.topPapers.length ? (
                      <div className="space-y-3.5">
                        {overview.topPapers.map((paper) => {
                          const max = Math.max(1, ...overview.topPapers.map((p) => p.attempts));
                          return (
                            <div key={paper.title} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-3 text-[14px]">
                                <span className="truncate font-medium text-[#1c1917]">{paper.title}</span>
                                <span className="shrink-0 tabular-nums text-[#6b645c]">
                                  {paper.attempts} 份 · 均分 {formatScore(paper.avgCents)}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-[#f0ede7]">
                                <div
                                  className="h-full rounded-full bg-[#1c1917]"
                                  style={{ width: `${Math.max(8, Math.round((paper.attempts / max) * 100))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-10 text-center text-[14px] text-[#7a7268]">暂无交卷</div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[15px] font-semibold text-[#1c1917]">最近操作</h2>
                      <button
                        type="button"
                        onClick={() => navigate("audit")}
                        className="text-[14px] font-medium text-[#6b645c] hover:text-[#1c1917]"
                      >
                        全部
                      </button>
                    </div>
                    {overview.recentAudit.length ? (
                      <div className="divide-y divide-[#f0ede7]">
                        {overview.recentAudit.slice(0, 6).map((row) => (
                          <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-[14px]">
                            <div className="min-w-0 flex items-center gap-2.5">
                              <Badge>{row.action}</Badge>
                              <span className="truncate text-[#44403c]">{row.target}</span>
                            </div>
                            <span className="shrink-0 tabular-nums text-[13px] text-[#7a7268]">
                              {formatTime(row.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center text-[14px] text-[#7a7268]">暂无记录</div>
                    )}
                  </section>
                </div>
              </>
            ) : null}

            {/* 2. 评论审查 */}
            {view === "comments" && commentsData ? (
              <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae3] px-5 py-4">
                  <FilterTabs
                    value={commentFilter}
                    onChange={(v) => setCommentFilter(v)}
                    items={[
                      { value: "queue", label: "待复核", count: commentsData.summary.queue },
                      { value: "all", label: "全部", count: commentsData.summary.total },
                      { value: "approved", label: "已公开", count: commentsData.summary.approved },
                      { value: "rejected", label: "已屏蔽", count: commentsData.summary.rejected },
                    ]}
                  />
                  <div className="flex items-center gap-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void loadView("comments");
                      }}
                      className="relative"
                    >
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8c847a]" />
                      <input
                        value={commentQuery}
                        onChange={(e) => setCommentQuery(e.target.value)}
                        placeholder="搜索评论"
                        className="h-9 w-52 rounded-full border border-[#dcd6cc] bg-[#faf9f6] pr-3 pl-9 text-[14px] outline-none focus:border-[#1c1917] focus:bg-white"
                      />
                    </form>
                    <Button size="sm" variant="outline" onClick={() => setSettingsModalOpen(true)}>
                      <SlidersHorizontal className="h-4 w-4" />
                      <span>审核策略</span>
                    </Button>
                  </div>
                </div>

                {selectedIds.length > 0 ? (
                  <div className="flex items-center justify-between border-b border-[#e5e0d8] bg-[#faf7f0] px-5 py-2.5 text-[14px]">
                    <span className="font-medium text-[#1c1917]">已选 {selectedIds.length} 条</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => void reviewComments(selectedIds, "approve")}>
                        通过
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void reviewComments(selectedIds, "reject")}>
                        屏蔽
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#f3c6c1] text-[#a93b32]"
                        onClick={() =>
                          setConfirmState({
                            open: true,
                            title: `删除 ${selectedIds.length} 条评论`,
                            description: "删除后不可恢复，主评论下方的回复会一并移除。",
                            confirmLabel: "删除",
                            destructive: true,
                            onConfirm: async () => {
                              await reviewComments(selectedIds, "delete");
                              setConfirmState(null);
                            },
                          })
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ) : null}

                {commentsData.comments.length ? (
                  <div className="divide-y divide-[#f0ede7]">
                    {commentsData.comments.map((c: AdminComment) => {
                      const badge = COMMENT_BADGE[c.moderation.status] ?? COMMENT_BADGE.approved;
                      const checked = selectedIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className="comment-row flex flex-col gap-3 px-5 py-4 transition hover:bg-[#fcfbf9] sm:flex-row sm:items-start"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            aria-label="选择评论"
                            onChange={(e) =>
                              setSelectedIds((prev) =>
                                e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                              )
                            }
                            className="mt-1.5 h-4 w-4 shrink-0 accent-[#1c1917]"
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2.5 text-[14px]">
                              <button
                                type="button"
                                onClick={() => void openUserDetail(c.userId)}
                                className="font-semibold text-[#1c1917] hover:underline"
                              >
                                {c.author.name}
                              </button>
                              <Badge tone={badge.tone}>{badge.label}</Badge>
                              {c.userMuted ? <Badge tone="danger">已禁言</Badge> : null}
                              {c.reportCount > 0 ? <Badge tone="danger">举报 {c.reportCount}</Badge> : null}
                              <span className="text-[13px] text-[#7a7268]">
                                {c.paperTitle} · {formatTime(c.createdAt)}
                              </span>
                            </div>

                            {c.text ? (
                              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1c1917]">
                                {c.text}
                              </p>
                            ) : null}

                            {c.images.length ? (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {c.images.map((img, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setLightboxImg({ src: img.dataUri, title: c.author.name })}
                                    className="overflow-hidden rounded-xl border border-[#e5e0d8]"
                                  >
                                    <img src={img.dataUri} alt={`配图 ${i + 1}`} className="h-16 w-16 object-cover" />
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {c.moderation.reason ? (
                              <div className="inline-block rounded-lg bg-[#fbf1df] px-3 py-1 text-[13px] text-[#8a5514]">
                                {c.moderation.reason}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {c.moderation.status !== "approved" ? (
                              <>
                                <IconButton
                                  label="通过"
                                  tone="success"
                                  onClick={() => void reviewComments([c.id], "approve")}
                                >
                                  <Check className="h-4 w-4" />
                                </IconButton>
                                <IconButton
                                  label="通过并奖积分"
                                  tone="success"
                                  onClick={() =>
                                    void reviewComments([c.id], "approve", {
                                      rewardPoints: pointsData?.rules.featuredComment ?? 10,
                                      reason: "精选评论奖励",
                                    })
                                  }
                                >
                                  <Award className="h-4 w-4" />
                                </IconButton>
                              </>
                            ) : null}
                            {c.moderation.status !== "rejected" ? (
                              <IconButton
                                label="屏蔽"
                                onClick={() => void reviewComments([c.id], "reject")}
                              >
                                <Ban className="h-4 w-4" />
                              </IconButton>
                            ) : null}
                            <IconButton
                              label="删除"
                              tone="danger"
                              onClick={() =>
                                setConfirmState({
                                  open: true,
                                  title: "删除评论",
                                  description: "删除后不可恢复，主评论下方的回复会一并移除。",
                                  confirmLabel: "删除",
                                  destructive: true,
                                  onConfirm: async () => {
                                    await reviewComments([c.id], "delete");
                                    setConfirmState(null);
                                  },
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center text-[15px] text-[#7a7268]">暂无评论</div>
                )}
              </section>
            ) : null}

            {/* 3. 用户列表 */}
            {view === "users" && usersData ? (
              <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae3] px-5 py-4">
                  <FilterTabs
                    value={userFilter}
                    onChange={(v) => setUserFilter(v)}
                    items={[
                      { value: "all", label: "全部", count: usersData.summary.total },
                      { value: "active", label: "正常" },
                      { value: "with-points", label: "有积分", count: usersData.summary.withPoints },
                      { value: "muted", label: "已禁言", count: usersData.summary.muted },
                    ]}
                  />
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void loadView("users");
                    }}
                    className="relative"
                  >
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8c847a]" />
                    <input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="搜索昵称或岗位"
                      className="h-9 w-56 rounded-full border border-[#dcd6cc] bg-[#faf9f6] pr-3 pl-9 text-[14px] outline-none focus:border-[#1c1917] focus:bg-white"
                    />
                  </form>
                </div>

                {usersData.users.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[14px]">
                      <thead>
                        <tr className="border-b border-[#eeeae3] bg-[#faf9f6] text-left text-[13px] font-medium text-[#6b645c]">
                          <th className="px-5 py-3">用户</th>
                          <th className="px-4 py-3">岗位</th>
                          <th className="px-4 py-3">交卷 / 最高分</th>
                          <th className="px-4 py-3">积分</th>
                          <th className="px-4 py-3">状态</th>
                          <th className="px-4 py-3">活跃时间</th>
                          <th className="px-5 py-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0ede7]">
                        {usersData.users.map((u) => (
                          <tr key={u.userId} className="hover:bg-[#fcfbf9]">
                            <td className="px-5 py-3.5 font-medium text-[#1c1917]">{u.nickname}</td>
                            <td className="max-w-[200px] truncate px-4 py-3.5 text-[#575049]">
                              {u.positionLabel || "—"}
                            </td>
                            <td className="px-4 py-3.5 tabular-nums text-[#44403c]">
                              {u.attemptCount} 份 · {formatScore(u.bestScoreCents)}
                            </td>
                            <td className="px-4 py-3.5 font-semibold tabular-nums text-[#1c1917]">
                              {u.pointsBalance}
                            </td>
                            <td className="px-4 py-3.5">
                              {u.muted ? <Badge tone="danger">已禁言</Badge> : <Badge tone="success">正常</Badge>}
                            </td>
                            <td className="px-4 py-3.5 tabular-nums text-[#6b645c]">{formatTime(u.lastActiveAt)}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1">
                                <IconButton
                                  label="查看详情"
                                  dataTest="open-user-drawer"
                                  onClick={() => void openUserDetail(u.userId)}
                                >
                                  <Eye className="h-4 w-4" />
                                </IconButton>
                                <IconButton
                                  label="发放积分"
                                  onClick={() => void openGrant(u.userId, u.nickname)}
                                >
                                  <Coins className="h-4 w-4" />
                                </IconButton>
                                <IconButton
                                  label={u.muted ? "解除禁言" : "禁言"}
                                  tone={u.muted ? "success" : "danger"}
                                  onClick={() => void toggleMute(u)}
                                >
                                  {u.muted ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                </IconButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-16 text-center text-[15px] text-[#7a7268]">暂无用户</div>
                )}
              </section>
            ) : null}

            {/* 4. 积分发放管理 */}
            {view === "points" && pointsData ? (
              <>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  {[
                    { label: "当前流通", value: pointsData.summary.totalBalance },
                    { label: "累计发放", value: `+${pointsData.summary.totalIssued}` },
                    { label: "累计扣减", value: `-${pointsData.summary.totalDeducted}` },
                    { label: "持分人数", value: pointsData.summary.holders },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
                      <div className="text-[14px] font-medium text-[#6b645c]">{item.label}</div>
                      <div className="mt-2 text-[30px] font-semibold leading-none tabular-nums text-[#1c1917]">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae3] px-5 py-4">
                    <FilterTabs
                      value={pointType}
                      onChange={(v) => setPointType(v)}
                      items={[
                        { value: "all", label: "全部" },
                        { value: "reward", label: "任务" },
                        { value: "activity", label: "活动" },
                        { value: "correction", label: "纠错" },
                        { value: "deduct", label: "扣减" },
                      ]}
                    />
                    <div className="flex items-center gap-2">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void loadView("points");
                        }}
                        className="relative"
                      >
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8c847a]" />
                        <input
                          value={pointQuery}
                          onChange={(e) => setPointQuery(e.target.value)}
                          placeholder="搜索用户或原因"
                          className="h-9 w-48 rounded-full border border-[#dcd6cc] bg-[#faf9f6] pr-3 pl-9 text-[14px] outline-none focus:border-[#1c1917] focus:bg-white"
                        />
                      </form>
                      <Button size="sm" variant="outline" onClick={() => setRulesModalOpen(true)}>
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>奖励规则</span>
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => void openGrant()}>
                        <Plus className="h-4 w-4" />
                        <span>发放积分</span>
                      </Button>
                    </div>
                  </div>

                  {pointsData.ledger.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[14px]">
                        <thead>
                          <tr className="border-b border-[#eeeae3] bg-[#faf9f6] text-left text-[13px] font-medium text-[#6b645c]">
                            <th className="px-5 py-3">时间</th>
                            <th className="px-4 py-3">用户</th>
                            <th className="px-4 py-3">类型</th>
                            <th className="px-4 py-3">变动</th>
                            <th className="px-4 py-3">余额</th>
                            <th className="px-5 py-3">原因</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0ede7]">
                          {pointsData.ledger.map((l) => (
                            <tr key={l.id} className="hover:bg-[#fcfbf9]">
                              <td className="px-5 py-3.5 tabular-nums text-[#6b645c]">{formatTime(l.createdAt)}</td>
                              <td className="px-4 py-3.5 font-medium text-[#1c1917]">{l.nickname}</td>
                              <td className="px-4 py-3.5">
                                <Badge>{POINT_TYPE_LABEL[l.type] ?? l.type}</Badge>
                              </td>
                              <td
                                className={cn(
                                  "px-4 py-3.5 font-semibold tabular-nums",
                                  l.delta >= 0 ? "text-[#286346]" : "text-[#a93b32]",
                                )}
                              >
                                {l.delta >= 0 ? `+${l.delta}` : l.delta}
                              </td>
                              <td className="px-4 py-3.5 tabular-nums text-[#44403c]">{l.balanceAfter}</td>
                              <td className="px-5 py-3.5 text-[#44403c]">{l.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-[15px] text-[#7a7268]">暂无积分流水</div>
                  )}
                </section>
              </>
            ) : null}

            {/* 4.5 卷豆账本与定价 */}
            {view === "credits" ? (
              <ToolCreditsView
                data={creditsData}
                error={creditsError}
                accountFilter={creditAccountFilter}
                onAccountFilterChange={setCreditAccountFilter}
                onRefresh={async (accountId) => {
                  try {
                    await fetchCredits(accountId);
                  } catch (err) {
                    showToast((err as Error).message);
                  }
                }}
                showToast={showToast}
              />
            ) : null}

            {/* 5. 答案纠错 */}
            {view === "corrections" && correctionsData ? (
              <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
                {correctionsData.feedbacks.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[14px]">
                      <thead>
                        <tr className="border-b border-[#eeeae3] bg-[#faf9f6] text-left text-[13px] font-medium text-[#6b645c]">
                          <th className="px-5 py-3">套卷</th>
                          <th className="px-4 py-3">建议修改</th>
                          <th className="px-4 py-3">影响答卷</th>
                          <th className="px-4 py-3">状态</th>
                          <th className="px-4 py-3">提交时间</th>
                          <th className="px-5 py-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0ede7]">
                        {correctionsData.feedbacks.map((fb) => {
                          const hasPending = fb.items.some((i) => i.status === "pending");
                          return (
                            <tr key={fb.id} className="hover:bg-[#fcfbf9]">
                              <td className="px-5 py-3.5 font-medium text-[#1c1917]">{fb.paperTitle}</td>
                              <td className="px-4 py-3.5 text-[#44403c]">
                                {fb.items.map((i) => `第 ${i.question} 题 ${i.originalAnswer}→${i.suggestedAnswer}`).join("、")}
                              </td>
                              <td className="px-4 py-3.5 tabular-nums text-[#575049]">{fb.affectedAttempts} 份</td>
                              <td className="px-4 py-3.5">
                                <Badge tone={hasPending ? "warn" : "success"}>
                                  {hasPending ? "待审核" : "已处理"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3.5 tabular-nums text-[#6b645c]">{formatTime(fb.createdAt)}</td>
                              <td className="px-5 py-3.5 text-right">
                                {hasPending ? (
                                  <Button size="sm" variant="primary" onClick={() => setActiveFeedback(fb)}>
                                    核对
                                  </Button>
                                ) : (
                                  <CheckCircle2 className="ml-auto h-4 w-4 text-[#286346]" />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-16 text-center text-[15px] text-[#7a7268]">暂无答案纠错反馈</div>
                )}
              </section>
            ) : null}

            {/* 5.5 用户意见反馈 */}
            {view === "feedback" ? (
              <FeedbackView
                data={feedbackData}
                statusFilter={feedbackStatus}
                onStatusFilterChange={(next) => setFeedbackStatus(next)}
                searchQuery={feedbackQuery}
                onSearchQueryChange={(next) => setFeedbackQuery(next)}
                onRefresh={() => loadView("feedback")}
                onOpenLightbox={(img) => setLightboxImg(img)}
                showToast={showToast}
              />
            ) : null}

            {/* 6. 操作日志 */}
            {view === "audit" && auditData ? (
              <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#eeeae3] px-5 py-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void loadView("audit");
                    }}
                    className="relative"
                  >
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8c847a]" />
                    <input
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                      placeholder="搜索日志"
                      className="h-9 w-56 rounded-full border border-[#dcd6cc] bg-[#faf9f6] pr-3 pl-9 text-[14px] outline-none focus:border-[#1c1917] focus:bg-white"
                    />
                  </form>
                  <span className="text-[14px] tabular-nums text-[#6b645c]">共 {auditData.total} 条</span>
                </div>
                {auditData.items.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[14px]">
                      <thead>
                        <tr className="border-b border-[#eeeae3] bg-[#faf9f6] text-left text-[13px] font-medium text-[#6b645c]">
                          <th className="px-5 py-3">时间</th>
                          <th className="px-4 py-3">操作</th>
                          <th className="px-4 py-3">内容</th>
                          <th className="px-5 py-3">操作人</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0ede7]">
                        {auditData.items.map((row) => (
                          <tr key={row.id} className="hover:bg-[#fcfbf9]">
                            <td className="px-5 py-3.5 tabular-nums text-[#6b645c]">{formatTime(row.createdAt)}</td>
                            <td className="px-4 py-3.5">
                              <Badge>{row.action}</Badge>
                            </td>
                            <td className="px-4 py-3.5 text-[#1c1917]">{row.target}</td>
                            <td className="px-5 py-3.5 text-[#575049]">{row.operator || "系统"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-16 text-center text-[15px] text-[#7a7268]">暂无日志</div>
                )}
              </section>
            ) : null}
          </main>
        </div>
      </div>

      {/* Modal: 发放/扣减积分 */}
      <Modal
        open={grantModal.open}
        onOpenChange={(open) => setGrantModal((prev) => ({ ...prev, open }))}
        title={grantModal.nickname ? `发放积分 · ${grantModal.nickname}` : "发放 / 扣减积分"}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setGrantModal({ open: false, userId: "", nickname: "" })}>
              取消
            </Button>
            <Button type="submit" form="grant-points-form" variant="primary" size="sm">
              确认
            </Button>
          </>
        }
      >
        <form id="grant-points-form" onSubmit={submitGrant} className="space-y-4">
          {!grantModal.userId ? (
            <div className="space-y-1.5">
              <label htmlFor="grant-target-select" className="block text-[14px] font-medium text-[#44403c]">
                对象
              </label>
              <select id="grant-target-select" name="target" required className={INPUT_CLASS}>
                <option value="">选择用户</option>
                {userPool.length ? <option value="__ALL__">全部用户（{userPool.length} 人）</option> : null}
                {userPool.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.nickname}（余额 {u.pointsBalance}）
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="grant-delta-input" className="block text-[14px] font-medium text-[#44403c]">
                数量
              </label>
              <input
                id="grant-delta-input"
                type="number"
                value={grantDelta}
                onChange={(e) => setGrantDelta(e.target.value)}
                placeholder="正发负扣"
                required
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="grant-type-select" className="block text-[14px] font-medium text-[#44403c]">
                类型
              </label>
              <select
                id="grant-type-select"
                value={grantType}
                onChange={(e) => setGrantType(e.target.value)}
                className={INPUT_CLASS}
              >
                {Object.entries(POINT_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[10, 20, 50, 100, -10].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setGrantDelta(String(val))}
                className="rounded-full border border-[#dcd6cc] bg-[#faf9f6] px-3 py-1 text-[13px] font-medium text-[#44403c] hover:border-[#1c1917] hover:text-[#1c1917]"
              >
                {val > 0 ? `+${val}` : val}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="grant-reason-input" className="block text-[14px] font-medium text-[#44403c]">
              原因
            </label>
            <input
              id="grant-reason-input"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              maxLength={200}
              placeholder="例如：活动奖励"
              required
              className={INPUT_CLASS}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: 审核策略 */}
      <Modal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        title="评论审核策略"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettingsModalOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="comment-settings-form" variant="primary" size="sm">
              保存
            </Button>
          </>
        }
      >
        <form id="comment-settings-form" onSubmit={submitCommentSettings} className="space-y-5">
          <ToggleSwitch checked={settingsManual} onCheckedChange={setSettingsManual} label="全量先审后发" />
          <div className="space-y-1.5">
            <label htmlFor="keywords-textarea" className="block text-[14px] font-medium text-[#44403c]">
              敏感词（每行一个）
            </label>
            <textarea
              id="keywords-textarea"
              rows={5}
              value={settingsKeywords}
              onChange={(e) => setSettingsKeywords(e.target.value)}
              placeholder="加微卖课&#10;内部原题"
              className={TEXTAREA_CLASS}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: 积分奖励规则 */}
      <Modal
        open={rulesModalOpen}
        onOpenChange={setRulesModalOpen}
        title="默认奖励规则"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setRulesModalOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="rules-form" variant="primary" size="sm">
              保存
            </Button>
          </>
        }
      >
        {pointsData ? (
          <form id="rules-form" onSubmit={submitRules} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[14px] font-medium text-[#44403c]">完成交卷</label>
              <input name="submitAttempt" type="number" min={0} max={10000} defaultValue={pointsData.rules.submitAttempt} className={INPUT_CLASS} required />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[14px] font-medium text-[#44403c]">纠错采纳</label>
              <input name="approvedCorrection" type="number" min={0} max={10000} defaultValue={pointsData.rules.approvedCorrection} className={INPUT_CLASS} required />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[14px] font-medium text-[#44403c]">精选评论</label>
              <input name="featuredComment" type="number" min={0} max={10000} defaultValue={pointsData.rules.featuredComment} className={INPUT_CLASS} required />
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Modal: 修改密码 */}
      <Modal
        open={passwordModalOpen}
        onOpenChange={setPasswordModalOpen}
        title="修改密码"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="password-change-form" variant="primary" size="sm">
              确认修改
            </Button>
          </>
        }
      >
        <form id="password-change-form" onSubmit={submitPasswordChange} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[14px] font-medium text-[#44403c]">当前密码</label>
            <input name="currentPassword" type="password" autoComplete="current-password" required className={INPUT_CLASS} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[14px] font-medium text-[#44403c]">新密码</label>
            <input name="newPassword" type="password" minLength={8} maxLength={128} placeholder="至少 8 位" autoComplete="new-password" required className={INPUT_CLASS} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[14px] font-medium text-[#44403c]">确认新密码</label>
            <input name="confirmPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" required className={INPUT_CLASS} />
          </div>
        </form>
      </Modal>

      {/* Modal: 答案纠错审批 */}
      <Modal
        open={Boolean(activeFeedback)}
        onOpenChange={(open) => { if (!open) setActiveFeedback(null); }}
        title={activeFeedback ? activeFeedback.paperTitle : "核对纠错"}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setActiveFeedback(null)}>
              取消
            </Button>
            <Button type="submit" form="correction-review-form" variant="primary" size="sm">
              提交
            </Button>
          </>
        }
      >
        {activeFeedback ? (
          <form id="correction-review-form" onSubmit={submitCorrectionReview} className="space-y-4">
            <div className="space-y-2">
              {activeFeedback.items
                .filter((i) => i.status === "pending")
                .map((item) => (
                  <label
                    key={item.question}
                    className="flex items-start gap-3 rounded-xl border border-[#e5e0d8] bg-[#faf9f6] p-3"
                  >
                    <input type="checkbox" name="q" value={item.question} defaultChecked className="mt-1 h-4 w-4 accent-[#1c1917]" />
                    <div className="text-[14px]">
                      <div className="font-semibold text-[#1c1917]">
                        第 {item.question} 题：{item.originalAnswer} → {item.suggestedAnswer}
                      </div>
                      <p className="mt-1 text-[#575049]">{item.evidence}</p>
                    </div>
                  </label>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-[#44403c]">结论</label>
                <select name="decision" className={INPUT_CLASS}>
                  <option value="approve">通过并重算（{activeFeedback.affectedAttempts} 份）</option>
                  <option value="reject">拒绝</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-[#44403c]">奖励积分</label>
                <input
                  name="rewardPoints"
                  type="number"
                  min={0}
                  max={1000}
                  defaultValue={correctionsData?.rules.approvedCorrection ?? 20}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[14px] font-medium text-[#44403c]">理由</label>
              <textarea name="reason" rows={3} required className={TEXTAREA_CLASS} />
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Modal: 图片核查灯箱 */}
      <Modal
        open={Boolean(lightboxImg)}
        onOpenChange={(open) => { if (!open) setLightboxImg(null); }}
        title={lightboxImg ? `配图 · ${lightboxImg.title}` : "配图"}
        maxWidth="max-w-2xl"
      >
        {lightboxImg ? (
          <img src={lightboxImg.src} alt="评论配图" className="mx-auto max-h-[68vh] rounded-xl object-contain" />
        ) : null}
      </Modal>

      {/* Drawer: 用户档案 */}
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerUser ? drawerUser.user.nickname : "用户档案"}
      >
        {drawerUser ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {drawerUser.user.muted ? <Badge tone="danger">已禁言</Badge> : <Badge tone="success">正常</Badge>}
                {drawerUser.user.positionLabel ? (
                  <span className="text-[14px] text-[#575049]">{drawerUser.user.positionLabel}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" onClick={() => void openGrant(drawerUser.user.userId, drawerUser.user.nickname)}>
                  发积分
                </Button>
                <Button size="sm" variant="outline" onClick={() => void toggleMute(drawerUser.user)}>
                  {drawerUser.user.muted ? "解禁" : "禁言"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#e5e0d8] bg-[#faf9f6] p-3.5">
                <div className="text-[13px] text-[#6b645c]">积分</div>
                <div className="mt-1 text-[22px] font-semibold tabular-nums">{drawerUser.user.pointsBalance}</div>
              </div>
              <div className="rounded-xl border border-[#e5e0d8] bg-[#faf9f6] p-3.5">
                <div className="text-[13px] text-[#6b645c]">交卷</div>
                <div className="mt-1 text-[22px] font-semibold tabular-nums">{drawerUser.user.attemptCount}</div>
              </div>
              <div className="rounded-xl border border-[#e5e0d8] bg-[#faf9f6] p-3.5">
                <div className="text-[13px] text-[#6b645c]">最高分</div>
                <div className="mt-1 text-[22px] font-semibold tabular-nums">
                  {formatScore(drawerUser.user.bestScoreCents)}
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 text-[14px] font-semibold text-[#1c1917]">积分流水</h3>
              {drawerUser.ledger.length ? (
                <div className="divide-y divide-[#f0ede7] rounded-xl border border-[#e5e0d8]">
                  {drawerUser.ledger.slice(0, 8).map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14px]">
                      <span className="truncate text-[#44403c]">{l.reason}</span>
                      <span
                        className={cn(
                          "shrink-0 font-semibold tabular-nums",
                          l.delta >= 0 ? "text-[#286346]" : "text-[#a93b32]",
                        )}
                      >
                        {l.delta >= 0 ? `+${l.delta}` : l.delta}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[14px] text-[#7a7268]">暂无记录</div>
              )}
            </div>

            <div>
              <h3 className="mb-2.5 text-[14px] font-semibold text-[#1c1917]">最近成绩</h3>
              {drawerUser.attempts.length ? (
                <div className="divide-y divide-[#f0ede7] rounded-xl border border-[#e5e0d8]">
                  {drawerUser.attempts.slice(0, 8).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14px]">
                      <span className="truncate text-[#1c1917]">{a.paperTitle}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-[#1c1917]">
                        {formatScore(a.totalCents)} 分
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[14px] text-[#7a7268]">暂无成绩</div>
              )}
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-[14px] text-[#7a7268]">读取中…</div>
        )}
      </Drawer>

      {/* AlertDialog: 危险操作确认 */}
      <ConfirmDialog
        open={Boolean(confirmState?.open)}
        onOpenChange={(open) => { if (!open) setConfirmState(null); }}
        title={confirmState?.title ?? ""}
        description={confirmState?.description ?? ""}
        confirmLabel={confirmState?.confirmLabel}
        destructive={confirmState?.destructive}
        onConfirm={() => { void confirmState?.onConfirm(); }}
      />

      {/* Toast */}
      {toastMsg ? (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-full bg-[#1c1917] px-4 py-2.5 text-[14px] font-medium text-white shadow-lg"
        >
          <ShieldCheck className="h-4 w-4 text-[#86efac]" />
          <span>{toastMsg}</span>
        </div>
      ) : null}
    </Tooltip.Provider>
  );
}
