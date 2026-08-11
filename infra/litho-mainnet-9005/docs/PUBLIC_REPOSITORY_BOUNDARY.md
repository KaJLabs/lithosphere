# Public Repository Boundary

This repository is the KaJ Labs source of record for reviewable LITHO and
MultX code, reproducible builds, public chain identity, genesis evidence,
tests, deployment templates, and operational procedures.

The following values must remain outside Git and be supplied through protected
GitHub environments, the deployment secret manager, or a client-controlled
private Ansible inventory:

- SSH private keys, passwords, API tokens, signing and recovery private keys;
- validator and origin addresses, administrative accounts, and SSH key paths;
- WireGuard addresses, private/public keys, and current private peer topology;
- database credentials, TLS private keys, and non-public service endpoints;
- monitoring destinations and backup encryption recipient material where the
  governance policy treats those assignments as restricted.

The committed `ansible/inventory/mainnet-9005/` directory is a deliberately
non-runnable template. Copy it to the ignored
`ansible/inventory/mainnet-9005-private/` directory, populate that copy through
an approved secure channel, and run production playbooks only against the
private inventory. Do not convert the public template into live inventory.

Public RPC, REST/LCD, WebSocket, gRPC, explorer, contract, and registry
addresses remain appropriate for public documentation once they are intended
for general network use. Consensus and EVM chain identities, genesis hashes,
allocations, public contract source, ABI artifacts, and SDK interfaces also
remain public and auditable.

Repository sanitization does not retract values already published in Git
history, pull-request diffs, mirrors, or caches. Any operational value that was
previously committed must be treated as disclosed: restrict it at the network
edge or rotate it under the normal change-control process, then update only the
protected inventory or secret manager.
