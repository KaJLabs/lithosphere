# Governance

## Governance Structure

Lithosphere employs a multi-layered governance model that balances technical expertise with broad community representation. Three distinct bodies participate in the governance process:

### Council Members

Council Members are **elected representatives** who act on behalf of passive stakeholders in the network. Their responsibilities include:

- Proposing referenda for network changes
- Exercising veto power over proposals that may harm the network
- Representing the interests of token holders who do not actively participate in governance

**Joel Kasr** serves as the chair of the council.

### Technical Committee

The Technical Committee comprises the **core teams actively building Lithosphere**. Their governance role includes:

- Proposing emergency referenda in coordination with the council for urgent fixes or security patches
- Providing technical assessments of governance proposals
- Advising the council on the feasibility and implications of proposed changes

### Community Members

All token holders and network participants can act as Community Members in governance:

- **Create proposals** for network upgrades, parameter changes, or ecosystem initiatives
- **Vote on active proposals** to determine their outcome
- Participate in discussions and provide feedback on pending referenda

## Smart Contract Upgrade RACI Matrix

The following RACI (Responsible, Accountable, Consulted, Informed) matrix defines roles and responsibilities for smart contract upgrades:

| Activity | Dev Team | Security | DevOps | Product | Legal | Executive |
|---|---|---|---|---|---|---|
| Code development | **R** | C | I | C | I | I |
| Security audit | C | **R** | I | I | C | I |
| Test environment deployment | C | I | **R** | I | I | I |
| Testnet validation | R | **R** | R | I | I | I |
| Mainnet approval | I | **R** | C | C | **R** | **R** |
| Deployment execution | C | C | **R** | I | I | I |
| Post-deployment monitoring | R | **R** | R | I | I | C |
| Incident response | R | **R** | R | I | C | C |
| Documentation | **R** | C | C | **R** | I | I |

> **R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

### Approval Requirements

Upgrades must receive explicit approval before deployment:

- **Testnet deployment**: Requires sign-off from **1 Security team member** and **1 DevOps team member**
- **Mainnet deployment**: Requires sign-off from **2 Security team members**, **1 Legal representative**, and **1 Executive**

### Escalation Path

When issues arise during the upgrade process, the escalation path follows this chain:

**Developer** -> **Security Lead** -> **Engineering Manager** -> **CTO** -> **CEO**

## Community Operation Plan

### Foundation Sponsorship

The **KaJ Labs Foundation** sponsors the Lithosphere community and has maintained a community-oriented approach from the project's inception. The foundation provides funding, organizational support, and strategic direction to foster organic community growth.

### Community Composition

The Lithosphere community is composed of several key groups:

1. **Core development team**: Engineers and researchers building the protocol
2. **Programmers**: External developers building applications on Lithosphere
3. **Participating nodes**: Validators and node operators securing the network
4. **Platform users**: End users of DeFi services and applications on the network
5. **DeFi service providers**: Projects and teams offering financial services on Lithosphere
6. **Token holders**: Investors and stakeholders holding LITHO tokens
7. **Media and government**: External observers, regulators, and media organizations following the project

### Core vs. Peripheral Community

The community operates on a **core-peripheral model**:

- The **core community** consists of dedicated contributors, validators, and active governance participants who drive the project forward on a daily basis.
- The **peripheral community** encompasses casual users, token holders, and observers who engage with the network less frequently but contribute to its overall reach and adoption.

Both layers are essential: the core community provides stability and development continuity, while the peripheral community drives adoption and network effects.

## Project Promotion

### Token Rewards for Foundation Team

Foundation team members receive token-based compensation to align their incentives with the long-term success of the network. This ensures that those promoting and building the ecosystem are directly invested in its growth.

### Blockchain Technology Community Building

Lithosphere fosters a technology-first community culture where education, open-source contribution, and technical discourse are prioritized alongside market growth.

### Blockchain Value Community

Beyond technology, Lithosphere cultivates a value-driven community focused on the practical utility and real-world impact of decentralized cross-chain infrastructure.

## Blockchain Movements

### Blockchain Technology Promotion Movement

Lithosphere actively promotes blockchain education and adoption through:

- **Technical salons**: Focused discussions on specific technical topics
- **Training camps**: Intensive hands-on sessions for developers
- **Seminars**: Broader educational events covering blockchain fundamentals and Lithosphere-specific concepts
- **Monthly training sessions**: Regular recurring sessions to maintain engagement and skill development within the community

### Blockchain Interface Standardization Movement

A key initiative within Lithosphere governance is the drive to **standardize interfaces** across three domains:

1. **Between blockchains**: Establishing common protocols for cross-chain communication
2. **Between centralized and decentralized organizations**: Bridging traditional infrastructure with blockchain-native systems
3. **Between heterogeneous data sources**: Creating unified data formats and access patterns for cross-platform interoperability

This standardization effort is foundational to Lithosphere's mission of enabling seamless cross-chain DeFi infrastructure.
