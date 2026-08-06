"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ToolTipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
};

export function ToolTip({
  label,
  children,
  side = "bottom",
  className = "",
}: ToolTipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null,
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      left: rect.left + rect.width / 2,
      top: side === "bottom" ? rect.bottom + 8 : rect.top - 8,
    });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className="pointer-events-none fixed z-[9999] -translate-x-1/2 whitespace-nowrap border border-line bg-[color-mix(in_oklab,var(--bg)_92%,white)] px-2.5 py-1.5 font-[family-name:var(--font-body)] text-xs font-semibold tracking-wide text-ink shadow-[0_8px_24px_color-mix(in_oklab,var(--ink)_12%,transparent)]"
              style={{
                left: coords.left,
                top: coords.top,
                transform:
                  side === "bottom"
                    ? "translate(-50%, 0)"
                    : "translate(-50%, -100%)",
              }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
