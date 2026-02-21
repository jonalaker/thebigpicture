import { expect } from "chai";
import { ethers } from "hardhat";
import { PINN44Token } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PINN44Token", function () {
    let token: PINN44Token;
    let owner: SignerWithAddress;
    let treasury: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    const TOTAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens (matches contract)
    const ZERO_ADDRESS = ethers.ZeroAddress;

    beforeEach(async function () {
        [owner, treasury, user1, user2] = await ethers.getSigners();

        const PINN44Token = await ethers.getContractFactory("PINN44Token");
        token = await PINN44Token.deploy(ethers.ZeroAddress, owner.address, treasury.address);
        await token.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await token.name()).to.equal("PINN44");
            expect(await token.symbol()).to.equal("PINN44");
        });

        it("Should mint total supply to owner", async function () {
            expect(await token.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
        });

        it("Should have correct total supply", async function () {
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });

        it("Should set up roles correctly", async function () {
            const DEFAULT_ADMIN = await token.DEFAULT_ADMIN_ROLE();
            const TREASURY_ROLE = await token.TREASURY_ROLE();

            expect(await token.hasRole(DEFAULT_ADMIN, owner.address)).to.be.true;
            expect(await token.hasRole(TREASURY_ROLE, treasury.address)).to.be.true;
        });

        it("Should initialize max wallet amount to 2% of supply", async function () {
            const maxWallet = await token.maxWalletAmount();
            expect(maxWallet).to.equal(TOTAL_SUPPLY * 2n / 100n); // 20,000 tokens
        });
    });

    describe("Anti-Bot Protection", function () {
        it("Should enable anti-bot by default", async function () {
            expect(await token.antiBotEnabled()).to.be.true;
        });

        it("Should enforce max transaction amount", async function () {
            const maxTx = await token.maxTxAmount();
            const exceedAmount = maxTx + 1n;

            // Transfer to user1 first (owner is excluded)
            await token.transfer(user1.address, exceedAmount);

            // User1 should not be able to send more than max
            await expect(
                token.connect(user1).transfer(user2.address, exceedAmount)
            ).to.be.revertedWith("Exceeds max tx");
        });

        it("Should enforce cooldown between transactions", async function () {
            const amount = ethers.parseEther("1000");

            // Transfer tokens to user1
            await token.transfer(user1.address, amount * 3n);

            // First transfer should work
            await token.connect(user1).transfer(user2.address, amount);

            // Second transfer in same block should fail
            await expect(
                token.connect(user1).transfer(user2.address, amount)
            ).to.be.revertedWith("Cooldown active");
        });

        it("Should allow excluding addresses from limits", async function () {
            await token.excludeFromLimits(user1.address, true);
            await token.excludeFromLimits(user2.address, true);
            expect(await token.isExcludedFromLimits(user1.address)).to.be.true;

            // Transfer a large amount (both excluded so max wallet doesn't apply)
            const largeAmount = TOTAL_SUPPLY / 2n;
            await token.transfer(user1.address, largeAmount);

            // User1 can transfer any amount to excluded user2
            await token.connect(user1).transfer(user2.address, largeAmount);
        });

        it("Should allow disabling anti-bot", async function () {
            await token.setAntiBotEnabled(false);
            expect(await token.antiBotEnabled()).to.be.false;
        });
    });

    describe("Max Wallet Limit", function () {
        it("Should enforce max wallet holding", async function () {
            const maxWallet = await token.maxWalletAmount();

            // Transfer exactly max wallet amount (should work)
            await token.transfer(user1.address, maxWallet);
            expect(await token.balanceOf(user1.address)).to.equal(maxWallet);

            // Advance past cooldown
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);

            // Transfer 1 more token should fail (exceeds max wallet)
            await expect(
                token.transfer(user1.address, 1n)
            ).to.be.revertedWith("Exceeds max wallet");
        });

        it("Should allow excluded wallets to exceed max wallet", async function () {
            await token.excludeFromLimits(user1.address, true);
            const overLimit = TOTAL_SUPPLY / 2n;

            // Excluded wallet can receive any amount
            await token.transfer(user1.address, overLimit);
            expect(await token.balanceOf(user1.address)).to.equal(overLimit);
        });

        it("Should allow admin to update max wallet", async function () {
            const newMaxWallet = ethers.parseEther("50000"); // 5% of supply
            await token.setMaxWalletAmount(newMaxWallet);
            expect(await token.maxWalletAmount()).to.equal(newMaxWallet);
        });

        it("Should reject max wallet below 1% of supply", async function () {
            const tooLow = TOTAL_SUPPLY / 200n; // 0.5%
            await expect(
                token.setMaxWalletAmount(tooLow)
            ).to.be.revertedWith("Max wallet too low");
        });

        it("Should not enforce max wallet when anti-bot is disabled", async function () {
            await token.setAntiBotEnabled(false);
            const overLimit = TOTAL_SUPPLY / 2n;

            // Can receive over limit when anti-bot is off
            await token.transfer(user1.address, overLimit);
            expect(await token.balanceOf(user1.address)).to.equal(overLimit);
        });

        it("Should check max wallet correctly via checkMaxWallet", async function () {
            const maxWallet = await token.maxWalletAmount();

            expect(await token.checkMaxWallet(user1.address, maxWallet)).to.be.true;
            expect(await token.checkMaxWallet(user1.address, maxWallet + 1n)).to.be.false;
        });
    });

    describe("Burning", function () {
        it("Should allow burning tokens", async function () {
            const burnAmount = ethers.parseEther("1000");
            const initialBalance = await token.balanceOf(owner.address);

            await token.burn(burnAmount);

            expect(await token.balanceOf(owner.address)).to.equal(initialBalance - burnAmount);
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY - burnAmount);
        });

        it("Should emit TokensBurned event", async function () {
            const burnAmount = ethers.parseEther("500");

            await expect(token.burn(burnAmount))
                .to.emit(token, "TokensBurned")
                .withArgs(burnAmount, owner.address);
        });
    });

    describe("ERC20Permit", function () {
        it("Should return correct DOMAIN_SEPARATOR", async function () {
            const domain = await token.eip712Domain();
            expect(domain.name).to.equal("PINN44");
        });

        it("Should support permit functionality", async function () {
            // This is a simplified test - full permit test would require signature
            const nonce = await token.nonces(owner.address);
            expect(nonce).to.equal(0n);
        });
    });

    describe("Access Control", function () {
        it("Should prevent non-admins from changing anti-bot settings", async function () {
            const ANTI_BOT_ADMIN = await token.ANTI_BOT_ADMIN();

            await expect(
                token.connect(user1).setAntiBotEnabled(false)
            ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
        });

        it("Should allow admin to update max tx", async function () {
            const newMax = ethers.parseEther("100000");
            await token.setMaxTxAmount(newMax);
            expect(await token.maxTxAmount()).to.equal(newMax);
        });

        it("Should prevent non-admin from updating max wallet", async function () {
            await expect(
                token.connect(user1).setMaxWalletAmount(ethers.parseEther("50000"))
            ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
        });
    });
});
