import { network } from "hardhat";

const { ethers } = await network.create();

const tokenAddress = process.env.TOKEN_ADDRESS;
const chainAddress = process.env.GIVECHAIN_ADDRESS;
if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
    throw new Error("Set TOKEN_ADDRESS to a deployed GiveTokenV2 address");
}
if (!chainAddress || !ethers.isAddress(chainAddress)) {
    throw new Error("Set GIVECHAIN_ADDRESS to a deployed GiveChainV2 address");
}

const [owner, donor, beneficiary] = await ethers.getSigners();
const token = await ethers.getContractAt("GiveTokenV2", tokenAddress);
const giveChain = await ethers.getContractAt("GiveChainV2", chainAddress);
const decimals = await token.decimals();
const units = (value: string) => ethers.parseUnits(value, decimals);

const mintAmount = units("1000");
const successDonation = units("600");
const failedDonation = units("100");

await (await token.mintForCharge(donor.address, mintAmount)).wait();

await (
    await giveChain.createCampaign(
        "성공 캠페인",
        units("500"),
        beneficiary.address,
        tokenAddress
    )
).wait();
await (await token.connect(donor).approve(chainAddress, successDonation)).wait();
await (await giveChain.connect(donor).donateToken(0, successDonation)).wait();
await (await giveChain.finalizeCampaign(0)).wait();

const beneficiaryBefore = await token.balanceOf(beneficiary.address);
await (await giveChain.connect(beneficiary).withdraw(0)).wait();
const beneficiaryAfter = await token.balanceOf(beneficiary.address);

await (
    await giveChain.createCampaign(
        "실패 캠페인",
        units("500"),
        beneficiary.address,
        tokenAddress
    )
).wait();
await (await token.connect(donor).approve(chainAddress, failedDonation)).wait();
await (await giveChain.connect(donor).donateToken(1, failedDonation)).wait();
await (await giveChain.finalizeCampaign(1)).wait();

const donorBeforeRefund = await token.balanceOf(donor.address);
await (await giveChain.connect(donor).refund(1)).wait();
const donorAfterRefund = await token.balanceOf(donor.address);
const contractBalance = await giveChain.getContractAssetBalance(tokenAddress);

console.log(`Token: ${tokenAddress}`);
console.log(`GiveChain: ${chainAddress}`);
console.log(`Owner: ${owner.address}`);
console.log(`Donor: ${donor.address}`);
console.log(`Beneficiary: ${beneficiary.address}`);
console.log(`SUCCESS campaign #0 withdrawn: ${ethers.formatUnits(beneficiaryAfter - beneficiaryBefore, decimals)} GVT`);
console.log(`FAILED campaign #1 refunded: ${ethers.formatUnits(donorAfterRefund - donorBeforeRefund, decimals)} GVT`);
console.log(`Donor final balance: ${ethers.formatUnits(await token.balanceOf(donor.address), decimals)} GVT`);
console.log(`GiveChain final balance: ${ethers.formatUnits(contractBalance, decimals)} GVT`);
