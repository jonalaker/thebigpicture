import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddr = await deployer.getAddress();

    console.log("Checking balances for:", deployerAddr);

    // Token address
    const tokenAddress = process.env.NEXT_PUBLIC_PINN44_TOKEN_ADDRESS;
    if (!tokenAddress) {
        throw new Error("NEXT_PUBLIC_PINN44_TOKEN_ADDRESS not set");
    }

    // Get token contract
    const token = await ethers.getContractAt("PINN44Token", tokenAddress);

    // Check balance
    const balance = await token.balanceOf(deployerAddr);
    console.log("\nPINN44 Balance:", ethers.formatEther(balance), "PINN44");

    // Check MATIC balance
    const maticBalance = await ethers.provider.getBalance(deployerAddr);
    console.log("MATIC Balance:", ethers.formatEther(maticBalance), "MATIC");

    // Check total supply
    const totalSupply = await token.totalSupply();
    console.log("\nTotal Supply:", ethers.formatEther(totalSupply), "PINN44");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
