export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function doneKey(taskId: string, d: Date = new Date()): string {
  return `${taskId}|${dateKey(d)}`;
}
