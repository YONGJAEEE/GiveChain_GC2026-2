import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const units = (value: string) => ethers.parseUnits(value, 18);

describe("GiveChainV2", function () {
    let token: any;
    let giveChain: any;
    let owner: any;
    let donor: any;
    let beneficiary: any;
    let other: any;

    async function createCampaign(
        goal = "500",
        beneficiaryAddress = beneficiary.address,
        asset = token.target
    ) {
        return giveChain
            .connect(owner)
            .createCampaign(
                "교육 지원",
                units(goal),
                beneficiaryAddress,
                asset
            );
    }

    beforeEach(async function () {
        [owner, donor, beneficiary, other] = await ethers.getSigners();

        const tokenFactory = await ethers.getContractFactory("GiveTokenV2");
        token = await tokenFactory.deploy(owner.address);
        await token.waitForDeployment();

        const chainFactory = await ethers.getContractFactory("GiveChainV2");
        giveChain = await chainFactory.deploy();
        await giveChain.waitForDeployment();
    });

    it("mints GVT only through the owner charge flow", async function () {
        await expect(token.mintForCharge(donor.address, units("1000")))
            .to.emit(token, "ChargeMinted")
            .withArgs(donor.address, units("1000"));
        expect(await token.balanceOf(donor.address)).to.equal(units("1000"));

        await expect(
            token.connect(donor).mintForCharge(donor.address, units("1"))
        ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        await expect(token.mintForCharge(ethers.ZeroAddress, units("1")))
            .to.be.revertedWithCustomError(token, "InvalidReceiver");
        await expect(token.mintForCharge(donor.address, 0))
            .to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("requires approval and matches the campaign asset type", async function () {
        await createCampaign();
        await token.mintForCharge(donor.address, units("100"));

        await expect(
            giveChain.connect(donor).donateToken(0, units("100"))
        ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

        await createCampaign("1", beneficiary.address, ethers.ZeroAddress);
        await token.connect(donor).approve(giveChain.target, units("100"));
        await expect(
            giveChain.connect(donor).donateToken(1, units("100"))
        ).to.be.revertedWithCustomError(giveChain, "WrongAssetType");
        await expect(
            giveChain.connect(donor).donateETH(0, { value: 1n })
        ).to.be.revertedWithCustomError(giveChain, "WrongAssetType");
    });

    it("records the received token amount in the campaign ledgers", async function () {
        await createCampaign();
        const amount = units("100");
        await token.mintForCharge(donor.address, amount);
        await token.connect(donor).approve(giveChain.target, amount);

        await expect(giveChain.connect(donor).donateToken(0, amount))
            .to.emit(giveChain, "Donated")
            .withArgs(0n, donor.address, token.target, amount);

        const campaign = await giveChain.campaigns(0);
        expect(campaign.raised).to.equal(amount);
        expect(await giveChain.donations(0, donor.address)).to.equal(amount);
        expect(await giveChain.lifetimeDonatedByAsset(token.target)).to.equal(amount);
        expect(await token.balanceOf(giveChain.target)).to.equal(amount);
        expect(await token.allowance(donor.address, giveChain.target)).to.equal(0n);
    });

    it("settles a successful token campaign with one beneficiary withdrawal", async function () {
        await createCampaign();
        const amount = units("600");
        await token.mintForCharge(donor.address, amount);
        await token.connect(donor).approve(giveChain.target, amount);
        await giveChain.connect(donor).donateToken(0, amount);
        await giveChain.finalizeCampaign(0);

        const campaign = await giveChain.campaigns(0);
        expect(campaign.stage).to.equal(2n); // Stage.SUCCESS

        const before = await token.balanceOf(beneficiary.address);
        await expect(giveChain.connect(beneficiary).withdraw(0))
            .to.emit(giveChain, "Withdrawn")
            .withArgs(0n, beneficiary.address, token.target, amount);
        expect(await token.balanceOf(beneficiary.address)).to.equal(before + amount);
        expect((await giveChain.campaigns(0)).withdrawn).to.equal(true);
        expect(await giveChain.getContractAssetBalance(token.target)).to.equal(0n);

        await expect(giveChain.connect(beneficiary).withdraw(0))
            .to.be.revertedWithCustomError(giveChain, "AlreadyWithdrawn");
    });

    it("settles a failed token campaign with donor refunds", async function () {
        await createCampaign();
        const amount = units("100");
        await token.mintForCharge(donor.address, amount);
        await token.connect(donor).approve(giveChain.target, amount);
        await giveChain.connect(donor).donateToken(0, amount);
        await giveChain.finalizeCampaign(0);

        expect((await giveChain.campaigns(0)).stage).to.equal(3n); // Stage.FAILED
        const before = await token.balanceOf(donor.address);
        await expect(giveChain.connect(donor).refund(0))
            .to.emit(giveChain, "Refunded")
            .withArgs(0n, donor.address, token.target, amount);
        expect(await token.balanceOf(donor.address)).to.equal(before + amount);
        expect(await giveChain.donations(0, donor.address)).to.equal(0n);
        expect((await giveChain.campaigns(0)).refunded).to.equal(amount);
        expect(await giveChain.getContractAssetBalance(token.target)).to.equal(0n);

        await expect(giveChain.connect(donor).refund(0))
            .to.be.revertedWithCustomError(giveChain, "NoDonation");
    });

    it("keeps the original ETH campaign flow working", async function () {
        await createCampaign("1", beneficiary.address, ethers.ZeroAddress);
        const amount = ethers.parseEther("1");
        await giveChain.connect(donor).donateETH(0, { value: amount });
        await giveChain.finalizeCampaign(0);

        const before = await ethers.provider.getBalance(beneficiary.address);
        await expect(giveChain.connect(beneficiary).withdraw(0))
            .to.emit(giveChain, "Withdrawn")
            .withArgs(0n, beneficiary.address, ethers.ZeroAddress, amount);
        const after = await ethers.provider.getBalance(beneficiary.address);
        expect(after).to.be.greaterThan(before);
        expect(await giveChain.getContractAssetBalance(ethers.ZeroAddress)).to.equal(0n);
    });

    it("validates campaign setup and prevents changing an active ledger", async function () {
        await expect(
            giveChain.connect(donor).createCampaign(
                "교육 지원",
                units("1"),
                beneficiary.address,
                token.target
            )
        ).to.be.revertedWithCustomError(giveChain, "OnlyOwner");
        await expect(createCampaign("0"))
            .to.be.revertedWithCustomError(giveChain, "InvalidGoal");
        await expect(createCampaign("1", ethers.ZeroAddress))
            .to.be.revertedWithCustomError(giveChain, "InvalidBeneficiary");
        await expect(
            createCampaign("1", beneficiary.address, other.address)
        ).to.be.revertedWithCustomError(giveChain, "InvalidAsset");

        await createCampaign("500", other.address, ethers.ZeroAddress);
        expect((await giveChain.campaigns(0)).beneficiary).to.equal(other.address);
        await giveChain.changeBeneficiary(0, beneficiary.address);
        expect((await giveChain.campaigns(0)).beneficiary).to.equal(beneficiary.address);

        await giveChain.connect(donor).donateETH(0, { value: 1n });
        await expect(giveChain.changeBeneficiary(0, other.address))
            .to.be.revertedWithCustomError(giveChain, "CampaignHasDonation");
    });
});
