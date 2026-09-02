# LITHO mainnet monitoring alert delivery

## Approved ownership

- Primary monitoring responder: Litho Agent (`@lithoagent`)
- Independent backup responder: `@Jkasr`
- Approved alert channel: Telegram through `@LITHO_Moniter_bot`
- Fallback and deduplication record: repository GitHub Issues

The destination chat identifier and bot token are protected environment
secrets and must not be committed or included in logs, issues, artifacts, or
chat messages.

## Protected configuration

Configure the following secrets in the `litho-mainnet-monitoring` GitHub
environment:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

The bot must be a member of the approved destination and allowed to post. The
environment must retain approved reviewers and prevent self-review.

## Controlled delivery test

1. Open the `LITHO Mainnet Chain Monitor` workflow.
2. Select **Run workflow** on the reviewed default-branch commit.
3. Enable `deliver_test_alert`.
4. Approve the protected environment deployment.
5. Confirm the read-only three-node monitor succeeds.
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
