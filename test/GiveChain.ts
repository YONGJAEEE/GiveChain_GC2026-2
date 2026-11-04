import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const ether = (value: string) => ethers.parseEther(value);

describe("GiveChain", function () {
  let giveChain: any;
  let attackerContract: any;
  let admin: any;
  let beneficiary: any;
  let donorA: any;
  let donorB: any;
  let attacker: any;

  async function createCampaign(
    goal = "5",
    beneficiaryAddress = beneficiary.address
  ) {
    return giveChain
      .connect(admin)
      .createCampaign("교육 지원", ether(goal), beneficiaryAddress);
  }

  beforeEach(async function () {
    [admin, beneficiary, donorA, donorB, attacker] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("GiveChain");
    giveChain = await factory.deploy();
    await giveChain.waitForDeployment();

    const attackerFactory = await ethers.getContractFactory("RefundAttacker");
    attackerContract = await attackerFactory.deploy();
    await attackerContract.waitForDeployment();
  });

  it("creates an OPEN campaign with all six fields", async function () {
    await expect(createCampaign())
      .to.emit(giveChain, "CampaignCreated")
      .withArgs(0n, admin.address, "교육 지원", ether("5"), beneficiary.address);

    const campaign = await giveChain.campaigns(0);
    expect(campaign.owner).to.equal(admin.address);
    expect(campaign.title).to.equal("교육 지원");
    expect(campaign.goal).to.equal(ether("5"));
    expect(campaign.raised).to.equal(0n);
    expect(campaign.beneficiary).to.equal(beneficiary.address);
    expect(campaign.stage).to.equal(1n); // Stage.OPEN
  });

  it("keeps campaigns and donor ledgers independent", async function () {
    await createCampaign("5");
    await giveChain
      .connect(admin)
      .createCampaign("의료 지원", ether("3"), donorB.address);

    await giveChain.connect(donorA).donate(0, { value: ether("1") });
    await giveChain.connect(donorA).donate(0, { value: ether("0.5") });
    await giveChain.connect(donorB).donate(1, { value: ether("2") });

    const campaign0 = await giveChain.campaigns(0);
    const campaign1 = await giveChain.campaigns(1);
    expect(campaign0.raised).to.equal(ether("1.5"));
    expect(campaign1.raised).to.equal(ether("2"));
    expect(await giveChain.donations(0, donorA.address)).to.equal(ether("1.5"));
    expect(await giveChain.donations(1, donorB.address)).to.equal(ether("2"));
    expect(await ethers.provider.getBalance(await giveChain.getAddress())).to.equal(
      ether("3.5")
    );
  });

  it("emits the donation event with id, donor, and amount", async function () {
    await createCampaign();

    await expect(giveChain.connect(donorA).donate(0, { value: ether("1") }))
      .to.emit(giveChain, "Donated")
      .withArgs(0n, donorA.address, ether("1"));
  });

  it("finalizes to SUCCESS when raised reaches the goal", async function () {
    await createCampaign("1");
    await giveChain.connect(donorA).donate(0, { value: ether("1") });
    await giveChain.connect(admin).finalizeCampaign(0);

    const campaign = await giveChain.campaigns(0);
    expect(campaign.stage).to.equal(2n); // Stage.SUCCESS
  });

  it("finalizes to FAILED when raised is below the goal", async function () {
    await createCampaign("5");
    await giveChain.connect(donorA).donate(0, { value: ether("1") });
    await giveChain.connect(admin).finalizeCampaign(0);

    const campaign = await giveChain.campaigns(0);
    expect(campaign.stage).to.equal(3n); // Stage.FAILED
  });

  it("lets only the beneficiary withdraw a successful campaign once", async function () {
    await createCampaign("1");
    await giveChain.connect(donorA).donate(0, { value: ether("1") });
    await giveChain.connect(admin).finalizeCampaign(0);

    await expect(giveChain.connect(attacker).withdraw(0))
      .to.be.revertedWithCustomError(giveChain, "NotBeneficiary");

    await expect(giveChain.connect(beneficiary).withdraw(0))
      .to.emit(giveChain, "Withdrawn")
      .withArgs(0n, beneficiary.address, ether("1"));
    expect(await giveChain.withdrawn(0)).to.equal(true);

    await expect(giveChain.connect(beneficiary).withdraw(0))
      .to.be.revertedWithCustomError(giveChain, "AlreadyWithdrawn");
  });

  it("refunds a failed campaign and blocks a second refund", async function () {
    await createCampaign("5");
    await giveChain.connect(donorA).donate(0, { value: ether("1") });
    await giveChain.connect(admin).finalizeCampaign(0);

    await expect(giveChain.connect(donorA).refund(0))
      .to.changeEtherBalance(ethers, donorA, ether("1"));
    expect(await giveChain.donations(0, donorA.address)).to.equal(0n);

    await expect(giveChain.connect(donorA).refund(0))
      .to.be.revertedWithCustomError(giveChain, "NoDoubleRefund");
  });

  it("rejects invalid campaign ids and invalid state transitions", async function () {
    await expect(giveChain.connect(donorA).donate(0, { value: ether("1") }))
      .to.be.revertedWithCustomError(giveChain, "InvalidCampaign");

    await createCampaign("1");
    await giveChain.connect(donorA).donate(0, { value: ether("1") });
    await giveChain.connect(admin).finalizeCampaign(0);

    await expect(giveChain.connect(donorA).donate(0, { value: ether("1") }))
      .to.be.revertedWithCustomError(giveChain, "InvalidStage");
    await expect(giveChain.connect(donorA).refund(0))
      .to.be.revertedWithCustomError(giveChain, "InvalidStage");
    await expect(giveChain.connect(admin).finalizeCampaign(0))
      .to.be.revertedWithCustomError(giveChain, "InvalidStage");
  });

  it("blocks a non-owner from finalizing", async function () {
    await createCampaign("1");
    await expect(giveChain.connect(attacker).finalizeCampaign(0))
      .to.be.revertedWithCustomError(giveChain, "NotCampaignOwner");
  });

  it("blocks withdrawal from a FAILED campaign", async function () {
    await createCampaign("5");
    await giveChain.connect(donorA).donate(0, { value: ether("1") });
    await giveChain.connect(admin).finalizeCampaign(0);

    await expect(giveChain.connect(beneficiary).withdraw(0))
      .to.be.revertedWithCustomError(giveChain, "InvalidStage");
  });

  it("prevents refund reentrancy from receiving more than the donation", async function () {
    await createCampaign("5", await attackerContract.getAddress());
    await attackerContract.donate(await giveChain.getAddress(), 0, {
      value: ether("1"),
    });
    await giveChain.connect(admin).finalizeCampaign(0);

    const beforeBalance = await ethers.provider.getBalance(await giveChain.getAddress());
    await expect(
      attackerContract.attack(await giveChain.getAddress(), 0)
    ).to.emit(giveChain, "Refunded").withArgs(
      0n,
      await attackerContract.getAddress(),
      ether("1")
    );

    expect(await attackerContract.receiveCount()).to.equal(1n);
    expect(await giveChain.donations(0, await attackerContract.getAddress())).to.equal(0n);
    expect(await ethers.provider.getBalance(await giveChain.getAddress())).to.equal(
      beforeBalance - ether("1")
    );
  });
});
