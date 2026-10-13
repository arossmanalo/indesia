import { useEffect } from 'preact/hooks';
import type { Settings as SettingsData } from '@indesia/shared';
import { closeSettings, updateSettings } from '../app/actions';
import { app } from '../app/state';
import { Button } from './components';
import { useStore } from './store';

function Slider({
  label,
  value,
  onInput,
}: {
  label: string;
  value: number;
  onInput: (value: number) => void;
}) {
  return (
    <label class="setting">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
      />
      <output>{value}</output>
    </label>
  );
}

export function SettingsDialog() {
  const open = useStore(app, (s) => s.settingsOpen);
  const settings = useStore(app, (s) => s.save.settings);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        closeSettings();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open]);

  if (!open) return null;
  const set = (patch: Partial<SettingsData>) => updateSettings(patch);
  return (
    <div class="overlay overlay--top">
      <div class="panel dialog settings" role="dialog" aria-label="Settings">
        <h2>Settings</h2>
        <Slider label="Music" value={settings.music} onInput={(music) => set({ music })} />
        <Slider label="Sound effects" value={settings.sfx} onInput={(sfx) => set({ sfx })} />
        <div class="setting">
          <span>Default speed</span>
          <div class="segmented" role="group" aria-label="Default speed">
            {([1, 2, 3] as const).map((speed) => (
              <button
                key={speed}
                type="button"
                aria-pressed={settings.speed === speed}
                onClick={() => set({ speed })}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
        <label class="setting setting--check">
          <input
            type="checkbox"
            checked={settings.reducedShake}
            onChange={(e) => set({ reducedShake: (e.target as HTMLInputElement).checked })}
          />
          <span>Reduce screen shake and flashes</span>
        </label>
        <Button variant="primary" onClick={closeSettings}>
          Done
        </Button>
      </div>
    </div>
  );
}
