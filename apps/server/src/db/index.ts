import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// Database file path (can be overridden by env)
const DB_PATH = process.env.DATABASE_PATH ?? './data/kas-racing.db';

// Create database directory if needed
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite connection
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL'); // Better concurrent performance

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Export schema for convenience
export * from './schema.js';

// Close database connection (for clean shutdown)
export function closeDb(): void {
  sqlite.close();
}
