import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getLevel, TOTAL_LEVELS } from "../core/levels";
import { music, sfx } from "../game/audio";
import { useSave } from "../game/store";
import { THEMES, WORLD_SIZE, themeFor, worldThemeIndex, type Theme } from "../game/themes";
import { Chip } from "./Screens";
import { Btn, IconBtn, Modal, Panel, Stars, BubbleDot } from "./ui";

const NODE_H = 96;
const TOP_PAD = 180;
const BOTTOM_PAD = 220;
const TOTAL_H = TOP_PAD + TOTAL_LEVELS * NODE_H + BOTTOM_PAD;
const yOf = (lv: number) => TOTAL_H - BOTTOM_PAD - (lv - 1) * NODE_H - NODE_H / 2;
const xPct = (lv: number) => 50 + Math.sin(lv * 0.72) * 28 + Math.sin(lv * 0.23) * 6;

export function LevelMap({ theme, onBack, onPlay }: { theme: Theme; onBack: () => void; onPlay: (lv: number) => void }) {
  const save = useSave();
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, h: 800, w: 400 });
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [jump, setJump] = useState("");

  useEffect(() => { music.play("map", theme); }, [theme]);

  const measure = () => {
    const el = ref.current;
    if (el) setView({ top: el.scrollTop, h: el.clientHeight, w: el.clientWidth });
  };
  const scrollToLevel = (lv: number, smooth = false) => {
    const el = ref.current;
    if (!el) return;
    const top = yOf(lv) - el.clientHeight / 2;
    const far = Math.abs(el.scrollTop - top) > 6000;
    el.scrollTo({ top, behavior: smooth && !far ? "smooth" : "auto" });
    measure();
  };
  useLayoutEffect(() => {
    scrollToLevel(save.unlocked);
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rafRef = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
  };

  const buffer = 6;
  const maxLv = Math.min(TOTAL_LEVELS, Math.ceil((TOTAL_H - BOTTOM_PAD - view.top) / NODE_H) + buffer);
  const minLv = Math.max(1, Math.floor((TOTAL_H - BOTTOM_PAD - (view.top + view.h)) / NODE_H) - buffer);
  const levels: number[] = [];
  for (let l = minLv; l <= maxLv; l++) levels.push(l);
  const worlds: number[] = [];
  for (let w = Math.floor((minLv - 1) / WORLD_SIZE); w <= Math.floor((maxLv - 1) / WORLD_SIZE); w++) worlds.push(w);

  const svgTop = yOf(Math.min(TOTAL_LEVELS, maxLv + 1)) - 60;
  const svgH = yOf(Math.max(1, minLv - 1)) + 60 - svgTop;
  const pathD = useMemo(() => {
    const pts = [];
    for (let l = Math.max(1, minLv - 1); l <= Math.min(TOTAL_LEVELS, maxLv + 1); l++) pts.push(`${(xPct(l) / 100) * view.w},${yOf(l) - svgTop}`);
    return "M" + pts.join(" L");
  }, [minLv, maxLv, view.w, svgTop]);
  const donePath = useMemo(() => {
    const end = Math.min(maxLv + 1, save.unlocked);
    if (end <= minLv) return "";
    const pts = [];
    for (let l = Math.max(1, minLv - 1); l <= end; l++) pts.push(`${(xPct(l) / 100) * view.w},${yOf(l) - svgTop}`);
    return "M" + pts.join(" L");
  }, [minLv, maxLv, view.w, save.unlocked, svgTop]);

  const clickLevel = (lv: number) => {
    if (lv > save.unlocked) {
      sfx.danger();
      setShake(lv);
      setTimeout(() => setShake(null), 500);
      setToast(`🔒 Complete Level ${(lv - 1).toLocaleString()} first!`);
      setTimeout(() => setToast(null), 1800);
      return;
    }
    sfx.ui();
    setSelected(lv);
  };

  const doJump = () => {
    const n = parseInt(jump, 10);
    if (n >= 1 && n <= TOTAL_LEVELS) scrollToLevel(n, true);
    setJump("");
  };

  return (
    <div className="absolute inset-0 text-white anim-fade" style={{ background: "#111" }}>
      <div ref={ref} onScroll={onScroll} className="absolute inset-0 overflow-y-auto no-scrollbar">
        <div className="relative" style={{ height: TOTAL_H }}>
          {worlds.map((w) => {
            const t = THEMES[w % THEMES.length];
            const firstLv = w * WORLD_SIZE + 1;
            const lastLv = Math.min(TOTAL_LEVELS, firstLv + WORLD_SIZE - 1);
            const top = yOf(lastLv) - NODE_H / 2 - (lastLv === TOTAL_LEVELS ? TOP_PAD : 0);
            const bottom = yOf(firstLv) + NODE_H / 2 + (firstLv === 1 ? BOTTOM_PAD : 0);
            return (
              <div key={w} className="absolute inset-x-0 overflow-hidden" style={{ top, height: bottom - top, background: t.bg }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className="absolute anim-float opacity-50" style={{ left: `${(i * 41 + w * 13) % 92}%`, top: `${(i * 8.3 + 2) % 98}%`, fontSize: 24 + ((i * 5) % 22), animationDelay: `${-i}s` }}>
                    {t.decor[(i + w) % t.decor.length]}
                  </span>
                ))}
                <div className="absolute inset-x-0 flex justify-center" style={{ bottom: (firstLv === 1 ? BOTTOM_PAD : 0) - 18 }}>
                  <div className="px-4 py-1.5 rounded-full font-black text-sm border-2 border-white/60 shadow-lg z-10" style={{ background: t.accent2 }}>
                    {t.emoji} World {(w + 1).toLocaleString()} · {t.name} · {firstLv.toLocaleString()}–{lastLv.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
          <svg className="absolute left-0 pointer-events-none" width={view.w} height={svgH} style={{ top: svgTop, overflow: "visible" }}>
            <path d={pathD} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathD} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
            {donePath && <path d={donePath} fill="none" stroke="#fde047" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />}
          </svg>
          {levels.map((lv) => {
            const locked = lv > save.unlocked;
            const current = lv === save.unlocked;
            const stars = save.stars[lv] ?? 0;
            const t = THEMES[worldThemeIndex(lv)];
            const size = current ? 70 : 58;
            return (
              <div key={lv} className="absolute" style={{ left: `${xPct(lv)}%`, top: yOf(lv), transform: "translate(-50%,-50%)" }}>
                {current && <div className="absolute left-1/2 -top-12 text-3xl anim-bob z-20">📍</div>}
                <button
                  onClick={() => clickLevel(lv)}
                  className={`relative rounded-full grid place-items-center font-black border-4 transition-transform hover:scale-110 ${current ? "anim-pulse" : ""} ${shake === lv ? "anim-wobble" : ""}`}
                  style={{
                    width: size, height: size,
                    borderColor: locked ? "rgba(255,255,255,.35)" : "#fff",
                    background: locked ? "linear-gradient(180deg,#9ca3af,#4b5563)" : stars ? `radial-gradient(circle at 35% 30%, #fff7, ${t.accent} 45%, color-mix(in srgb, ${t.accent} 60%, black))` : `radial-gradient(circle at 35% 30%, #fff8, ${t.accent2} 45%, color-mix(in srgb, ${t.accent2} 55%, black))`,
                    boxShadow: "0 6px 0 rgba(0,0,0,.3)",
                    fontSize: lv >= 10000 ? 13 : lv >= 1000 ? 15 : 19,
                  }}
                >
                  {locked ? <span className="text-xl">🔒</span> : <span className="text-stroke">{lv}</span>}
                </button>
                {!locked && stars > 0 && <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 whitespace-nowrap"><Stars n={stars} size={14} /></div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute top-0 inset-x-0 p-3 flex items-center gap-2 z-30 anim-down" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.55), transparent)" }}>
        <IconBtn onClick={onBack} title="Back">⬅️</IconBtn>
        <div className="font-black text-xl text-stroke flex-1">Level Map</div>
        <Chip>⭐ {save.totalStars}</Chip>
        <Chip>🪙 {save.coins}</Chip>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-3 flex gap-2 justify-center items-center z-30" style={{ background: "linear-gradient(0deg, rgba(0,0,0,.6), transparent)" }}>
        <Btn small color="#f59e0b" onClick={() => scrollToLevel(save.unlocked, true)}>📍 Current</Btn>
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onKeyDown={(e) => e.key === "Enter" && doJump()}
          placeholder="Level #"
          inputMode="numeric"
          className="w-24 rounded-xl px-3 py-2 text-black font-bold outline-none border-2 border-white"
        />
        <Btn small color="#3b82f6" onClick={doJump}>Go</Btn>
        <Btn small color="#22c55e" onClick={() => onPlay(save.unlocked)}>▶ Play {save.unlocked}</Btn>
      </div>

      {toast && <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl bg-black/80 font-black anim-pop whitespace-nowrap">{toast}</div>}
      {selected && <LevelStart level={selected} theme={themeFor(selected, save.theme)} onClose={() => setSelected(null)} onPlay={() => onPlay(selected)} />}
    </div>
  );
}

export function LevelStart({ level, theme, onClose, onPlay }: { level: number; theme: Theme; onClose: () => void; onPlay: () => void }) {
  const save = useSave();
  const data = useMemo(() => getLevel(level), [level]);
  const stars = save.stars[level] ?? 0;
  return (
    <Modal onClose={onClose}>
      <Panel theme={theme} title={`Level ${level.toLocaleString()}`}>
        <div className="flex justify-center mb-3"><Stars n={stars} size={34} /></div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <Info label="Goal" value="Pop All 🫧" />
          <Info label="Shots" value={`🎯 ${data.shotLimit}`} />
          <Info label="Bubbles" value={`${data.bubbleCount}`} />
          <Info label="Layout" value={data.pattern} />
        </div>
        <div className="mt-3 bg-black/25 rounded-2xl p-3">
          <div className="flex justify-between text-xs font-bold mb-1"><span>Difficulty</span><span>{data.params.difficulty}%</span></div>
          <div className="h-3 rounded-full bg-black/40 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(4, data.params.difficulty)}%`, background: "linear-gradient(90deg,#22c55e,#facc15,#ef4444)" }} /></div>
          <div className="flex gap-1 justify-center mt-3">{theme.bubbles.slice(0, data.colors).map((c) => <BubbleDot key={c} color={c} size={20} />)}</div>
        </div>
        {save.best[level] ? <div className="text-center mt-2 text-sm font-bold opacity-90">🏆 Best: {save.best[level].toLocaleString()}</div> : null}
        <div className="flex gap-3 mt-4">
          <Btn color="#6b7280" className="flex-1" onClick={onClose}>Close</Btn>
          <Btn color="#22c55e" className="flex-[2]" onClick={onPlay}>▶ Play</Btn>
        </div>
      </Panel>
    </Modal>
  );
}

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-black/25 rounded-2xl py-2 px-1">
    <div className="text-[11px] uppercase font-bold opacity-75">{label}</div>
    <div className="font-black text-sm truncate">{value}</div>
  </div>
);
