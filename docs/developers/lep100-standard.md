# LEP100 Token Standard

The LEP100 (Lithosphere Evolution Proposal 100) is the token standard that governs all tokens on the Lithosphere network. This guide covers the standard's design, features, comparisons with other token standards, and how to create and store LEP100 tokens.

![LEP100 Token Standard](../diagrams/LEP100-TOKENS_AND_LITHO-LAUNCHPAD-1.png)

---

## Abstract

The LEP100 token standard was proposed by Joel Kasr, founder of KaJ Labs and creator of Lithosphere. This standard is a set of rules that all tokens on Lithosphere's project launchpad follow, including Lithosphere's native token LITHO. The LEP100 yellowpaper provides the formal specification of the standard.

---

## What is LEP100?

The LEP100 is a novel standard for multi-tokens. It allows a single contract to represent multiple fungible (currency) and non-fungible tokens (NFT) with batched operations for increased gas efficiency. Most importantly, LEP100 tokens can exchange for any other token equivalents.

LEP100 tokens are fueled using the native Litho coin (LITHO). When pegged with LEP100 tokens, you can also peg onto any network using any major digital asset. The token is multi-contract compliant and provides basic features such as transferring, returning a balance, and examining a token's possession.

Unlike ERC-20 or BEP-20, LEP100 allows a single contract to represent numerous fungible and non-fungible tokens, enabling a wide range of applications. It is designed for DeFi platforms, gaming platforms, NFT marketplaces, and other high-demand contract-compatible platforms.

The LEP100 standard also enables **token time-slicing** in smart contracts. When a token is sliced, it is split into two parts: a time-limited slice (Time-Lent) and an infinite end (Time-Restricted, since its utility is limited for a period but not locked). Both slices can be further split, enabling sophisticated DeFi instruments such as options and futures trading.

---

## LEP100 vs. ERC-20, ERC-1155, and BEP-20

LEP100 and ERC-20 share many similarities. LEP100 is an extended version of the ERC-20 and ERC-1155 standards with additional capabilities for cross-chain operations and multi-token support.

| Feature | LEP100 | ERC-20 | ERC-1155 | BEP-20 |
|---------|--------|--------|----------|--------|
| Fungible tokens | Yes | Yes | Yes | Yes |
| Non-fungible tokens | Yes | No | Yes | No |
| Multi-token per contract | Yes | No | Yes | No |
| Time slicing | Yes | No | No | No |
| Cross-chain exchange | Native | No | No | No |
| Batch transfers | Yes | No | Yes | No |
| Gas efficiency | Up to 90% reduction | Baseline | Improved | Similar to ERC-20 |
| DeFi integration | Native | Via extensions | Limited | Via extensions |

Lithosphere provides the **Litho Bridge**, a cross-chain bridging service that enables interoperability between different blockchains. The bridge supports cross-chain transfers for BEP-20, ERC-20, ERC-1155, and TRC-20 tokens. Converting from a native blockchain token to LEP100 is called **Peg-in**, and converting back is called **Peg-out**.

---

## Key Features and Parameters

When creating a LEP100 token (through the Litho Launchpad or a smart contract), the following parameters define the token's behavior:

| Parameter | Description |
|-----------|-------------|
| **Fungible & Non-Fungible** | Can represent both fungible assets (currency) and non-fungible assets (art, collectibles, music) |
| **Time Slicing** | Adds start-time and end-time attributes. Only tokens whose current time falls within the start and end time are valid. Superior to ERC-20 in this regard |
| **Cross-chain** | Can be exchanged with ERC-20, ERC-721, ERC-1155, BEP-2, BEP-20, or any similar token equivalents |
| **Can Burn** | Whether the tokens can be burned to reduce supply over time, making the token deflationary |
| **Can Mint** | Whether new tokens can be minted to expand supply over time, making the token inflationary |
| **Can Pause** | Whether all operations associated with the token can be paused during a malicious attack or vulnerability. Only the generator or a permissioned address can pause |
| **Blacklist** | Ability to blocklist specific addresses acting maliciously |

---

## Functions

### Save Gas

Cut gas fees by up to 90% when minting new tokens compared to other token standards.

### Advanced Features

LEP100 enables token owners to use, trade, destroy, upgrade, combine, rent, loan, and transfer their NFTs.

### Atomic Swaps

Atomic swaps of any number of tokens in just two simple steps.

### Batch Transfers

Send multiple tokens in a single transaction, reducing gas costs and network congestion.

