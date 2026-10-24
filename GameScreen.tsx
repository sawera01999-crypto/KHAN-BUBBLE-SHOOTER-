import { useEffect, useMemo, useRef, useState } from "react";
import { getLevel, starsFor, TOTAL_LEVELS } from "../core/levels";
import { music, sfx } from "../game/audio";
import { GameEngine, type EndState, type HudState, type Kind } from "../game/engine";
import { store, useSave } from "../game/store";
import type { Theme } from "../game/themes";
import { Btn, Decorations, IconBtn, Modal, Panel, Stars } from "./ui";

const CONTINUE_COST = 100;
const BOOSTER_COST = 150;

export function GameScreen({ level, theme, onMap, onPlay }: { level: number; theme: Theme; onMap: () => void; onPlay: (lv: number) => void }) {
  const save = useSave();
  const data = useMemo(() => getLevel(level), [level]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hud, setHud] = useState<HudState | null>(null);
  const [end, setEnd] = useState<EndState | null>(null);
  const [reward, setReward] = useState<{ coins: number; giftBooster: string | null; stars: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => { music.play("game", theme); }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    setEnd(null);
    setReward(null);
    setPaused(false);
    const eng = new GameEngine(canvas, getLevel(level), themeRef.current, {
      onHud: setHud,
      onBooster: (k: Kind) => store.set((s) => (k === "bomb" ? { bombs: Math.max(0, s.bombs - 1) } : { fireballs: Math.max(0, s.fireballs - 1) })),
      onEnd: (e) => {
        setEnd(e);
        if (e.won) {
          const stars = starsFor(eng.level, e.shotsUsed);
          const r = store.completeLevel(level, stars, e.score);
          setReward({ ...r, stars });
          sfx.victory();
          for (let i = 0; i < stars; i++) setTimeout(() => sfx.star(i), 700 + i * 350);
          setTimeout(() => sfx.coin(), 1900);
        } else sfx.defeat();
      },
    });
    engineRef.current = eng;
    const box = boxRef.current!;
    const fit = () => eng.resize(box.clientWidth - 12, box.clientHeight - 10);
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    fit();
    return () => { ro.disconnect(); eng.destroy(); engineRef.current = null; };
  }, [level, attempt]);

  useEffect(() => { engineRef.current?.setTheme(theme); }, [theme]);
  useEffect(() => { if (engineRef.current) engineRef.current.paused = paused; }, [paused]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1600); };
  const triggerBooster = (k: "bomb" | "fire") => {
    const eng = engineRef.current;
    if (!eng || end) return;
    const have = k === "bomb" ? save.bombs : save.fireballs;
    if (have <= 0 && eng.armed !== k) {
      if (save.coins >= BOOSTER_COST) {
        store.set((s) => ({ coins: s.coins - BOOSTER_COST, ...(k === "bomb" ? { bombs: s.bombs + 1 } : { fireballs: s.fireballs + 1 }) }));
        sfx.coin();
        flash(`Bought 1 ${k === "bomb" ? "Bomb 💣" : "Fireball 🔥"} for ${BOOSTER_COST} 🪙`);
      } else {
        flash(`Need ${BOOSTER_COST} 🪙 to buy`);
        return;
      }
    }
    eng.arm(k);
  };

  const restart = () => { sfx.ui(); setAttempt((a) => a + 1); };
  const continueGame = () => {
    if (save.coins < CONTINUE_COST) return;
    store.set((s) => ({ coins: s.coins - CONTINUE_COST }));
    setEnd(null);
    engineRef.current?.addShots(5);
  };

  const potentialStars = hud ? starsFor(data, hud.shotsUsed + 0) : 3;
  const shotsLeft = hud?.shotsLeft ?? data.shotLimit;
  const clearedPct = hud ? Math.round(((data.bubbleCount - Math.min(hud.remaining, data.bubbleCount)) / data.bubbleCount) * 100) : 0;

  return (
    <div className="absolute inset-0 flex flex-col text-white anim-fade overflow-hidden" style={{ background: theme.bg }}>
      <Decorations theme={theme} count={8} />
      {/* HUD */}
      <div className="relative z-10 px-2 pt-2 pb-1 anim-down">
        <div className="mx-auto max-w-[520px] flex items-center gap-2 rounded-3xl px-2 py-1.5 border-2 border-white/25 glass" style={{ background: theme.panel }}>
          <IconBtn onClick={() => setPaused(true)} title="Pause">⏸️</IconBtn>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-black text-lg leading-none">Lv {level.toLocaleString()}</span>
              <span className="text-xs font-bold opacity-80 truncate">{theme.emoji} {data.pattern}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-black/40 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clearedPct}%`, background: `linear-gradient(90deg, ${theme.accent}, #fff)` }} />
            </div>
          </div>
          <div className="text-center px-1">
            <div className="text-[10px] font-bold opacity-75 leading-none">SCORE</div>
            <div className="font-black text-lg leading-tight tabular-nums">{(hud?.score ?? 0).toLocaleString()}</div>
          </div>
          <div className="text-center px-1">
            <Stars n={potentialStars} size={12} />
            <div className={`font-black text-lg leading-tight tabular-nums ${shotsLeft <= 3 ? "text-red-300 animate-pulse" : ""}`}>🎯 {shotsLeft}</div>
          </div>
        </div>
        {hud?.danger && !end && <div className="text-center text-xs font-black text-red-200 mt-1 animate-pulse">⚠️ Bubbles near the danger line!</div>}
      </div>

      {/* Board */}
      <div ref={boxRef} className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-1">
        <canvas ref={canvasRef} className="rounded-3xl shadow-2xl border-4 border-white/30" />
      </div>

      {/* Boosters */}
      <div className="relative z-10 p-2 anim-slide">
        <div className="mx-auto max-w-[520px] flex justify-center gap-3">
          <Booster icon="💣" label="Bomb" count={save.bombs} active={hud?.armed === "bomb"} onClick={() => triggerBooster("bomb")} color="#475569" />
          <Booster icon="🔥" label="Fireball" count={save.fireballs} active={hud?.armed === "fire"} onClick={() => triggerBooster("fire")} color="#ea580c" />
          <Booster icon="🔄" label="Swap" count={-1} active={false} onClick={() => engineRef.current?.swap()} color="#7c3aed" />
        </div>
      </div>

      {level <= 3 && attempt === 0 && hud && hud.shotsUsed === 0 && !hud.armed && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[26%] z-20 px-4 py-3 rounded-2xl bg-black/70 font-bold text-sm text-center anim-pop leading-snug">
          👆 Drag / move to aim · Release to shoot<br />🎯 Match 3+ same colours · 🔄 Tap NEXT to swap
        </div>
      )}

      {toast && <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl bg-black/80 font-black anim-pop whitespace-nowrap text-sm">{toast}</div>}

      {paused && !end && (
        <Modal onClose={() => setPaused(false)}>
          <Panel theme={theme} title="⏸️ Paused">
            <div className="space-y-3">
              <Btn className="w-full" color="#22c55e" onClick={() => setPaused(false)}>▶ Resume</Btn>
              <Btn className="w-full" color="#f59e0b" onClick={restart}>🔁 Restart</Btn>
              <Btn className="w-full" color="#3b82f6" onClick={onMap}>🗺️ Level Map</Btn>
              <div className="flex gap-2">
                <Btn small className="flex-1" color={save.music ? "#8b5cf6" : "#6b7280"} onClick={() => { store.set({ music: !save.music }); sfx.setMusic(!save.music); }}>🎵 {save.music ? "On" : "Off"}</Btn>
                <Btn small className="flex-1" color={save.sfx ? "#8b5cf6" : "#6b7280"} onClick={() => { store.set({ sfx: !save.sfx }); sfx.setSfx(!save.sfx); }}>🔊 {save.sfx ? "On" : "Off"}</Btn>
              </div>
            </div>
          </Panel>
        </Modal>
      )}

      {end?.won && reward && (
        <Modal>
          <Panel theme={theme} title="🎉 Level Complete!">
            <div className="text-center">
              <div className="flex justify-center my-2"><Stars n={reward.stars} size={52} animate /></div>
              <div className="text-sm font-bold opacity-80">SCORE</div>
              <CountUp to={end.score} />
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <div className="bg-black/25 rounded-2xl p-2"><div className="opacity-75 font-bold text-xs">Shots used</div><div className="font-black">{end.shotsUsed} / {data.shotLimit}</div></div>
                <div className="bg-black/25 rounded-2xl p-2"><div className="opacity-75 font-bold text-xs">Shots bonus</div><div className="font-black">+{end.bonus}</div></div>
              </div>
              <div className="mt-3 bg-black/25 rounded-2xl p-3 anim-slide" style={{ animationDelay: "1.6s" }}>
                <div className="text-xs font-bold opacity-75 mb-1">REWARDS</div>
                <div className="flex justify-center gap-4 font-black text-lg">
                  <span>🪙 +{reward.coins}</span>
                  {reward.giftBooster && <span>{reward.giftBooster === "bomb" ? "💣" : "🔥"} +1</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Btn small color="#3b82f6" className="flex-1" onClick={onMap}>🗺️ Map</Btn>
              <Btn small color="#f59e0b" className="flex-1" onClick={restart}>🔁 Replay</Btn>
              {level < TOTAL_LEVELS && <Btn small color="#22c55e" className="flex-[1.4]" onClick={() => onPlay(level + 1)}>Next ▶</Btn>}
            </div>
          </Panel>
        </Modal>
      )}

      {end?.won && reward && <Confetti colors={theme.bubbles} />}

      {end && !end.won && (
        <Modal>
          <Panel theme={theme} title={end.reason === "danger" ? "💥 Danger Line!" : "😢 Out of Shots"}>
            <div className="text-center">
              <div className="text-6xl my-2 anim-wobble">{end.reason === "danger" ? "🚧" : "🎯"}</div>
              <p className="font-bold opacity-90">{end.reason === "danger" ? "A bubble crossed the danger line." : `${hud?.remaining ?? 0} bubbles left. So close!`}</p>
              <div className="font-black text-2xl mt-2">Score {end.score.toLocaleString()}</div>
            </div>
            <div className="space-y-2 mt-4">
              {end.reason === "shots" && (
                <Btn className="w-full" color="#a855f7" disabled={save.coins < CONTINUE_COST} onClick={continueGame}>+5 Shots · {CONTINUE_COST} 🪙</Btn>
              )}
              <div className="flex gap-2">
                <Btn color="#3b82f6" className="flex-1" onClick={onMap}>🗺️ Map</Btn>
                <Btn color="#22c55e" className="flex-1" onClick={restart}>🔁 Retry</Btn>
              </div>
            </div>
          </Panel>
        </Modal>
      )}
    </div>
  );
}

