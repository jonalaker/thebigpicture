# The Big Picture — Web3 MVP (PINN44)

This folder contains the standalone Web3 MVP built for The Big Picture platform.

The MVP is intentionally isolated so it does **not interfere with the existing website**.

---

## What This MVP Demonstrates

- MetaMask wallet connection
- Polygon Mainnet enforcement
- Automatic airdrop of 100 PINN tokens for first-time users
- Job listing display
- File submission to IPFS (via Pinata)
- On-chain IPFS hash reference
- Admin dashboard to:
  - View submissions
  - Open IPFS files
  - Select a winner
  - Send 5000 PINN tokens to the selected wallet

---

## Tech Stack

- Next.js (App Router)
- Polygon (ERC-20 PINN token)
- MetaMask
- IPFS (Pinata)
- Vercel-ready deployment

---


## Environment Variables

Create a `.env.local` file inside `mvp/frontend` with:

---
## How to Run Locally

```bash
cd mvp/frontend
npm install
npm run dev

Then Open 

http://localhost:3000
