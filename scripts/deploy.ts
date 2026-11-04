import { network } from "hardhat";

const { ethers } = await network.create();

const [deployer, beneficiary] = await ethers.getSigners();
const GiveChain = await ethers.getContractFactory("GiveChain");
const giveChain = await GiveChain.deploy();
await giveChain.waitForDeployment();

console.log(`deployer: ${deployer.address}`);
console.log(`beneficiary example: ${beneficiary.address}`);
console.log(`GiveChain: ${await giveChain.getAddress()}`);
