# Smart Contracts & Decentralized Finance (DeFi)

Lithosphere smart contracts define the relationships and value interaction conditions among digital assets and participants. This guide covers smart contract development, the multi-triggering mechanism, enclosed calls, rapid development interfaces, and transaction anonymity features.

---

## Overview

A smart contract on Lithosphere defines the relationship and value interaction conditions of one or more digital assets among multiple participants in terms of temporal succession and spatial location. It is used to complete financial transactions of one or multiple digital assets among multiple participants.

Digital assets on Lithosphere are assets mapped onto the Lithosphere chain through the Lock-in process. The owners or consumers of various digital assets are referred to as multiple participants and are represented as accounts in the Lithosphere chain, including both user and contract accounts.

The definition of financial transactions through smart contracts becomes a description of the connections among various digital assets and diverse ownership in time and space, because the core of finance is the exchange of values across time and place.

---

## Limitations of Current Smart Contracts

Existing smart contracts on most blockchains have the following limitations:

- Can only operate on the same digital asset between two parties on the **same chain**.
- Can only transfer **ownership** of digital assets, making usage and ownership indivisible.
- Can only be triggered by a **transaction**, with no off-chain trigger conditions or legitimate off-chain information input.

---

## Lithosphere Improvements

Lithosphere smart contracts address these limitations by introducing three key capabilities:

### Multi-Role

The capacity for a smart contract to handle many distinct account types while defining the connections between numerous users and various smart contracts. A single contract can involve multiple user accounts as well as multiple contract accounts.

### Multi-Token

After mapping distinct digital assets to Lithosphere using Lock-in, a smart contract can describe the relationship between many different digital assets at the same time.

### Usufruct Separation

The ability to separate the usufructs (usage rights) and ownerships of digital assets. Unlike current smart contracts that can only transfer tokens as a whole from one party to another, Lithosphere enables one party to gain ownership of a digital asset while another party obtains the usufruct. This makes it possible to establish more than two user accounts or contractual accounts in a single smart contract, allowing for financial activities such as mortgage loans across various digital assets.

The logical abstraction of relationships in terms of time, space, and object attributions can lead to the construction of transactions ranging from simple to complex between various digital assets, enabling financial innovations from basic transfers to borrowing, lending, and derivative instruments.

---

## Contract Development

To fulfill a smart contract on Lithosphere, the following steps must be completed:

### 1. Build a Smart Contract

Lithosphere smart contracts are an evolution of current smart contracts. There should be two components to the contract:

- **Definition section**: Consistent and Ethereum smart contract compliant. Contains contract status, contract values, and methods for defining response conditions and rules. Existing Ethereum smart contracts are therefore compatible with Lithosphere.
- **Description section**: Specifies trigger conditions, off-chain data sources, and the relationship rules between participants and assets.

### 2. Release a Smart Contract

Following the publication of the smart contract:
- The definition section is recorded on the blockchain following current smart contract conventions.
- The description section is merged with the trigger conditions of all smart contracts in the current blockchain to create a **calling list** that is recorded in the block and accessible to the entire network.
- Each row of entries in the calling list corresponds to a smart contract. In addition to the material in the description, each record has an index address pointing to the stored smart contract.

---

## Multi-Triggering Mechanism

![Smart Contract Multi-Triggering Mechanism](../diagrams/Figure_5.png)

Current smart contracts are triggered exclusively by a transfer to the contract, limiting their capabilities to ownership-based asset transfers. Lithosphere introduces a **multi-triggering mechanism** with three trigger modes:

### Active Triggering Mode

The active triggering mode is equivalent to the current smart contract triggering mode. It is compatible with all existing smart contracts. A user initiates a transfer to the contract, the node validates the legality of the transfer, and the contract function executes.

### Timing Triggering Mode

A smart contract can be activated by time-based conditions such as a specific time point or duration. This enables applications like scheduled swaps, recurring payments, and futures contracts.

### Event Triggering Mode

A smart contract is activated when a certain event occurs. This is critical for automated trading, quantitative trading, and any application where capturing real-world or cross-chain events is required.

### Off-Chain Data Input

In the multi-triggering model, some triggering information comes from outside the blockchain. Lithosphere provides an external information input interface:

- External data is transmitted through HTTP or SOCKS to the nodes using common APIs from third-party data sources.
- Lithosphere encapsulates data calls from widely used off-chain data sources, functioning similarly to system calls for node data acquisition.
- Nodes can create their own data sources using the provided data collection routes.
- The consensus process verifies the validity of off-chain data. If a malicious node broadcasts a fraudulent trigger, the network terminates the smart contract during re-verification.

---

## Contract Enclosed Calls

On Lithosphere, a smart contract may not only change account status and data but can also call another smart contract during execution if certain criteria are satisfied.

