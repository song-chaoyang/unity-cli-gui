import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Clamp position to viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - (items.length * 36 + 16));

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-lg"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="my-1 h-px bg-border" />;
        }
        const Icon = item.icon;
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onClick?.();
                onClose();
              }
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
              item.disabled
                ? "cursor-not-allowed opacity-40"
                : item.danger
                  ? "cursor-pointer text-destructive hover:bg-destructive/10"
                  : "cursor-pointer hover:bg-accent"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/// Hook to manage context menu state
export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const open = (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number } | React.MouseEvent | MouseEvent, items: ContextMenuItem[]) => {
    if ("preventDefault" in e) {
      (e as any).preventDefault?.();
    }
    if ("stopPropagation" in e) {
      (e as any).stopPropagation?.();
    }
    const x = (e as any).clientX || 0;
    const y = (e as any).clientY || 0;
    setMenu({ x, y, items });
  };

  const close = () => setMenu(null);

  return { menu, open, close };
}
