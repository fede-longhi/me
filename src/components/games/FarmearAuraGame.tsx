"use client";

import { Share_Tech_Mono, Teko } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameChrome } from "@/components/games/GameChrome";
import { AuraFighter } from "@/components/games/AuraFighter";
import { useLanguage } from "@/components/LanguageProvider";
import { AuraTheme, getAudioContext, playSfx } from "@/lib/farmear-aura/audio";
import { gameCopy, gestureGroups, pickRivalName, resultCopy } from "@/lib/farmear-aura/copy";
import {
  DEFAULT_LOADOUT,
  MAX_LOADOUT,
  MIN_LOADOUT,
  createMenuBattle,
  countdownDigit,
  isSixSevenLive,
  isValidLoadout,
  performGesture,
  remainingMs,
  slotKeyMap,
  startCountdown,
  tickBattle,
  toggleLoadout,
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

export function FarmearAuraGame() {
  const { locale } = useLanguage();
  const copy = useMemo(() => gameCopy(locale), [locale]);
  const groups = useMemo(() => gestureGroups(), []);
  const [loadout, setLoadout] = useState<GestureId[]>(() => [...DEFAULT_LOADOUT]);
  const [battle, setBattle] = useState<Battle>(() =>
    createMenuBattle(copy.youDefault, copy.rivals[0], 0, DEFAULT_LOADOUT),
  );
  const [now, setNow] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const themeRef = useRef<AuraTheme | null>(null);
  const lastPopupRef = useRef(0);
  const mutedRef = useRef(muted);
  const keys = useMemo(() => slotKeyMap(loadout), [loadout]);

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
    return () => {
      themeRef.current?.dispose();
      themeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const live = battle.phase === "countdown" || battle.phase === "fight";
    if (!live && !themeRef.current) return;
    const ctx = getAudioContext(audioRef);
    if (!ctx) return;
    if (!themeRef.current) themeRef.current = new AuraTheme(ctx);
    const theme = themeRef.current;
    theme.setMuted(muted);
    if (live) {
      void ctx.resume();
      const mode = battle.phase === "countdown" ? "intro" : "full";
      theme.start(mode);
    } else {
      theme.stop();
    }
  }, [battle.phase, muted]);

  useEffect(() => {
    const latest = battle.popups[0];
    if (!latest || latest.id === lastPopupRef.current) return;
    lastPopupRef.current = latest.id;
    if (mutedRef.current) return;
    const ctx = getAudioContext(audioRef);
    if (!ctx) return;
    void ctx.resume();
    if (latest.tags.includes("cringe") || latest.delta < 0) playSfx(ctx, "cringe");
    else if (latest.tags.includes("sixseven")) playSfx(ctx, "six");
    else playSfx(ctx, "hit");
  }, [battle.popups]);

  const begin = useCallback(async () => {
    if (!isValidLoadout(loadout)) return;
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
        loadout,
      ),
    );
  }, [copy, loadout]);

  const cast = useCallback((gesture: GestureId) => {
    const ctx = getAudioContext(audioRef);
    if (ctx) void ctx.resume();
    setBattle((current) =>
      performGesture(current, "you", gesture, performance.now(), Math.random),
    );
  }, []);

  const preview = useCallback((gesture: GestureId) => {
    const until = performance.now() + 1100;
    setBattle((current) => {
      if (current.phase !== "menu" && current.phase !== "result") return current;
      return {
        ...current,
        you: {
          ...current.you,
          pose: gesture,
          poseUntil: until,
        },
      };
    });
  }, []);

  const onToggle = useCallback(
    (gesture: GestureId) => {
      setLoadout((current) => toggleLoadout(current, gesture));
      preview(gesture);
    },
    [preview],
  );

  const backToKit = useCallback(() => {
    setBattle((current) =>
      createMenuBattle(copy.youDefault, current.rival.name, performance.now(), loadout),
    );
  }, [copy.youDefault, loadout]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (event.key === " " || event.code === "Space") {
        if (battle.phase === "menu" || battle.phase === "result") {
          event.preventDefault();
          if (battle.phase === "result") backToKit();
          else void begin();
        }
        return;
      }

      if (battle.phase !== "fight") return;
      const gesture = keys[event.key];
      if (!gesture) return;
      event.preventDefault();
      cast(gesture);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backToKit, battle.phase, begin, cast, keys]);

  const sixLive = isSixSevenLive(battle, now);
  const digit = countdownDigit(battle, now);
  const timeLeft = remainingMs(battle, now);
  const fighting = battle.phase === "fight";
  const picking = battle.phase === "menu";
  const showOverlay =
    battle.phase === "menu" || battle.phase === "result" || battle.phase === "countdown";
  const padMoves = fighting || battle.phase === "countdown" ? battle.you.moves : loadout;
  const canStart = isValidLoadout(loadout);

  return (
    <GameChrome eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} wide compact>
      <div className={`${teko.variable} ${shareTech.variable} farmear-aura`}>
        <div className="aura-hud">
          <p className="aura-hud__live">{copy.live}</p>
          <p className="aura-hud__clock">
            {copy.time}{" "}
            {fighting || battle.phase === "countdown"
              ? formatTime(timeLeft)
              : battle.phase === "result"
                ? "0:00"
                : "0:20"}
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
            <div className={`aura-overlay ${picking ? "aura-overlay--pick" : ""}`}>
              {battle.phase === "countdown" ? (
                <p className="aura-overlay__count">{digit === "go" ? copy.go : digit}</p>
              ) : null}
              {picking ? (
                <>
                  <p className="aura-overlay__pick-title">{copy.pickTitle}</p>
                  <p className="aura-overlay__how">{copy.pickHint}</p>
                  <p className="aura-overlay__countline">
                    {loadout.length}/{MAX_LOADOUT} {copy.pickCount}
                  </p>
                  <div className="aura-picker">
                    <div className="aura-picker__group">
                      <p className="aura-picker__label">{copy.bodyGroup}</p>
                      <div className="aura-picker__grid">
                        {groups.body.map((id) => {
                          const selected = loadout.includes(id);
                          const gesture = copy.gestures[id];
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`aura-picker__btn ${selected ? "aura-picker__btn--on" : ""} ${
                                id === "sixseven" ? "aura-picker__btn--six" : ""
                              }`}
                              aria-pressed={selected}
                              onClick={() => onToggle(id)}
                            >
                              <span className="aura-picker__name">{gesture.name}</span>
                              <span className="aura-picker__hint">{gesture.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="aura-picker__group">
                      <p className="aura-picker__label">{copy.faceGroup}</p>
                      <div className="aura-picker__grid">
                        {groups.face.map((id) => {
                          const selected = loadout.includes(id);
                          const gesture = copy.gestures[id];
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`aura-picker__btn ${selected ? "aura-picker__btn--on" : ""}`}
                              aria-pressed={selected}
                              onClick={() => onToggle(id)}
                            >
                              <span className="aura-picker__name">{gesture.name}</span>
                              <span className="aura-picker__hint">{gesture.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="aura-overlay__how">{copy.how}</p>
                  <button
                    type="button"
                    className="aura-overlay__cta"
                    disabled={!canStart}
                    onClick={() => void begin()}
                  >
                    {copy.start}
                  </button>
                  {!canStart ? (
                    <p className="aura-overlay__need">
                      {MIN_LOADOUT}+ {copy.pickCount}
                    </p>
                  ) : null}
                </>
              ) : null}
              {battle.phase === "result" ? (
                <>
                  <p className="aura-overlay__result">{resultCopy(copy, battle.winner)}</p>
                  <p className="aura-overlay__scoreline">
                    {battle.you.aura.toLocaleString()} {copy.vs}{" "}
                    {battle.rival.aura.toLocaleString()}
                  </p>
                  <button type="button" className="aura-overlay__cta" onClick={backToKit}>
                    {copy.rematch}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {picking ? null : (
          <div className="aura-pad" role="group" aria-label={copy.title}>
            {padMoves.map((id, index) => {
              const gesture = copy.gestures[id];
              return (
                <button
                  key={`${id}-${index}`}
                  type="button"
                  className={`aura-pad__btn ${id === "sixseven" ? "aura-pad__btn--six" : ""} ${
                    sixLive && id === "sixseven" ? "aura-pad__btn--hot" : ""
                  }`}
                  disabled={!fighting}
                  aria-pressed={battle.you.pose === id}
                  onClick={() => cast(id)}
                >
                  <span className="aura-pad__key">{index + 1}</span>
                  <span className="aura-pad__name">{gesture.name}</span>
                  <span className="aura-pad__hint">
                    {id === "sixseven" && sixLive ? copy.sixBanner : gesture.hint}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </GameChrome>
  );
}
