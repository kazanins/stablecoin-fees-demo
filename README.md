# Tempo Stablecoin Fees Demo

A split-pane demo showing how Tempo transaction fees can be paid in any supported stablecoin/token.

## Current behavior

- Passkey signup/login/logout (WebAuthn) in-browser.
- Signup auto-funds the account from Tempo testnet faucet.
- Session persists on refresh; logout clears active session.
- Transfer selector (left pane):
  - `10 alphaUSD`
  - `10 betaUSD`
  - `10 thetaUSD`
- Fee token selector (left pane):
  - `not specified`
  - `alphaUSD`
  - `betaUSD`
  - `thetaUSD`
- Call preview (right pane) updates automatically from current selections.
- Submit flow uses async send + confirmation wait:
  - send tx (`Actions.token.transfer`)
  - show pending hash
  - wait for receipt
  - show explorer link only after confirmation
- Improved error UX:
  - short user-friendly error message
  - expandable technical details panel
- Success feedback:
  - page shake animation on successful submission

## Tech stack

- React + Vite
- `viem` + `viem/tempo`
- Frontend-only app (no app backend required)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment variables

```bash
VITE_TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz
VITE_TEMPO_EXPLORER_TX_BASE=https://explore.moderato.tempo.xyz/tx/
```

If `VITE_TEMPO_EXPLORER_TX_BASE` is not set, the app uses `tempoModerato` chain explorer defaults from `viem`.

## Tempo testnet defaults in app

- Chain: `tempoModerato` (`42431`)
- RPC: `https://rpc.moderato.tempo.xyz`
- Explorer: `https://explore.moderato.tempo.xyz`
- TIP-20 addresses:
  - pathUSD: `0x20c0000000000000000000000000000000000000`
  - alphaUSD: `0x20c0000000000000000000000000000000000001`
  - betaUSD: `0x20c0000000000000000000000000000000000002`
  - thetaUSD: `0x20c0000000000000000000000000000000000003`

## Railway deployment

This repo is Railway-ready.

### Included files

- `railway.json` (Nixpacks + healthcheck)
- `railway-server.mjs` (serves built `dist/` and SPA fallback)

### Commands used by Railway

- Build: `npm run build`
- Start: `npm start`
- Healthcheck: `GET /health`

### Deploy steps

1. Create/import project in Railway from this repo.
2. Set environment variables:
   - `VITE_TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz`
   - `VITE_TEMPO_EXPLORER_TX_BASE=https://explore.moderato.tempo.xyz/tx/`
3. Deploy.

## Production note

This demo stores passkey credential metadata in browser local storage. For production, use a server-side key registry and account recovery/device portability strategy.
