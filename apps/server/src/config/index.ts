/**
 * Server Configuration
 *
 * Loads and validates environment variables required for the KAS Racing server.
 * The server will fail to start if required variables are missing or invalid.
 *
 * IMPORTANT: Keys and secrets are NEVER logged.
 */

export type Network = 'mainnet' | 'testnet';

export interface ServerConfig {
  /** Network to use (mainnet or testnet) */
  network: Network;
  /** Server port */
  port: number;
  /** Treasury wallet private key (hex) */
  treasuryPrivateKey: string;
  /** Treasury change address */
  treasuryChangeAddress: string;
  /** Oracle private key for duel settlements (hex) */
  oraclePrivateKey: string;
  /** Minimum reward amount in sompi */
  minRewardSompi: bigint;
  /** Whether this is a production environment */
  isProduction: boolean;
}

interface ValidationError {
  variable: string;
  message: string;
}

/**
 * Validate that a string looks like a valid Kaspa address
 */
function isValidKaspaAddress(address: string, network: Network): boolean {
  const prefix = network === 'mainnet' ? 'kaspa:' : 'kaspatest:';
  // Also accept 'kaspa:' for testnet in development
  if (network === 'testnet' && address.startsWith('kaspa:')) {
    return address.length > 10;
  }
  return address.startsWith(prefix) && address.length > prefix.length + 10;
}

/**
 * Validate that a string looks like a valid hex private key
 * Kaspa private keys are 64 hex characters (32 bytes)
 */
function isValidPrivateKey(key: string): boolean {
  if (!key) return false;
  // Remove 0x prefix if present
  const hex = key.startsWith('0x') ? key.slice(2) : key;
  // Check if it's a valid 64-char hex string
  return /^[0-9a-fA-F]{64}$/.test(hex);
}

/**
 * Load and validate server configuration from environment variables.
 *
 * @throws Error if required variables are missing or invalid
 */
export function loadConfig(): ServerConfig {
  const errors: ValidationError[] = [];

  // Network
  const networkRaw = process.env.NETWORK?.toLowerCase() ?? 'testnet';
  if (networkRaw !== 'mainnet' && networkRaw !== 'testnet') {
    errors.push({
      variable: 'NETWORK',
      message: `Invalid value "${networkRaw}". Must be "mainnet" or "testnet".`,
    });
  }
  const network: Network = networkRaw === 'mainnet' ? 'mainnet' : 'testnet';

  // Port
  const port = Number(process.env.PORT ?? 8787);

  // Treasury Private Key
  const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY ?? '';
  if (!treasuryPrivateKey) {
    errors.push({
      variable: 'TREASURY_PRIVATE_KEY',
      message: 'Required but not set.',
    });
  } else if (!isValidPrivateKey(treasuryPrivateKey)) {
    errors.push({
      variable: 'TREASURY_PRIVATE_KEY',
      message: 'Invalid format. Must be 64 hex characters.',
    });
  }

  // Treasury Change Address
  const treasuryChangeAddress = process.env.TREASURY_CHANGE_ADDRESS ?? '';
  if (!treasuryChangeAddress) {
    errors.push({
      variable: 'TREASURY_CHANGE_ADDRESS',
      message: 'Required but not set.',
    });
  } else if (!isValidKaspaAddress(treasuryChangeAddress, network)) {
    errors.push({
      variable: 'TREASURY_CHANGE_ADDRESS',
      message: `Invalid Kaspa address format for ${network}.`,
    });
  }

  // Oracle Private Key
  const oraclePrivateKey = process.env.ORACLE_PRIVATE_KEY ?? '';
  if (!oraclePrivateKey) {
    errors.push({
      variable: 'ORACLE_PRIVATE_KEY',
      message: 'Required but not set.',
    });
  } else if (!isValidPrivateKey(oraclePrivateKey)) {
    errors.push({
      variable: 'ORACLE_PRIVATE_KEY',
      message: 'Invalid format. Must be 64 hex characters.',
    });
  }

  // Min Reward Amount (optional, defaults to 0.02 KAS = 2_000_000 sompi)
  const minRewardKas = Number(process.env.MIN_REWARD_KAS ?? '0.02');
  const minRewardSompi = BigInt(Math.floor(minRewardKas * 100_000_000));

  // Production flag
  const isProduction = process.env.NODE_ENV === 'production';

  // If there are errors, fail
  if (errors.length > 0) {
    const errorMessages = errors
      .map((e) => `  - ${e.variable}: ${e.message}`)
      .join('\n');
    throw new Error(
      `Server configuration error:\n${errorMessages}\n\n` +
        'Please set the required environment variables. See .env.example for reference.'
    );
  }

  return {
    network,
    port,
    treasuryPrivateKey,
    treasuryChangeAddress,
    oraclePrivateKey,
    minRewardSompi,
    isProduction,
  };
}

// Singleton config instance
let cachedConfig: ServerConfig | null = null;

/**
 * Get the server configuration.
 * Loads and validates on first call, returns cached value on subsequent calls.
 *
 * @throws Error if configuration is invalid
 */
export function getConfig(): ServerConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Check if config has been loaded (useful for testing)
 */
export function isConfigLoaded(): boolean {
  return cachedConfig !== null;
}

/**
 * Reset config cache (useful for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}

/**
 * Safe log helper that redacts sensitive values
 */
export function safeLogConfig(config: ServerConfig): Record<string, unknown> {
  return {
    network: config.network,
    port: config.port,
    treasuryPrivateKey: '[REDACTED]',
    treasuryChangeAddress: config.treasuryChangeAddress,
    oraclePrivateKey: '[REDACTED]',
    minRewardSompi: config.minRewardSompi.toString(),
    isProduction: config.isProduction,
  };
}
