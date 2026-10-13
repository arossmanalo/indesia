import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './style.css';
import './ui/icons.css';
import { render } from 'preact';
import { session } from './app/actions';
import { startOnlineLoop } from './app/online';
import { app } from './app/state';
import { createPhaser } from './game/phaser';
import { App } from './ui/App';
import { audio } from './audio/audio';

const ui = document.getElementById('ui')!;
session.phaser = createPhaser(document.getElementById('game')!, ui);
render(<App />, ui);
startOnlineLoop();

// Audio may only start after a user gesture.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
ui.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button:not(:disabled)')) audio.play('click');
});
const syncAudio = () => {
  const { save, screen } = app.get();
  audio.setVolumes(save.settings.music, save.settings.sfx);
  audio.setTrack(screen === 'loading' ? null : screen === 'battle' ? 'battle' : 'menu');
};
app.subscribe(syncAudio);
syncAudio();

// Pause automatically when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  const s = app.get();
  if (document.hidden && s.screen === 'battle' && !s.result) app.set({ paused: true });
});

if (import.meta.env.DEV) {
  // Debug handle for the browser console during development.
  const handle = { app, session, audio, sim: null as unknown };
  (window as unknown as { indesia: unknown }).indesia = handle;
  void import('@indesia/sim').then((sim) => (handle.sim = sim));
}
