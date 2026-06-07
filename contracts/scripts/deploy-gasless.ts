import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * Deploys the gasless meta-transaction stack:
 *   1. PINN44Forwarder (ERC-2771 trusted forwarder)
 *   2. A fresh WorkSubmission that trusts the forwarder
 *
 * Why a fresh WorkSubmission? ERC2771Context stores the trusted forwarder as an
 * immutable set in the constructor, so an already-deployed WorkSubmission that
 * was created with forwarder = 0x0 can never become gasless. We redeploy it.
 *
 * NOTE: the new WorkSubmission starts with zero bounties. Recreate/fund your
 * bounties against the new address after deployment.
 *
 * Run:  npm run deploy:gasless   (add the script to contracts/package.json)
 *   or: hardhat run scripts/deploy-gasless.ts --network polygon_amoy
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddr = await deployer.getAddress();

    console.log("Deploying gasless stack with account:", deployerAddr);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployerAddr)), "POL");

    // 1. Forwarder
    console.log("\n--- Deploying PINN44Forwarder ---");
    const forwarderFactory = await ethers.getContractFactory("PINN44Forwarder");
    const forwarder = await forwarderFactory.deploy();
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    console.log("PINN44Forwarder deployed to:", forwarderAddress);

    // 2. WorkSubmission trusting the forwarder
    console.log("\n--- Deploying WorkSubmission (gasless-enabled) ---");
    const workFactory = await ethers.getContractFactory("WorkSubmission");
    const work = await workFactory.deploy(forwarderAddress, deployerAddr);
    await work.waitForDeployment();
    const workAddress = await work.getAddress();
    console.log("WorkSubmission deployed to:", workAddress);

    // Save addresses
    const info = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployerAddr,
        timestamp: new Date().toISOString(),
        contracts: {
            PINN44Forwarder: forwarderAddress,
            WorkSubmission: workAddress,
        },
    };
    fs.writeFileSync("./deployment-gasless.json", JSON.stringify(info, null, 2));

    console.log("\n========================================");
    console.log("GASLESS STACK DEPLOYED");
    console.log("========================================");
    console.log("Add these to your .env.local (web app):\n");
    console.log(`NEXT_PUBLIC_FORWARDER_ADDRESS=${forwarderAddress}`);
    console.log(`NEXT_PUBLIC_WORK_SUBMISSION_ADDRESS=${workAddress}`);
    console.log("\nMake sure RELAYER_PRIVATE_KEY (a funded wallet) and POLYGON_RPC_URL are set.");
    console.log("Saved to deployment-gasless.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
