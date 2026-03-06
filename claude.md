My project is built on Polygon testnet (Amoy, chain ID 80002, CAIP-2: eip155:80002)
- Use Polygon’s official Amoy testnet facilitator: https://x402-amoy.polygon.technology (do NOT use https://www.x402.org/facilitator as it does not support Polygon Amoy)
- For production later: switch to Polygon mainnet (eip155:137) with facilitator https://x402.polygon.technology
- Price: exactly $0.02 per chatbot message/response (in USDC)
- Receiving wallet: placeholder 0xYourPolygonAddressHere (I'll replace it)
- Libraries: Use official x402 packages only — @x402/express, @x402/evm, @x402/core for server; @x402/fetch, @x402/evm/exact/client for client
- Backend: Node.js + Express (or Next.js API routes)
- Frontend: React / Next.js with fetch or axios, assuming user has an EVM wallet like MetaMask connected to Polygon Amoy

Exact requirements:
- Backend: Protect the POST /api/chat route with x402 paymentMiddleware.
  - If no valid PAYMENT-SIGNATURE header → return HTTP 402 with proper payment instructions (exact EVM scheme on eip155:80002)
  - After verification via the Polygon facilitator → execute the real chatbot logic (call your LLM — use a placeholder like console.log or mock response for now)
- Frontend: Wrap fetch calls so they automatically detect 402 → prompt wallet to sign/pay → retry the request seamlessly.
- Use "exact" payment scheme (simple USDC transfer via EIP-712 signature, no on-chain tx from user)
- Handle wallet connection (simple viem or wagmi example is fine)
- Add basic UI feedback: "Pay $0.02 in USDC to send message" when needed, loading states, error handling (wrong network, insufficient balance, payment rejected)

Important rules:
- Network MUST be "eip155:80002" for Amoy testnet in all config (accepts array, register call, etc.)
- Facilitator client MUST use url: "https://x402-amoy.polygon.technology"
- Do NOT use Base Sepolia (84532) or the default x402.org facilitator anywhere — they won't verify Polygon payments
- Testnet only for now: users get free test USDC/MATIC from Polygon Amoy faucets (e.g. https://faucet.polygon.technology)
- Include installation commands: npm install @x402/express @x402/evm @x402/core @x402/fetch etc.
- Add comments explaining how to switch to Polygon mainnet later (change network to eip155:137, facilitator to https://x402.polygon.technology)