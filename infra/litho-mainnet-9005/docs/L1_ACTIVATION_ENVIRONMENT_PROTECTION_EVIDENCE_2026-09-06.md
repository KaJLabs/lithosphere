# LITHO L1 activation environment protection evidence

Recorded: 2026-09-06 UTC

The GitHub repository environment API was queried after configuration. No
secret values are included in this record.

| Environment | Required reviewers | Prevent self-review | Admin bypass | Branch policy |
|---|---|---:|---:|---|
| `l1-makalu-activation` | `@lithoagent`, `@Jkasr` | enabled | disabled | protected branches |
| `l1-kamet-activation` | `@lithoagent`, `@Jkasr` | enabled | disabled | protected branches |
| `l1-mainnet-activation` | `@lithoagent`, `@Jkasr` | enabled | disabled | protected branches |

API resources:

- `GET /repos/KaJLabs/Lithosphere/environments/l1-makalu-activation`
- `GET /repos/KaJLabs/Lithosphere/environments/l1-kamet-activation`
- `GET /repos/KaJLabs/Lithosphere/environments/l1-mainnet-activation`

The environments require an independent reviewer and do not allow the
initiating actor or a repository administrator to bypass that review.
