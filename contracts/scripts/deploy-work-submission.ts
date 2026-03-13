import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * Deploy ONLY the updated WorkSubmission contract
 * This replaces the old WorkSubmission address while keeping all other contracts unchanged.
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddr = await deployer.getAddress();

    console.log("Deploying updated WorkSubmission with account:", deployerAddr);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployerAddr)), "POL");

    // Use the same trusted forwarder as the original deployment
    const TRUSTED_FORWARDER = process.env.TRUSTED_FORWARDER && process.env.TRUSTED_FORWARDER.startsWith("0x")
        ? process.env.TRUSTED_FORWARDER
        : "0x0000000000000000000000000000000000000000";

    console.log("\nConfiguration:");
    console.log("  Deployer (admin):", deployerAddr);
    console.log("  Trusted Forwarder:", TRUSTED_FORWARDER);

    // Deploy the updated WorkSubmission contract
    console.log("\n--- Deploying WorkSubmission ---");
    const factory = await ethers.getContractFactory("WorkSubmission");
    const workSubmission = await factory.deploy(TRUSTED_FORWARDER, deployerAddr);
    await workSubmission.waitForDeployment();

    const newAddress = await workSubmission.getAddress();
    console.log("✅ WorkSubmission deployed to:", newAddress);

    // Update deployment.json
    const deploymentPath = "./deployment.json";
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
        const oldAddress = deployment.contracts.WorkSubmission;
        deployment.contracts.WorkSubmission = newAddress;
        deployment.lastUpdated = new Date().toISOString();
        deployment.updates = deployment.updates || [];
        deployment.updates.push({
            contract: "WorkSubmission",
            oldAddress,
            newAddress,
            reason: "Added updateDeadline() function for admin",
            timestamp: new Date().toISOString(),
        });
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log("\n✅ deployment.json updated");
        console.log("   Old address:", oldAddress);
        console.log("   New address:", newAddress);
    }

    console.log("\n========================================");
    console.log("WORK SUBMISSION REDEPLOYMENT COMPLETE");
    console.log("========================================");
    console.log("\n⚠️  IMPORTANT: Update your .env file:");
    console.log(`   NEXT_PUBLIC_WORK_SUBMISSION_ADDRESS=${newAddress}`);
    console.log("\n⚠️  NOTE: Existing bounties from the old contract will NOT carry over.");
    console.log("   The new contract starts fresh with zero bounties.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
