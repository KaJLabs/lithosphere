// Translate ethers / MetaMask errors into a short, friendly UI string.
// Returns null when the user simply cancelled — those don't deserve a banner.
// Used by DEX, Bridge, Names, and any other write-side page.
export const friendlyError = (err) => {
  if (!err) return null;
  const code = err.code || err.error?.code || err.data?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') return null;
  const reason = err.reason || err.error?.message || err.data?.message;
  if (reason) return reason;
  const msg = err.message || '';
  const truncated = msg.split(' (action=')[0].split(' [')[0].trim();
  return truncated.length > 200 ? truncated.slice(0, 200) + '…' : (truncated || 'Transaction failed.');
};
