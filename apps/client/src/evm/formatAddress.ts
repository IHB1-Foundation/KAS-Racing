import { getAddress, isAddress } from 'viem';

/**
 * Normalize an EVM address into a checksum 0x... form.
 * Returns null when the input is not a valid EVM address.
 */
export function normalizeEvmAddress(address?: string | null): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;

  const candidate = trimmed.startsWith('0x') || trimmed.startsWith('0X')
    ? trimmed
    : /^[0-9a-fA-F]{40}$/.test(trimmed)
      ? `0x${trimmed}`
      : trimmed;

  if (!isAddress(candidate)) return null;
  return getAddress(candidate);
}

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
  const normalized = normalizeEvmAddress(address);
  const fallback = address?.trim() ?? '';
  const value = normalized ?? fallback;

  if (!value) return '';

  const start = opts?.start ?? 6;
  const end = opts?.end ?? 4;

  if (value.startsWith('0x')) {
    if (value.length <= 2 + start + end) return value;
    return `${value.slice(0, 2 + start)}...${value.slice(-end)}`;
  }

  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}
