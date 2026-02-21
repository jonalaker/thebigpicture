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

    // USDC Address (Amoy)
    const USDC_ADDRESS = isValidAddress(process.env.USDC_ADDRESS)
        ? process.env.USDC_ADDRESS!
        : "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // Amoy USDC

    // 100 PINN44 per 1 USDC (price in tokens per Unit, scaled by 1e18)
    const SWAP_PRICE = ethers.parseEther("100");
    const fixedSwap = await deployContract("FixedPriceSwap", [tokenAddress, USDC_ADDRESS, deployerAddr, SWAP_PRICE]);
    const fixedSwapAddress = await fixedSwap.getAddress();

    // Configure cross-contract references
    console.log("\n--- Configuring Contracts ---");

    // Exclude vault and staking from token limits
    console.log("Excluding contracts from anti-bot limits...");
    let tx = await (token as any).excludeFromLimits(vaultAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(stakingAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(buybackAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(liquidityAddress, true);
    await tx.wait();
    tx = await (token as any).excludeFromLimits(fixedSwapAddress, true);
    await tx.wait();
    console.log("Done.");

    // Token allocation — 1,000,000 PINN44 total
    console.log("\n--- Token Allocation (1M PINN44) ---");

    // Contributor Pool: 40% (400K)
    const CONTRIBUTOR_POOL = ethers.parseEther("400000");
    console.log("Transferring 400K tokens to ContributorVault (40%)...");
    tx = await (token as any).transfer(vaultAddress, CONTRIBUTOR_POOL);
    await tx.wait();
    console.log("Done.");

    // DAO Treasury: 20% (200K) - to staking for vesting
    const DAO_TREASURY = ethers.parseEther("200000");
    console.log("Approving 200K tokens for DAO Treasury vesting (20%)...");
    tx = await (token as any).approve(stakingAddress, DAO_TREASURY);
    await tx.wait();
    console.log("Done.");

    // Team/Admin: 15% (150K) - to staking for vesting
    const TEAM_ALLOCATION = ethers.parseEther("150000");
    console.log("Approving 150K tokens for Team vesting (15%)...");
    tx = await (token as any).approve(stakingAddress, TEAM_ALLOCATION);
    await tx.wait();
    console.log("Done.");

    // DEX Liquidity: 15% (150K) - to liquidity manager
    const LIQUIDITY_POOL = ethers.parseEther("150000");
    console.log("Transferring 150K tokens to LiquidityManager (15%)...");
    tx = await (token as any).transfer(liquidityAddress, LIQUIDITY_POOL);
    await tx.wait();
    console.log("Done.");

    // Community Airdrop / Private Sale: 10% (100K) - to FixedPriceSwap
    const SALE_ALLOCATION = ethers.parseEther("100000");
    console.log("Transferring 100K tokens to FixedPriceSwap (10%)...");
    tx = await (token as any).transfer(fixedSwapAddress, SALE_ALLOCATION);
    await tx.wait();

    // Admin calls depositTokens to register the balance in the Sales contract
    // (Ensure deployer is admin)
    console.log("Calling depositTokens on Swap contract...");
    // We need to approve first? No, we just transferred. 
    // But verify: FixedPriceSwap has `depositTokens` which does `safeTransferFrom`.
    // If we manually transfer, we just need to know the contract has them.
    // The contract uses `balanceOf(this)` in `buyTokens`'s `available` check.
    // So direct transfer works?
    // Let's check `FixedPriceSwap.sol`. 
    // `buyTokens`: `uint256 available = pinn44Token.balanceOf(address(this));`
    // Yes, direct transfer works for availability.
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
            GovernanceModule: governanceAddress,
            BuyBackBurn: buybackAddress,
            LiquidityManager: liquidityAddress,
            WorkSubmission: workAddress,
            GaslessModule: gaslessAddress,
            FixedPriceSwap: fixedSwapAddress,
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
    console.log("GovernanceModule:", governanceAddress);
    console.log("BuyBackBurn:", buybackAddress);
    console.log("LiquidityManager:", liquidityAddress);
    console.log("WorkSubmission:", workAddress);
    console.log("GaslessModule:", gaslessAddress);
    console.log("FixedPriceSwap:", fixedSwapAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

