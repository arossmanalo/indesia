import { app } from '../app/state';
import { Battle } from './Battle';
import { LevelSelect } from './LevelSelect';
import { Toast } from './Overlays';
import { useStore } from './store';
import { Title } from './Title';

export function App() {
  const screen = useStore(app, (s) => s.screen);
  return (
    <>
      {screen === 'loading' && <div class="loading">Loading…</div>}
      {screen === 'title' && <Title />}
      {screen === 'levels' && <LevelSelect />}
      {screen === 'battle' && <Battle />}
      <Toast />
      <div class="rotate-prompt" role="alert">
        <p>Turn your device sideways to defend Indesia.</p>
      </div>
    </>
  );
}
