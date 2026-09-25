# INCOIS API Gateway

Express + TypeScript reverse proxy in front of the data-service.

- `GET /health` — gateway liveness; `GET /api/health` — gateway + data-service health.
- `GET|HEAD /api/*` — public, read-only, proxied to `DATA_SERVICE_URL` (scientific data is public).
- Mutating requests (`POST ...`) require `Authorization: Bearer <HS256 JWT signed with JWT_SECRET>`;
  they return 503 when `JWT_SECRET` is not configured. `ADMIN_API_TOKEN` is forwarded to the
  data-service for those requests.
- `POST /api/auth/login` exists only when `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set (no defaults).
- Per-IP rate limit (`RATE_LIMIT_PER_MINUTE`, default 600) and CORS from `CORS_ALLOWED_ORIGINS`.
- `/ws/live` WebSocket requires a JWT; no broadcast source is wired yet.

```bash
npm ci
npm run dev        # or: npm run build && npm start
```
