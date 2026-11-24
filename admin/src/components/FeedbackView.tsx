import { useState, type FormEvent } from "react";
import {
  Bell,
  BellOff,
  Check,
  Copy,
  MessageSquareReply,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import {
  consoleApi,
  formatTime,
  type AdminUserFeedback,
  type FeedbackNotifyView,
  type UserFeedbackResponse,
} from "../api";
import { Badge, Button, ConfirmDialog, FilterTabs, IconButton, Modal, ToggleSwitch } from "./ui";

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-[#dcd6cc] bg-white px-3.5 text-[14px] text-[#1c1917] placeholder:text-[#9c948b] outline-none transition focus:border-[#1c1917] focus:ring-2 focus:ring-[#1c1917]/10";

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[#dcd6cc] bg-white p-3 text-[14px] leading-relaxed text-[#1c1917] placeholder:text-[#9c948b] outline-none transition focus:border-[#1c1917] focus:ring-2 focus:ring-[#1c1917]/10";

const STATUS_BADGE: Record<string, { label: string; tone: "warn" | "neutral" | "success" | "danger" }> = {
  pending: { label: "待处理", tone: "warn" },
  processing: { label: "处理中", tone: "neutral" },
  replied: { label: "已回复", tone: "success" },
  closed: { label: "已关闭", tone: "neutral" },
};

const CATEGORY_TONE: Record<string, "danger" | "warn" | "neutral" | "success"> = {
  bug: "danger",
  paper: "warn",
  suggestion: "success",
  other: "neutral",
};

export function FeedbackView({
  data,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onRefresh,
  onOpenLightbox,
  showToast,
}: {
  data: UserFeedbackResponse | null;
  statusFilter: string;
  onStatusFilterChange: (next: string) => void;
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  onRefresh: () => Promise<void>;
  onOpenLightbox: (img: { src: string; title: string }) => void;
  showToast: (msg: string) => void;
}) {
  const [activeItem, setActiveItem] = useState<AdminUserFeedback | null>(null);
  const [replyText, setReplyText] = useState("");
  const [nextStatus, setNextStatus] = useState<AdminUserFeedback["status"]>("replied");
  const [savingReply, setSavingReply] = useState(false);
  const [copiedContact, setCopiedContact] = useState(false);

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const [testingNotify, setTestingNotify] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [mpState, setMpState] = useState<"formal" | "trial" | "developer">("formal");
  const [jumpPage, setJumpPage] = useState("pages/admin/admin");
  const [categoryKey, setCategoryKey] = useState("thing1");
  const [contentKey, setContentKey] = useState("thing2");
  const [timeKey, setTimeKey] = useState("time3");
  const [userKey, setUserKey] = useState("thing4");

  const [deleteTarget, setDeleteTarget] = useState<AdminUserFeedback | null>(null);
  const [removeSubId, setRemoveSubId] = useState<string>("");

  function openHandleModal(item: AdminUserFeedback) {
    setActiveItem(item);
    setReplyText(item.reply?.text || "");
    setNextStatus(item.status === "pending" ? "replied" : item.status);
    setCopiedContact(false);
  }

  function openNotifyModal() {
    const notify = data?.notify;
    if (notify) {
      setNotifyEnabled(notify.enabled);
      setTemplateId(notify.templateId || "");
      setMpState(notify.miniprogramState || "formal");
      setJumpPage(notify.page || "pages/admin/admin");
      setCategoryKey(notify.fieldMap?.categoryKey ?? "thing1");
      setContentKey(notify.fieldMap?.contentKey ?? "thing2");
      setTimeKey(notify.fieldMap?.timeKey ?? "time3");
      setUserKey(notify.fieldMap?.userKey ?? "thing4");
    }
    setNotifyOpen(true);
  }

  async function handleSaveReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeItem || savingReply) return;
    setSavingReply(true);
    try {
      await consoleApi("feedback/update", {
        feedbackId: activeItem.id,
        status: nextStatus,
        replyText: replyText.trim(),
      });
      setActiveItem(null);
      showToast("已保存处理结果");
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSavingReply(false);
    }
  }

  async function handleDeleteFeedback() {
    if (!deleteTarget) return;
    try {
      await consoleApi("feedback/delete", { feedbackId: deleteTarget.id });
      if (activeItem?.id === deleteTarget.id) setActiveItem(null);
      setDeleteTarget(null);
      showToast("反馈已删除");
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function handleSaveNotify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingNotify) return;
    setSavingNotify(true);
    try {
      await consoleApi<{ ok: boolean; notify: FeedbackNotifyView }>("feedback/notify-settings", {
        enabled: notifyEnabled,
        templateId: templateId.trim(),
        miniprogramState: mpState,
        page: jumpPage.trim() || "pages/admin/admin",
        fieldMap: {
          categoryKey: categoryKey.trim(),
          contentKey: contentKey.trim(),
          timeKey: timeKey.trim(),
          userKey: userKey.trim(),
        },
      });
      showToast("微信提醒配置已保存");
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSavingNotify(false);
    }
  }

  async function handleTestNotify(subscriberId = "") {
    if (testingNotify) return;
    setTestingNotify(true);
    try {
      const res = await consoleApi<{ ok: boolean; sent: number; failed: number; skippedReason?: string; lastError?: string }>(
        "feedback/notify-test",
        { subscriberId },
      );
      if (res.sent > 0) {
        showToast(`测试提醒已发送（成功 ${res.sent} 条）`);
      } else {
        showToast(res.lastError || res.skippedReason || "未能发送测试提醒");
      }
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setTestingNotify(false);
    }
  }

  async function handleRemoveSubscriber() {
    if (!removeSubId) return;
    try {
      await consoleApi("feedback/subscribers/remove", { subscriberId: removeSubId });
      setRemoveSubId("");
      showToast("已移除该订阅管理员");
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  if (!data) return null;

  const { summary, notify, items } = data;
  const notifyReady = notify.enabled && notify.wechatReady && notify.templateConfigured && notify.totalQuota > 0;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae3] px-5 py-4">
          <FilterTabs
            value={statusFilter}
            onChange={onStatusFilterChange}
            items={[
              { value: "pending", label: "待处理", count: summary.pending },
              { value: "processing", label: "处理中", count: summary.processing },
              { value: "replied", label: "已回复", count: summary.replied },
              { value: "closed", label: "已关闭", count: summary.closed },
              { value: "all", label: "全部", count: summary.total },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onRefresh();
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8c847a]" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="搜索反馈内容或联系方式"
                className="h-9 w-56 rounded-full border border-[#dcd6cc] bg-[#faf9f6] pr-3 pl-9 text-[14px] outline-none focus:border-[#1c1917] focus:bg-white"
              />
            </form>

            <Button size="sm" variant="outline" onClick={openNotifyModal}>
              {notifyReady ? (
                <Bell className="h-4 w-4 text-[#286346]" />
              ) : (
                <BellOff className="h-4 w-4 text-[#9c948b]" />
              )}
              <span>
                {!notify.enabled
                  ? "提醒已关闭"
                  : !notify.templateConfigured
                    ? "配置微信提醒"
                    : `微信提醒 · 剩余 ${notify.totalQuota} 次`}
              </span>
            </Button>
          </div>
        </div>

        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-[#eeeae3] bg-[#faf9f6] text-left text-[13px] font-medium text-[#6b645c]">
                  <th className="px-5 py-3">类型</th>
                  <th className="px-4 py-3">反馈内容</th>
                  <th className="px-4 py-3">提交者 / 联系方式</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede7]">
                {items.map((item) => {
                  const statusMeta = STATUS_BADGE[item.status] || { label: item.statusLabel, tone: "neutral" as const };
                  const catTone = CATEGORY_TONE[item.category] || "neutral";
                  return (
                    <tr key={item.id} className="align-top hover:bg-[#fcfbf9]">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge tone={catTone}>{item.categoryLabel}</Badge>
                      </td>
                      <td className="max-w-[420px] px-4 py-3.5">
                        <p className="whitespace-pre-wrap break-words text-[#1c1917] leading-relaxed">
                          {item.content}
                        </p>
                        {item.images.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.images.map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => onOpenLightbox({ src: img.dataUri, title: img.alt || `反馈截图 ${idx + 1}` })}
                                className="group relative h-14 w-14 overflow-hidden rounded-lg border border-[#e5e0d8] bg-[#faf9f6]"
                                title="点击查看大图"
                              >
                                <img src={img.dataUri} alt={img.alt || ""} className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {item.reply?.text ? (
                          <div className="mt-2.5 rounded-xl bg-[#f7f4ee] px-3 py-2 text-[13px] text-[#44403c]">
                            <span className="font-medium text-[#1c1917]">回复：</span>
                            <span>{item.reply.text}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-[#44403c]">
                        <div className="font-medium text-[#1c1917]">{item.nickname}</div>
                        {item.contact ? (
                          <div className="mt-0.5 text-[13px] text-[#6b645c] break-all">{item.contact}</div>
                        ) : (
                          <div className="mt-0.5 text-[12px] text-[#a0988e]">未留联系方式</div>
                        )}
                        {item.clientMeta?.envVersion ? (
                          <div className="mt-1 text-[12px] text-[#8c847a]">
                            {item.clientMeta.platform || "miniprogram"} · {item.clientMeta.envVersion}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                        {item.notifySummary ? (
                          <div
                            className="mt-1 text-[12px] text-[#7a7268]"
                            title={item.notifySummary.lastError || item.notifySummary.skippedReason || ""}
                          >
                            {item.notifySummary.sent > 0
                              ? `已推送 ${item.notifySummary.sent} 人`
                              : item.notifySummary.attempted > 0
                                ? "推送失败"
                                : "未推送"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums text-[#6b645c]">
                        {formatTime(item.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={item.status === "pending" ? "primary" : "outline"}
                            onClick={() => openHandleModal(item)}
                          >
                            <MessageSquareReply className="h-3.5 w-3.5" />
                            <span>{item.reply?.text ? "编辑回复" : "处理"}</span>
                          </Button>
                          <IconButton
                            label="删除反馈"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-[15px] text-[#7a7268]">暂无符合条件的用户反馈</div>
        )}
      </section>

      {/* 处理与回复弹窗 */}
      <Modal
        open={Boolean(activeItem)}
        onOpenChange={(open) => {
          if (!open) setActiveItem(null);
        }}
        title="处理用户反馈"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setActiveItem(null)}>
              取消
            </Button>
            <Button type="submit" form="feedback-reply-form" variant="primary" size="sm" disabled={savingReply}>
              {savingReply ? "保存中…" : "保存"}
            </Button>
          </>
        }
      >
        {activeItem ? (
          <form id="feedback-reply-form" onSubmit={handleSaveReply} className="space-y-4">
            <div className="rounded-xl border border-[#ece6dc] bg-[#faf8f4] p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={CATEGORY_TONE[activeItem.category] || "neutral"}>{activeItem.categoryLabel}</Badge>
                  <span className="text-[14px] font-medium text-[#1c1917]">{activeItem.nickname}</span>
                </div>
                <span className="text-[12px] tabular-nums text-[#7a7268]">{formatTime(activeItem.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#1c1917]">
                {activeItem.content}
              </p>
              {activeItem.contact ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-[13px] border border-[#ebe5dc]">
                  <span className="truncate text-[#44403c]">联系方式：{activeItem.contact}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(activeItem.contact).then(() => {
                        setCopiedContact(true);
                        setTimeout(() => setCopiedContact(false), 1800);
                      }).catch(() => {});
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#6b645c] hover:text-[#1c1917]"
                  >
                    {copiedContact ? <Check className="h-3.5 w-3.5 text-[#286346]" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedContact ? "已复制" : "复制"}</span>
                  </button>
                </div>
              ) : null}
              {activeItem.images.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeItem.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onOpenLightbox({ src: img.dataUri, title: img.alt || `反馈截图 ${idx + 1}` })}
                      className="h-16 w-16 overflow-hidden rounded-lg border border-[#e5e0d8] bg-white"
                    >
                      <img src={img.dataUri} alt={img.alt || ""} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="feedback-status-select" className="block text-[14px] font-medium text-[#44403c]">
                处理状态
              </label>
              <select
                id="feedback-status-select"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as AdminUserFeedback["status"])}
                className={INPUT_CLASS}
              >
                <option value="pending">待处理</option>
                <option value="processing">处理中</option>
                <option value="replied">已回复</option>
                <option value="closed">已关闭</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="feedback-reply-textarea" className="block text-[14px] font-medium text-[#44403c]">
                回复内容
              </label>
              <textarea
                id="feedback-reply-textarea"
                rows={4}
                maxLength={1000}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="输入回复，用户可在小程序查看…"
                className={TEXTAREA_CLASS}
              />
            </div>
          </form>
        ) : null}
      </Modal>

      {/* 微信订阅消息提醒设置弹窗 */}
      <Modal
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        title="微信小程序反馈提醒"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setNotifyOpen(false)}>
              关闭
            </Button>
            <Button type="submit" form="feedback-notify-form" variant="primary" size="sm" disabled={savingNotify}>
              {savingNotify ? "保存中…" : "保存配置"}
            </Button>
          </>
        }
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="rounded-xl border border-[#ece6dc] bg-[#faf8f4] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={notify.wechatReady ? "success" : "warn"}>
                {notify.wechatReady ? "微信密钥已就绪" : "未配置 AppID / Secret"}
              </Badge>
              <Badge tone={notify.totalQuota > 0 ? "success" : "warn"}>
                {notify.subscriberCount} 位管理员 · 剩 {notify.totalQuota} 次
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[12px] font-medium text-[#575049]">
              <div className="rounded-lg border border-[#e7dfd2] bg-white py-1.5">1. 填模板 ID</div>
              <div className="rounded-lg border border-[#e7dfd2] bg-white py-1.5">2. 小程序订阅</div>
              <div className="rounded-lg border border-[#e7dfd2] bg-white py-1.5">3. 新反馈推送</div>
            </div>
          </div>

          <form id="feedback-notify-form" onSubmit={handleSaveNotify} className="space-y-4">
            <ToggleSwitch
              checked={notifyEnabled}
              onCheckedChange={setNotifyEnabled}
              label="开启微信提醒"
            />

            <div className="space-y-1.5">
              <label htmlFor="notify-template-id" className="block text-[14px] font-medium text-[#44403c]">
                模板 ID
              </label>
              <input
                id="notify-template-id"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder="微信公众平台「订阅消息」template_id"
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <label htmlFor="notify-mp-state" className="block text-[14px] font-medium text-[#44403c]">
                  跳转版本
                </label>
                <select
                  id="notify-mp-state"
                  value={mpState}
                  onChange={(e) => setMpState(e.target.value as "formal" | "trial" | "developer")}
                  className={INPUT_CLASS}
                >
                  <option value="formal">正式版</option>
                  <option value="trial">体验版</option>
                  <option value="developer">开发版</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="notify-jump-page" className="block text-[14px] font-medium text-[#44403c]">
                  跳转路径
                </label>
                <input
                  id="notify-jump-page"
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  placeholder="pages/admin/admin"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[13px] font-medium text-[#44403c]">模板字段（留空不传）</div>
              <div className="grid grid-cols-4 gap-2">
                <label className="space-y-1">
                  <span className="block text-[12px] text-[#6b645c]">类型</span>
                  <input value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)} placeholder="thing1" className={INPUT_CLASS} />
                </label>
                <label className="space-y-1">
                  <span className="block text-[12px] text-[#6b645c]">内容</span>
                  <input value={contentKey} onChange={(e) => setContentKey(e.target.value)} placeholder="thing2" className={INPUT_CLASS} />
                </label>
                <label className="space-y-1">
                  <span className="block text-[12px] text-[#6b645c]">时间</span>
                  <input value={timeKey} onChange={(e) => setTimeKey(e.target.value)} placeholder="time3" className={INPUT_CLASS} />
                </label>
                <label className="space-y-1">
                  <span className="block text-[12px] text-[#6b645c]">提交人</span>
                  <input value={userKey} onChange={(e) => setUserKey(e.target.value)} placeholder="thing4" className={INPUT_CLASS} />
                </label>
              </div>
            </div>
          </form>

          <div className="border-t border-[#eeeae3] pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#1c1917]">已绑管理员</span>
              {notify.subscribers.length > 0 ? (
                <Button size="sm" variant="outline" disabled={testingNotify} onClick={() => void handleTestNotify()}>
                  <Send className="h-3.5 w-3.5" />
                  <span>{testingNotify ? "发送中…" : "测试推送"}</span>
                </Button>
              ) : null}
            </div>
            {notify.subscribers.length ? (
              <div className="space-y-2">
                {notify.subscribers.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#ece6dc] bg-[#fcfbf9] px-3.5 py-2.5 text-[13px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1c1917]">{sub.label}</span>
                        <span className="text-[12px] text-[#8c847a]">{sub.openidMask}</span>
                        <Badge tone={sub.quota > 0 ? "success" : "warn"}>剩 {sub.quota} 次</Badge>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#7a7268]">
                        已发 {sub.totalSent} 次
                        {sub.lastNotifiedAt ? ` · ${formatTime(sub.lastNotifiedAt)}` : ""}
                      </div>
                      {sub.lastError ? (
                        <div className="mt-0.5 text-[12px] text-[#a93b32]">{sub.lastError}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton
                        label="发送测试"
                        onClick={() => void handleTestNotify(sub.id)}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="移除管理员"
                        onClick={() => setRemoveSubId(sub.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#dfd8cc] px-3.5 py-3.5 text-center text-[13px] text-[#7a7268]">
                暂未绑定 · 在小程序维护者页解锁后点「订阅 +1」
              </p>
            )}
          </div>

          {notify.logs.length ? (
            <div className="border-t border-[#eeeae3] pt-4 space-y-2">
              <div className="text-[13px] font-semibold text-[#1c1917]">最近推送记录</div>
              <div className="space-y-1.5">
                {notify.logs.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-2 text-[12px] text-[#575049]">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Badge tone={log.ok ? "success" : "danger"}>{log.ok ? "成功" : "失败"}</Badge>
                      <span className="truncate">{log.subscriberLabel} · {log.errmsg}</span>
                    </div>
                    <span className="shrink-0 tabular-nums text-[#8c847a]">{formatTime(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="确认删除这条反馈？"
        description={deleteTarget ? `删除后不可恢复：「${deleteTarget.content.slice(0, 40)}」` : ""}
        confirmLabel="删除"
        destructive
        onConfirm={handleDeleteFeedback}
      />

      <ConfirmDialog
        open={Boolean(removeSubId)}
        onOpenChange={(open) => {
          if (!open) setRemoveSubId("");
        }}
        title="移除该提醒管理员？"
        description="移除后将不再向该微信推送新反馈提醒，如需恢复可在小程序重新订阅。"
        confirmLabel="移除"
        destructive
        onConfirm={handleRemoveSubscriber}
      />
    </>
  );
}
