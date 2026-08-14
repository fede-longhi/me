"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function BeastPortrait({
  art,
  alt,
  className,
  size = 40,
  variant = "thumb",
  fill = false,
}: {
  art?: string | null;
  alt: string;
  className?: string;
  size?: number;
  variant?: "thumb" | "full";
  fill?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [art]);

  const showImg = Boolean(art) && !failed;
  const thumb = variant === "thumb";

  return (
    <div
      className={[
        "flex aspect-square shrink-0 items-center justify-center overflow-hidden border border-[var(--bp-line)] bg-[color-mix(in_oklab,black_30%,var(--bp-bg-panel))] text-[var(--bp-muted)]",
        thumb ? "rounded-full" : "rounded-sm",
        fill ? "size-full" : "",
        className ?? "",
      ].join(" ")}
      style={fill ? undefined : { width: size, height: size, aspectRatio: "1 / 1" }}
      aria-hidden={!showImg}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art!}
          alt={alt}
          width={fill ? undefined : size}
          height={fill ? undefined : size}
          className={[
            "beast-path__pixel size-full",
            "object-cover",
          ].join(" ")}
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageIcon
          size={
            fill
              ? 16
              : Math.max(12, Math.round(size * 0.4))
          }
          strokeWidth={1.75}
        />
      )}
    </div>
  );
}
