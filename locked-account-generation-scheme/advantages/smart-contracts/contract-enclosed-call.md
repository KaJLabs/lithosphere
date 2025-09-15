# Contract enclosed call

The above improvements to current smart contracts will eventually allow smart contracts on Lithosphere to define relationships and interaction rules based on various conditions, among various values and participants, in time and space, allowing smart contracts on Lithosphere to build DeFi applications.

On Lithosphere, a smart contract may not only change account status and data, but it can also call another smart contract during execution if certain criteria are satisfied.

The following activities must be completed to implement Smart Contract A’s call to Smart Contract B:

**(1)Create an enclosed call smart contract.**

A preset condition judgment and a preset condition rule for invoking the smart contract B are added to the code of smart contract A, and the parameter of the target smart contract address index is generated. The data input when smart contract A is triggered, as well as the outcome of the data computation, provides the foundation for the condition judgment. If the predefined criteria are met, the node will download and execute smart contract B.

The call condition is divided into two parts: rules and time. Rules are pre-programmed computation routines in a smart contract. Time conditions can be a pre-defined condition in a smart contract that is triggered when the smart contract is executed or a condition that checks the state of a smart contract regularly.

**(2)The procedure for making an enclosed call.**

i.When the smart contract A is activated, it will determine whether or not it is required to execute the smart contract B based on the preset calling circumstances.

ii.When the calling circumstances are satisfied, the preset calculation function is called, and the result is used as the smart contract B’s input.

iii.The node that performed the smart contract A downloads the smart contract B to the local computing environment, inputs the data determined in the preceding step as the smart contract B’s input data and starts executing the smart contract B.

The procedures outlined above can be used to execute smart contract A’s call to contract B. We call the logic link between them an enclosed call of a smart contract because smart contract B is based on the state of smart contract A as the trigger and input data.

Smart contracts not only make decisions based on their business logic, but they may also invoke other smart contracts based on predefined criteria. It is therefore simple to create network-like call interactions between distinct smart contracts, establishing the value interaction across connected financial apps and thus allowing the creation of complicated applications. As a consequence, sophisticated financial services, such as a loan application based on future cash flow, maybe developed using enclosed smart contract calls. The Lithosphere platform can achieve complicated financial activities thanks to these features and the multi-trigger mechanism, which will be explained in the section on multi-trigger mechanisms.

####
