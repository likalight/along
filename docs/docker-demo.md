# Along shopper — Docker demo (on-device)

Run the Along shopper demo with a single Compose command. The container listens on `0.0.0.0:3000` so other devices on the LAN can open the UI.

## Requirements

- Docker Engine + Docker Compose v2
- Node is **not** required on the host

## Run

```sh
cp .env.example .env
# Optional: set OPENAI_API_KEY in .env for live GPT-Live voice mint
docker compose up --build
```

On the demo device (or any device on the same network):

```text
http://<device-ip>:3000
```

On the host machine itself: `http://127.0.0.1:3000`.

Stop with `Ctrl+C`, or `docker compose down`.

## Notes

- **Text demo** works without `OPENAI_API_KEY` (in-memory `/api/session` fixture; no DB).
- **Voice mint** needs `OPENAI_API_KEY`; without it the mint path returns `not_connected`.
- Local `npm run start` / `npm run dev` still bind `127.0.0.1` by design; only the Compose/Docker CMD overrides to `0.0.0.0`.
- Change the published host port with `ALONG_PORT` in `.env` (default `3000`).

## Service

| Compose service | Container name | Port |
| --- | --- | --- |
| `along-shopper` | `along-shopper` | `3000` |
