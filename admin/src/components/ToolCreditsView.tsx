import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  consoleApi,
  formatTime,
  type ToolCreditAccount,
  type ToolCreditAdjustResponse,
  type ToolCreditPackage,
  type ToolCreditRules,
  type ToolCreditsResponse,
} from "../api";
import { Badge, Button, FilterTabs, IconButton, Modal, ToggleSwitch } from "./ui";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-[#dcd6cc] bg-white px-3.5 text-[14px] text-[#1c1917] placeholder:text-[#9c948b] outline-none transition focus:border-[#1c1917] focus:ring-2 focus:ring-[#1c1917]/10";

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[#dcd6cc] bg-white p-3 text-[14px] leading-relaxed text-[#1c1917] placeholder:text-[#9c948b] outline-none transition focus:border-[#1c1917] focus:ring-2 focus:ring-[#1c1917]/10";

const VALID_ACCOUNT_REF_RE = /^(?:[1-9]\d{4,9}|[\w-]{10,80})$/;
const TOOL_ID_RE = /^[a-z][a-z0-9-]{0,39}$/;

const TOOL_LABELS: Record<string, string> = {
  "answer-sheet": "答题卡扫描",
  "photo-review": "拍照批改",
};

const SOURCE_META: Record<string, { label: string; tone: "neutral" | "success" | "warn" | "danger" }> = {
  welcome: { label: "首次赠送", tone: "success" },
  manual: { label: "人工调整", tone: "warn" },
  tool: { label: "工具消耗", tone: "neutral" },
  invite: { label: "邀请奖励", tone: "success" },
  rules: { label: "规则变更", tone: "neutral" },
};

function toolLabel(tool: string | null | undefined): string {
  if (!tool) return "—";
  return TOOL_LABELS[tool] ? `${TOOL_LABELS[tool]} (${tool})` : tool;
}

function shortId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function accountLabel(id: string, uid?: number | null): string {
  return typeof uid === "number" && Number.isInteger(uid) ? `UID ${uid}` : shortId(id);
}

function accountQueryValue(id: string, uid?: number | null): string {
  return typeof uid === "number" && Number.isInteger(uid) ? String(uid) : id;
}

function formatYuan(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatUnitYuan(cents: number, credits: number): string {
  if (!credits || credits <= 0) return "—";
  return `¥${(cents / 100 / credits).toFixed(2)}/颗`;
}

function makeRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
}

interface PackageDraft {
  key: string;
  credits: string;
  yuan: string;
}

interface CostDraft {
  tool: string;
  cost: string;
}

export function ToolCreditsView({
  data,
  error,
  accountFilter,
  onAccountFilterChange,
  onRefresh,
  showToast,
}: {
  data: ToolCreditsResponse | null;
  error?: string;
  accountFilter: string;
  onAccountFilterChange: (accountId: string) => void;
  onRefresh: (accountId?: string) => Promise<void>;
  showToast: (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState<"accounts" | "records">("accounts");
  const [searchInput, setSearchInput] = useState(accountFilter);
  const [copiedId, setCopiedId] = useState("");

  // Rules modal state
  const [rulesOpen, setRulesOpen] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesError, setRulesError] = useState("");
  const [welcomeNew, setWelcomeNew] = useState("3");
  const [welcomeExisting, setWelcomeExisting] = useState("3");
  const [costDrafts, setCostDrafts] = useState<CostDraft[]>([]);
  const [newToolId, setNewToolId] = useState("");
  const [newToolCost, setNewToolCost] = useState("1");
  const [inviteEnabled, setInviteEnabled] = useState(false);
  const [inviteGroups, setInviteGroups] = useState(false);
  const [inviteReward, setInviteReward] = useState("2");
  const [inviteMonthly, setInviteMonthly] = useState("10");
  const [inviteRegisterDays, setInviteRegisterDays] = useState("7");
  const [inviteUseDays, setInviteUseDays] = useState("7");
  const [packageDrafts, setPackageDrafts] = useState<PackageDraft[]>([]);
  const [adsReward, setAdsReward] = useState("1");
  const [adsDailyLimit, setAdsDailyLimit] = useState("2");

  // Adjust modal state
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAccountId, setAdjustAccountId] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"add" | "deduct">("add");
  const [adjustCount, setAdjustCount] = useState("3");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustRequestId, setAdjustRequestId] = useState("");
  const [adjustLastAttemptKey, setAdjustLastAttemptKey] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  useEffect(() => {
    setSearchInput(accountFilter);
  }, [accountFilter]);

  const rules = data?.rules ?? null;
  const accounts = data?.accounts ?? [];
  const records = data?.records ?? [];
  const groupApproved = Boolean(data?.groupApproved);

  const summary = useMemo(() => {
    const totalBalance = accounts.reduce((sum, item) => sum + item.balance, 0);
    const totalHeld = accounts.reduce((sum, item) => sum + item.held, 0);
    const scanCost = rules?.costs["answer-sheet"] ?? 1;
    const newScans = scanCost > 0 && rules ? Math.floor(rules.welcome.newAccount / scanCost) : 0;
    const existingScans = scanCost > 0 && rules ? Math.floor(rules.welcome.existingMember / scanCost) : 0;
    return { totalBalance, totalHeld, scanCost, newScans, existingScans };
  }, [accounts, rules]);

  const previewScanCost = useMemo(() => {
    const scanRow = costDrafts.find((item) => item.tool === "answer-sheet");
    const parsed = Number(scanRow?.cost);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  }, [costDrafts]);

  const previewNewScans = useMemo(() => {
    const welcome = Number(welcomeNew);
    if (!Number.isInteger(welcome) || welcome < 0 || previewScanCost <= 0) return null;
    return Math.floor(welcome / previewScanCost);
  }, [welcomeNew, previewScanCost]);

  const previewExistingScans = useMemo(() => {
    const welcome = Number(welcomeExisting);
    if (!Number.isInteger(welcome) || welcome < 0 || previewScanCost <= 0) return null;
    return Math.floor(welcome / previewScanCost);
  }, [welcomeExisting, previewScanCost]);

  const previewInviteBudget = useMemo(() => {
    const w = Number(welcomeNew);
    const r = Number(inviteReward);
    if (!Number.isInteger(w) || !Number.isInteger(r) || w < 0 || r < 0) return null;
    return w + r;
  }, [welcomeNew, inviteReward]);

  const selectedAdjustAccount = useMemo(() => {
    const query = adjustAccountId.trim();
    return accounts.find((item) => item.id === query || (item.uid != null && String(item.uid) === query)) ?? null;
  }, [accounts, adjustAccountId]);

  function openRulesModal() {
    if (!rules) return;
    setRulesError("");
    setWelcomeNew(String(rules.welcome.newAccount));
    setWelcomeExisting(String(rules.welcome.existingMember));
    setCostDrafts(Object.entries(rules.costs).map(([tool, cost]) => ({ tool, cost: String(cost) })));
    setNewToolId("");
    setNewToolCost("1");
    setInviteEnabled(rules.invite.enabled);
    setInviteGroups(rules.invite.groups);
    setInviteReward(String(rules.invite.reward));
    setInviteMonthly(String(rules.invite.monthlyLimit));
    setInviteRegisterDays(String(rules.invite.registerDays));
    setInviteUseDays(String(rules.invite.useDays));
    setPackageDrafts(
      rules.purchase.packages.map((pack, index) => ({
        key: `${pack.credits}-${index}`,
        credits: String(pack.credits),
        yuan: formatYuan(pack.cents),
      })),
    );
    setAdsReward(String(rules.ads.reward));
    setAdsDailyLimit(String(rules.ads.dailyLimit));
    setRulesOpen(true);
  }

  function openAdjustModal(account?: ToolCreditAccount) {
    setAdjustError("");
    const initial = account
      ? accountQueryValue(account.id, account.uid)
      : accountFilter || (accounts[0] ? accountQueryValue(accounts[0].id, accounts[0].uid) : "");
    setAdjustAccountId(initial);
    setAdjustDirection("add");
    setAdjustCount("3");
    setAdjustReason("");
    setAdjustRequestId(makeRequestId());
    setAdjustLastAttemptKey("");
    setAdjustOpen(true);
  }

  async function copyAccountId(value: string, label = "UID") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(value);
      showToast(`已复制 ${label}`);
      setTimeout(() => setCopiedId((prev) => (prev === value ? "" : prev)), 1500);
    } catch {
      showToast("复制失败，请手动选中复制");
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed && !VALID_ACCOUNT_REF_RE.test(trimmed)) {
      showToast("请输入 5 位 UID 或有效账号编号");
      return;
    }
    onAccountFilterChange(trimmed);
    void onRefresh(trimmed);
  }

  function clearFilter() {
    setSearchInput("");
    onAccountFilterChange("");
    void onRefresh("");
  }

  function filterByAccount(accountId: string) {
    setSearchInput(accountId);
    onAccountFilterChange(accountId);
    setSubTab("records");
    void onRefresh(accountId);
  }

  function addToolCostRow() {
    const id = newToolId.trim();
    const cost = Number(newToolCost);
    if (!TOOL_ID_RE.test(id)) {
      setRulesError("工具标识须以小写字母开头，仅含小写字母、数字和连字符（最多 40 字）。");
      return;
    }
    if (costDrafts.some((item) => item.tool === id)) {
      setRulesError(`工具「${id}」已在列表中。`);
      return;
    }
    if (!Number.isInteger(cost) || cost < 1 || cost > 100) {
      setRulesError("工具单次用量须为 1 到 100 的整数。");
      return;
    }
    setRulesError("");
    setCostDrafts((prev) => [...prev, { tool: id, cost: String(cost) }]);
    setNewToolId("");
    setNewToolCost("1");
  }

  function addPackageRow() {
    if (packageDrafts.length >= 20) {
      setRulesError("最多配置 20 个卷豆套餐档位。");
      return;
    }
    setRulesError("");
    setPackageDrafts((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${prev.length}`, credits: "", yuan: "" },
    ]);
  }

  async function submitRules(e: FormEvent) {
    e.preventDefault();
    setRulesError("");

    const parseIntRange = (raw: string, min: number, max: number, label: string): number | null => {
      const value = Number(raw);
      if (!raw.trim() || !Number.isInteger(value) || value < min || value > max) {
        setRulesError(`${label}须为 ${min} 到 ${max} 的整数。`);
        return null;
      }
      return value;
    };

    const newAccount = parseIntRange(welcomeNew, 0, 100, "新人赠送");
    if (newAccount === null) return;
    const existingMember = parseIntRange(welcomeExisting, 0, 100, "老卷友赠送");
    if (existingMember === null) return;

    const costs: Record<string, number> = {};
    for (const row of costDrafts) {
      if (!TOOL_ID_RE.test(row.tool)) {
        setRulesError(`工具标识「${row.tool}」格式无效。`);
        return;
      }
      const value = parseIntRange(row.cost, 1, 100, `工具 ${row.tool} 用量`);
      if (value === null) return;
      costs[row.tool] = value;
    }

    const invReward = parseIntRange(inviteReward, 0, 100, "邀请奖励");
    if (invReward === null) return;
    const invMonthly = parseIntRange(inviteMonthly, 1, 100, "每月奖励人数");
    if (invMonthly === null) return;
    const invRegDays = parseIntRange(inviteRegisterDays, 1, 30, "邀请认领天数");
    if (invRegDays === null) return;
    const invUseDays = parseIntRange(inviteUseDays, 1, 30, "首次有效使用天数");
    if (invUseDays === null) return;

    const packages: ToolCreditPackage[] = [];
    const seenCredits = new Set<number>();
    for (let i = 0; i < packageDrafts.length; i += 1) {
      const row = packageDrafts[i];
      const credits = parseIntRange(row.credits, 1, 10000, `第 ${i + 1} 档卷豆颗数`);
      if (credits === null) return;
      if (seenCredits.has(credits)) {
        setRulesError(`套餐颗数 ${credits} 重复，每档颗数须唯一。`);
        return;
      }
      seenCredits.add(credits);
      const yuan = Number(row.yuan);
      const cents = Math.round(yuan * 100);
      if (!row.yuan.trim() || !Number.isFinite(yuan) || cents < 1 || cents > 1000000) {
        setRulesError(`第 ${i + 1} 档售价须在 ¥0.01 到 ¥10000 之间。`);
        return;
      }
      packages.push({ credits, cents });
    }

    const adReward = parseIntRange(adsReward, 1, 100, "广告奖励");
    if (adReward === null) return;
    const adDaily = parseIntRange(adsDailyLimit, 1, 20, "广告每日领取上限");
    if (adDaily === null) return;

    const payload: Partial<ToolCreditRules> = {
      welcome: { newAccount, existingMember },
      costs,
      invite: {
        enabled: groupApproved ? inviteEnabled : false,
        groups: groupApproved ? inviteGroups : false,
        reward: invReward,
        monthlyLimit: invMonthly,
        registerDays: invRegDays,
        useDays: invUseDays,
      },
      purchase: {
        directPurchase: false,
        tokenRecharge: false,
        packages,
      },
      ads: {
        enabled: false,
        reward: adReward,
        dailyLimit: adDaily,
      },
    };

    setSavingRules(true);
    try {
      await consoleApi<{ rules: ToolCreditRules }>("tool-credits/rules", payload);
      setRulesOpen(false);
      showToast("卷豆规则已更新");
      await onRefresh(accountFilter);
    } catch (err) {
      setRulesError((err as Error).message);
    } finally {
      setSavingRules(false);
    }
  }

  async function submitAdjust(e: FormEvent) {
    e.preventDefault();
    setAdjustError("");
    const accountId = adjustAccountId.trim();
    if (!VALID_ACCOUNT_REF_RE.test(accountId)) {
      setAdjustError("请输入有效的 5 位 UID 或账号编号。");
      return;
    }
    const rawCount = Number(adjustCount);
    if (!Number.isInteger(rawCount) || rawCount < 1 || rawCount > 10000) {
      setAdjustError("调整颗数须为 1 到 10000 的整数。");
      return;
    }
    const amount = adjustDirection === "add" ? rawCount : -rawCount;
    const reason = adjustReason.trim();
    if (!reason || reason.length > 200) {
      setAdjustError("请填写调整原因（最多 200 字）。");
      return;
    }

    // 同参数重试复用同一个 requestId；如果上次已发过且这次改了参数，生成新 requestId 避免 409。
    const attemptKey = JSON.stringify({ accountId, amount, reason });
    let requestId = adjustRequestId || makeRequestId();
    if (adjustLastAttemptKey && adjustLastAttemptKey !== attemptKey) {
      requestId = makeRequestId();
      setAdjustRequestId(requestId);
    }
    setAdjustLastAttemptKey(attemptKey);

    setAdjustSubmitting(true);
    try {
      const res = await consoleApi<ToolCreditAdjustResponse>("tool-credits/adjust", {
        accountId,
        amount,
        reason,
        requestId,
      });
      setAdjustOpen(false);
      showToast(`${amount > 0 ? `已补发 +${amount}` : `已扣回 ${amount}`} 颗 · 当前余额 ${res.balance} 颗`);
      await onRefresh(accountFilter);
    } catch (err) {
      const message = (err as Error).message;
      setAdjustError(message);
    } finally {
      setAdjustSubmitting(false);
    }
  }

  if (!data || !rules) {
    if (error) {
      return (
        <div
          data-view="tool-credits"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#e5e0d8] bg-white px-6 py-16 text-center"
        >
          <p className="text-[15px] font-medium text-[#1c1917]">{error}</p>
          <p className="max-w-md text-[13.5px] text-[#7a7268]">
            请确认服务端已配置卷豆数据库连接并完成迁移，然后重试。
          </p>
          <Button size="sm" variant="outline" onClick={() => void onRefresh(accountFilter)}>
            重新加载
          </Button>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-[#e5e0d8] bg-white py-16 text-center text-[15px] text-[#7a7268]">
        正在加载卷豆账本…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-view="tool-credits">
      {/* 顶部概览指标卡 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
          <div className="text-[14px] font-medium text-[#6b645c]">
            {accountFilter ? "筛选账号" : "近期卷豆账号"}
          </div>
          <div className="mt-2 text-[30px] font-semibold leading-none tabular-nums text-[#1c1917]">
            {accounts.length}
          </div>
          <div className="mt-2 text-[12.5px] text-[#7a7268]">
            {accountFilter ? "精确匹配结果" : "最多展示最近 50 个账号"}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
          <div className="text-[14px] font-medium text-[#6b645c]">可用卷豆合计</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-semibold leading-none tabular-nums text-[#1c1917]">
              {summary.totalBalance}
            </span>
            <span className="text-[13px] text-[#7a7268]">颗</span>
          </div>
          <div className="mt-2 text-[12.5px] text-[#7a7268]">与运营积分独立记账</div>
        </div>

        <div className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
          <div className="text-[14px] font-medium text-[#6b645c]">占用中卷豆</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-[30px] font-semibold leading-none tabular-nums",
                summary.totalHeld > 0 ? "text-[#945c17]" : "text-[#1c1917]",
              )}
            >
              {summary.totalHeld}
            </span>
            <span className="text-[13px] text-[#7a7268]">颗</span>
          </div>
          <div className="mt-2 text-[12.5px] text-[#7a7268]">工具执行中锁定，失败自动退回</div>
        </div>

        <div className="rounded-2xl border border-[#e6d7b9] bg-[#fcf8ef] p-5">
          <div className="text-[14px] font-medium text-[#7b6238]">扫描定价 · 新人体验</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-semibold leading-none tabular-nums text-[#1c1917]">
              {summary.newScans}
            </span>
            <span className="text-[13px] font-medium text-[#7b6238]">张可免费扫</span>
          </div>
          <div className="mt-2 text-[12.5px] tabular-nums text-[#7b6238]">
            新人送 {rules.welcome.newAccount} 颗 · 每张用 {summary.scanCost} 颗
          </div>
        </div>
      </div>

      {/* 规则与定价摘要条 */}
      <section className="space-y-4 rounded-2xl border border-[#e5e0d8] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#9e6d2b]" />
            <h2 className="text-[15px] font-semibold text-[#1c1917]">当前卷豆规则</h2>
            <Badge tone={groupApproved && rules.invite.enabled && rules.invite.groups ? "success" : "neutral"}>
              {groupApproved && rules.invite.enabled && rules.invite.groups ? "微信群邀请已开启" : "邀请未开启"}
            </Badge>
            <Badge tone="neutral">购豆待开通</Badge>
            <Badge tone="neutral">激励视频待开通</Badge>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              data-action="open-credit-rules"
              onClick={openRulesModal}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>规则与定价</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-action="open-credit-adjust"
              onClick={() => openAdjustModal()}
            >
              <Plus className="h-4 w-4" />
              <span>补发 / 扣回</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-[13.5px] sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-3.5 py-2.5">
            <div className="text-[12px] text-[#7a7268]">首登赠送</div>
            <div className="mt-0.5 font-medium tabular-nums text-[#1c1917]">
              新人 {rules.welcome.newAccount} 颗 · 老卷友 {rules.welcome.existingMember} 颗
            </div>
          </div>

          <div className="rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-3.5 py-2.5">
            <div className="text-[12px] text-[#7a7268]">工具单次用量</div>
            <div className="mt-0.5 truncate font-medium tabular-nums text-[#1c1917]">
              {Object.entries(rules.costs)
                .map(([k, v]) => `${TOOL_LABELS[k] ?? k} ${v} 颗`)
                .join(" · ")}
            </div>
          </div>

          <div className="rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-3.5 py-2.5">
            <div className="text-[12px] text-[#7a7268]">邀请奖励配置</div>
            <div className="mt-0.5 font-medium tabular-nums text-[#1c1917]">
              {rules.invite.reward} 颗/人 · 月上限 {rules.invite.monthlyLimit} 位
            </div>
          </div>

          <div className="rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-3.5 py-2.5">
            <div className="text-[12px] text-[#7a7268]">试价套餐 / 广告</div>
            <div className="mt-0.5 font-medium tabular-nums text-[#1c1917]">
              {rules.purchase.packages.length} 档试价 · 广告 {rules.ads.reward} 颗/次
            </div>
          </div>
        </div>
      </section>

      {/* 账号与流水主面板 */}
      <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae3] px-5 py-4">
          <FilterTabs
            value={subTab}
            onChange={(v) => setSubTab(v as "accounts" | "records")}
            items={[
              { value: "accounts", label: "卷豆账号", count: accounts.length },
              { value: "records", label: "卷豆流水", count: records.length },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8c847a]" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="按 5 位 UID 或账号编号筛选"
                  aria-label="按 UID 或账号编号筛选"
                  data-credit-account-search
                  className="h-9 w-64 rounded-full border border-[#dcd6cc] bg-[#faf9f6] pr-8 pl-9 text-[13.5px] outline-none focus:border-[#1c1917] focus:bg-white"
                />
                {searchInput ? (
                  <button
                    type="button"
                    aria-label="清空筛选"
                    onClick={clearFilter}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#8c847a] hover:text-[#1c1917]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <Button type="submit" size="sm" variant="outline">
                查询
              </Button>
            </form>
          </div>
        </div>

        {accountFilter ? (
          <div className="flex items-center justify-between gap-3 border-b border-[#eeeae3] bg-[#faf6ee] px-5 py-2.5 text-[13px] text-[#6d5630]">
            <div className="flex items-center gap-2 truncate">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                当前仅查看账号 <code className="font-mono font-medium">{accountFilter}</code>
              </span>
            </div>
            <button
              type="button"
              onClick={clearFilter}
              className="shrink-0 font-medium text-[#1c1917] underline-offset-2 hover:underline"
            >
              查看全部
            </button>
          </div>
        ) : null}

        {subTab === "accounts" ? (
          accounts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-[#eeeae3] bg-[#faf9f6] text-left text-[13px] font-medium text-[#6b645c]">
                    <th className="px-5 py-3">账号 UID</th>
                    <th className="px-4 py-3">身份</th>
                    <th className="px-4 py-3">可用余额</th>
                    <th className="px-4 py-3">占用中</th>
                    <th className="px-4 py-3">创建时间</th>
                    <th className="px-5 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ede7]">
                  {accounts.map((acc) => {
                    const copyVal = accountQueryValue(acc.id, acc.uid);
                    return (
                    <tr key={acc.id} className="hover:bg-[#fcfbf9]" data-credit-account-row={acc.id}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <code
                            title={acc.id}
                            className="rounded-lg bg-[#f3efe8] px-2.5 py-0.5 font-mono text-[13px] font-medium text-[#1c1917]"
                          >
                            {accountLabel(acc.id, acc.uid)}
                          </code>
                          <IconButton
                            label="复制 UID"
                            onClick={() => void copyAccountId(copyVal, acc.uid ? `UID ${acc.uid}` : "账号编号")}
                          >
                            {copiedId === copyVal ? (
                              <Check className="h-3.5 w-3.5 text-[#286346]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </IconButton>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {acc.legacyMember ? (
                          <Badge tone="warn">老卷友</Badge>
                        ) : (
                          <Badge tone="neutral">新账号</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold tabular-nums text-[#1c1917]">
                        {acc.balance} 颗
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {acc.held > 0 ? (
                          <Badge tone="warn">{acc.held} 颗占用</Badge>
                        ) : (
                          <span className="text-[#8c847a]">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-[#6b645c]">
                        {formatTime(acc.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => filterByAccount(copyVal)}
                          >
                            流水
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            data-action="adjust-account"
                            onClick={() => openAdjustModal(acc)}
                          >
                            补发 / 扣回
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-[15px] text-[#7a7268]">
              {accountFilter ? "未找到匹配的卷豆账号" : "暂无卷豆账号，小程序用户首次登录后将自动创建"}
            </div>
          )
        ) : records.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-[#eeeae3] bg-[#faf9f6] text-left text-[13px] font-medium text-[#6b645c]">
                  <th className="px-5 py-3">时间</th>
                  <th className="px-4 py-3">账号</th>
                  <th className="px-4 py-3">来源</th>
                  <th className="px-4 py-3">变动</th>
                  <th className="px-4 py-3">余额</th>
                  <th className="px-4 py-3">工具 / 原因</th>
                  <th className="px-5 py-3">操作人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede7]">
                {records.map((row) => {
                  const meta = SOURCE_META[row.source] ?? { label: row.source, tone: "neutral" as const };
                  return (
                    <tr key={row.id} className="hover:bg-[#fcfbf9]" data-credit-record-row={row.id}>
                      <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-[#6b645c]">
                        {formatTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.accountId ? (
                          <button
                            type="button"
                            onClick={() => filterByAccount(accountQueryValue(row.accountId!, row.accountUid))}
                            title={row.accountId}
                            className="rounded-md bg-[#f3efe8] px-2 py-0.5 font-mono text-[12.5px] text-[#44403c] transition hover:bg-[#e8e1d5] hover:text-[#1c1917]"
                          >
                            {accountLabel(row.accountId, row.accountUid)}
                          </button>
                        ) : (
                          <span className="text-[13px] text-[#8c847a]">系统规则</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3.5 font-semibold whitespace-nowrap tabular-nums",
                          row.amount > 0
                            ? "text-[#286346]"
                            : row.amount < 0
                              ? "text-[#a93b32]"
                              : "text-[#8c847a]",
                        )}
                      >
                        {row.amount > 0 ? `+${row.amount}` : row.amount < 0 ? row.amount : "—"}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-[#44403c]">
                        {row.balanceAfter === null ? "—" : `${row.balanceAfter}`}
                      </td>
                      <td className="max-w-[300px] px-4 py-3.5 text-[#44403c]">
                        <div className="truncate font-medium text-[#1c1917]">{row.reason}</div>
                        {row.tool ? (
                          <div className="mt-0.5 text-[12px] text-[#7a7268]">{toolLabel(row.tool)}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-[#575049]">
                        {row.operator || "系统"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-[15px] text-[#7a7268]">暂无卷豆流水</div>
        )}
      </section>

      {/* Modal: 卷豆规则与定价 */}
      <Modal
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        title="卷豆规则与定价"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setRulesOpen(false)}>
              取消
            </Button>
            <Button
              type="submit"
              form="credit-rules-form"
              variant="primary"
              size="sm"
              disabled={savingRules}
            >
              {savingRules ? "保存中…" : "保存规则"}
            </Button>
          </>
        }
      >
        <form id="credit-rules-form" onSubmit={submitRules} className="space-y-6">
          {/* 实时试算预览 */}
          <div className="rounded-2xl border border-[#e6d7b9] bg-[#fcf8ef] p-4">
            <div className="text-[13px] font-medium text-[#7b6238]">规则生效预览（按答题卡扫描换算）</div>
            <div className="mt-2.5 grid grid-cols-3 gap-3 text-[13.5px]">
              <div>
                <div className="text-[12px] text-[#8a724a]">新人免费可扫</div>
                <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-[#1c1917]" data-preview="new-scans">
                  {previewNewScans === null ? "—" : `${previewNewScans} 张`}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[#8a724a]">老卷友免费可扫</div>
                <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-[#1c1917]" data-preview="existing-scans">
                  {previewExistingScans === null ? "—" : `${previewExistingScans} 张`}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[#8a724a]">有效邀请单次发放</div>
                <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-[#1c1917]">
                  {previewInviteBudget === null ? "—" : `${previewInviteBudget} 颗`}
                </div>
              </div>
            </div>
          </div>

          {rulesError ? (
            <p role="alert" className="rounded-xl bg-[#fbe9e7] px-3.5 py-2.5 text-[13.5px] text-[#a93b32]">
              {rulesError}
            </p>
          ) : null}

          {/* 1. 首登赠送 */}
          <div className="space-y-3">
            <h3 className="text-[14px] font-semibold text-[#1c1917]">首次登录赠送</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="rule-welcome-new" className="block text-[13.5px] font-medium text-[#44403c]">
                  新人赠送（颗）
                </label>
                <input
                  id="rule-welcome-new"
                  type="number"
                  min={0}
                  max={100}
                  value={welcomeNew}
                  onChange={(e) => setWelcomeNew(e.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rule-welcome-existing" className="block text-[13.5px] font-medium text-[#44403c]">
                  老卷友首次绑定（颗）
                </label>
                <input
                  id="rule-welcome-existing"
                  type="number"
                  min={0}
                  max={100}
                  value={welcomeExisting}
                  onChange={(e) => setWelcomeExisting(e.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. 工具单次用量 */}
          <div className="space-y-3 border-t border-[#eeeae3] pt-5">
            <h3 className="text-[14px] font-semibold text-[#1c1917]">付费工具用量</h3>
            <div className="space-y-2">
              {costDrafts.map((row, index) => (
                <div
                  key={row.tool}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[#1c1917]">
                      {TOOL_LABELS[row.tool] ?? row.tool}
                    </div>
                    <code className="font-mono text-[12px] text-[#7a7268]">{row.tool}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`${row.tool} 用量`}
                      data-tool-cost={row.tool}
                      type="number"
                      min={1}
                      max={100}
                      value={row.cost}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCostDrafts((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, cost: value } : item)),
                        );
                      }}
                      className="h-9 w-24 rounded-xl border border-[#dcd6cc] bg-white px-3 text-right text-[14px] tabular-nums outline-none focus:border-[#1c1917]"
                      required
                    />
                    <span className="text-[13px] text-[#6b645c]">颗 / 次</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newToolId}
                onChange={(e) => setNewToolId(e.target.value)}
                placeholder="新增工具标识，如 photo-review"
                className="h-9 flex-1 rounded-xl border border-[#dcd6cc] bg-white px-3 text-[13.5px] outline-none focus:border-[#1c1917]"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={newToolCost}
                onChange={(e) => setNewToolCost(e.target.value)}
                aria-label="新工具用量"
                className="h-9 w-20 rounded-xl border border-[#dcd6cc] bg-white px-3 text-right text-[13.5px] tabular-nums outline-none focus:border-[#1c1917]"
              />
              <Button type="button" size="sm" variant="outline" onClick={addToolCostRow}>
                添加工具
              </Button>
            </div>
          </div>

          {/* 3. 邀请奖励 */}
          <div className="space-y-3 border-t border-[#eeeae3] pt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[#1c1917]">邀请奖励</h3>
              <Badge tone={groupApproved ? "success" : "warn"}>
                {groupApproved ? "微信群校验器已就绪" : "待微信群提审与校验器接入"}
              </Badge>
            </div>
            <div className={cn("rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-4 py-2.5", !groupApproved && "opacity-65")}>
              <div className={!groupApproved ? "pointer-events-none" : undefined}>
                <ToggleSwitch
                  checked={groupApproved && inviteEnabled}
                  onCheckedChange={setInviteEnabled}
                  label="启用邀请奖励活动"
                />
                <ToggleSwitch
                  checked={groupApproved && inviteGroups}
                  onCheckedChange={setInviteGroups}
                  label="开放微信群邀请渠道"
                />
              </div>
              {!groupApproved ? (
                <p className="mt-1 text-[12.5px] text-[#7a7268]">
                  需在服务端配置审批标识与群访问校验器后方可打开渠道开关，当前可预配置奖励参数。
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <label htmlFor="rule-invite-reward" className="block text-[13px] font-medium text-[#44403c]">
                  每次奖励（颗）
                </label>
                <input
                  id="rule-invite-reward"
                  type="number"
                  min={0}
                  max={100}
                  value={inviteReward}
                  onChange={(e) => setInviteReward(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rule-invite-monthly" className="block text-[13px] font-medium text-[#44403c]">
                  每月人数上限
                </label>
                <input
                  id="rule-invite-monthly"
                  type="number"
                  min={1}
                  max={100}
                  value={inviteMonthly}
                  onChange={(e) => setInviteMonthly(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rule-invite-reg-days" className="block text-[13px] font-medium text-[#44403c]">
                  认领天数
                </label>
                <input
                  id="rule-invite-reg-days"
                  type="number"
                  min={1}
                  max={30}
                  value={inviteRegisterDays}
                  onChange={(e) => setInviteRegisterDays(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rule-invite-use-days" className="block text-[13px] font-medium text-[#44403c]">
                  有效使用天数
                </label>
                <input
                  id="rule-invite-use-days"
                  type="number"
                  min={1}
                  max={30}
                  value={inviteUseDays}
                  onChange={(e) => setInviteUseDays(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* 4. 购豆试价套餐 */}
          <div className="space-y-3 border-t border-[#eeeae3] pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-[#1c1917]">购豆档位</h3>
                <Badge tone="neutral">道具直购 / 代币充值待微信开通</Badge>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addPackageRow}>
                <Plus className="h-3.5 w-3.5" />
                <span>新增档位</span>
              </Button>
            </div>
            <div className="space-y-2">
              {packageDrafts.map((pack, index) => {
                const c = Number(pack.credits);
                const cents = Math.round(Number(pack.yuan) * 100);
                return (
                  <div
                    key={pack.key}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_36px] items-center gap-2 rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-3 py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        placeholder="颗数"
                        aria-label={`第 ${index + 1} 档颗数`}
                        value={pack.credits}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPackageDrafts((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, credits: value } : item)),
                          );
                        }}
                        className="h-9 w-full rounded-lg border border-[#dcd6cc] bg-white px-2.5 text-[13.5px] tabular-nums outline-none focus:border-[#1c1917]"
                      />
                      <span className="shrink-0 text-[13px] text-[#6b645c]">颗</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-[13px] text-[#6b645c]">¥</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        max={10000}
                        placeholder="售价"
                        aria-label={`第 ${index + 1} 档售价`}
                        value={pack.yuan}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPackageDrafts((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, yuan: value } : item)),
                          );
                        }}
                        className="h-9 w-full rounded-lg border border-[#dcd6cc] bg-white px-2.5 text-[13.5px] tabular-nums outline-none focus:border-[#1c1917]"
                      />
                    </div>
                    <div className="text-right text-[12.5px] tabular-nums text-[#6b645c]">
                      {Number.isFinite(cents) && cents > 0 && Number.isInteger(c) && c > 0
                        ? formatUnitYuan(cents, c)
                        : "—"}
                    </div>
                    <button
                      type="button"
                      aria-label={`删除第 ${index + 1} 档`}
                      onClick={() => setPackageDrafts((prev) => prev.filter((_, i) => i !== index))}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[#7a7268] hover:bg-[#fbe9e7] hover:text-[#a93b32]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. 激励视频 */}
          <div className="space-y-3 border-t border-[#eeeae3] pt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[#1c1917]">激励视频广告</h3>
              <Badge tone="neutral">流量主开通后启用</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="rule-ads-reward" className="block text-[13.5px] font-medium text-[#44403c]">
                  单次完播奖励（颗）
                </label>
                <input
                  id="rule-ads-reward"
                  type="number"
                  min={1}
                  max={100}
                  value={adsReward}
                  onChange={(e) => setAdsReward(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rule-ads-daily" className="block text-[13.5px] font-medium text-[#44403c]">
                  每日领取上限（次）
                </label>
                <input
                  id="rule-ads-daily"
                  type="number"
                  min={1}
                  max={20}
                  value={adsDailyLimit}
                  onChange={(e) => setAdsDailyLimit(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: 人工补发 / 扣回卷豆 */}
      <Modal
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title="人工补发 / 扣回卷豆"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAdjustOpen(false)}>
              取消
            </Button>
            <Button
              type="submit"
              form="credit-adjust-form"
              variant="primary"
              size="sm"
              disabled={adjustSubmitting}
            >
              {adjustSubmitting ? "提交中…" : adjustDirection === "add" ? "确认补发" : "确认扣回"}
            </Button>
          </>
        }
      >
        <form id="credit-adjust-form" onSubmit={submitAdjust} className="space-y-4">
          {adjustError ? (
            <p role="alert" className="rounded-xl bg-[#fbe9e7] px-3.5 py-2.5 text-[13.5px] text-[#a93b32]">
              {adjustError}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="adjust-account-input" className="block text-[14px] font-medium text-[#44403c]">
              账号 UID（或内部编号）
            </label>
            <input
              id="adjust-account-input"
              value={adjustAccountId}
              onChange={(e) => setAdjustAccountId(e.target.value)}
              placeholder="输入 5 位 UID（如 10001），或从下方快捷选择"
              required
              className={cn(INPUT_CLASS, "font-mono text-[13px]")}
            />
            {accounts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {accounts.slice(0, 5).map((acc) => {
                  const val = accountQueryValue(acc.id, acc.uid);
                  const active = adjustAccountId === val || adjustAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAdjustAccountId(val)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-mono text-[12px] transition",
                        active
                          ? "border-[#1c1917] bg-[#1c1917] text-white"
                          : "border-[#e5e0d8] bg-[#faf9f6] text-[#575049] hover:border-[#cfc8bc]",
                      )}
                    >
                      {accountLabel(acc.id, acc.uid)} · {acc.balance} 颗
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="block text-[14px] font-medium text-[#44403c]">调整方向</span>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#e5e0d8] bg-[#f3efe8] p-1">
                <button
                  type="button"
                  data-adjust-dir="add"
                  onClick={() => setAdjustDirection("add")}
                  className={cn(
                    "h-8 rounded-lg text-[13.5px] font-medium transition",
                    adjustDirection === "add"
                      ? "bg-white text-[#286346] shadow-xs"
                      : "text-[#575049] hover:text-[#1c1917]",
                  )}
                >
                  补发 (+)
                </button>
                <button
                  type="button"
                  data-adjust-dir="deduct"
                  onClick={() => setAdjustDirection("deduct")}
                  className={cn(
                    "h-8 rounded-lg text-[13.5px] font-medium transition",
                    adjustDirection === "deduct"
                      ? "bg-white text-[#a93b32] shadow-xs"
                      : "text-[#575049] hover:text-[#1c1917]",
                  )}
                >
                  扣回 (-)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adjust-count-input" className="block text-[14px] font-medium text-[#44403c]">
                颗数（1–10000）
              </label>
              <input
                id="adjust-count-input"
                type="number"
                min={1}
                max={10000}
                value={adjustCount}
                onChange={(e) => setAdjustCount(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {selectedAdjustAccount ? (
            <div className="flex items-center justify-between rounded-xl border border-[#eeeae3] bg-[#faf9f6] px-3.5 py-2.5 text-[13px] text-[#575049]">
              <span>当前可用 {selectedAdjustAccount.balance} 颗{selectedAdjustAccount.held > 0 ? `（占用 ${selectedAdjustAccount.held} 颗）` : ""}</span>
              <span className="font-semibold tabular-nums text-[#1c1917]">
                调整后预估：
                {selectedAdjustAccount.balance +
                  (adjustDirection === "add" ? 1 : -1) * (Number.isInteger(Number(adjustCount)) ? Number(adjustCount) : 0)}{" "}
                颗
              </span>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="adjust-reason-input" className="block text-[14px] font-medium text-[#44403c]">
                原因（必填，仅管理员与审计可见）
              </label>
              <span className="text-[12px] tabular-nums text-[#8c847a]">{adjustReason.trim().length}/200</span>
            </div>
            <textarea
              id="adjust-reason-input"
              rows={3}
              maxLength={200}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="例如：实拍模糊重扫补偿、异常退款扣回"
              required
              className={TEXTAREA_CLASS}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
