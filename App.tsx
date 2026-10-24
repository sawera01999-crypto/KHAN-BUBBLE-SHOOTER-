import { useEffect, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { LevelMap } from "./components/LevelMap";
import { Loading, Menu, SettingsModal, ThemeModal } from "./components/Screens";
import { sfx } from "./game/audio";
import { useSave } from "./game/store";
import { themeFor } from "./game/themes";

type Screen = "loading" | "menu" | "map" | "game";

export default function App() {
  const save = useSave();
  const [screen, setScreen] = useState<Screen>("loading");
  const [level, setLevel] = useState(save.unlocked);
  const [modal, setModal] = useState<"themes" | "settings" | null>(null);

  useEffect(() => {
    sfx.setMusic(save.music);
    sfx.setSfx(save.sfx);
  }, [save.music, save.sfx]);

  const play = (lv: number) => {
    if (lv > save.unlocked) return; // strict sequential unlocking
    setLevel(lv);
    setScreen("game");
  };

  const menuTheme = themeFor(save.unlocked, save.theme);
  const gameTheme = themeFor(level, save.theme);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {screen === "loading" && <Loading onDone={() => setScreen("menu")} />}
      {screen === "menu" && (
        <Menu theme={menuTheme} onPlay={() => play(save.unlocked)} onMap={() => setScreen("map")} onThemes={() => setModal("themes")} onSettings={() => setModal("settings")} />
      )}
      {screen === "map" && <LevelMap theme={menuTheme} onBack={() => setScreen("menu")} onPlay={play} />}
      {screen === "game" && <GameScreen key={level} level={level} theme={gameTheme} onMap={() => setScreen("map")} onPlay={play} />}
      {modal === "themes" && <ThemeModal theme={menuTheme} onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal theme={menuTheme} onClose={() => setModal(null)} />}
    </div>
  );
}
