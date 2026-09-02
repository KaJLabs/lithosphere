# LITHO mainnet monitoring alert delivery

## Approved ownership

- Primary monitoring responder: Litho Agent (`@lithoagent`)
- Independent backup responder: `@Jkasr`
- Approved alert channel: Telegram through `@LITHO_Moniter_bot`
- Fallback and deduplication record: repository GitHub Issues

The destination chat identifier and bot token are protected environment
secrets and must not be committed or included in logs, issues, artifacts, or
chat messages.

## Environment separation

The scheduled monitor and incident-delivery path use the
`litho-mainnet-monitoring` GitHub environment. It must remain unattended so a
real incident is not held for manual approval. Configure these secrets there:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

The bot must be a member of the approved destination and allowed to post. The
environment must not be used for deployment credentials or write access to a
chain node.

The `litho-mainnet-monitoring-test` environment is an approval-only gate. It
contains no secrets. Configure `@lithoagent` and `@Jkasr` as its required
reviewers and enable self-review prevention. A responder who dispatches a
controlled test therefore cannot approve that same test.

## Controlled delivery test

1. Open the `LITHO Mainnet Chain Monitor` workflow.
2. Select **Run workflow** on the reviewed default-branch commit.
3. Enable `deliver_test_alert`.
4. Confirm the read-only three-node monitor succeeds.
5. Have an eligible responder other than the dispatcher approve the
   `litho-mainnet-monitoring-test` environment gate.
6. Confirm the Telegram message explicitly says `CONTROLLED TEST` and contains
   the workflow-run URL.
7. Have the primary and backup responders independently acknowledge receipt.
8. Record only the workflow-run URL and acknowledgements; never copy secret
   values into the evidence.

The test performs read-only health queries. It does not apply configuration,
submit a transaction, stop a service, or restart a node.

## Failure behavior

When the scheduled chain monitor fails, the workflow retains the existing
deduplicated GitHub incident issue and additionally sends a Telegram incident
message. A Telegram delivery failure makes the workflow fail visibly; it does
not suppress the GitHub incident record.
