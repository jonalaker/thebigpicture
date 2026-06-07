# Gasless Work Submission Setup

Users submit work for **free** — they only sign a message in their wallet, and a
relayer wallet you fund pays the gas. Built on ERC-2771 meta-transactions.

## How it works

```
User clicks "Submit Work"
   → signs an EIP-712 ForwardRequest (no gas, no MATIC needed)
   → POST /api/submit-work
   → relayer calls PINN44Forwarder.execute()  (relayer pays gas)
   → WorkSubmission.submitWork() runs, _msgSender() = the real user
```

Gasless applies only to bounties with **no native (MATIC) stake**. Staked
bounties fall back to the normal flow (user pays gas + stake) automatically.

## One-time deployment (you must do this — it needs a funded key)

ERC-2771's trusted forwarder is set **immutably** in the contract constructor,
and the current `WorkSubmission` was deployed with forwarder `0x0`. So we deploy
a forwarder **and a fresh `WorkSubmission`** that trusts it.

1. Install contract deps and set env (in repo root `.env`):
   ```
   RELAYER_PRIVATE_KEY=<private key of a wallet funded with POL/MATIC>
   POLYGON_RPC_URL=https://rpc-amoy.polygon.technology   # or your Alchemy URL
   ```

2. Deploy the gasless stack:
   ```bash
   cd contracts
   npm install
   npm run deploy:gasless
   ```
   It prints the new `PINN44Forwarder` and `WorkSubmission` addresses
   (also saved to `contracts/deployment-gasless.json`).

3. Put those in your web app env (`.env.local`):
   ```
   NEXT_PUBLIC_FORWARDER_ADDRESS=<PINN44Forwarder address>
   NEXT_PUBLIC_WORK_SUBMISSION_ADDRESS=<new WorkSubmission address>
   RELAYER_PRIVATE_KEY=<same funded relayer key>
   POLYGON_RPC_URL=<same RPC URL>
   ```

4. Keep the **relayer wallet funded with POL** — it pays every submission's gas.
   The API returns a 503 "out of gas funds" error if the relayer drops below
   0.02 POL.

> ⚠️ The new `WorkSubmission` starts empty. Recreate and fund your bounties
> against the new address (the old contract's bounties don't carry over).

## Turning it off

Leave `NEXT_PUBLIC_FORWARDER_ADDRESS` unset → the app silently uses the normal
(user-pays-gas) flow. No code changes needed.

## Security notes

- `/api/submit-work` only sponsors `submitWork(...)` calls to your configured
  `WorkSubmission` address, and only zero-value requests — the relayer can't be
  tricked into sponsoring arbitrary transactions.
- Forwarded gas is capped (1.5M) to limit cost per call.
- Consider adding rate limiting (per IP/wallet) before mainnet to prevent a
  griefer from draining the relayer; the airdrop route's fingerprint pattern is
  a good reference.

## Files involved

| File | Role |
|------|------|
| `contracts/contracts/PINN44Forwarder.sol` | ERC-2771 trusted forwarder |
| `contracts/scripts/deploy-gasless.ts` | Deploys forwarder + new WorkSubmission |
| `lib/gasless.ts` | Builds & signs the EIP-712 request (client) |
| `app/api/submit-work/route.ts` | Relay endpoint — pays the gas |
| `hooks/useContracts.ts` | `submitWorkGasless()` |
| `components/contracts/WorkSubmission.tsx` | Picks gasless when no stake |
| `lib/contracts/config.ts` / `abis.ts` | Forwarder address, name, ABI |
