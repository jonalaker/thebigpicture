// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title WorkSubmission
 * @notice Bounty system for work submissions with IPFS storage and auto-payment
 * @dev Features:
 *      - Submit work with IPFS URIs
 *      - State machine (Open -> Judging -> Completed)
 *      - Optional stake-to-submit anti-spam
 *      - Escrow and auto-payment to winners
 */
contract WorkSubmission is ERC2771Context, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    bytes32 public constant BOUNTY_ADMIN = keccak256("BOUNTY_ADMIN");
    bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");
    
    // ============ Enums ============
    enum BountyState { Open, Judging, Completed, Cancelled }
    enum SubmissionStatus { Pending, Winner, Rejected, Refunded }
    
    // ============ Structs ============
    struct Bounty {
        uint256 id;
        string title;
        string description;
        address rewardToken;
        uint256 rewardAmount;
        uint256 stakeRequired; // 0 = no stake
        address stakeToken; // Token for stake (can be MATIC via wrapper)
        uint256 deadline; // 0 = no deadline
        BountyState state;
        address creator;
        uint256 submissionCount;
        bool funded;
    }
    
    struct Submission {
        uint256 id;
        uint256 bountyId;
        address submitter;
        string fileUri; // IPFS CID
        string thumbnailUri; // Optional thumbnail for videos
        uint256 submittedAt;
        SubmissionStatus status;
        uint256 stakeAmount;
    }
    
    // ============ State ============
    mapping(uint256 => Bounty) public bounties;
    uint256 public bountyCount;
    
    mapping(uint256 => Submission) public submissions;
    uint256 public submissionCount;
    
    // Bounty => Submission IDs
    mapping(uint256 => uint256[]) public bountySubmissions;
    
    // Submitter => Stake amounts held
    mapping(address => uint256) public stakesHeld;
    
    // Stats
    uint256 public totalBountiesFunded;
    uint256 public totalPayouts;
    
    // ============ Events ============
    event BountyCreated(
        uint256 indexed bountyId,
        string title,
        address rewardToken,
        uint256 rewardAmount,
        uint256 deadline
    );
    event BountyFunded(uint256 indexed bountyId, uint256 amount);
    event BountyStateChanged(uint256 indexed bountyId, BountyState newState);
    event SubmissionReceived(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address submitter,
        string fileUri
    );
    event WinnerSelected(uint256 indexed bountyId, uint256 indexed submissionId, address winner);
    event BountyPaid(uint256 indexed bountyId, address winner, uint256 amount);
    event StakeRefunded(address indexed submitter, uint256 amount);
    event StakeSlashed(address indexed submitter, uint256 amount);
    
    // ============ Constructor ============
    constructor(
        address trustedForwarder,
        address admin
    ) ERC2771Context(trustedForwarder) {
        require(admin != address(0), "Invalid admin");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BOUNTY_ADMIN, admin);
        _grantRole(JUDGE_ROLE, admin);
    }
    
    // ============ Bounty Management ============
    
    /**
     * @notice Create a new bounty
     */
    function createBounty(
        string calldata title,
        string calldata description,
        address rewardToken,
        uint256 rewardAmount,
        uint256 stakeRequired,
        address stakeToken,
        uint256 deadline
    ) external onlyRole(BOUNTY_ADMIN) returns (uint256) {
        require(bytes(title).length > 0, "Title required");
        require(rewardToken != address(0), "Invalid reward token");
        require(rewardAmount > 0, "Reward required");
        require(deadline == 0 || deadline > block.timestamp, "Invalid deadline");
        
        bountyCount++;
        
        bounties[bountyCount] = Bounty({
            id: bountyCount,
            title: title,
            description: description,
            rewardToken: rewardToken,
            rewardAmount: rewardAmount,
            stakeRequired: stakeRequired,
            stakeToken: stakeToken,
            deadline: deadline,
            state: BountyState.Open,
            creator: _msgSender(),
            submissionCount: 0,
            funded: false
        });
        
        emit BountyCreated(bountyCount, title, rewardToken, rewardAmount, deadline);
        
        return bountyCount;
    }
    
    /**
     * @notice Fund a bounty with reward tokens
     */
    function fundBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.id != 0, "Bounty not found");
        require(!bounty.funded, "Already funded");
        require(bounty.state == BountyState.Open, "Not open");
        
        IERC20(bounty.rewardToken).safeTransferFrom(
            _msgSender(),
            address(this),
            bounty.rewardAmount
        );
        
        bounty.funded = true;
        totalBountiesFunded += bounty.rewardAmount;
        
        emit BountyFunded(bountyId, bounty.rewardAmount);
    }
    
    /**
     * @notice Move bounty to judging phase
     */
    function startJudging(uint256 bountyId) external onlyRole(BOUNTY_ADMIN) {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.state == BountyState.Open, "Not open");
        
        bounty.state = BountyState.Judging;
        
        emit BountyStateChanged(bountyId, BountyState.Judging);
    }
    
    /**
     * @notice Cancel bounty (refund if funded)
     */
    function cancelBounty(uint256 bountyId) external onlyRole(BOUNTY_ADMIN) nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.state != BountyState.Completed, "Already completed");
        require(bounty.state != BountyState.Cancelled, "Already cancelled");
        
        bounty.state = BountyState.Cancelled;
        
        // Refund creator if funded
        if (bounty.funded) {
            IERC20(bounty.rewardToken).safeTransfer(bounty.creator, bounty.rewardAmount);
            bounty.funded = false;
        }
        
        emit BountyStateChanged(bountyId, BountyState.Cancelled);
    }
    
    // ============ Submission Functions ============
    
    /**
     * @notice Submit work for a bounty
     */
    function submitWork(
        uint256 bountyId,
        string calldata fileUri,
        string calldata thumbnailUri
    ) external payable nonReentrant returns (uint256) {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.id != 0, "Bounty not found");
        require(bounty.state == BountyState.Open, "Not accepting submissions");
        require(bounty.deadline == 0 || block.timestamp <= bounty.deadline, "Deadline passed");
        require(bytes(fileUri).length > 0, "File URI required");
        
        address submitter = _msgSender();
        uint256 stakeAmount = 0;
        
        // Handle stake if required
        if (bounty.stakeRequired > 0) {
            if (bounty.stakeToken == address(0)) {
                // Native token stake (MATIC)
                require(msg.value >= bounty.stakeRequired, "Insufficient stake");
                stakeAmount = bounty.stakeRequired;
                // Refund excess
                if (msg.value > bounty.stakeRequired) {
                    payable(submitter).transfer(msg.value - bounty.stakeRequired);
                }
            } else {
                // ERC20 stake
                IERC20(bounty.stakeToken).safeTransferFrom(
                    submitter,
                    address(this),
                    bounty.stakeRequired
                );
                stakeAmount = bounty.stakeRequired;
            }
            stakesHeld[submitter] += stakeAmount;
        }
        
        submissionCount++;
        bounty.submissionCount++;
        
        submissions[submissionCount] = Submission({
            id: submissionCount,
            bountyId: bountyId,
            submitter: submitter,
            fileUri: fileUri,
            thumbnailUri: thumbnailUri,
            submittedAt: block.timestamp,
            status: SubmissionStatus.Pending,
            stakeAmount: stakeAmount
        });
        
        bountySubmissions[bountyId].push(submissionCount);
        
        emit SubmissionReceived(bountyId, submissionCount, submitter, fileUri);
        
        return submissionCount;
    }
    
    // ============ Judging Functions ============
    
    /**
     * @notice Select winner and trigger auto-payment
     */
    function selectWinner(
        uint256 bountyId,
        uint256 submissionId
    ) external onlyRole(JUDGE_ROLE) nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        Submission storage submission = submissions[submissionId];
        
        require(bounty.id != 0, "Bounty not found");
        require(bounty.funded, "Not funded");
        require(
            bounty.state == BountyState.Open || bounty.state == BountyState.Judging,
            "Invalid state"
        );
        require(submission.bountyId == bountyId, "Submission mismatch");
        require(submission.status == SubmissionStatus.Pending, "Already processed");
        
        // Mark submission as winner
        submission.status = SubmissionStatus.Winner;
        bounty.state = BountyState.Completed;
        
        address winner = submission.submitter;
        
        // Auto-pay winner
        IERC20(bounty.rewardToken).safeTransfer(winner, bounty.rewardAmount);
        totalPayouts += bounty.rewardAmount;
        
        // Refund winner's stake
        if (submission.stakeAmount > 0) {
            _refundStake(submission);
        }
        
        emit WinnerSelected(bountyId, submissionId, winner);
        emit BountyPaid(bountyId, winner, bounty.rewardAmount);
        emit BountyStateChanged(bountyId, BountyState.Completed);
    }
    
    /**
     * @notice Reject a submission (stake can be slashed or refunded)
     */
    function rejectSubmission(
        uint256 submissionId,
        bool slashStake
    ) external onlyRole(JUDGE_ROLE) nonReentrant {
        Submission storage submission = submissions[submissionId];
        require(submission.id != 0, "Submission not found");
        require(submission.status == SubmissionStatus.Pending, "Already processed");
        
        submission.status = SubmissionStatus.Rejected;
        
        if (submission.stakeAmount > 0) {
            if (slashStake) {
                // Slash stake (keep in contract for DAO)
                stakesHeld[submission.submitter] -= submission.stakeAmount;
                emit StakeSlashed(submission.submitter, submission.stakeAmount);
            } else {
                _refundStake(submission);
            }
        }
    }
    
    /**
     * @notice Refund all stakes after bounty completion/cancellation
     */
    function refundAllStakes(uint256 bountyId) external onlyRole(BOUNTY_ADMIN) nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(
            bounty.state == BountyState.Completed || bounty.state == BountyState.Cancelled,
            "Bounty still active"
        );
        
        uint256[] storage subIds = bountySubmissions[bountyId];
        
        for (uint256 i = 0; i < subIds.length; i++) {
            Submission storage sub = submissions[subIds[i]];
            if (sub.stakeAmount > 0 && sub.status != SubmissionStatus.Refunded) {
                if (sub.status == SubmissionStatus.Pending) {
                    sub.status = SubmissionStatus.Refunded;
                }
                _refundStake(sub);
            }
        }
    }
    
    function _refundStake(Submission storage submission) internal {
        uint256 amount = submission.stakeAmount;
        if (amount == 0) return;
        
        address submitter = submission.submitter;
        Bounty storage bounty = bounties[submission.bountyId];
        
        submission.stakeAmount = 0;
        stakesHeld[submitter] -= amount;
        
        if (bounty.stakeToken == address(0)) {
            payable(submitter).transfer(amount);
        } else {
            IERC20(bounty.stakeToken).safeTransfer(submitter, amount);
        }
        
        emit StakeRefunded(submitter, amount);
    }
    
    // ============ View Functions ============
    
    function getBountySubmissions(uint256 bountyId) external view returns (uint256[] memory) {
        return bountySubmissions[bountyId];
    }
    
    function getSubmissionDetails(uint256 submissionId) external view returns (
        uint256 bountyId,
        address submitter,
        string memory fileUri,
        string memory thumbnailUri,
        uint256 submittedAt,
        SubmissionStatus status
    ) {
        Submission storage sub = submissions[submissionId];
        return (
            sub.bountyId,
            sub.submitter,
            sub.fileUri,
            sub.thumbnailUri,
            sub.submittedAt,
            sub.status
        );
    }
    
    function isBountyOpen(uint256 bountyId) external view returns (bool) {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.state != BountyState.Open) return false;
        if (bounty.deadline > 0 && block.timestamp > bounty.deadline) return false;
        return true;
    }
    
    function getActiveBountyCount() external view returns (uint256 count) {
        for (uint256 i = 1; i <= bountyCount; i++) {
            if (bounties[i].state == BountyState.Open || bounties[i].state == BountyState.Judging) {
                count++;
            }
        }
    }
    
    // ============ Admin ============
    
    /**
     * @notice Withdraw slashed stakes to DAO
     */
    function withdrawSlashedStakes(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
    
    // ============ ERC2771 Overrides ============
    
    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    
    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    
    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
