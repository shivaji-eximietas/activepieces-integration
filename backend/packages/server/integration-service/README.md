# integration-service

A standalone backend service that runs independently from the Activepieces `api`.
It has its own Fastify server, its own package, and its own HTTP port (`4000` by
default), but reuses the shared type contract from `@activepieces/shared` so it
stays in sync with the rest of the platform.

## Run

```bash
# from the repo root
npm run serve:integration-service
# or directly
npx turbo run serve --filter=integration-service
```

The service listens on `http://localhost:4000`.

## Configuration

| Env var                       | Default     | Description              |
| ----------------------------- | ----------- | ------------------------ |
| `INTEGRATION_SERVICE_PORT`    | `4000`      | HTTP port to listen on   |
| `INTEGRATION_SERVICE_HOST`    | `0.0.0.0`   | Host/interface to bind   |

## Endpoints

| Method | Path          | Description          |
| ------ | ------------- | -------------------- |
| GET    | `/v1/health`  | Liveness check       |
| GET    | `/v1/items`   | Sample items list    |

## Copying out of the monorepo

This package is intentionally self-contained. To extract it into its own repo:

1. Copy the `integration-service` folder out.
2. Replace the `@activepieces/shared` workspace dependency with either a published
   version of that package or a local copy of the types you use.
3. Keep `fastify`, `@fastify/cors`, and `fastify-plugin` as normal dependencies.
