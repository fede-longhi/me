"use client";

import { Share_Tech_Mono, Teko } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameChrome } from "@/components/games/GameChrome";
import { AuraFighter } from "@/components/games/AuraFighter";
import { useLanguage } from "@/components/LanguageProvider";
import { gameCopy, pickRivalName, resultCopy } from "@/lib/farmear-aura/copy";
import {
  BEAT_MS,
  GESTURE_IDS,
  PLAYER_GESTURE_KEYS,
  createMenuBattle,
  countdownDigit,
  isSixSevenLive,
  performGesture,
  remainingMs,
  startCountdown,
  tickBattle,
  type Battle,
  type GestureId,
} from "@/lib/farmear-aura/engine";

const teko = Teko({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-aura-display",
  display: "swap",
});

const shareTech = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-aura-mono",
  display: "swap",
});

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function popupClass(tags: string[], delta: number) {
  if (tags.includes("cringe") || delta < 0) return "aura-pop aura-pop--cringe";
  if (tags.includes("sixseven")) return "aura-pop aura-pop--six";
  if (tags.includes("onbeat")) return "aura-pop aura-pop--beat";
  return "aura-pop";
}

function getAudioContext(ref: { current: AudioContext | null }) {
  if (ref.current) return ref.current;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ref.current = new Ctor();
  return ref.current;
}

function beep(ctx: AudioContext, kind: "beat" | "hit" | "cringe" | "six") {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (kind === "beat") {
    osc.frequency.value = 92;
    osc.type = "square";
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
    return;
  }
  if (kind === "cringe") {
    osc.frequency.value = 70;
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.17);
    return;
  }
  if (kind === "six") {
    osc.frequency.value = 392;
    osc.type = "triangle";
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.23);
    return;
  }
  osc.frequency.value = 220;
  osc.type = "triangle";
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  osc.start(now);
  osc.stop(now + 0.11);
}

