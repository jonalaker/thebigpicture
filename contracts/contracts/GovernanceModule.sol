// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title GovernanceModule
 * @notice DAO coordination: contribution points, profit-share weights, proposal execution
 * @dev Designed to work with Gnosis Safe and off-chain voting (Snapshot)
 */
contract GovernanceModule is ERC2771Context, AccessControl, ReentrancyGuard {
    // ============ Roles ============
    bytes32 public constant POINTS_ADMIN = keccak256("POINTS_ADMIN");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    
    // ============ State ============
    mapping(address => uint256) public contributionPoints;
    address[] public contributors;
    mapping(address => bool) public isContributor;
    uint256 public totalPoints;
    
    // Proposal tracking
    struct Proposal {
        uint256 id;
        address target;
        bytes data;
        bool executed;
        uint256 executedAt;
    }
    
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    // ============ Events ============
    event ContributionRecorded(address indexed contributor, uint256 points, uint256 newTotal);
    event ContributionDeducted(address indexed contributor, uint256 points, uint256 newTotal);
    event ProposalExecuted(uint256 indexed id, address target, bytes data);
    event ProposalQueued(uint256 indexed id, address target, bytes4 selector);
    
    // ============ Constructor ============
    constructor(
        address trustedForwarder,
        address admin,
        address executor
    ) ERC2771Context(trustedForwarder) {
        require(admin != address(0), "Invalid admin");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POINTS_ADMIN, admin);
        if (executor != address(0)) {
            _grantRole(EXECUTOR_ROLE, executor);
        }
    }
    
    // ============ Contribution Points ============
    
    /**
     * @notice Record contribution points for a contributor
     */
    function recordContribution(
        address contributor,
        uint256 points
    ) external onlyRole(POINTS_ADMIN) {
        require(contributor != address(0), "Invalid contributor");
        require(points > 0, "Points must be positive");
        
        if (!isContributor[contributor]) {
            contributors.push(contributor);
            isContributor[contributor] = true;
        }
        
        contributionPoints[contributor] += points;
        totalPoints += points;
        
        emit ContributionRecorded(contributor, points, contributionPoints[contributor]);
    }
    
    /**
     * @notice Batch record contributions
     */
    function recordContributionsBatch(
        address[] calldata _contributors,
        uint256[] calldata points
    ) external onlyRole(POINTS_ADMIN) {
        require(_contributors.length == points.length, "Length mismatch");
        
        for (uint256 i = 0; i < _contributors.length; i++) {
            address contributor = _contributors[i];
            uint256 pts = points[i];
            
            if (contributor == address(0) || pts == 0) continue;
            
            if (!isContributor[contributor]) {
                contributors.push(contributor);
                isContributor[contributor] = true;
            }
            
            contributionPoints[contributor] += pts;
            totalPoints += pts;
            
            emit ContributionRecorded(contributor, pts, contributionPoints[contributor]);
        }
    }
    
    /**
     * @notice Deduct points (for penalties or adjustments)
     */
    function deductContribution(
        address contributor,
        uint256 points
    ) external onlyRole(POINTS_ADMIN) {
        require(contributionPoints[contributor] >= points, "Insufficient points");
        
        contributionPoints[contributor] -= points;
        totalPoints -= points;
        
        emit ContributionDeducted(contributor, points, contributionPoints[contributor]);
    }
    
    // ============ Profit Share Calculation ============
    
    /**
     * @notice Calculate profit share weight for a contributor
     * @return weight Scaled by 1e18 (e.g., 0.5 = 500000000000000000)
     */
    function getProfitShareWeight(address contributor) external view returns (uint256) {
        if (totalPoints == 0) return 0;
        return (contributionPoints[contributor] * 1e18) / totalPoints;
    }
    
    /**
     * @notice Calculate share amount for given total distribution
     */
    function calculateShare(
        address contributor,
        uint256 totalAmount
    ) external view returns (uint256) {
        if (totalPoints == 0) return 0;
        return (totalAmount * contributionPoints[contributor]) / totalPoints;
    }
    
    /**
     * @notice Get all contributors with their weights
     */
    function getContributorsWithWeights() external view returns (
        address[] memory,
        uint256[] memory,
        uint256[] memory
    ) {
        uint256 length = contributors.length;
        uint256[] memory points = new uint256[](length);
        uint256[] memory weights = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            points[i] = contributionPoints[contributors[i]];
            weights[i] = totalPoints > 0 ? (points[i] * 1e18) / totalPoints : 0;
        }
        
        return (contributors, points, weights);
    }
    
    // ============ Proposal Execution ============
    
    /**
     * @notice Queue a proposal for transparency
     */
    function queueProposal(
        address target,
        bytes calldata data
    ) external onlyRole(EXECUTOR_ROLE) returns (uint256) {
        proposalCount++;
        
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            target: target,
            data: data,
            executed: false,
            executedAt: 0
        });
        
        bytes4 selector = bytes4(data[:4]);
        emit ProposalQueued(proposalCount, target, selector);
        
        return proposalCount;
    }
    
    /**
     * @notice Execute a contract call after DAO vote
     * @dev Only callable by executor (Gnosis Safe or timelock)
     */
    function executeProposal(
        uint256 proposalId
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (bytes memory) {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id != 0, "Proposal not found");
        require(!proposal.executed, "Already executed");
        
        proposal.executed = true;
        proposal.executedAt = block.timestamp;
        
        (bool success, bytes memory result) = proposal.target.call(proposal.data);
        require(success, "Execution failed");
        
        emit ProposalExecuted(proposalId, proposal.target, proposal.data);
        
        return result;
    }
    
    /**
     * @notice Direct execution (for simple calls from multi-sig)
     */
    function execute(
        address target,
        bytes calldata data
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (bytes memory) {
        proposalCount++;
        
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            target: target,
            data: data,
            executed: true,
            executedAt: block.timestamp
        });
        
        (bool success, bytes memory result) = target.call(data);
        require(success, "Execution failed");
        
        emit ProposalExecuted(proposalCount, target, data);
        
        return result;
    }
    
    // ============ View Functions ============
    
    function getContributorCount() external view returns (uint256) {
        return contributors.length;
    }
    
    function getContributorAtIndex(uint256 index) external view returns (address, uint256) {
        require(index < contributors.length, "Invalid index");
        address contributor = contributors[index];
        return (contributor, contributionPoints[contributor]);
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
