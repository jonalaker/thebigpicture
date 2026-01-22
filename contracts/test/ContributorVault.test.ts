import { expect } from "chai";
import { ethers } from "hardhat";
import { ContributorVault, PINN44Token } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ContributorVault", function () {
    let token: PINN44Token;
    let vault: ContributorVault;
    let owner: SignerWithAddress;
    let dao: SignerWithAddress;
    let contributor1: SignerWithAddress;
    let contributor2: SignerWithAddress;

    const REWARD_AMOUNT = ethers.parseEther("1000");
    const LOCK_DURATION = 90 * 24 * 60 * 60; // 90 days in seconds

    beforeEach(async function () {
        [owner, dao, contributor1, contributor2] = await ethers.getSigners();

        // Deploy token
        const PINN44Token = await ethers.getContractFactory("PINN44Token");
        token = await PINN44Token.deploy(owner.address, owner.address, dao.address);
        await token.waitForDeployment();

        // Deploy vault
        const ContributorVault = await ethers.getContractFactory("ContributorVault");
        vault = await ContributorVault.deploy(
            owner.address, // forwarder
            await token.getAddress(),
            owner.address,
            dao.address
        );
        await vault.waitForDeployment();

        // Approve vault to spend tokens
        await token.approve(await vault.getAddress(), ethers.parseEther("1000000"));

        // Exclude vault from anti-bot
        await token.excludeFromLimits(await vault.getAddress(), true);
    });

    describe("Reward Distribution", function () {
        it("Should distribute 50% immediate, 50% locked", async function () {
            const initialBalance = await token.balanceOf(contributor1.address);

            await vault.distributeReward(contributor1.address, REWARD_AMOUNT);

            const newBalance = await token.balanceOf(contributor1.address);
            const immediateAmount = REWARD_AMOUNT / 2n;

            expect(newBalance - initialBalance).to.equal(immediateAmount);
        });

        it("Should create lock for contributor", async function () {
            await vault.distributeReward(contributor1.address, REWARD_AMOUNT);

            const lockCount = await vault.getLockCount(contributor1.address);
            expect(lockCount).to.equal(1n);

            const lock = await vault.getLock(contributor1.address, 0);
            expect(lock.amount).to.equal(REWARD_AMOUNT / 2n);
        });

        it("Should emit RewardDistributed event", async function () {
            const immediate = REWARD_AMOUNT / 2n;
            const locked = REWARD_AMOUNT - immediate;

            await expect(vault.distributeReward(contributor1.address, REWARD_AMOUNT))
                .to.emit(vault, "RewardDistributed");
        });
    });

    describe("Claiming Locked Tokens", function () {
        beforeEach(async function () {
            await vault.distributeReward(contributor1.address, REWARD_AMOUNT);
        });

        it("Should not allow claiming before cliff", async function () {
            await expect(
                vault.connect(contributor1).claimLockedTokens()
            ).to.be.revertedWith("Nothing to claim");
        });

        it("Should allow claiming after cliff", async function () {
            // Fast forward 90 days
            await time.increase(LOCK_DURATION);

            const lockedAmount = REWARD_AMOUNT / 2n;
            const initialBalance = await token.balanceOf(contributor1.address);

            await vault.connect(contributor1).claimLockedTokens();

            const newBalance = await token.balanceOf(contributor1.address);
            // With vesting, should get some amount
            expect(newBalance).to.be.gt(initialBalance);
        });

        it("Should allow early withdrawal with slashing", async function () {
            const initialBalance = await token.balanceOf(contributor1.address);

            // Early claim with slashing allowed
            await vault.connect(contributor1).claimLock(0, true);

            const newBalance = await token.balanceOf(contributor1.address);
            // Should get less than full locked amount due to slash
            const lockedAmount = REWARD_AMOUNT / 2n;
            expect(newBalance - initialBalance).to.be.lt(lockedAmount);
        });
    });

    describe("Multiple Rewards", function () {
        it("Should handle multiple distributions", async function () {
            await vault.distributeReward(contributor1.address, REWARD_AMOUNT);
            await vault.distributeReward(contributor1.address, REWARD_AMOUNT);

            const lockCount = await vault.getLockCount(contributor1.address);
            expect(lockCount).to.equal(2n);
        });
    });

    describe("Access Control", function () {
        it("Should prevent non-distributors from distributing", async function () {
            await expect(
                vault.connect(contributor1).distributeReward(contributor2.address, REWARD_AMOUNT)
            ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
        });
    });
});
