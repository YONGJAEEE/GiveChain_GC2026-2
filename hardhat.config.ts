import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.20",
    path: require.resolve("solc/soljson.js"),
  },
  paths: {
    tests: "./test",
  },
});
