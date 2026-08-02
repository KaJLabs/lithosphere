# MultX infrastructure status

`docker-compose.testnet.yml` and `ansible/deploy-bridge.yml` are historical
Makalu/Kamet deployment references. They are retained for auditability and do
not authorize a LITHO mainnet deployment.

The Compose file binds its public-facing services to loopback, requires an
explicit database password, and disables mock validators by default. Production
secrets must be supplied through the deployment secret manager.

A LITHO mainnet manifest will be added only after the audit and mainnet
contract/governance approvals are complete.
