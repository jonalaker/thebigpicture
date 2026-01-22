Token contract (ERC‑20 with extensions)
Standard: ERC‑20 with fixed supply of 10,000,000 tokens.

Permit: ERC20Permit for gasless approvals.

Meta‑tx: ERC2771Context to support trusted forwarder (gasless relayer).

Access control: Ownable (or Role-based: DEFAULT_ADMIN_ROLE, TREASURY_ROLE).

Anti‑bot (temporary): Max transaction limit, cooldown per block/seconds, optional dynamic tax; toggleable after 24–48 hours.

Minting policy: One-time mint at deployment; no further minting.

Burning: Optional burn function for buy‑back & burn program.

Events:

TokenInitialized: supply, owner, forwarder.

AntiBotStatusChanged: active/inactive.

MaxTxUpdated: new limit.

TokensBurned: amount, caller.

Contributor vault (payment splitter + lockbox)
Purpose: Automate reward distribution when a submission is approved.

Split logic: 50% immediate transfer to contributor; 50% auto‑locked for 90 days (configurable).

Lockbox: Per‑address struct with amount and releaseTime; supports multiple locks (queue) or aggregate with latest release.

Claiming: Contributors call claimLockedTokens() after cliff; optional linear vesting over 3 months post‑cliff.

Slashing (optional): Early unlock incurs fee (e.g., 20%) burned or sent to DAO.

Access control: onlyOwner or DAO role can distributeReward().

Events:

RewardDistributed: contributor, total, immediate, locked, releaseTime.

LockedClaimed: contributor, amount.

Slashed: contributor, amount, destination.

Staking & vesting contract (for team/admin/DAO/airdrop locks)
Team/admin vesting: 1‑year cliff, then 2‑year linear vesting.

DAO treasury vesting: 6‑month cliff, then 2‑year linear vesting.

Airdrop locks: “locked until first contribution or 6 months” logic; supports proof‑of‑work completion to unlock.

Contributor staking tiers: stake thresholds to access higher‑value tasks (e.g., 5,000 tokens).

Rewards: Optional staking yield (non‑inflationary—funded by DAO or buy‑back distribution).

Unstake rules: Cooldown and optional penalty to discourage rapid exits.

Events:

StakeDeposited: staker, amount, tier.

StakeWithdrawn: staker, amount, penalty.

VestingScheduleCreated/Released: beneficiary, amounts, timestamps.

Merkle distributor (airdrop claims)
Purpose: Gas‑efficient airdrops on signup via MetaMask.

Root management: Admin sets merkleRoot; supports multiple epochs.

Claim: claim(index, account, amount, proof) with replay protection.

Lock on claim: Claimed tokens routed to vesting/lock module rather than free balance.

Events:

AirdropRootSet: epoch, root.

AirdropClaimed: account, amount, epoch.

Governance/DAO integration
Treasury: Gnosis Safe multi‑sig holding DAO allocation and revenue.

On‑chain actions: Optional Aragon/XDAO module to execute contract calls after votes.

Off‑chain voting: Snapshot with ERC20Votes or staked-weight voting.

Contributions ledger: Points per contributor to drive profit‑share weights.

Events:

ProposalExecuted: id, target, function, params.

ContributionRecorded: contributor, points.

Buy‑back & burn / revenue distribution
Revenue intake: DAO receives USDC/MATIC from project sale or profits.

Buy‑back: Swap revenue for tokens on DEX; optionally burn or redistribute.

Profit share: Distribute stablecoins to contributors based on points or to all holders via snapshot.

Parameters: buy‑back percentage vs. distribution percentage; slippage limits; time‑weighted execution.

Events:

BuyBackExecuted: spentAsset, amountSpent, tokensBought, burned.

RevenueDistributed: asset, total, recipientsCount.

Liquidity management (ICO readiness)
Liquidity allocation: 15% of supply reserved for DEX after ICO.

LP locking: Send LP tokens to time‑lock (12 months+).

Range orders: Optional Uniswap V3 strategy to stabilize price bands.

Anti‑sniper launch mode: Enabled before adding liquidity; lifted after 24–48 hours.

Events:

LiquidityAdded: pool, tokenAmount, pairedAssetAmount.

LPLocked: locker, amount, unlockTime.

Gasless UX (paymaster/relayer compatibility)
Trusted forwarder: Set at deployment; updatable via admin with safety delay.

_msgSender override: ERC2771Context to read real user address.

Function whitelisting: claim, stake, distributeReward, vote—gasless via relayer.

Rate limits: Per‑address daily cap to prevent relayer abuse.

Events:

ForwarderUpdated: old, new.

GasSponsorshipPolicySet: functions, limits.

Token allocation schedule (10,000,000 total)
Contributor pool—40% (4,000,000):

Release: Per task/milestone via ContributorVault; 50% immediate, 50% locked 90 days; optional linear vest after cliff.

DAO treasury—20% (2,000,000):

Cliff: 6 months.

Vesting: Linear over 24 months.

Team/admin—15% (1,500,000):

Cliff: 12 months.

Vesting: Linear over 24 months.

DEX liquidity—15% (1,500,000):

Lock: Until ICO/public launch; LP tokens locked for ≥12 months.

Community airdrop—10% (1,000,000):

Claim: Merkle distributor.

Lock: Immediate small amount visible; majority locked until first contribution or 6 months.



Core Functionalities Requested
1. Work Submission System
Workers can submit files (images, code, documents, HD videos).

Each submission is stored on IPFS (decentralized storage).

Smart contract records:

Worker’s wallet address

File URI (IPFS CID)

Optional thumbnail URI (for large video previews).

2. DAO Governance & Judging
DAO members can view submissions via frontend gallery.

Voting or admin selection determines the winner.

Ability to toggle submissions open/closed (state machine logic).

Option to add time deadlines (auto-close after X days).

3. Auto-Payment Logic
Escrow system: DAO funds the bounty contract with tokens (e.g., USDC, MATIC).

Once a winner is selected:

Contract automatically transfers pre-funded tokens to the winner’s wallet.

Uses ERC20 interface for token transfers.

Secure flow: requires DAO approval before contract can spend tokens.

4. Funding Workflow
DAO admin must first approve the contract to spend tokens.

Then calls fundBounty() to deposit tokens into the contract.

Contract holds funds until payout.

5. Submission Gallery & Display
DAO dashboard shows all submissions:

Thumbnails for quick browsing.

Lazy-loading for HD videos (only load when clicked).

Real-time submission counter (number of entries).

Status indicators: “Pending” vs “Paid”.

6. Large File Handling
Hybrid storage: only store CID on-chain, actual file on IPFS.

Progress bar for uploads (to handle multi-GB video files).

Optional Livepeer integration for transcoding HD videos.

7. Security & Anti-Spam
“Stake to Submit” option:

Workers deposit a small token amount (e.g., 1 MATIC) to submit.

Prevents spam and ensures serious entries.

Stake can be refunded after judging.