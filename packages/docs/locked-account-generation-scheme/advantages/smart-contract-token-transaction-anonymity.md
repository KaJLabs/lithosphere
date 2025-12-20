# Smart Contract Token Transaction Anonymity

To achieve anonymity in smart contract token transactions on Lithosphere, ring-signature and one- time accounts are used. To make the sender anonymous, ring-signature combines the transaction sender with a group of false members. Each transaction generates a one-time account that cannot be connected to the actual owner.

A technique to lock the assets of the originating chain is required in almost all cross-chain transaction schemes. The locked assets will only be unlocked and returned to the original account or another account after the triggering condition is satisfied.

The Hashed TimeLock Contract system, the Trusted Third-Party Escrow Account strategy, and the Multi-Signature Account method are examples of existing techniques.
