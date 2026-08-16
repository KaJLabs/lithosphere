import type { HardhatEthersHelpers as PluginHardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

// TypeChain augments Hardhat's helper interface with contract-specific
// overloads. With the pnpm-resolved Hardhat toolbox versions, that generated
// augmentation shadows these two base members, so restore their public types
// without modifying generated files.
declare module "hardhat/types/runtime" {
  interface HardhatEthersHelpers {
    provider: PluginHardhatEthersHelpers["provider"];
    getSigners: PluginHardhatEthersHelpers["getSigners"];
    getSigner: PluginHardhatEthersHelpers["getSigner"];
  }
}
