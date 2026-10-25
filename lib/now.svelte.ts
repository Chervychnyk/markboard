/** A clock that ticks once a second while the calling component is mounted. Call during component init. */
export function ticker() {
  const s = $state({ now: Date.now() });
  $effect(() => {
    const id = setInterval(() => (s.now = Date.now()), 1000);
    return () => clearInterval(id);
  });
  return s;
}
