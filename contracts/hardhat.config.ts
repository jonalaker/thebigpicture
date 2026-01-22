import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || "";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        localhost: {
            url: "http://127.0.0.1:8545",
        },
        polygon_amoy: {
            url: "https://rpc-amoy.polygon.technology",
            chainId: 80002,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
        },
        polygon: {
            url: POLYGON_RPC_URL,
            chainId: 137,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: {
            polygon: POLYGONSCAN_API_KEY,
            polygonAmoy: POLYGONSCAN_API_KEY,
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};

export default config;
