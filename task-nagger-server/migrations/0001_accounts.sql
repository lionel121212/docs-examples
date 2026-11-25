-- Accounts, single active session per account, and the synced app data.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  premium INTEGER NOT NULL DEFAULT 0,
  active_session TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_data (
  user_id TEXT PRIMARY KEY,
  blob TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
