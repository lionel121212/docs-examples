-- accountability buddies (one row per pair, user_a < user_b) and daily progress
CREATE TABLE IF NOT EXISTS buddies (
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'pending' | 'accepted'
  requested_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b)
);
CREATE TABLE IF NOT EXISTS daily_reports (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,             -- YYYY-MM-DD in the user's time zone
  done INTEGER NOT NULL,
  total INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);
