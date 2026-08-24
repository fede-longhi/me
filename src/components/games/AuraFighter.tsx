import type { PoseId, Side } from "@/lib/farmear-aura/engine";

type AuraFighterProps = {
  side: Side;
  pose: PoseId;
  name: string;
  aura: number;
  live: boolean;
};

export function AuraFighter({ side, pose, name, aura, live }: AuraFighterProps) {
  return (
    <div
      className={`aura-fighter ${live ? "aura-fighter--live" : ""}`}
      data-side={side}
      data-pose={pose}
    >
      <svg
        className="aura-fighter__svg"
        viewBox="0 0 200 340"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`aura-glow-${side}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse
          className="aura-fighter__bloom"
          cx="100"
          cy="188"
          rx="72"
          ry="118"
          fill={`url(#aura-glow-${side})`}
        />
        <ellipse className="aura-fighter__shadow" cx="100" cy="318" rx="58" ry="10" />
        <g className="aura-fighter__body">
          <g className="aura-fighter__leg aura-fighter__leg--l">
            <path d="M88 214 L78 304 L94 304 L102 214 Z" />
            <path className="aura-fighter__shoe" d="M70 300 H98 L102 312 H66 Z" />
          </g>
          <g className="aura-fighter__leg aura-fighter__leg--r">
            <path d="M108 214 L112 304 L128 304 L120 214 Z" />
            <path className="aura-fighter__shoe" d="M108 300 H140 L138 312 H104 Z" />
          </g>
          <g className="aura-fighter__torso">
            <path d="M78 112 C76 168 74 208 86 216 H114 C126 208 124 168 122 112 C118 102 82 102 78 112 Z" />
            <path
              className="aura-fighter__jacket"
              d="M80 118 C90 132 110 132 120 118 L118 168 C108 176 92 176 82 168 Z"
            />
            <circle className="aura-fighter__chain" cx="100" cy="156" r="9" />
            <circle className="aura-fighter__chain-hole" cx="100" cy="156" r="4.5" />
          </g>
          <g className="aura-fighter__arm aura-fighter__arm--l">
            <path d="M80 122 C62 138 52 168 56 196 L70 198 C70 172 76 146 86 132 Z" />
            <circle className="aura-fighter__hand" cx="60" cy="204" r="11" />
          </g>
          <g className="aura-fighter__arm aura-fighter__arm--r">
            <path d="M120 122 C138 138 148 168 144 196 L130 198 C130 172 124 146 114 132 Z" />
            <circle className="aura-fighter__hand" cx="140" cy="204" r="11" />
          </g>
          <g className="aura-fighter__head">
            <circle className="aura-fighter__skull" cx="100" cy="78" r="32" />
            <path className="aura-fighter__cap" d="M68 66 Q100 38 132 66 L128 74 Q100 58 72 74 Z" />
            <g className="aura-fighter__face">
              <g className="aura-fighter__brow aura-fighter__brow--l">
                <path d="M78 68 H92" />
              </g>
              <g className="aura-fighter__brow aura-fighter__brow--r">
                <path d="M108 68 H122" />
              </g>
              <g className="aura-fighter__eye aura-fighter__eye--l">
                <ellipse className="aura-fighter__eye-white" cx="85" cy="78" rx="7.5" ry="6" />
                <circle className="aura-fighter__pupil" cx="85" cy="78" r="3.2" />
              </g>
              <g className="aura-fighter__eye aura-fighter__eye--r">
                <ellipse className="aura-fighter__eye-white" cx="115" cy="78" rx="7.5" ry="6" />
                <circle className="aura-fighter__pupil" cx="115" cy="78" r="3.2" />
              </g>
              <path className="aura-fighter__mouth" d="M90 94 Q100 98 110 94" />
            </g>
          </g>
        </g>
      </svg>
      <div className="aura-fighter__meta">
        <p className="aura-fighter__name">{name}</p>
        <p className="aura-fighter__score" aria-live="polite">
          {aura.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
