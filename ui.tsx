import type { ReactNode, CSSProperties } from "react";
import { sfx } from "../game/audio";
import type { Theme } from "../game/themes";

export function Btn({ children, onClick, color = "#22c55e", className = "", disabled, style, small }: { children: ReactNode; onClick?: () => void; color?: string; className?: string; disabled?: boolean; style?: CSSProperties; small?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => { sfx.ui(); onClick?.(); }}
      className={`btn3d rounded-2xl font-extrabold text-white tracking-wide ${small ? "px-3 py-2 text-sm" : "px-6 py-3 text-lg"} disabled:opacity-50 disabled:pointer-events-none ${className}`}
      style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 70%, black))`, ...style }}
    >
      {children}
    </button>
  );
}

export function IconBtn({ children, onClick, title, className = "" }: { children: ReactNode; onClick?: () => void; title?: string; className?: string }) {
  return (
    <button title={title} onClick={() => { sfx.ui(); onClick?.(); }} className={`btn3d w-11 h-11 rounded-2xl grid place-items-center text-xl bg-white/20 glass border border-white/30 ${className}`}>
      {children}
    </button>
  );
}

export function Decorations({ theme, count = 14 }: { theme: Theme; count?: number }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((i) => (
        <span
          key={"d" + i}
          className="absolute anim-float opacity-60"
          style={{ left: `${(i * 37) % 95}%`, top: `${(i * 53) % 90}%`, fontSize: 22 + ((i * 7) % 26), animationDelay: `${-i * 0.7}s`, animationDuration: `${4 + (i % 4)}s` }}
        >
          {theme.decor[i % theme.decor.length]}
        </span>
      ))}
      {items.slice(0, 10).map((i) => (
        <span
          key={"b" + i}
          className="absolute bottom-[-40px] rounded-full border-2 border-white/50"
          style={{ left: `${(i * 29 + 5) % 100}%`, width: 10 + (i % 4) * 8, height: 10 + (i % 4) * 8, animation: `rise ${7 + (i % 5) * 2}s linear infinite`, animationDelay: `${-i * 1.3}s`, background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.6), rgba(255,255,255,.05))" }}
        />
      ))}
    </div>
  );
}

export function Stars({ n, size = 16, animate = false }: { n: number; size?: number; animate?: boolean }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[0, 1, 2].map((i) => (
        <span key={i} className={animate && i < n ? "anim-star" : ""} style={{ fontSize: size, filter: i < n ? "drop-shadow(0 0 4px #fde047)" : "grayscale(1) opacity(.35)", animationDelay: `${0.3 + i * 0.35}s` }}>
          ⭐
        </span>
      ))}
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/55 anim-fade p-4" onClick={onClose}>
      <div className="anim-pop w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Panel({ children, theme, title }: { children: ReactNode; theme: Theme; title?: string }) {
  return (
    <div className="relative rounded-[28px] p-5 pt-8 text-white border-4 border-white/40 shadow-2xl" style={{ background: `linear-gradient(180deg, ${theme.accent2}, ${theme.panel.replace(/[\d.]+\)$/, "1)")})` }}>
      {title && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl font-black text-xl whitespace-nowrap border-4 border-white/50 text-stroke" style={{ background: theme.accent, color: "#fff" }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export const BubbleDot = ({ color, size = 28 }: { color: string; size?: number }) => (
  <span className="inline-block rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #fff 0%, ${color} 35%, color-mix(in srgb, ${color} 55%, black) 100%)`, boxShadow: "0 2px 4px rgba(0,0,0,.35)" }} />
);
