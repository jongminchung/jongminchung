# Translation Gateway Docker

The extension always calls the LibreTranslate-compatible endpoint:

```bash
http://127.0.0.1:5000/translate
```

Docker now exposes that endpoint through the `gateway` service. The gateway chooses a provider with `TRANSLATION_PROFILE`, so the extension storage/default endpoint does not change.

## Default LibreTranslate Profile

Start the reliable local Docker profile:

```bash
bun run docker:up
```

This starts:

- `gateway` on `127.0.0.1:5000`.
- `libretranslate` as the internal upstream at `http://libretranslate:5000/translate`.
- optional direct LibreTranslate debug port on `127.0.0.1:5001`.

The compose file stores downloaded Argos models in the `libretranslate-data` Docker volume and loads English/Korean by default.

Health check:

```bash
curl http://127.0.0.1:5000/health
```

Translate check:

```bash
curl -s http://127.0.0.1:5000/translate \
  -H 'Content-Type: application/json' \
  -d '{"q":"Hello world","source":"en","target":"ko","format":"text"}'
```

## MLX-LM Profile

MLX-LM runs on the macOS host, not inside Docker. The Docker gateway calls the host server through `host.docker.internal`.

Install MLX-LM on the host if needed:

```bash
uv tool install --force 'mlx-lm==0.29.1' \
  --with 'transformers<5' \
  --with 'mlx<0.31.2' \
  --with 'mlx-metal<0.31.2'
```

This pin avoids the current `transformers>=5` tokenizer registration failure in `mlx-lm 0.31.3` and the `mlx 0.31.2` server stream regression.

Start the host model server:

```bash
bun run mlx:serve
```

This binds MLX-LM to `0.0.0.0:8000` by default so Docker can reach it through `host.docker.internal:8000`.

Start the Docker gateway in MLX mode:

```bash
bun run docker:up:mlx
```

The recommended M1 Pro 16GB default is:

```bash
mlx-community/Qwen3-4B-Instruct-2507-4bit
```

If latency is too high, switch the host model only:

```bash
MLX_MODEL=mlx-community/Qwen3-1.7B-4bit bun run mlx:serve
```

No extension code or UI change is needed. The extension still calls `http://127.0.0.1:5000/translate`.

## Environment

| Variable                    | Default                                     |
| --------------------------- | ------------------------------------------- |
| `TRANSLATION_PROFILE`       | `libretranslate`                            |
| `LIBRETRANSLATE_URL`        | `http://libretranslate:5000/translate`      |
| `MLX_BASE_URL`              | `http://host.docker.internal:8000/v1`       |
| `MLX_MODEL`                 | `mlx-community/Qwen3-4B-Instruct-2507-4bit` |
| `MLX_FALLBACK_MODEL`        | `mlx-community/Qwen3-1.7B-4bit`             |
| `MLX_TEMPERATURE`           | `0`                                         |
| `MLX_MAX_TOKENS`            | `1024`                                      |
| `LIBRETRANSLATE_DEBUG_PORT` | `5001`                                      |

## Stop

```bash
bun run docker:down
```
