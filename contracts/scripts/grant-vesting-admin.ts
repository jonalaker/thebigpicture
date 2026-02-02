import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddr = await deployer.getAddress();

    console.log("Granting VESTING_ADMIN role with account:", deployerAddr);

    // Get the StakingVesting contract address from env
    const stakingAddress = process.env.NEXT_PUBLIC_STAKING_VESTING_ADDRESS;
    if (!stakingAddress) {
        throw new Error("NEXT_PUBLIC_STAKING_VESTING_ADDRESS not set");
    }

    console.log("StakingVesting address:", stakingAddress);

    // Get contract instance
    const StakingVesting = await ethers.getContractFactory("StakingVesting");
    const staking = StakingVesting.attach(stakingAddress);

    // Grant VESTING_ADMIN role to deployer (relayer wallet)
    const VESTING_ADMIN = ethers.keccak256(ethers.toUtf8Bytes("VESTING_ADMIN"));

    console.log("VESTING_ADMIN role hash:", VESTING_ADMIN);
    console.log("Granting role to:", deployerAddr);

    // Check if already has role
    const hasRole = await staking.hasRole(VESTING_ADMIN, deployerAddr);
    if (hasRole) {
        console.log("✅ Already has VESTING_ADMIN role");
        return;
    }

    const tx = await staking.grantRole(VESTING_ADMIN, deployerAddr);
    await tx.wait();

    console.log("✅ VESTING_ADMIN role granted successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
