import { network } from "hardhat";

const { ethers } = await network.create();

const [deployer] = await ethers.getSigners();
const tokenFactory = await ethers.getContractFactory("GiveTokenV2");
const token = await tokenFactory.deploy(deployer.address);
await token.waitForDeployment();

const chainFactory = await ethers.getContractFactory("GiveChainV2");
const giveChain = await chainFactory.deploy();
await giveChain.waitForDeployment();

const tokenAddress = await token.getAddress();
const chainAddress = await giveChain.getAddress();

console.log(`Deployer: ${deployer.address}`);
console.log(`GiveTokenV2: ${tokenAddress}`);
console.log(`GiveChainV2: ${chainAddress}`);
console.log(`TOKEN_ADDRESS=${tokenAddress}`);
console.log(`GIVECHAIN_ADDRESS=${chainAddress}`);
