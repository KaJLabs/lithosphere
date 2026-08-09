# Public Repository Boundary

The KaJ Labs repository is the public source of record for Lithosphere and
MultX application code, contracts, SDKs, schemas, tests, public chain data,
reproducible build inputs, and non-runnable infrastructure templates.

## Public material

- source code, contract source, ABIs, SDK interfaces, and public validator
  addresses;
- chain IDs, genesis files and hashes, transaction hashes, and public contract
  addresses;
- public DNS endpoints intended for general network use;
- architecture, threat models, audit evidence, and procedures that do not
  expose live access topology.

## Protected material

The following must be supplied through a protected GitHub environment, secret
manager, or client-controlled private inventory and must not be committed:

- origin, bastion, indexer, validator, sentry, database, and monitoring hosts;
- SSH users, operator-specific key paths, host fingerprints, and private keys;
- private network topology, security-group identifiers, instance identifiers,
  database origins, and load-balancer origins;
- cloud account IDs, KMS key ARNs/aliases, secret paths, and custody mappings;
- passwords, tokens, TLS private keys, signing keys, recovery material, and
  production `.env` values.

Committed operational examples must use descriptive placeholders and fail
closed when required runtime configuration is missing. Public DNS names may be
used only when they are deliberately supported as public interfaces; raw
origin addresses are not public API documentation.

AWS references may remain where they describe historical architecture or
generic procedures, but live resource identifiers and access topology must be
omitted. KaJ Labs has moved current production infrastructure to VPS providers;
legacy AWS procedures are retained only as historical or migration records.

Removing a value from the branch head does not retract it from Git history,
pull-request diffs, mirrors, or caches. Previously committed operational values
must be treated as disclosed and restricted, decommissioned, or rotated under
the normal change-control process.
