import { getAddress, isAddress } from 'viem';

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
