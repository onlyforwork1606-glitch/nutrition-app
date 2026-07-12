# NutriAI — Database (D1)

D1 is a SQLite-compatible database. Migrations live in `worker/migrations/`.

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth identity (anonymous / google / email), soft-delete |
| `goals` | Daily nutrition + body targets |
| `meals` | A meal entry (breakfast/lunch/snacks/dinner) for a date |
| `meal_items` | Individual foods inside a meal (the nutrition rows) |
| `meal_images` | R2 keys + URLs for meal photos |
| `daily_summary` | Aggregated daily totals + consistency |
| `weight_logs` | Weight history |
| `water_logs` | Water intake history |
| `exercise_logs` | Activity history |
| `coach_messages` | Chat history with the AI coach |
| `favorites` | User-saved foods |
| `food_db` | Curated / USDA nutrition reference (used to correct AI estimates) |
| `settings` | Per-user app settings |
| `migration_history` | Applied migration versions |

## Conventions
- All tables use `created_at` / `updated_at` (epoch ms) and soft-delete via
  `deleted_at` (nullable). Queries filter `deleted_at IS NULL`.
- Foreign keys reference `users.id` where relevant.
- Indexes exist on `(user_id, date)` for time-series tables.

## `food_db` and nutrition accuracy
AI vision estimates are reconciled against `food_db` by fuzzy name match
(Levenshtein + substring). When a match scores ≥ 0.6 the curated per-100g
values replace the model's numbers, scaled to the detected portion. This keeps
reported calories/protein from drifting due to hallucination.

Seed the curated list once: it is idempotent and runs automatically on the
first `/api/vision` call (`NutritionService.seedIfEmpty`).