function Booster({ icon, label, count, active, onClick, color }: { icon: string; label: string; count: number; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`btn3d relative w-[86px] h-[64px] rounded-2xl flex flex-col items-center justify-center border-4 transition ${active ? "border-yellow-300 scale-110 anim-pulse" : "border-white/40"}`}
      style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 80%, white), ${color})` }}
    >
      <span className={`text-2xl leading-none ${active ? "animate-bounce" : ""}`}>{icon}</span>
      <span className="text-[11px] font-black mt-0.5">{active ? "ARMED" : label}</span>
      {count >= 0 && (
        <span className={`absolute -top-2 -right-2 min-w-6 h-6 px-1 rounded-full grid place-items-center text-xs font-black border-2 border-white ${count > 0 ? "bg-red-500" : "bg-green-500"}`}>
          {count > 0 ? count : "+"}
        </span>
      )}
    </button>
  );
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1200);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <div className="font-black text-4xl tabular-nums text-yellow-200 text-stroke">{v.toLocaleString()}</div>;
}

function Confetti({ colors }: { colors: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[60]">
      {Array.from({ length: 60 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${(i * 17) % 100}%`, width: 8 + (i % 3) * 3, height: 12 + (i % 4) * 3, background: colors[i % colors.length],
            borderRadius: i % 2 ? "50%" : 2, animation: `confetti ${2.5 + (i % 5) * 0.5}s linear infinite`, animationDelay: `${-(i % 10) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}
