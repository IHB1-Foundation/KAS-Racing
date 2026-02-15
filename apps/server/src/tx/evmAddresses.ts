import type { Address } from 'viem';

const PROD_ESCROW_ADDRESS = '0x62c0a62d3121499a92293B8Bd95f8073D226Fb02';
const PROD_REWARD_ADDRESS = '0xa706104A1F63cb360B8d405a60132424a81986A8';
const PROD_FUEL_TOKEN_ADDRESS = '0xF8B8D3b674baE33f8f9b4775F9AEd2D487C0Cd8D';

const isProd = process.env.NODE_ENV === 'production';

function resolveAddress(envValue: string | undefined, prodFallback: string): string | null {
  if (envValue && envValue !== '0x_TO_BE_DEPLOYED') {
    return envValue;
  }
  if (isProd) {
    return prodFallback;
  }
  return null;
}

export function getEscrowAddress(): Address {
  const addr = resolveAddress(process.env.ESCROW_CONTRACT_ADDRESS, PROD_ESCROW_ADDRESS);
  if (!addr) {
    throw new Error('ESCROW_CONTRACT_ADDRESS not configured');
  }
  return addr as Address;
}

export function getRewardAddress(): Address {
  const addr = resolveAddress(process.env.REWARD_CONTRACT_ADDRESS, PROD_REWARD_ADDRESS);
  if (!addr) {
    throw new Error('REWARD_CONTRACT_ADDRESS not configured');
  }
  return addr as Address;
}

export function resolveEscrowAddress(): string {
  return resolveAddress(process.env.ESCROW_CONTRACT_ADDRESS, PROD_ESCROW_ADDRESS) ?? '';
}

export function resolveFuelTokenAddress(): string {
  return resolveAddress(process.env.FUEL_TOKEN_ADDRESS, PROD_FUEL_TOKEN_ADDRESS) ?? '';
}
