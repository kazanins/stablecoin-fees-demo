# Tempo Stablecoin Fee Demo

Split-pane demo for Tempo stablecoin fee selection with passkey auth.

## What this demo does

- Left pane: sign up/login/logout with passkey, choose amount (1/10/100 pathUSD), choose fee token strategy.
- Right pane: display prepared call JSON and link to submitted transaction in Tempo explorer.
- Signup automatically triggers Tempo testnet faucet funding.
- Session persists across page refresh.
- Logout clears active session and requires login again.

## Stack

- Frontend only: React + Vite + `viem/tempo`
- No separate backend process required.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Optional env vars

```bash
VITE_TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz
VITE_TEMPO_EXPLORER_TX_BASE=https://explore.moderato.tempo.xyz/tx/
```

## Deploy to Railway

This repo is configured for Railway with `railway.json` and a production static server.

### What Railway runs

- Build: `npm run build`
- Start: `npm start` (serves `dist/` via `railway-server.mjs`)
- Health check: `GET /health`

### Railway setup

1. Create a new Railway project from this GitHub repo.
2. Add environment variables:
   - `VITE_TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz`
   - `VITE_TEMPO_EXPLORER_TX_BASE=https://explore.tempo.xyz/tx/`
3. Deploy.

Notes:
- Railway injects `PORT`; server binds to `0.0.0.0:$PORT`.
- The app is an SPA; unknown routes fallback to `dist/index.html`.

## Tempo testnet defaults wired in

- RPC: `https://rpc.moderato.tempo.xyz`
- Chain ID: `42431` (`tempoModerato`)
- Explorer: `https://explore.moderato.tempo.xyz`
- Tokens:
  - pathUSD: `0x20c0000000000000000000000000000000000000`
  - alphaUSD: `0x20c0000000000000000000000000000000000001`
  - betaUSD: `0x20c0000000000000000000000000000000000002`

## Notes

- Credential public key is stored in browser local storage for demo purposes.
- For production, store credential public keys server-side and implement stronger account recovery + device portability.
