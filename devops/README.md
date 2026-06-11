# DevOps

Infrastructure, CI/CD, Docker, and operational tooling.

## Layout

| Path | Description |
|------|-------------|
| `docker/` | Dockerfile, docker-compose files, entrypoint |
| `ci/.github/` | GitHub Actions workflows (symlinked from repo root `.github`) |
| `deploy/` | Helm charts and Pulumi configs |
| `scripts/` | Operational shell scripts |
| `tools/` | Dev setup, migration checks, piece publishing scripts |
| `benchmark/` | Performance benchmarks |
| `smoke-test/` | Smoke test suite |
| `.devcontainer/` | VS Code dev container config |

## Docker

Root-level symlinks point here for compatibility:

- `Dockerfile` → `devops/docker/Dockerfile`
- `docker-compose.yml` → `devops/docker/docker-compose.yml`
- `.github` → `devops/ci/.github`

```bash
docker compose -f devops/docker/docker-compose.yml up
```

## CI

Workflows live in `devops/ci/.github/workflows/`. GitHub Actions reads them via the root `.github` symlink.
