import type { Address } from 'viem';

export const isE2E = import.meta.env.VITE_E2E === 'true';

export const e2eApiBase =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

const fallbackAccounts = [
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222',
];

export const e2eAccounts = (() => {
  const raw = import.meta.env.VITE_E2E_ACCOUNTS as string | undefined;
  const list = raw
    ? raw.split(',').map((addr) => addr.trim()).filter(Boolean)
    : fallbackAccounts;
  return list as Address[];
})();
