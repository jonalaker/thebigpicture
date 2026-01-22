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

    const TOTAL_SUPPLY = ethers.parseEther("10000000"); // 10M tokens
    const ZERO_ADDRESS = ethers.ZeroAddress;

    beforeEach(async function () {
        [owner, treasury, user1, user2] = await ethers.getSigners();

        const PINN44Token = await ethers.getContractFactory("PINN44Token");
        token = await PINN44Token.deploy(owner.address, owner.address, treasury.address);
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
    });

    describe("Anti-Bot Protection", function () {
        it("Should enable anti-bot by default", async function () {
            expect(await token.antiBotEnabled()).to.be.true;
        });

        it("Should enforce max transaction amount", async function () {
            const maxTx = await token.maxTxAmount();
            const exceedAmount = maxTx + 1n;

            // Transfer to user1 first
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
            expect(await token.isExcludedFromLimits(user1.address)).to.be.true;

            // Transfer a large amount
            const largeAmount = TOTAL_SUPPLY / 2n;
            await token.transfer(user1.address, largeAmount);

            // User1 can transfer any amount
            await token.connect(user1).transfer(user2.address, largeAmount);
        });

        it("Should allow disabling anti-bot", async function () {
            await token.setAntiBotEnabled(false);
            expect(await token.antiBotEnabled()).to.be.false;
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
    });
});
