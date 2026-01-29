import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddr = await deployer.getAddress();

    console.log("Deploying contracts with account:", deployerAddr);
    console.log("Account balance:", (await ethers.provider.getBalance(deployerAddr)).toString());

    // Configuration - properly handle empty env variables
    const isValidAddress = (addr: string | undefined): boolean => {
        return !!addr && addr.startsWith("0x") && addr.length === 42;
    };

    const TRUSTED_FORWARDER = isValidAddress(process.env.TRUSTED_FORWARDER)
        ? process.env.TRUSTED_FORWARDER!
        : "0x0000000000000000000000000000000000000000"; // Use 0x0 if not set, to disable meta-tx for now
    const TREASURY = isValidAddress(process.env.TREASURY_ADDRESS)
        ? process.env.TREASURY_ADDRESS!
        : deployerAddr;
    const DAO = isValidAddress(process.env.DAO_ADDRESS)
        ? process.env.DAO_ADDRESS!
        : deployerAddr;
    const UNISWAP_ROUTER = isValidAddress(process.env.UNISWAP_ROUTER)
        ? process.env.UNISWAP_ROUTER!
        : "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // QuickSwap on Polygon

    console.log("Configuration:");
    console.log("  Deployer:", deployerAddr);
    console.log("  Trusted Forwarder:", TRUSTED_FORWARDER);
    console.log("  Treasury:", TREASURY);
    console.log("  DAO:", DAO);
    console.log("  Uniswap Router:", UNISWAP_ROUTER);

    // Helper function to deploy contracts using standard Hardhat pattern
    async function deployContract(name: string, args: any[]) {
        console.log(`\n--- Deploying ${name} ---`);
        const factory = await ethers.getContractFactory(name);
        const contract = await factory.deploy(...args);
        await contract.waitForDeployment();

        const address = await contract.getAddress();
        console.log(`${name} deployed to:`, address);
        return contract;
    }

    // Deploy all contracts
    const token = await deployContract("PINN44Token", [TRUSTED_FORWARDER, deployerAddr, TREASURY]);
    const tokenAddress = await token.getAddress();

    const vault = await deployContract("ContributorVault", [TRUSTED_FORWARDER, tokenAddress, deployerAddr, DAO]);
    const vaultAddress = await vault.getAddress();

    const staking = await deployContract("StakingVesting", [TRUSTED_FORWARDER, tokenAddress, deployerAddr]);
    const stakingAddress = await staking.getAddress();

    const merkle = await deployContract("MerkleDistributor", [TRUSTED_FORWARDER, tokenAddress, deployerAddr]);
    const merkleAddress = await merkle.getAddress();

    const governance = await deployContract("GovernanceModule", [TRUSTED_FORWARDER, deployerAddr, DAO]);
    const governanceAddress = await governance.getAddress();

    const buyback = await deployContract("BuyBackBurn", [tokenAddress, UNISWAP_ROUTER, deployerAddr, TREASURY]);
    const buybackAddress = await buyback.getAddress();

    const liquidity = await deployContract("LiquidityManager", [tokenAddress, UNISWAP_ROUTER, deployerAddr]);
    const liquidityAddress = await liquidity.getAddress();

    const work = await deployContract("WorkSubmission", [TRUSTED_FORWARDER, deployerAddr]);
    const workAddress = await work.getAddress();

    const gasless = await deployContract("GaslessModule", [TRUSTED_FORWARDER, deployerAddr]);
    const gaslessAddress = await gasless.getAddress();

    // Configure cross-contract references
    console.log("\n--- Configuring Contracts ---");

    // Set lock module in MerkleDistributor
    console.log("Setting StakingVesting as lock module for MerkleDistributor...");
    const setLockTx = await (merkle as any).setLockModule(stakingAddress);
    await setLockTx.wait();
    console.log("Done.");

    // Exclude vault and staking from token limits
    console.log("Excluding contracts from anti-bot limits...");
    let tx = await (token as any).excludeFromLimits(vaultAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(stakingAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(merkleAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(buybackAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(liquidityAddress, true);
    await tx.wait();
    console.log("Done.");

    // Token allocation according to specification
    console.log("\n--- Token Allocation ---");

    // Contributor Pool: 40% (4M)
    const CONTRIBUTOR_POOL = ethers.parseEther("4000000");
    console.log("Transferring 4M tokens to ContributorVault (40%)...");
    tx = await (token as any).transfer(vaultAddress, CONTRIBUTOR_POOL);
    await tx.wait();
    console.log("Done.");

    // DAO Treasury: 20% (2M) - to staking for vesting
    const DAO_TREASURY = ethers.parseEther("2000000");
    console.log("Approving 2M tokens for DAO Treasury vesting (20%)...");
    tx = await (token as any).approve(stakingAddress, DAO_TREASURY);
    await tx.wait();
    console.log("Done.");

    // Team/Admin: 15% (1.5M) - to staking for vesting
    const TEAM_ALLOCATION = ethers.parseEther("1500000");
    console.log("Approving 1.5M tokens for Team vesting (15%)...");
    tx = await (token as any).approve(stakingAddress, TEAM_ALLOCATION);
    await tx.wait();
    console.log("Done.");

    // DEX Liquidity: 15% (1.5M) - to liquidity manager
    const LIQUIDITY_POOL = ethers.parseEther("1500000");
    console.log("Transferring 1.5M tokens to LiquidityManager (15%)...");
    tx = await (token as any).transfer(liquidityAddress, LIQUIDITY_POOL);
    await tx.wait();
    console.log("Done.");

    // Community Airdrop: 10% (1M) - to merkle distributor
    const AIRDROP_POOL = ethers.parseEther("1000000");
    console.log("Approving 1M tokens for Airdrop pool (10%)...");
    tx = await (token as any).approve(merkleAddress, AIRDROP_POOL);
    await tx.wait();
    console.log("Done.");

    // Save deployment addresses
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployerAddr,
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

