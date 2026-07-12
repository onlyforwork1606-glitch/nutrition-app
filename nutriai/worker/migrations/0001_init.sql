-- NutriAI D1 schema (SQLite / D1)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  google_id     TEXT UNIQUE,
  display_name  TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'anonymous', -- anonymous | google | email
  is_guest      INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

CREATE TABLE IF NOT EXISTS goals (
  user_id         TEXT PRIMARY KEY,
  calorie_goal    REAL NOT NULL DEFAULT 2200,
  protein_goal    REAL NOT NULL DEFAULT 140,
  carbs_goal      REAL NOT NULL DEFAULT 220,
  fat_goal        REAL NOT NULL DEFAULT 70,
  fiber_goal      REAL NOT NULL DEFAULT 30,
  weight_goal     REAL NOT NULL DEFAULT 80,
  height_cm       REAL NOT NULL DEFAULT 172,
  age             INTEGER NOT NULL DEFAULT 28,
  male            INTEGER NOT NULL DEFAULT 1,
  water_goal_ml   REAL NOT NULL DEFAULT 2500,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE TABLE IF NOT EXISTS meals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,            -- YYYY-MM-DD
  type        TEXT NOT NULL,            -- breakfast | lunch | snacks | dinner
  note        TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

CREATE TABLE IF NOT EXISTS meal_items (
  id           TEXT PRIMARY KEY,
  meal_id      TEXT NOT NULL,
  food_id      TEXT,                     -- reference to food_db / favorites
  name         TEXT NOT NULL,
  portion      TEXT,
  quantity     REAL NOT NULL DEFAULT 1,
  calories     REAL NOT NULL DEFAULT 0,
  protein      REAL NOT NULL DEFAULT 0,
  carbs        REAL NOT NULL DEFAULT 0,
  fat          REAL NOT NULL DEFAULT 0,
  fiber        REAL NOT NULL DEFAULT 0,
  confidence   REAL,
  source       TEXT NOT NULL DEFAULT 'ai', -- ai | db | manual
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER,
  FOREIGN KEY (meal_id) REFERENCES meals(id)
);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);

CREATE TABLE IF NOT EXISTS meal_images (
  id          TEXT PRIMARY KEY,
  meal_id     TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  url         TEXT,
  is_temp     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (meal_id) REFERENCES meals(id)
);
CREATE INDEX IF NOT EXISTS idx_meal_images_meal ON meal_images(meal_id);

CREATE TABLE IF NOT EXISTS daily_summary (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  date          TEXT NOT NULL,
  calories      REAL NOT NULL DEFAULT 0,
  protein       REAL NOT NULL DEFAULT 0,
  carbs         REAL NOT NULL DEFAULT 0,
  fat           REAL NOT NULL DEFAULT 0,
  fiber         REAL NOT NULL DEFAULT 0,
  water_ml      REAL NOT NULL DEFAULT 0,
  consistency   REAL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_user_date ON daily_summary(user_id, date);

CREATE TABLE IF NOT EXISTS weight_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  weight      REAL NOT NULL,
  note        TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_user_date ON weight_logs(user_id, date);

CREATE TABLE IF NOT EXISTS water_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  amount      REAL NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs(user_id, date);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  activity    TEXT NOT NULL,
  duration_min REAL,
  calories_burned REAL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_logs(user_id, date);

CREATE TABLE IF NOT EXISTS coach_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL,             -- user | assistant
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_coach_user ON coach_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS favorites (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  portion     TEXT,
  calories    REAL NOT NULL DEFAULT 0,
  protein     REAL NOT NULL DEFAULT 0,
  carbs       REAL NOT NULL DEFAULT 0,
  fat         REAL NOT NULL DEFAULT 0,
  fiber       REAL NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS food_db (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  aliases         TEXT,                    -- comma separated
  portion         TEXT,
  calories        REAL NOT NULL,
  protein         REAL NOT NULL,
  carbs           REAL NOT NULL,
  fat             REAL NOT NULL,
  fiber           REAL NOT NULL,
  source          TEXT NOT NULL DEFAULT 'curated', -- curated | usda | in_food
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_food_db_name ON food_db(name);

CREATE TABLE IF NOT EXISTS settings (
  user_id         TEXT PRIMARY KEY,
  units           TEXT NOT NULL DEFAULT 'metric',
  reduce_motion   INTEGER NOT NULL DEFAULT 0,
  notifications   INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS migration_history (
  version         TEXT PRIMARY KEY,
  applied_at      INTEGER NOT NULL,
  description     TEXT
);
