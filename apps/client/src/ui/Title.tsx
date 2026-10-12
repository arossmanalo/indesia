import { SIM_VERSION } from '@indesia/sim';
import { showLevels } from '../app/actions';
import { Button } from './components';

export function Title() {
  return (
    <main class="screen title">
      <h1 class="logo">Indesia</h1>
      <p class="tagline">The last road of Indesia must hold.</p>
      <div class="menu">
        <Button variant="primary" onClick={showLevels}>
          Play
        </Button>
      </div>
      <footer class="footnote">Tower defense · rules v{SIM_VERSION}</footer>
    </main>
  );
}
