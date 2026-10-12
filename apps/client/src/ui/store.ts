import { useEffect, useState } from 'preact/hooks';

export interface Store<T> {
  get(): T;
  set(patch: Partial<T> | ((state: T) => Partial<T>)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) =>
    Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/** Subscribes a component to a slice of a store; re-renders only when the slice changes. */
export function useStore<T extends object, S>(store: Store<T>, select: (state: T) => S): S {
  const [value, setValue] = useState(() => select(store.get()));
  useEffect(() => {
    const update = () =>
      setValue((prev) => {
        const next = select(store.get());
        return shallowEqual(prev, next) ? prev : next;
      });
    update();
    return store.subscribe(update);
    // `select` is treated as stable: re-subscribing on every render is unnecessary.
  }, [store]);
  return value;
}