### Creating an Enclosed Call

Smart Contract A contains a preset condition judgment and a preset condition rule for invoking Smart Contract B. The parameter of the target smart contract address index is generated. The data input when Smart Contract A is triggered, as well as the outcome of the data computation, provides the foundation for the condition judgment.

The call condition is divided into two parts:
- **Rules**: Pre-programmed computation routines in the smart contract.
- **Time**: A pre-defined condition triggered during execution, or a condition that checks the state of the contract regularly.

### The Enclosed Call Procedure

1. When Smart Contract A is activated, it determines whether it is required to execute Smart Contract B based on the preset calling circumstances.
2. When the calling circumstances are satisfied, the preset calculation function is called, and the result is used as Smart Contract B's input.
3. The node that performed Smart Contract A downloads Smart Contract B to the local computing environment, inputs the determined data, and executes Smart Contract B.

This mechanism establishes a logical link between contracts, enabling network-like call interactions between distinct smart contracts and creating value interaction across connected financial applications.

---

## Multiple Triggers for Complex Financial Functions

Existing smart contracts can only passively wait for a transaction trigger, requiring the introduction of a trusted broker. On Lithosphere, smart contracts describe relationships through code (whether by common or enclosed contracts), and multiple triggers automate their execution without human intervention.

Example use cases:

- **Lending**: A smart contract borrows tokens, returns fresh currency, and pays interest automatically.
- **Fund Management**: A smart contract autonomously administers a fund, taking usufruct of various tokens, holding digital assets, producing management fees, and paying dividends.
- **Derivatives**: A smart contract takes margins and performs operations such as modifying margins, liquidating, and settling using external data source triggers.

---

## Enhancements and Compatibility

Lithosphere smart contracts are developed as upgrades to Ethereum and other blockchain smart contracts. Functionality additions such as triggering mechanisms are built on top of compatibility with existing smart contracts:

- Smart contracts already operating on Ethereum and other blockchains can migrate to Lithosphere with minimal changes.
- Smart contract developers familiar with Ethereum tooling can quickly develop on Lithosphere.
- The roadmap includes optimized programming languages and virtual machines for a more robust development environment.

---

## Rapid Development Interfaces

Lithosphere provides development environments for smart contracts along with function libraries. The development environment encapsulates various blockchain interactions, smart contracts, and data sources as interfaces:

### (1) Key Management

Initialize key pairs, create and return public key addresses, and return signature hash values for a given public key address and associated signature.

### (2) Blockchain Data Acquisition

Smart contracts collecting blockchain data access the blockchain system's global variables. Through this interface, contracts can access information such as target block height, sender information, and recipient information.

### (3) Call of Smart Contracts

All Lithosphere functionalities are implemented using smart contracts. A transfer smart contract can be used to make transfers within a smart contract. Lithosphere provides a library of fundamental financial contracts for developers to employ and compose.

### (4) Off-Chain Datasource Interface

Smart contracts employ off-chain data on trigger circumstances. Such data is obtained using standard HTTP or SOCKS-based APIs supplied by third parties. This interface method can also be used to get information from other blockchains, such as querying whether a transaction on another chain has been confirmed.

### (5) Rapid Development Tools

Lithosphere provides smart contract templates for common applications. As the platform's underlying functionalities grow, application developers can create preconditions to actualize desired financial applications. The roadmap includes visual and modular application development tools, a compilation environment, and a test environment.

---

## Programming Language

Lithosphere initially employs Ethereum's **Solidity** programming language for interoperability with existing smart contracts and quick porting. Compilers for additional languages will be provided in the future.

A smart contract **sandboxing system** performs fail-safe checks and fuel cost minimization using a browser or programming editor.

---

## Smart Contract Token Transaction Anonymity

To achieve anonymity in smart contract token transactions on Lithosphere, two mechanisms are used:

### Ring Signatures

Ring signatures combine the transaction sender with a group of decoy members, making the actual sender anonymous. The signature proves that one member of the group authored the transaction without revealing which one.

### One-Time Accounts

Each transaction generates a one-time account that cannot be connected to the actual owner. This prevents address-based tracking and provides privacy protection for all token transfers.

These two mechanisms working together ensure both sender anonymity and unlinkability of transactions, while maintaining the ability to verify transaction validity through the consensus process.

---

## Further Reading

- [LEP100 Token Standard](lep100-standard.md) -- The token standard built on Lithosphere smart contracts
- [API & SDK](api-and-sdk.md) -- Interact with deployed smart contracts through the SDK
- [Hardhat Example](examples/hardhat-example.md) -- Practical contract development with Hardhat
- [Foundry Example](examples/foundry-example.md) -- Fast fuzz testing with Foundry
