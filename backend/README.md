# Backend

Server-side code for Activepieces: API, worker, engine, shared types, pieces, and CLI.

## Packages

| Path | Description |
|------|-------------|
| `packages/server/api` | Fastify API server |
| `packages/server/worker` | BullMQ job worker |
| `packages/server/engine` | Flow execution engine |
| `packages/server/utils` | Shared server utilities |
| `packages/shared` | Shared types and utilities (used by frontend too) |
| `packages/pieces` | Integration pieces (framework, core, community) |
| `packages/cli` | CLI for piece development |

## Commands (from repo root)

```bash
npm run dev:backend          # API + engine
npm run serve:backend        # API only
npm run serve:engine         # Engine only
npm run serve:worker         # Worker only
npm run db-migration         # Run database migrations
npm run test-api             # API integration tests
npm run lint-pieces          # Lint all pieces
```
