import { useEffect, useState } from "react";
import { getLevel, TOTAL_LEVELS } from "../core/levels";
import { music, sfx } from "../game/audio";
import { store, useSave } from "../game/store";
import { THEMES, type Theme } from "../game/themes";
import { BubbleDot, Btn, Decorations, IconBtn, Modal, Panel } from "./ui";

export function Logo({ size = 1 }: { size?: number }) {
  const colors = ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#a855f7"];
  return (
    <div className="anim-logo text-center select-none" style={{ transform: `scale(${size})` }}>
      <div className="flex justify-center gap-1 mb-2">
        {colors.map((c, i) => (
          <span key={c} className="anim-float" style={{ animationDelay: `${-i * 0.4}s`, animationDuration: "2.6s" }}>
            <BubbleDot color={c} size={30} />
          </span>
        ))}
      </div>
      <div className="font-black leading-none text-stroke" style={{ fontSize: 58, letterSpacing: 4 }}>
        <span className="shine-text">KHAN</span>
      </div>
      <div className="font-black leading-none text-white text-stroke mt-1" style={{ fontSize: 34, letterSpacing: 1 }}>
        BUBBLE SHOOTER
      </div>
    </div>
  );
}

export function Loading({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState(0);
  const theme = THEMES[1];
  useEffect(() => {
    let v = 0;
    const id = setInterval(() => {
      v = Math.min(100, v + 4 + Math.random() * 7);
      if (v > 40 && v < 52) getLevel(store.get().unlocked); // warm up the level engine
      setP(v);
      if (v >= 100) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, []);
  const ready = p >= 100;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white anim-fade" style={{ background: theme.bg }} onClick={() => { if (ready) { sfx.unlock(); sfx.ui(); onDone(); } }}>
      <Decorations theme={theme} count={10} />
      <Logo />
      <div className="mt-12 w-64 h-5 rounded-full bg-black/40 border-2 border-white/40 overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${p}%`, background: "linear-gradient(90deg,#22d3ee,#a855f7,#f472b6)" }} />
      </div>
      <div className="mt-3 text-sm font-bold opacity-90 h-6">
        {ready ? <span className="animate-pulse text-lg font-black text-yellow-300">👆 TAP TO PLAY</span> : `Loading ${TOTAL_LEVELS.toLocaleString()} levels… ${Math.floor(p)}%`}
      </div>
      <div className="absolute bottom-4 text-xs opacity-70">✈️ 100% Offline • No internet needed</div>
    </div>
  );
}

export function Menu({ theme, onPlay, onMap, onThemes, onSettings }: { theme: Theme; onPlay: () => void; onMap: () => void; onThemes: () => void; onSettings: () => void }) {
  const save = useSave();
  useEffect(() => { music.play("menu", theme); }, [theme]);
  const pct = ((save.unlocked - 1) / TOTAL_LEVELS) * 100;
  return (
    <div className="absolute inset-0 flex flex-col items-center text-white overflow-hidden" style={{ background: theme.bg }}>
      <Decorations theme={theme} />
      <div className="relative z-10 w-full flex justify-between p-4 anim-down">
        <div className="flex gap-2">
          <Chip>🪙 {save.coins}</Chip>
          <Chip>⭐ {save.totalStars}</Chip>
        </div>
        <IconBtn onClick={onSettings} title="Settings">⚙️</IconBtn>
      </div>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-sm px-6">
        <div className="anim-pop"><Logo /></div>
        <div className="w-full mt-6 anim-slide" style={{ animationDelay: ".1s" }}>
          <button onClick={() => { sfx.ui(); onPlay(); }} className="btn3d anim-pulse w-full rounded-3xl py-5 font-black text-3xl text-white border-4 border-white/60" style={{ background: "linear-gradient(180deg,#4ade80,#16a34a)" }}>
            ▶ PLAY
            <div className="text-sm font-bold opacity-90">Level {save.unlocked.toLocaleString()}</div>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full anim-slide" style={{ animationDelay: ".2s" }}>
          <Btn color="#3b82f6" onClick={onMap}>🗺️ Levels</Btn>
          <Btn color="#a855f7" onClick={onThemes}>🎨 Themes</Btn>
        </div>
        <div className="w-full anim-slide" style={{ animationDelay: ".3s" }}>
          <div className="flex justify-between text-xs font-bold opacity-90 mb-1"><span>Journey</span><span>{save.unlocked - 1} / {TOTAL_LEVELS.toLocaleString()}</span></div>
          <div className="h-3 rounded-full bg-black/35 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(1.5, pct)}%`, background: `linear-gradient(90deg, ${theme.accent}, #fff)` }} /></div>
        </div>
      </div>
      <div className="relative z-10 pb-4 text-xs opacity-75">Theme: {theme.emoji} {theme.name} {save.theme === "auto" ? "(Auto)" : ""}</div>
    </div>
  );
}

export const Chip = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 py-1.5 rounded-full bg-black/35 glass border border-white/25 font-black text-sm text-white">{children}</div>
);

export function ThemeModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const save = useSave();
  const choose = (v: number | "auto") => { sfx.ui(); store.set({ theme: v }); };
  return (
    <Modal onClose={onClose}>
      <Panel theme={theme} title="🎨 Themes">
        <button onClick={() => choose("auto")} className={`w-full mb-3 rounded-2xl p-3 font-black text-left border-4 transition ${save.theme === "auto" ? "border-yellow-300 bg-white/25" : "border-transparent bg-black/20"}`}>
          🔄 Auto — changes every 25 levels
        </button>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t, i) => (
            <button key={t.id} onClick={() => choose(i)} className={`relative h-24 rounded-2xl overflow-hidden border-4 transition hover:scale-[1.03] ${save.theme === i ? "border-yellow-300 scale-[1.03]" : "border-white/20"}`} style={{ background: t.bg }}>
              <div className="absolute inset-x-0 top-2 flex justify-center gap-1">{t.bubbles.slice(0, 5).map((c) => <BubbleDot key={c} color={c} size={14} />)}</div>
              <div className="absolute bottom-2 inset-x-0 text-center font-black text-white text-stroke">{t.emoji} {t.name}</div>
              {save.theme === i && <div className="absolute top-1 right-1 text-lg">✅</div>}
            </button>
          ))}
        </div>
        <Btn className="w-full mt-4" color="#22c55e" onClick={onClose}>Done</Btn>
      </Panel>
    </Modal>
  );
}

