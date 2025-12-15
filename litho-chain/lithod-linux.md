Lithosphere Network – Node Chain Binary

GitHub repo URL: https://github.com/KaJLabs/lithosphere/   
Branch: main 


Binary Name
lithod

Chain Framework
Cosmos-SDK–based chain
Consensus: CometBFT (Tendermint Core)
Execution: LithoVM (EVM-compatible runtime)

Source Repository
https://github.com/KaJLabs/lithosphere/litho-chain


Pre-built Binary
Platform: Linux x86_64
Binary: lithod
If a release binary is provided:
https://github.com/lithosphere-network/litho-chain/releases/latest

(Otherwise build from source as below.)

Build Instructions (from source)
Requirements
Go ≥ 1.22
GNU Make
Linux x86_64
git clone https://github.com/lithosphere-network/litho-chain
cd litho-chain
make install

This installs:
$GOPATH/bin/lithod

Verify:
lithod version


Default Node Directories
~/.lithod/
├── config/
│   ├── app.toml
│   ├── config.toml
│   ├── genesis.json
├── data/
└── keyring/


Node Startup
lithod init <moniker> --chain-id lithosphere-1
lithod start


Genesis & Config
genesis.json provided separately (chain launch package)
Seed & persistent peers injected via config.toml
Remote signer / HSM supported via CometBFT signer

Validator Compatibility
Cosmovisor supported
Remote signer (tmkms / KMS / HSM) supported
Prometheus metrics enabled

