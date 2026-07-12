# NutriAI — API Reference

Base URL: `VITE_API_BASE` (empty = same-origin Pages Functions). All requests
send credentials (the session cookie) and expect `application/json`.

## Auth model

- Anonymous: the Worker auto-creates a user on first request and sets a
  `nutriai_session` HttpOnly cookie.
- Google: `GET /api/auth/google` → redirect → `GET /api/auth/google/callback`.
- `POST /api/auth/logout` clears the cookie.

## Endpoints

### `GET /api/health`
Returns `{ status, environment, hasOpenRouterKey }`.

### `POST /api/vision`
Body: `{ image: dataUrl, date?: "YYYY-MM-DD" }`.
- Uploads the image to R2 (temp), calls the vision model, reconciles foods
  against `food_db`.
- Returns `{ foods: FoodItem[] }` where each item has
  `name, portion, calories, protein, carbs, fat, fiber, confidence, source, foodId`.

### `GET /api/coach`
Returns `{ messages: { role, content, created_at }[] }` (chat history).

### `POST /api/coach`
Body: `{ message: string, context?: string, history?: {role,content}[] }`.
- `context` is a JSON string of the user's nutrition data (built client-side);
  the server injects it into the system prompt. If omitted, the server builds
  context from D1.
- Returns `{ message: string }`.

### `GET /api/goals` · `PUT /api/goals`
Read/update the user's daily goals (calories, protein, carbs, fat, fiber,
water, body metrics).

### `GET /api/meals?date=YYYY-MM-DD` · `POST /api/meals`
List/save meals for a date. Body meal: `{ id, date, type, note?, items[] }`.

### `POST /api/weight` · `POST /api/water` · `POST /api/exercise`
Log a weight (`{date, weight}`), water (`{date, amount}`), or exercise
(`{date, activity, duration_min?, calories_burned?}`).

### `GET /api/progress`
Returns `{ weight[], water[], exercise[] }` history.

### `GET /api/auth/session`
Returns `{ user }` for the current session.

## Errors
JSON `{ error }`. `rate_limited` → 429. Validation failures → 400/422.
Upstream AI failures → 502.
