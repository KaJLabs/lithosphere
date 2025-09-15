# Validators

In classical Byzantine fault-tolerant (BFT) algorithms, each node has the same weight. In Lithosphere, nodes have a non-negative amount of voting power, and nodes that have positive voting power are called validators. Validators participate in the consensus protocol by broadcasting cryptographic signatures, or votes, to agree upon the next block.\
Validators’ voting powers are determined at genesis or are changed deterministically by the blockchain, depending on the application. For example, in a proof-of-stake application such as the LithoSwap, the voting power may be determined by the amount of staking tokens bonded as collateral.