export function SettingsModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const save = useSave();
  const [confirm, setConfirm] = useState(false);
  const Toggle = ({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) => (
    <button onClick={() => { onChange(!on); sfx.ui(); }} className="w-full flex items-center justify-between bg-black/20 rounded-2xl px-4 py-3 font-black">
      <span>{label}</span>
      <span className={`w-14 h-8 rounded-full p-1 transition ${on ? "bg-green-400" : "bg-gray-500"}`}>
        <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : ""}`} />
      </span>
    </button>
  );
  return (
    <Modal onClose={onClose}>
      <Panel theme={theme} title="⚙️ Settings">
        <div className="space-y-3">
          <Toggle on={save.music} label="🎵 Music" onChange={(v) => { store.set({ music: v }); sfx.setMusic(v); }} />
          <Toggle on={save.sfx} label="🔊 Sound Effects" onChange={(v) => { store.set({ sfx: v }); sfx.setSfx(v); }} />
          <div className="bg-black/20 rounded-2xl px-4 py-3 text-sm leading-relaxed">
            <div className="font-black mb-1">✅ Quality verified</div>
            All {TOTAL_LEVELS.toLocaleString()} levels are generated on-device (fully offline) and checked by an automated solver, so every level can be won within its shot limit.
          </div>
          {!confirm ? (
            <Btn small color="#ef4444" className="w-full" onClick={() => setConfirm(true)}>Reset Progress</Btn>
          ) : (
            <div className="flex gap-2">
              <Btn small color="#ef4444" className="flex-1" onClick={() => { store.reset(); setConfirm(false); }}>Yes, reset</Btn>
              <Btn small color="#6b7280" className="flex-1" onClick={() => setConfirm(false)}>Cancel</Btn>
            </div>
          )}
        </div>
        <Btn className="w-full mt-4" color="#22c55e" onClick={onClose}>Close</Btn>
      </Panel>
    </Modal>
  );
}
