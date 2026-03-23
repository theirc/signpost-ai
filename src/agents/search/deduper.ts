export function deduplicateSources(array: string[]): string[] {
  const seen: Record<string, boolean> = {}
  const deduped: string[] = []
  for (const d of array) {
    if (!seen[d]) {
      deduped.push(d)
      seen[d] = true
    }
  }
  return deduped
}