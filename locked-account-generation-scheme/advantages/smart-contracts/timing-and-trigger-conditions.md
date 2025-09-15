# Timing and trigger conditions

Proactive triggers are similar to how smart contracts in Ethereum are activated, which is by a transfer to a contract address. The following procedures will be used to create the new time triggering mode and event triggering mode:

**(1)Judge the trigger conditions by nodes**

For execution, the Calling list is downloaded to the local node. To determine if each item in the list matches the trigger condition, the node will poll the list and download matching or local data.

**(2)Trigger a smart contract**

When the accounting node discovers that the condition of a certain smart contract is met while polling at a specific time, the node acquires the smart contract address from the Calling list and sends a particular transaction to activate the smart contract. At the same moment, the smart contract for the selected transaction will be downloaded by the whole network of accounting nodes.

**(3)Execute the smart contract**

A smart contract is performed in the same way as the current smart contract, that is, it is executed in the node’s operational environment (virtual machine). The contract differs in that it has additional triggers and may be integrated into other contracts through triggering conditions, resulting in a chain of occurrences.

####
