// Smart Contract ABIs
// Only include the functions needed for frontend interactions

export const PINN44_TOKEN_ABI = [
    // Read functions
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function antiBotEnabled() view returns (bool)',
    'function maxTxAmount() view returns (uint256)',
    'function maxWalletAmount() view returns (uint256)',

    // Write functions
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'function burn(uint256 amount)',

    // Events
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

export const STAKING_VESTING_ABI = [
    // Read functions
    'function token() view returns (address)',
    'function totalStaked() view returns (uint256)',
    'function getStakingTier(address staker) view returns (uint256)',
    'function getVestingScheduleCount(address beneficiary) view returns (uint256)',
    'function getClaimableVested(address beneficiary) view returns (uint256)',
    'function getPendingRewards(address staker) view returns (uint256)',
    'function stakes(address) view returns (uint256 amount, uint256 stakedAt, uint256 unstakeRequestedAt, uint256 pendingUnstake)',

    // Tier thresholds
    'function TIER_1_THRESHOLD() view returns (uint256)',
    'function TIER_2_THRESHOLD() view returns (uint256)',
    'function TIER_3_THRESHOLD() view returns (uint256)',

    // Write functions
    'function stake(uint256 amount)',
    'function requestUnstake(uint256 amount)',
    'function completeUnstake()',
    'function emergencyUnstake()',
    'function claimVested()',
    'function claimRewards()',

    // Events
    'event StakeDeposited(address indexed staker, uint256 amount, uint256 tier)',
    'event StakeWithdrawn(address indexed staker, uint256 amount, uint256 penalty)',
    'event UnstakeRequested(address indexed staker, uint256 amount, uint256 unlockTime)',
    'event VestingReleased(address indexed beneficiary, uint256 amount)',
    'event RewardsClaimed(address indexed staker, uint256 amount)',
];

export const WORK_SUBMISSION_ABI = [
    // Read functions
    'function bountyCount() view returns (uint256)',
    'function submissionCount() view returns (uint256)',
    'function bounties(uint256) view returns (uint256 id, string title, string description, address rewardToken, uint256 rewardAmount, uint256 stakeRequired, address stakeToken, uint256 deadline, uint8 state, address creator, uint256 submissionCount, bool funded)',
    'function submissions(uint256) view returns (uint256 id, uint256 bountyId, address submitter, string fileUri, string thumbnailUri, uint256 submittedAt, uint8 status, uint256 stakeAmount)',
    'function getBountySubmissions(uint256 bountyId) view returns (uint256[])',
    'function getSubmissionDetails(uint256 submissionId) view returns (uint256 bountyId, address submitter, string fileUri, string thumbnailUri, uint256 submittedAt, uint8 status)',
    'function isBountyOpen(uint256 bountyId) view returns (bool)',
    'function getActiveBountyCount() view returns (uint256)',
    'function stakesHeld(address) view returns (uint256)',
    'function totalBountiesFunded() view returns (uint256)',
    'function totalPayouts() view returns (uint256)',

    // Role functions
    'function BOUNTY_ADMIN() view returns (bytes32)',
    'function JUDGE_ROLE() view returns (bytes32)',
    'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
    'function hasRole(bytes32 role, address account) view returns (bool)',

    // Admin Write functions
    'function createBounty(string title, string description, address rewardToken, uint256 rewardAmount, uint256 stakeRequired, address stakeToken, uint256 deadline) returns (uint256)',
    'function fundBounty(uint256 bountyId)',
    'function startJudging(uint256 bountyId)',
    'function cancelBounty(uint256 bountyId)',
    'function selectWinner(uint256 bountyId, uint256 submissionId)',
    'function rejectSubmission(uint256 submissionId, bool slashStake)',
    'function refundAllStakes(uint256 bountyId)',

    // User Write functions
    'function submitWork(uint256 bountyId, string fileUri, string thumbnailUri) payable returns (uint256)',

    // Events
    'event BountyCreated(uint256 indexed bountyId, string title, address rewardToken, uint256 rewardAmount, uint256 deadline)',
    'event BountyFunded(uint256 indexed bountyId, uint256 amount)',
    'event BountyStateChanged(uint256 indexed bountyId, uint8 newState)',
    'event SubmissionReceived(uint256 indexed bountyId, uint256 indexed submissionId, address submitter, string fileUri)',
    'event WinnerSelected(uint256 indexed bountyId, uint256 indexed submissionId, address winner)',
    'event BountyPaid(uint256 indexed bountyId, address winner, uint256 amount)',
    'event StakeRefunded(address indexed submitter, uint256 amount)',
    'event StakeSlashed(address indexed submitter, uint256 amount)',
];

export const CONTRIBUTOR_VAULT_ABI = [
    // Read functions
    'function token() view returns (address)',
    'function getLockedBalance(address contributor) view returns (uint256)',
    'function getClaimableAmount(address contributor) view returns (uint256)',
    'function getLockCount(address contributor) view returns (uint256)',
    'function contributorStats(address) view returns (uint256 totalEarned, uint256 totalClaimed, uint256 lockedBalance)',

    // Write functions
    'function claimLockedTokens()',
    'function earlyUnlock() returns (uint256)',

    // Events
    'event RewardDistributed(address indexed contributor, uint256 total, uint256 immediate, uint256 locked, uint256 releaseTime)',
    'event LockedClaimed(address indexed contributor, uint256 amount)',
    'event Slashed(address indexed contributor, uint256 amount, address destination)',
];

export const GOVERNANCE_MODULE_ABI = [
    // Read functions
    'function proposalCount() view returns (uint256)',
    'function contributionPoints(address) view returns (uint256)',
    'function proposals(uint256) view returns (uint256 id, address proposer, string description, address target, bytes data, uint256 votesFor, uint256 votesAgainst, uint256 deadline, bool executed, bool cancelled)',
    'function hasVoted(uint256 proposalId, address voter) view returns (bool)',

    // Write functions
    'function createProposal(string description, address target, bytes data, uint256 votingPeriod) returns (uint256)',
    'function vote(uint256 proposalId, bool support)',
    'function executeProposal(uint256 proposalId)',

    // Events
    'event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description)',
    'event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)',
    'event ProposalExecuted(uint256 indexed proposalId)',
    'event ContributionRecorded(address indexed contributor, uint256 points)',
];

export const FIXED_PRICE_SWAP_ABI = [
    // Read functions
    'function pinn44Token() view returns (address)',
    'function paymentToken() view returns (address)',
    'function pricePerUnit() view returns (uint256)',
    'function saleActive() view returns (bool)',
    'function whitelistEnabled() view returns (bool)',
    'function availableForSale() view returns (uint256)',
    'function getTokensForPayment(uint256 paymentAmount) view returns (uint256)',
    'function getPaymentForTokens(uint256 tokenAmount) view returns (uint256)',
    'function getRemainingLimit(address buyer) view returns (uint256)',
    'function canBuy(address buyer) view returns (bool allowed, string reason)',
    'function getSaleStats() view returns (uint256 totalTokensSold, uint256 totalFundsRaised, uint256 availableTokens, uint256 currentPrice, bool isActive)',
    'function totalPurchased(address buyer) view returns (uint256)',
    'function maxPerWallet() view returns (uint256)',
    'function maxPerTx() view returns (uint256)',
    'function cooldownSeconds() view returns (uint256)',
    'function lastPurchaseTime(address) view returns (uint256)',
    'function whitelisted(address) view returns (bool)',

    // Write functions
    'function buyTokens(uint256 amount) returns (bool)',
    'function setPrice(uint256 newPrice)',
    'function setSaleActive(bool active)',
    'function setWhitelistEnabled(bool enabled)',
    'function setWhitelisted(address[] accounts, bool status)',
    'function setLimits(uint256 maxPerWallet, uint256 maxPerTx, uint256 cooldown)',
    'function depositTokens(uint256 amount)',
    'function withdrawFunds(address to, uint256 amount)',
    'function withdrawTokens(address to, uint256 amount)',

    // Events
    'event TokensPurchased(address indexed buyer, uint256 cost, uint256 tokensBought)',
    'event PriceUpdated(uint256 oldPrice, uint256 newPrice)',
    'event SaleStatusChanged(bool active)',
    'event TokensDeposited(uint256 amount)',
    'event FundsWithdrawn(address indexed to, uint256 amount)',
];
