import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const PINNToken = await ethers.getContractFactory("PINNToken");
  const token = await PINNToken.deploy();

  await token.waitForDeployment();

  console.log("PINN Token deployed to:", await token.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

