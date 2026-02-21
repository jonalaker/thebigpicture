import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FixedPriceSwap", function () {
    let token: any;
    let usdc: any;
    let swap: any;
    let owner: SignerWithAddress;
    let treasury: SignerWithAddress;
    let buyer1: SignerWithAddress;
    let buyer2: SignerWithAddress;

    // 100 PINN44 per 1 USDC
    const INITIAL_PRICE = ethers.parseEther("100");
    const DEPOSIT_AMOUNT = ethers.parseEther("100000"); // 100K tokens for sale

    beforeEach(async function () {
        [owner, treasury, buyer1, buyer2] = await ethers.getSigners();

        // Deploy token
        const TokenFactory = await ethers.getContractFactory("PINN44Token");
        token = await TokenFactory.deploy(ethers.ZeroAddress, owner.address, treasury.address);
        await token.waitForDeployment();

        // Deploy Mock USDC (6 decimals)
        const MockFactory = await ethers.getContractFactory("MockERC20");
        usdc = await MockFactory.deploy("Mock USDC", "USDC", 6);
        await usdc.waitForDeployment();

        // Deploy swap
        const SwapFactory = await ethers.getContractFactory("FixedPriceSwap");
        swap = await SwapFactory.deploy(
            await token.getAddress(),
            await usdc.getAddress(),
            owner.address,
            INITIAL_PRICE
        );
        await swap.waitForDeployment();

        // Exclude swap from anti-bot limits and disable anti-bot for swap tests
        await token.excludeFromLimits(await swap.getAddress(), true);
        await token.setAntiBotEnabled(false);

        // Approve and deposit tokens for sale
        await token.approve(await swap.getAddress(), DEPOSIT_AMOUNT);
        await swap.depositTokens(DEPOSIT_AMOUNT);

        // Mint USDC to buyers
        await usdc.mint(buyer1.address, ethers.parseUnits("10000", 6)); // 10k USDC
        await usdc.mint(buyer2.address, ethers.parseUnits("10000", 6));

        // Activate sale
        await swap.setSaleActive(true);
    });

    describe("Deployment", function () {
        it("Should set correct initial price", async function () {
            expect(await swap.pricePerUnit()).to.equal(INITIAL_PRICE);
        });

        it("Should set correct payment token", async function () {
            expect(await swap.paymentToken()).to.equal(await usdc.getAddress());
        });

        it("Should start with sale inactive by default", async function () {
            const SwapFactory = await ethers.getContractFactory("FixedPriceSwap");
            const freshSwap = await SwapFactory.deploy(
                await token.getAddress(),
                await usdc.getAddress(),
                owner.address,
                INITIAL_PRICE
            );
            expect(await freshSwap.saleActive()).to.be.false;
        });

        it("Should have correct token balance after deposit", async function () {
            expect(await swap.availableForSale()).to.equal(DEPOSIT_AMOUNT);
        });
    });

    describe("Buying Tokens", function () {
        it("Should allow buying tokens with USDC", async function () {
            const usdcAmount = ethers.parseUnits("1", 6); // 1 USDC
            const expectedTokens = ethers.parseEther("100"); // 100 PINN44

            // Approve USDC
            await usdc.connect(buyer1).approve(await swap.getAddress(), usdcAmount);

            // Buy
            await swap.connect(buyer1).buyTokens(usdcAmount);

            expect(await token.balanceOf(buyer1.address)).to.equal(expectedTokens);
            expect(await usdc.balanceOf(buyer1.address)).to.equal(ethers.parseUnits("9999", 6)); // 10000 - 1
            expect(await swap.totalTokensSold()).to.equal(expectedTokens);
            expect(await swap.totalFundsRaised()).to.equal(usdcAmount);
        });

        it("Should emit TokensPurchased event", async function () {
            const usdcAmount = ethers.parseUnits("1", 6);
            const expectedTokens = ethers.parseEther("100");

            await usdc.connect(buyer1).approve(await swap.getAddress(), usdcAmount);

            await expect(swap.connect(buyer1).buyTokens(usdcAmount))
                .to.emit(swap, "TokensPurchased")
                .withArgs(buyer1.address, usdcAmount, expectedTokens);
        });

        it("Should track per-wallet purchases", async function () {
            const usdcAmount = ethers.parseUnits("1", 6);
            const expectedTokens = ethers.parseEther("100");

            await usdc.connect(buyer1).approve(await swap.getAddress(), usdcAmount);
            await swap.connect(buyer1).buyTokens(usdcAmount);

            expect(await swap.totalPurchased(buyer1.address)).to.equal(expectedTokens);
        });

        it("Should correctly preview token amounts (USDC 6 decimals)", async function () {
            const usdcAmount = ethers.parseUnits("2.5", 6); // 2.5 USDC
            const expectedTokens = ethers.parseEther("250");

            expect(await swap.getTokensForPayment(usdcAmount)).to.equal(expectedTokens);
        });

        it("Should correctly preview USDC cost", async function () {
            const tokenAmount = ethers.parseEther("100");
            const expectedUsdc = ethers.parseUnits("1", 6);

            expect(await swap.getPaymentForTokens(tokenAmount)).to.equal(expectedUsdc);
        });

        it("Should reject purchase when sale is inactive", async function () {
            await swap.setSaleActive(false);
            const usdcAmount = ethers.parseUnits("1", 6);
            await usdc.connect(buyer1).approve(await swap.getAddress(), usdcAmount);

            await expect(
                swap.connect(buyer1).buyTokens(usdcAmount)
            ).to.be.revertedWith("Sale not active");
        });

        it("Should reject purchase with 0 USDC", async function () {
            await expect(
                swap.connect(buyer1).buyTokens(0)
            ).to.be.revertedWith("Amount too small");
        });

        it("Should fail if allowance is insufficient", async function () {
            const usdcAmount = ethers.parseUnits("1", 6);
            // No approval
            await expect(
                swap.connect(buyer1).buyTokens(usdcAmount)
            ).to.be.reverted; // ERC20 insufficient allowance
        });
    });

    describe("Limits", function () {
        it("Should enforce max per transaction", async function () {
            // maxPerTx defaults to 10K PINN44
            // 10K / 100 = 100 USDC would buy exactly the limit
            const tooMuchUsdc = ethers.parseUnits("101", 6); // 101 USDC = 10,100 tokens > 10K limit

            await usdc.connect(buyer1).approve(await swap.getAddress(), tooMuchUsdc);

            await expect(
                swap.connect(buyer1).buyTokens(tooMuchUsdc)
            ).to.be.revertedWith("Exceeds max per tx");
        });

        it("Should enforce max per wallet", async function () {
            // maxPerWallet defaults to 50K PINN44 (approx 500 USDC)
            const usdcPerBatch = ethers.parseUnits("100", 6); // 10K PINN44

            // Need approvals for 5 batches + 1 fail
            await usdc.connect(buyer1).approve(await swap.getAddress(), ethers.parseUnits("600", 6));

            // Buy 5 times (Total 50K)
            for (let i = 0; i < 5; i++) {
                if (i > 0) {
                    await ethers.provider.send("evm_increaseTime", [61]);
                    await ethers.provider.send("evm_mine", []);
                }
                await swap.connect(buyer1).buyTokens(usdcPerBatch);
            }

            await ethers.provider.send("evm_increaseTime", [61]);
            await ethers.provider.send("evm_mine", []);

            // Next buy needs 1 USDC -> Exceeds max wallet
            await expect(
                swap.connect(buyer1).buyTokens(ethers.parseUnits("1", 6))
            ).to.be.revertedWith("Exceeds max per wallet");
        });

        it("Should enforce cooldown", async function () {
            const usdcAmount = ethers.parseUnits("1", 6);
            await usdc.connect(buyer1).approve(await swap.getAddress(), usdcAmount * 2n);

            await swap.connect(buyer1).buyTokens(usdcAmount);

            // Immediately try again
            await expect(
                swap.connect(buyer1).buyTokens(usdcAmount)
            ).to.be.revertedWith("Cooldown active");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to withdraw USDC", async function () {
            const usdcAmount = ethers.parseUnits("100", 6);
            await usdc.connect(buyer1).approve(await swap.getAddress(), usdcAmount);
            await swap.connect(buyer1).buyTokens(usdcAmount);

            const contractBalance = await usdc.balanceOf(await swap.getAddress());
            expect(contractBalance).to.equal(usdcAmount);

            const adminBalanceBefore = await usdc.balanceOf(owner.address);

            await swap.withdrawFunds(owner.address, contractBalance);

            const adminBalanceAfter = await usdc.balanceOf(owner.address);
            expect(adminBalanceAfter).to.equal(adminBalanceBefore + contractBalance);
        });
    });
});
