# Linear-communication BFT Consensus

The Litho protocol utilizes a BFT (BFT stands for Byzantine Fault-Tolerance) algorithm to achieve this. A Byzantine Fault-Tolerant consensus algorithm guarantees safety for up to a third of Byzantine, or malicious, actors. Byzantine faults within distributed systems are some of the most difficult to deal with.

A blockchain framework like Lithosphere powered by BFT allows public and private blockchains to transfer tokens to each other.

A BFT powered blockchain network (Lithosphere) allows interoperability with other PoS / fast finality blockchains like Cosmos, Binance or Proof of Authority & PoW blockchains.

Lithosphere adapts a new consensus algorithm, LinBFT proposed by Dr. David Yang. The Linear-communication BFT Protocol (LinBFT) applies to a permissionless, public blockchain system, in which there is no public-key infrastructure, based on the classic PBFT with 4 major improvements:

* Per-block consensus. There is consensus for each block, rather than for a group of blocks. This limits the power of the block proposer, and, thus, mitigates selfish mining.
* Rotating leader. The LinBFT protocol changes the leader (i.e., block proposer) for every block, which reduces the risk of denial-of-service attacks on the leader.
* Changing honesty. In Pyramid LinBFT, a participant can be honest for one block, and malicious for another (e.g., one containing a transaction of interest to the participant), as long as over 2/3 of all participants are honest for each block. In other words, it is possible that every participant is malicious at some point, and yet the blockchain remains secure at all times.
* Dynamic participant set. LinBFT allows nodes to join and leave the protocol at the beginning of epochs. As a result, different blocks may be verified by completely different sets of nodes.

Further, in the ordinary case, LinBFT involves only a single round of voting instead of two in PBFT, which reduces both communication overhead and the confirmation time and employs the proof-of- stake scheme to reward all participants. Extensive experiments using data obtained from the Ethereum test net demonstrate that LinBFT consistently and significantly outperforms existing in- production BFT protocols for blockchains.\


####
