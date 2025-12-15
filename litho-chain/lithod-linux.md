# Lithosphere Network – Node Chain Binary

## GitHub Repository
- **Repo URL:** [https://github.com/KaJLabs/lithosphere](https://github.com/KaJLabs/lithosphere/)  
- **Branch:** `main`

---

## Binary Name
`lithod`

## Chain Framework
- **Framework:** Cosmos-SDK–based chain  
- **Consensus:** CometBFT (Tendermint Core)  
- **Execution:** LithoVM (EVM-compatible runtime)

## Source Repository
[https://github.com/KaJLabs/lithosphere/litho-chain](https://github.com/KaJLabs/lithosphere/litho-chain)

---

## Pre-built Binary
- **Platform:** Linux x86_64  
- **Binary:** `lithod`  

**Latest release binary:**  
[https://github.com/lithosphere-network/litho-chain/releases/latest](https://github.com/lithosphere-network/litho-chain/releases/latest)

> If no release binary is provided, you can build from source (see below).

---

## Build Instructions (From Source)

### Requirements
- Go ≥ 1.22  
- GNU Make  
- Linux x86_64  

### Steps
```bash
git clone https://github.com/lithosphere-network/litho-chain
cd litho-chain
make install
