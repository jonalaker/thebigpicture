import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Configuration
    const TRUSTED_FORWARDER = process.env.TRUSTED_FORWARDER || deployer.address; // Use deployer as placeholder
    const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;
    const DAO = process.env.DAO_ADDRESS || deployer.address;
    const UNISWAP_ROUTER = process.env.UNISWAP_ROUTER || "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // QuickSwap on Polygon

    console.log("\n--- Deploying PINN44 Token ---");
    const PINN44Token = await ethers.getContractFactory("PINN44Token");
    const token = await PINN44Token.deploy(TRUSTED_FORWARDER, deployer.address, TREASURY);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("PINN44Token deployed to:", tokenAddress);

    console.log("\n--- Deploying ContributorVault ---");
    const ContributorVault = await ethers.getContractFactory("ContributorVault");
    const vault = await ContributorVault.deploy(TRUSTED_FORWARDER, tokenAddress, deployer.address, DAO);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("ContributorVault deployed to:", vaultAddress);

    console.log("\n--- Deploying StakingVesting ---");
    const StakingVesting = await ethers.getContractFactory("StakingVesting");
    const staking = await StakingVesting.deploy(TRUSTED_FORWARDER, tokenAddress, deployer.address);
    await staking.waitForDeployment();
    const stakingAddress = await staking.getAddress();
    console.log("StakingVesting deployed to:", stakingAddress);

    console.log("\n--- Deploying MerkleDistributor ---");
    const MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
    const merkle = await MerkleDistributor.deploy(TRUSTED_FORWARDER, tokenAddress, deployer.address);
    await merkle.waitForDeployment();
    const merkleAddress = await merkle.getAddress();
    console.log("MerkleDistributor deployed to:", merkleAddress);

    console.log("\n--- Deploying GovernanceModule ---");
    const GovernanceModule = await ethers.getContractFactory("GovernanceModule");
    const governance = await GovernanceModule.deploy(TRUSTED_FORWARDER, deployer.address, DAO);
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    console.log("GovernanceModule deployed to:", governanceAddress);

    console.log("\n--- Deploying BuyBackBurn ---");
    const BuyBackBurn = await ethers.getContractFactory("BuyBackBurn");
    const buyback = await BuyBackBurn.deploy(tokenAddress, UNISWAP_ROUTER, deployer.address, TREASURY);
    await buyback.waitForDeployment();
    const buybackAddress = await buyback.getAddress();
    console.log("BuyBackBurn deployed to:", buybackAddress);

    console.log("\n--- Deploying LiquidityManager ---");
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidity = await LiquidityManager.deploy(tokenAddress, UNISWAP_ROUTER, deployer.address);
    await liquidity.waitForDeployment();
    const liquidityAddress = await liquidity.getAddress();
    console.log("LiquidityManager deployed to:", liquidityAddress);

    console.log("\n--- Deploying WorkSubmission ---");
    const WorkSubmission = await ethers.getContractFactory("WorkSubmission");
    const work = await WorkSubmission.deploy(TRUSTED_FORWARDER, deployer.address);
    await work.waitForDeployment();
    const workAddress = await work.getAddress();
    console.log("WorkSubmission deployed to:", workAddress);

    console.log("\n--- Deploying GaslessModule ---");
    const GaslessModule = await ethers.getContractFactory("GaslessModule");
    const gasless = await GaslessModule.deploy(TRUSTED_FORWARDER, deployer.address);
    await gasless.waitForDeployment();
    const gaslessAddress = await gasless.getAddress();
    console.log("GaslessModule deployed to:", gaslessAddress);

    // Configure cross-contract references
    console.log("\n--- Configuring Contracts ---");

    // Set lock module in MerkleDistributor
    await merkle.setLockModule(stakingAddress);
    console.log("Set StakingVesting as lock module for MerkleDistributor");

    // Exclude vault and staking from token limits
    await token.excludeFromLimits(vaultAddress, true);
    await token.excludeFromLimits(stakingAddress, true);
    await token.excludeFromLimits(merkleAddress, true);
    await token.excludeFromLimits(buybackAddress, true);
    await token.excludeFromLimits(liquidityAddress, true);
    console.log("Excluded contracts from anti-bot limits");

    // Token allocation according to specification
    console.log("\n--- Token Allocation ---");
    const TOTAL_SUPPLY = ethers.parseEther("10000000"); // 10M tokens

    // Contributor Pool: 40% (4M)
    const CONTRIBUTOR_POOL = ethers.parseEther("4000000");
    await token.transfer(vaultAddress, CONTRIBUTOR_POOL);
    console.log("Transferred 4M tokens to ContributorVault (40%)");

    // DAO Treasury: 20% (2M) - to staking for vesting
    const DAO_TREASURY = ethers.parseEther("2000000");
    await token.approve(stakingAddress, DAO_TREASURY);
    console.log("Approved 2M tokens for DAO Treasury vesting (20%)");

    // Team/Admin: 15% (1.5M) - to staking for vesting
    const TEAM_ALLOCATION = ethers.parseEther("1500000");
    await token.approve(stakingAddress, TEAM_ALLOCATION);
    console.log("Approved 1.5M tokens for Team vesting (15%)");

    // DEX Liquidity: 15% (1.5M) - to liquidity manager
    const LIQUIDITY_POOL = ethers.parseEther("1500000");
    await token.transfer(liquidityAddress, LIQUIDITY_POOL);
    console.log("Transferred 1.5M tokens to LiquidityManager (15%)");

    // Community Airdrop: 10% (1M) - to merkle distributor
    const AIRDROP_POOL = ethers.parseEther("1000000");
    await token.approve(merkleAddress, AIRDROP_POOL);
    console.log("Approved 1M tokens for Airdrop pool (10%)");

    // Save deployment addresses
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            PINN44Token: tokenAddress,
            ContributorVault: vaultAddress,
            StakingVesting: stakingAddress,
            MerkleDistributor: merkleAddress,
            GovernanceModule: governanceAddress,
            BuyBackBurn: buybackAddress,
            LiquidityManager: liquidityAddress,
            WorkSubmission: workAddress,
            GaslessModule: gaslessAddress,
        },
        config: {
            trustedForwarder: TRUSTED_FORWARDER,
            treasury: TREASURY,
            dao: DAO,
            uniswapRouter: UNISWAP_ROUTER,
        }
    };

    fs.writeFileSync(
        "./deployment.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n✅ Deployment info saved to deployment.json");

    console.log("\n========================================");
    console.log("DEPLOYMENT COMPLETE");
    console.log("========================================");
    console.log("\nToken:", tokenAddress);
    console.log("ContributorVault:", vaultAddress);
    console.log("StakingVesting:", stakingAddress);
    console.log("MerkleDistributor:", merkleAddress);
    console.log("GovernanceModule:", governanceAddress);
    console.log("BuyBackBurn:", buybackAddress);
    console.log("LiquidityManager:", liquidityAddress);
    console.log("WorkSubmission:", workAddress);
    console.log("GaslessModule:", gaslessAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
