export function createFromPath(path: string) {
  const parts = path.replace(/^\$\./, '').split('.');

  return (obj: object) =>
    parts.reduce((val, prop) => val?.[prop] ?? null, obj as object | null);
}
