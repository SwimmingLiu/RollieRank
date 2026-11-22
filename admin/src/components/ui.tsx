import type { ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { Switch } from "@base-ui/react/switch";
import { Tabs } from "@base-ui/react/tabs";
import { Tooltip } from "@base-ui/react/tooltip";
import { HelpCircle, X } from "lucide-react";
import { Button as BeButton } from "@/components/motion/button";
import { cn } from "@/lib/utils";

export { BeButton as Button };

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warn" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[#f0ede7] text-[#575049]",
    success: "bg-[#e7f3ec] text-[#286346]",
    warn: "bg-[#fbf1df] text-[#945c17]",
    danger: "bg-[#fbe9e7] text-[#a93b32]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#1c1917]/35 backdrop-blur-[2px] transition-opacity" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[86vh] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white shadow-2xl outline-none",
            maxWidth,
          )}
        >
          <div className="flex items-center justify-between border-b border-[#eeeae3] px-6 py-4">
            <Dialog.Title className="text-[16px] font-semibold text-[#1c1917]">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="关闭"
              className="grid h-8 w-8 place-items-center rounded-lg text-[#6b645c] transition hover:bg-[#f3efe8] hover:text-[#1c1917]"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2.5 border-t border-[#eeeae3] bg-[#faf9f6] px-6 py-3.5">
              {footer}
            </div>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#1c1917]/30 backdrop-blur-[1px]" />
        <Dialog.Popup className="fixed top-0 right-0 z-50 flex h-full w-full max-w-[500px] flex-col border-l border-[#e5e0d8] bg-white shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-[#eeeae3] px-6 py-4">
            <Dialog.Title className="text-[16px] font-semibold text-[#1c1917]">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="关闭"
              className="grid h-8 w-8 place-items-center rounded-lg text-[#6b645c] transition hover:bg-[#f3efe8] hover:text-[#1c1917]"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-[#1c1917]/40 backdrop-blur-[2px]" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#e5e0d8] bg-white p-6 shadow-2xl outline-none">
          <AlertDialog.Title className="text-[16px] font-semibold text-[#1c1917]">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[14px] leading-relaxed text-[#575049]">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <AlertDialog.Close className="inline-flex h-9 items-center justify-center rounded-full border border-[#dcd6cc] bg-white px-4 text-[14px] font-medium text-[#1c1917] hover:bg-[#f7f5f0]">
              取消
            </AlertDialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-full px-4 text-[14px] font-medium text-white transition",
                destructive ? "bg-[#c4453a] hover:bg-[#ad392f]" : "bg-[#1c1917] hover:bg-[#332e2a]",
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function FilterTabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string; count?: number }>;
}) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(String(next))}>
      <Tabs.List className="inline-flex items-center gap-1 rounded-full border border-[#e5e0d8] bg-[#f3efe8] p-1">
        {items.map((item) => (
          <Tabs.Tab
            key={item.value}
            value={item.value}
            data-filter-tab={item.value}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium text-[#575049] transition outline-none hover:text-[#1c1917] data-[active]:bg-white data-[active]:text-[#1c1917] data-[active]:shadow-xs"
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="tabular-nums text-[13px] text-[#7a7268]">{item.count}</span>
            ) : null}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

export function ToggleSwitch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="text-[14px] font-medium text-[#1c1917]">{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-[#d6d0c6] p-0.5 transition-colors data-[checked]:bg-[#1c1917]"
      >
        <Switch.Thumb className="block h-5 w-5 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5" />
      </Switch.Root>
    </label>
  );
}

export function HelpPopover({
  label,
  children,
  trigger,
}: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className={cn(
          trigger
            ? "inline-flex items-center gap-2 rounded-full border border-[#e5e0d8] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#44403c] transition hover:bg-[#f7f5f0]"
            : "inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7a7268] transition hover:bg-[#f0ede7] hover:text-[#1c1917]",
        )}
      >
        {trigger ?? <HelpCircle className="h-4 w-4" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="w-72 rounded-xl border border-[#e5e0d8] bg-white p-4 text-[13.5px] leading-relaxed text-[#44403c] shadow-lg outline-none">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  tone = "neutral",
  disabled,
  dataTest,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "danger" | "success";
  disabled?: boolean;
  dataTest?: string;
}) {
  const tones = {
    neutral: "text-[#575049] hover:bg-[#f0ede7] hover:text-[#1c1917]",
    danger: "text-[#a93b32] hover:bg-[#fbe9e7]",
    success: "text-[#286346] hover:bg-[#e7f3ec]",
  };
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        aria-label={label}
        disabled={disabled}
        data-action={dataTest}
        onClick={onClick}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-45",
          tones[tone],
        )}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} className="z-50">
          <Tooltip.Popup className="rounded-lg bg-[#1c1917] px-2.5 py-1 text-[12.5px] font-medium text-white shadow-md">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