export function FarmearAuraGame() {
  const { locale } = useLanguage();
  const copy = useMemo(() => gameCopy(locale), [locale]);
  const [battle, setBattle] = useState<Battle>(() =>
    createMenuBattle(copy.youDefault, copy.rivals[0], 0),
  );
  const [now, setNow] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastBeatRef = useRef(-1);
  const lastPopupRef = useRef(0);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    let frame = 0;
    let lastClock = 0;
    const loop = (t: number) => {
      setBattle((current) => tickBattle(current, t, Math.random));
      if (t - lastClock > 50) {
        lastClock = t;
        setNow(t);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (battle.phase !== "fight" || muted) return;
    const beatIndex = Math.floor((now - battle.beatOrigin) / BEAT_MS);
    if (beatIndex === lastBeatRef.current || beatIndex < 0) return;
    lastBeatRef.current = beatIndex;
    const ctx = getAudioContext(audioRef);
    if (ctx && ctx.state === "running") beep(ctx, "beat");
  }, [battle.beatOrigin, battle.phase, muted, now]);

  useEffect(() => {
    const latest = battle.popups[0];
    if (!latest || latest.id === lastPopupRef.current) return;
    lastPopupRef.current = latest.id;
    if (mutedRef.current) return;
    const ctx = getAudioContext(audioRef);
    if (!ctx) return;
    void ctx.resume();
    if (latest.tags.includes("cringe") || latest.delta < 0) beep(ctx, "cringe");
    else if (latest.tags.includes("sixseven")) beep(ctx, "six");
    else beep(ctx, "hit");
  }, [battle.popups]);

  const begin = useCallback(async () => {
    const ctx = getAudioContext(audioRef);
    if (ctx) void ctx.resume();
    const t = performance.now();
    setBattle((current) =>
      startCountdown(
        current,
        copy.youDefault,
        pickRivalName(copy, Math.random),
        t,
        Math.random,
      ),
    );
  }, [copy]);

  const cast = useCallback((gesture: GestureId) => {
    const ctx = getAudioContext(audioRef);
    if (ctx) void ctx.resume();
    setBattle((current) =>
      performGesture(current, "you", gesture, performance.now(), Math.random),
    );
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (event.key === " " || event.code === "Space") {
        if (battle.phase === "menu" || battle.phase === "result") {
          event.preventDefault();
          void begin();
        }
        return;
      }

      const gesture = PLAYER_GESTURE_KEYS[event.key.toLowerCase()];
      if (!gesture) return;
      event.preventDefault();
      cast(gesture);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [battle.phase, begin, cast]);

  const sixLive = isSixSevenLive(battle, now);
  const digit = countdownDigit(battle, now);
  const timeLeft = remainingMs(battle, now);
  const fighting = battle.phase === "fight";
  const showOverlay = battle.phase === "menu" || battle.phase === "result" || battle.phase === "countdown";

  return (
    <GameChrome eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} wide compact>
      <div className={`${teko.variable} ${shareTech.variable} farmear-aura`}>
        <div className="aura-hud">
          <p className="aura-hud__live">{copy.live}</p>
          <p className="aura-hud__clock">
            {copy.time} {fighting || battle.phase === "countdown" ? formatTime(timeLeft) : "0:32"}
          </p>
          <button
            type="button"
            className="aura-hud__mute"
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? copy.unmute : copy.mute}
          </button>
        </div>

        <div className={`aura-stage ${sixLive ? "aura-stage--six" : ""}`}>
          <div className="aura-stage__pulse" aria-hidden="true" />
          <div className="aura-stage__floor" aria-hidden="true" />

          <AuraFighter
            side="you"
            pose={battle.you.pose}
            name={battle.you.name}
            aura={battle.you.aura}
            live={fighting}
          />

          <p className="aura-stage__vs">{copy.vs}</p>

          <AuraFighter
            side="rival"
            pose={battle.rival.pose}
            name={battle.rival.name}
            aura={battle.rival.aura}
            live={fighting}
          />

          <div className="aura-pops" aria-hidden="true">
            {battle.popups.map((popup) => (
              <span
                key={popup.id}
                className={`${popupClass(popup.tags, popup.delta)} aura-pop--${popup.side}`}
              >
                {popup.delta > 0 ? "+" : ""}
                {popup.delta.toLocaleString()}
                {popup.tags.includes("cringe") ? ` ${copy.tagLabel.cringe}` : ""}
                {popup.tags.includes("onbeat") && popup.delta > 0
                  ? ` ${copy.tagLabel.onbeat}`
                  : ""}
              </span>
            ))}
          </div>

          {sixLive ? (
            <div className="aura-six" role="status">
              <p className="aura-six__title">{copy.sixBanner}</p>
              <p className="aura-six__hint">{copy.sixHint}</p>
            </div>
          ) : null}

          {showOverlay ? (
            <div className="aura-overlay">
              {battle.phase === "countdown" ? (
                <p className="aura-overlay__count">{digit === "go" ? copy.go : digit}</p>
              ) : null}
              {battle.phase === "menu" ? (
                <>
                  <p className="aura-overlay__how">{copy.how}</p>
                  <button type="button" className="aura-overlay__cta" onClick={() => void begin()}>
                    {copy.start}
                  </button>
                </>
              ) : null}
              {battle.phase === "result" ? (
                <>
                  <p className="aura-overlay__result">{resultCopy(copy, battle.winner)}</p>
                  <p className="aura-overlay__scoreline">
                    {battle.you.aura.toLocaleString()} {copy.vs} {battle.rival.aura.toLocaleString()}
                  </p>
                  <button type="button" className="aura-overlay__cta" onClick={() => void begin()}>
                    {copy.rematch}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="aura-pad" role="group" aria-label={copy.title}>
          {GESTURE_IDS.map((id) => {
            const gesture = copy.gestures[id];
            return (
              <button
                key={id}
                type="button"
                className={`aura-pad__btn ${id === "sixseven" ? "aura-pad__btn--six" : ""} ${
                  sixLive && id === "sixseven" ? "aura-pad__btn--hot" : ""
                }`}
                disabled={!fighting}
                aria-pressed={battle.you.pose === id}
                onClick={() => cast(id)}
              >
                <span className="aura-pad__key">{gesture.key}</span>
                <span className="aura-pad__name">{gesture.name}</span>
                <span className="aura-pad__hint">
                  {id === "sixseven" && sixLive ? copy.sixBanner : gesture.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </GameChrome>
  );
}
