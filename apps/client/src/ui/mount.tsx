import { render } from 'preact';
import { HealthBadge } from './HealthBadge';

export function mountUi(root: HTMLElement): void {
  render(<HealthBadge />, root);
}
