import { Transfer } from "../types";
export async function handleTransfer(event: any): Promise<void> {
  const id = `${event.transaction.hash}-${event.logIndex}`;
  const t = new Transfer(id);
  t.from = event.params.from;
  t.to = event.params.to;
  t.value = event.params.value.toString();
  t.tokenId = Number(event.params.id || 0); // expect id=0 for LITHO
  t.txHash = event.transaction.hash;
  t.blockHeight = Number(event.block.number);
  t.timestamp = new Date(Number(event.block.timestamp) * 1000).toISOString();
  await t.save();
}
