import { SIM_VERSION } from '@indesia/sim';
import { showLeaderboard, showLevels } from '../app/actions';
import { linkAccount, signOut } from '../app/online';
import { app } from '../app/state';
import { Button } from './components';
import { useStore } from './store';

const PROVIDER_NAMES = { github: 'GitHub', google: 'Google' } as const;

function Account() {
  const online = useStore(app, (s) => s.online);
  if (online.status === 'connecting') return <p class="account muted">Connecting…</p>;
  if (online.status === 'offline') {
    return <p class="account muted">Offline · progress is saved on this device</p>;
  }
  return (
    <div class="account">
      <p>
        Playing as <strong>{online.name}</strong>
        {online.guest && <span class="muted"> (guest)</span>}
      </p>
      {online.guest && online.providers.length > 0 && (
        <div class="account__link">
          <span class="muted">Keep your progress on every device:</span>
          {online.providers.map((p) => (
            <Button key={p} variant="ghost" onClick={() => void linkAccount(p)}>
              Link {PROVIDER_NAMES[p]}
            </Button>
          ))}
        </div>
      )}
      {!online.guest && (
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      )}
    </div>
  );
}

export function Title() {
  return (
    <main class="screen title">
      <h1 class="logo">Indesia</h1>
      <p class="tagline">The last road of Indesia must hold.</p>
      <div class="menu">
        <Button variant="primary" onClick={showLevels}>
          Play
        </Button>
        <Button onClick={() => showLeaderboard()}>Leaderboards</Button>
      </div>
      <Account />
      <footer class="footnote">Tower defense · rules v{SIM_VERSION}</footer>
    </main>
  );
}
