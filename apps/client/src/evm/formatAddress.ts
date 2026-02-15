/**
 * formatEvmAddress
 *
 * Formats an EVM address into a short, readable form.
 * Default: 0x123456...cdef
 */
export function formatEvmAddress(
  address?: string | null,
  opts?: { start?: number; end?: number }
): string {
  if (!address) return '';
  const trimmed = address.trim();
  if (!trimmed) return '';

  const start = opts?.start ?? 6;
  const end = opts?.end ?? 4;

  if (trimmed.startsWith('0x')) {
    if (trimmed.length <= 2 + start + end) return trimmed;
    return `${trimmed.slice(0, 2 + start)}...${trimmed.slice(-end)}`;
  }

  if (trimmed.length <= start + end) return trimmed;
  return `${trimmed.slice(0, start)}...${trimmed.slice(-end)}`;
}
