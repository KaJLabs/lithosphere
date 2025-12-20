# Rapid development and interface

Lithosphere will provide development environments for smart contracts as well as function libraries. These functions may be used by developers to speed up the creation of smart contracts. To make it simpler to access and interact with data, the development environment will encapsulate different blockchain, smart contracts, data sources, and so on as interfaces.

Here are some typical interfaces:

**(1)Key management**

Initializing the key pair, creating and returning the public key address are all functions that must be implemented.

Returning the signature hash value after entering the public key address and the associated signature.&#x20;

**(2)Blockchain data acquisition**

If blockchains are thought of as systems that allow distributed applications (DApps), smart contracts collecting blockchain data will be the same as getting the blockchain system’s global variables. Smart contracts can access the following information on the blockchain using this interface:

Aim for a specific block height. The sender’s information. The recipient’s information.

**(3)Call of smart contracts**

Smart contracts are used to implement all of the Lithosphere’s functionalities.

The use of a transfer smart contract may be used to make a transfer in a smart contract. To encompass typical financial applications, Lithosphere will employ more basic smart contracts. As a result, developing a smart contract on Lithosphere entails embedding simple smart contracts into conventional financial apps and then enhancing their functionality by adding more complicated functionalities.

Lithosphere will identify fundamental financial contracts, resulting in a smart contract library for developers to employ.

**(4)Off-chain Datasource interface**

On trigger circumstances, smart contracts employ off-chain data. Such data is frequently obtained using a standard HTTP or socks-based API supplied by a third party. A third-party interface call function, for example, will obtain the destination URL’s address through HTTP and return a JSON packet.

This interface method can also be used to get information from other blockchains, such as querying and confirming whether a transaction in another chain is confirmed by the block where it is located.

The Foundation will be used by Lithosphere to discover third-party interfaces and create third-party interfaces for smart contracts to call.

**(5)Rapid development**

Lithosphere will provide several smart contract templates for common applications for reference and usage by application developers in the early phases of the project. However, application developers must still fulfill certain code standards.

Application developers can use smart contracts by creating preconditions to actualize the desired financial apps as the platform’s underlying functionalities and common financial basic applications grow more resourceful and complex. To further improve such a development environment and drastically reduce the development threshold for developers, Lithosphere’s plan includes visual and modular application development tools, a compilation environment, an application test environment, which will allow smart contract developers to focus on innovations in financial applications and a Launchpad to launch dApps.

**(6)Programming language and virtual machine**

For interoperability with smart contracts and quick porting of existing smart contracts, Lithosphere will initially employ Ethereum’s Solidity programming language. We will provide compilers for several languages in the future to accommodate more smart contract development languages.

We’ll create a smart contract sandboxing system that performs particular fail-safe checks and fuel cost minimization using a browser or programming editor.

####