---

## Token Features

- **High-speed transactions**: The LEP100 token standard enables high-speed transaction rates, making it extremely scalable. Lithosphere supports more than 10,000 TPS.
- **Low transaction fees**: Unlike Ethereum networks, users will not be charged high gas prices. All transaction fees are paid using the native LITHO token.
- **Cross-chain compatibility**: LEP100 tokens are compatible with ERC-20, ERC-721, ERC-1155, BEP-2, and BEP-20 networks and blockchains.
- **Wallet compatibility**: Compatible with nearly every major cryptocurrency wallet available today.
- **Exchange listing**: LEP100 tokens are simple to list on exchanges and DEXs such as LithoSwap, PancakeSwap, and Uniswap.

---

## How to Create LEP100 Tokens

### Via Litho Launchpad

The Litho Launchpad provides an intuitive user interface for creating LEP100 tokens without programming experience. You provide the token name, a symbol, and the parameters described above. The smart contract is automatically published to the Lithosphere blockchain, and you only need to pay the required transaction fees.

### Via Smart Contract

Developers can write custom LEP100 token contracts using Solidity. The `@lithosphere/contracts` package provides reference implementations:

- **LITHO** -- Native blockchain token
- **LEP100** -- Multi-chain token standard implementation
- **WLITHO** -- Wrapped token implementation
- **Lep100Access** -- Access control contracts

See the [Smart Contracts](smart-contracts.md) guide and the [Hardhat Example](examples/hardhat-example.md) for contract development workflows.

---

## How to Store LEP100 Tokens

LEP100 tokens can be stored in any wallet that supports the Lithosphere network:

| Wallet | Description |
|--------|-------------|
| **MetaMask** | Connect MetaMask with the Lithosphere network to store and manage LEP100 tokens |
| **Thanos Wallet** | Decentralized multi-currency wallet supporting send, receive, store, swap, stake, borrow, lend, and purchase of LEP100 tokens. Available on iPhone, Android, Chrome, and Firefox |
| **Trust Wallet** | Decentralized multi-currency wallet supporting send, receive, store, swap, and purchase of LEP100 tokens |

---

## Why Use LEP100 for DeFi?

LEP100 tokens are well-suited for DeFi projects for several reasons:

- **Asset representation**: LEP100 tokens can represent a variety of assets including stocks, fiat currency, and crypto-assets. Other tokens from different blockchains can be pegged to LEP100.
- **Validator rewards**: All validators that transfer LEP100 tokens receive LITHO as a reward, collected as a transaction fee.
- **Low gas fees**: Minimal gas prices for all transactions compared to standards like ERC-20.
- **High throughput**: Built on the Lithosphere network which supports more than 10,000 TPS compared to Ethereum's 15 TPS.
- **Easy integration**: Straightforward to integrate DeFi projects with LEP100 tokens. Tokens can be listed on DEXs such as LithoSwap, PancakeSwap, and Uniswap.

---

## Cross-Chain Integration

Cross-chain asset transfer is a foundational capability of the LEP100 standard. The process relies on two key operations:

### Lock-in (Peg-in)

Asset Lock-in enables Myriad Distributed Key Management (MDKM) and asset mapping for all key-managed tokens. When you Lock-in an asset from another chain to Lithosphere, corresponding LEP100 tokens are minted on the Lithosphere network to represent the locked asset.

### Lock-out (Peg-out)

Asset Lock-out is the reversal of Lock-in. It consists of control rights management and asset mapping disassembly. After Lock-out is completed, control of the digital asset is returned to the owner, restoring complete key storage and centralized key management.

### Asset Mapping

Asset mapping refers to producing matching tokens for bookkeeping on Lithosphere for a controlled item. Once mapped, a token can freely interact with other mapped assets on the network.

### Litho Bridge

The Litho Bridge provides the user-facing cross-chain bridging service. It currently supports ERC-20, ERC-1155, BEP-2, BEP-20, and TRC-20 token conversions. No conversion fees are charged; users only pay the network fees of the blockchain associated with the transaction.

![Cross-Chain Transaction Flow](../diagrams/Figure_2.png)

---

## Further Reading

- [Smart Contracts & DeFi](smart-contracts.md) -- Learn about smart contract development on Lithosphere
- [API & SDK](api-and-sdk.md) -- Integrate LEP100 tokens with the Lithosphere API
- [Hardhat Example](examples/hardhat-example.md) -- Deploy LEP100 contracts with Hardhat
