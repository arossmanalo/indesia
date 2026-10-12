import type { ComponentChildren } from 'preact';

/** A sprite from the atlas, drawn by the generated icons.css. */
export function Sprite({ frame, title }: { frame: string; title?: string }) {
  return <span class={`px px-${frame}`} role={title ? 'img' : undefined} aria-label={title} />;
}

export function Stars({ count }: { count: number }) {
  return (
    <span class="stars" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Sprite key={i} frame={i < count ? 'icon-star' : 'icon-starEmpty'} />
      ))}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'default',
  title,
  pressed,
}: {
  children: ComponentChildren;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  title?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      class={`btn btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
    >
      {children}
    </button>
  );
}
