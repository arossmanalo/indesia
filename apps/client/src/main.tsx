import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './style.css';
import './ui/icons.css';
import { render } from 'preact';
import { session } from './app/actions';
import { app } from './app/state';
import { createPhaser } from './game/phaser';
import { App } from './ui/App';

const ui = document.getElementById('ui')!;
session.phaser = createPhaser(document.getElementById('game')!, ui);
render(<App />, ui);

// Pause automatically when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  const s = app.get();
  if (document.hidden && s.screen === 'battle' && !s.result) app.set({ paused: true });
});

if (import.meta.env.DEV) {
  // Debug handle for the browser console during development.
  (window as unknown as { indesia: unknown }).indesia = { app, session };
}
