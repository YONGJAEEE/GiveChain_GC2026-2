import { network } from "hardhat";

const { ethers } = await network.create();

const tokenAddress = process.env.TOKEN_ADDRESS;
if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
    throw new Error("Set TOKEN_ADDRESS to a deployed GiveTokenV2 address");
}

const [owner] = await ethers.getSigners();
const user = process.env.CHARGE_USER ?? owner.address;
if (!ethers.isAddress(user)) {
    throw new Error("CHARGE_USER must be a valid address");
}

const chargeAmount = process.env.CHARGE_AMOUNT ?? "50000";
const token = await ethers.getContractAt("GiveTokenV2", tokenAddress);
const decimals = await token.decimals();
const amount = ethers.parseUnits(chargeAmount, decimals);

const transaction = await token.mintForCharge(user, amount);
const receipt = await transaction.wait();

console.log(`Token: ${tokenAddress}`);
console.log(`Owner: ${owner.address}`);
console.log(`User: ${user}`);
console.log(`Minted: ${chargeAmount} GVT`);
console.log(`Transaction: ${receipt?.hash ?? transaction.hash}`);
console.log(`Balance: ${ethers.formatUnits(await token.balanceOf(user), decimals)} GVT`);
