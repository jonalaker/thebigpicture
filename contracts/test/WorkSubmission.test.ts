import { expect } from "chai";
import { ethers } from "hardhat";
import { WorkSubmission, PINN44Token } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("WorkSubmission", function () {
    let token: PINN44Token;
    let workSubmission: WorkSubmission;
    let owner: SignerWithAddress;
    let judge: SignerWithAddress;
    let worker1: SignerWithAddress;
    let worker2: SignerWithAddress;

    const BOUNTY_REWARD = ethers.parseEther("1000");
    const STAKE_AMOUNT = ethers.parseEther("10");

    beforeEach(async function () {
        [owner, judge, worker1, worker2] = await ethers.getSigners();

        // Deploy token
        const PINN44Token = await ethers.getContractFactory("PINN44Token");
        token = await PINN44Token.deploy(owner.address, owner.address, owner.address);
        await token.waitForDeployment();

        // Deploy work submission
        const WorkSubmission = await ethers.getContractFactory("WorkSubmission");
        workSubmission = await WorkSubmission.deploy(owner.address, owner.address);
        await workSubmission.waitForDeployment();

        // Grant judge role
        const JUDGE_ROLE = await workSubmission.JUDGE_ROLE();
        await workSubmission.grantRole(JUDGE_ROLE, judge.address);

        // Exclude contracts from anti-bot
        await token.excludeFromLimits(await workSubmission.getAddress(), true);
    });

    describe("Bounty Creation", function () {
        it("Should create a bounty", async function () {
            await workSubmission.createBounty(
                "Test Bounty",
                "Create a cool thing",
                await token.getAddress(),
                BOUNTY_REWARD,
                0, // no stake
                ethers.ZeroAddress,
                0 // no deadline
            );

            const bounty = await workSubmission.bounties(1);
            expect(bounty.title).to.equal("Test Bounty");
            expect(bounty.rewardAmount).to.equal(BOUNTY_REWARD);
        });

        it("Should emit BountyCreated event", async function () {
            await expect(workSubmission.createBounty(
                "Test Bounty",
                "Description",
                await token.getAddress(),
                BOUNTY_REWARD,
                0,
                ethers.ZeroAddress,
                0
            )).to.emit(workSubmission, "BountyCreated");
        });
    });

    describe("Bounty Funding", function () {
        beforeEach(async function () {
            await workSubmission.createBounty(
                "Test Bounty",
                "Description",
                await token.getAddress(),
                BOUNTY_REWARD,
                0,
                ethers.ZeroAddress,
                0
            );
        });

        it("Should fund a bounty", async function () {
            await token.approve(await workSubmission.getAddress(), BOUNTY_REWARD);
            await workSubmission.fundBounty(1);

            const bounty = await workSubmission.bounties(1);
            expect(bounty.funded).to.be.true;
        });
    });

    describe("Work Submission", function () {
        beforeEach(async function () {
            await workSubmission.createBounty(
                "Test Bounty",
                "Description",
                await token.getAddress(),
                BOUNTY_REWARD,
                0,
                ethers.ZeroAddress,
                0
            );
            await token.approve(await workSubmission.getAddress(), BOUNTY_REWARD);
            await workSubmission.fundBounty(1);
        });

        it("Should submit work", async function () {
            await workSubmission.connect(worker1).submitWork(
                1,
                "ipfs://QmTest123",
                "ipfs://QmThumb123"
            );

            const submissions = await workSubmission.getBountySubmissions(1);
            expect(submissions.length).to.equal(1);
        });

        it("Should emit SubmissionReceived event", async function () {
            await expect(workSubmission.connect(worker1).submitWork(
                1,
                "ipfs://QmTest123",
                ""
            )).to.emit(workSubmission, "SubmissionReceived");
        });
    });

    describe("Winner Selection", function () {
        beforeEach(async function () {
            await workSubmission.createBounty(
                "Test Bounty",
                "Description",
                await token.getAddress(),
                BOUNTY_REWARD,
                0,
                ethers.ZeroAddress,
                0
            );
            await token.approve(await workSubmission.getAddress(), BOUNTY_REWARD);
            await workSubmission.fundBounty(1);
            await workSubmission.connect(worker1).submitWork(1, "ipfs://QmTest", "");
        });

        it("Should select winner and pay", async function () {
            const initialBalance = await token.balanceOf(worker1.address);

            await workSubmission.connect(judge).selectWinner(1, 1);

            const newBalance = await token.balanceOf(worker1.address);
            expect(newBalance - initialBalance).to.equal(BOUNTY_REWARD);
        });

        it("Should mark bounty as completed", async function () {
            await workSubmission.connect(judge).selectWinner(1, 1);

            const bounty = await workSubmission.bounties(1);
            expect(bounty.state).to.equal(2); // Completed
        });

        it("Should emit WinnerSelected and BountyPaid events", async function () {
            await expect(workSubmission.connect(judge).selectWinner(1, 1))
                .to.emit(workSubmission, "WinnerSelected")
                .and.to.emit(workSubmission, "BountyPaid");
        });
    });

    describe("Stake to Submit", function () {
        beforeEach(async function () {
            // Create bounty with stake requirement
            await workSubmission.createBounty(
                "Staked Bounty",
                "Requires stake",
                await token.getAddress(),
                BOUNTY_REWARD,
                STAKE_AMOUNT,
                await token.getAddress(), // Use PINN44 as stake token
                0
            );
            await token.approve(await workSubmission.getAddress(), BOUNTY_REWARD);
            await workSubmission.fundBounty(1);

            // Give worker1 some tokens for stake
            await token.transfer(worker1.address, STAKE_AMOUNT * 2n);
            await token.connect(worker1).approve(await workSubmission.getAddress(), STAKE_AMOUNT);
        });

        it("Should require stake for submission", async function () {
            await workSubmission.connect(worker1).submitWork(1, "ipfs://QmTest", "");

            const submission = await workSubmission.submissions(1);
            expect(submission.stakeAmount).to.equal(STAKE_AMOUNT);
        });

        it("Should refund stake to winner", async function () {
            await workSubmission.connect(worker1).submitWork(1, "ipfs://QmTest", "");

            const balanceAfterSubmit = await token.balanceOf(worker1.address);

            await workSubmission.connect(judge).selectWinner(1, 1);

            const finalBalance = await token.balanceOf(worker1.address);
            // Winner gets reward + stake refund
            expect(finalBalance - balanceAfterSubmit).to.equal(BOUNTY_REWARD + STAKE_AMOUNT);
        });
    });

    describe("Access Control", function () {
        it("Should prevent non-admins from creating bounties", async function () {
            await expect(
                workSubmission.connect(worker1).createBounty(
                    "Test",
                    "Desc",
                    await token.getAddress(),
                    BOUNTY_REWARD,
                    0,
                    ethers.ZeroAddress,
                    0
                )
            ).to.be.revertedWithCustomError(workSubmission, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-judges from selecting winners", async function () {
            await workSubmission.createBounty(
                "Test",
                "Desc",
                await token.getAddress(),
                BOUNTY_REWARD,
                0,
                ethers.ZeroAddress,
                0
            );
            await token.approve(await workSubmission.getAddress(), BOUNTY_REWARD);
            await workSubmission.fundBounty(1);
            await workSubmission.connect(worker1).submitWork(1, "ipfs://test", "");

            await expect(
                workSubmission.connect(worker1).selectWinner(1, 1)
            ).to.be.revertedWithCustomError(workSubmission, "AccessControlUnauthorizedAccount");
        });
    });
});
