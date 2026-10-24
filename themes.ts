export interface Theme {
  id: string;
  name: string;
  emoji: string;
  bg: string; // CSS background for screens
  board: [string, string]; // canvas gradient
  accent: string;
  accent2: string;
  panel: string;
  text: string;
  bubbles: string[]; // 7 colours
  decor: string[];
  music: { root: number; wave: OscillatorType; tempo: number; scale: number[] };
}

export const THEMES: Theme[] = [
  {
    id: "jungle",
    name: "Jungle",
    emoji: "🌴",
    bg: "radial-gradient(ellipse at top, #4ade80 0%, #15803d 45%, #052e16 100%)",
    board: ["#14532d", "#052e16"],
    accent: "#facc15",
    accent2: "#22c55e",
    panel: "rgba(5,46,22,0.72)",
    text: "#ecfccb",
    bubbles: ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#ec4899"],
    decor: ["🌿", "🍃", "🌴", "🦜", "🐒", "🌺", "🍌"],
    music: { root: 60, wave: "triangle", tempo: 108, scale: [0, 2, 4, 7, 9] },
  },
  {
    id: "space",
    name: "Space",
    emoji: "🚀",
    bg: "radial-gradient(ellipse at 30% 20%, #6d28d9 0%, #1e1b4b 50%, #020617 100%)",
    board: ["#1e1b4b", "#020617"],
    accent: "#22d3ee",
    accent2: "#a855f7",
    panel: "rgba(15,10,50,0.75)",
    text: "#e0e7ff",
    bubbles: ["#f43f5e", "#fde047", "#38bdf8", "#4ade80", "#c084fc", "#fb923c", "#f0abfc"],
    decor: ["⭐", "🪐", "🌙", "☄️", "🚀", "✨", "🛸"],
    music: { root: 57, wave: "sine", tempo: 96, scale: [0, 3, 5, 7, 10] },
  },
  {
    id: "candy",
    name: "Candy",
    emoji: "🍭",
    bg: "radial-gradient(ellipse at top, #fbcfe8 0%, #f472b6 50%, #9d174d 100%)",
    board: ["#fce7f3", "#f9a8d4"],
    accent: "#db2777",
    accent2: "#8b5cf6",
    panel: "rgba(131,24,67,0.7)",
    text: "#fff1f2",
    bubbles: ["#e11d48", "#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#f97316", "#d946ef"],
    decor: ["🍭", "🍬", "🧁", "🍩", "🍫", "🍰", "🍪"],
    music: { root: 65, wave: "square", tempo: 120, scale: [0, 2, 4, 7, 9] },
  },
  {
    id: "ocean",
    name: "Ocean",
    emoji: "🐠",
    bg: "radial-gradient(ellipse at top, #67e8f9 0%, #0284c7 45%, #082f49 100%)",
    board: ["#0c4a6e", "#082f49"],
    accent: "#fbbf24",
    accent2: "#06b6d4",
    panel: "rgba(8,47,73,0.72)",
    text: "#ecfeff",
    bubbles: ["#f43f5e", "#facc15", "#60a5fa", "#34d399", "#a78bfa", "#fb923c", "#f472b6"],
    decor: ["🐠", "🐚", "🐙", "🦀", "🐳", "🪸", "🐡"],
    music: { root: 62, wave: "sine", tempo: 100, scale: [0, 2, 5, 7, 9] },
  },
  {
    id: "wood",
    name: "Classic Wood",
    emoji: "🪵",
    bg: "repeating-linear-gradient(95deg, #92400e 0px, #a16207 18px, #78350f 34px, #92400e 52px)",
    board: ["#78350f", "#451a03"],
    accent: "#fde68a",
    accent2: "#d97706",
    panel: "rgba(69,26,3,0.78)",
    text: "#fef3c7",
    bubbles: ["#dc2626", "#eab308", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#db2777"],
    decor: ["🍂", "🌰", "🍁", "🪵", "🦉", "🍄", "🌲"],
    music: { root: 55, wave: "triangle", tempo: 92, scale: [0, 2, 4, 7, 9] },
  },
];

export const WORLD_SIZE = 25;
export const worldThemeIndex = (level: number) => Math.floor((level - 1) / WORLD_SIZE) % THEMES.length;
export const themeFor = (level: number, setting: number | "auto") =>
  THEMES[setting === "auto" ? worldThemeIndex(level) : setting];
