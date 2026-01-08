import "@nomicfoundation/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY not found in .env file");
}

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    amoy: {
      type: "http", // ✅ REQUIRED in Hardhat v3
      url: "https://rpc-amoy.polygon.technology",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};

export default config;



