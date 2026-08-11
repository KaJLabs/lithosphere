# LITHO mainnet consensus monitoring

`litho-mainnet-9005-alerts.yml` contains the production chain's no-block,
missing-metrics, validator-signing, and peer-floor rules. The expressions match
the metric names verified on all three live nodes on 2026-08-09.

Do not expose ports `26660` or `27060` publicly. Run an agent locally on each
node and remote-write to the approved monitoring system, or scrape through an
allowlisted private overlay. Add the external labels below before loading the
rules:

- `chain_id="lithosphere_9005-1"` on every target;
- `role="validator"` on validator targets; and
- `role="sentry"` on sentry targets.

The scheduled GitHub progression check is an independent outside-in control;
it is not a substitute for Prometheus/Alertmanager. Before enabling either,
configure the protected `litho-mainnet-monitoring` environment, test the page
route with the named on-call owner, and retain the test evidence outside the
public repository.
