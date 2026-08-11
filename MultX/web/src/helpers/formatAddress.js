export function formatAddress(line) {
  const truncatedLine = line.substring(0, 14) + '…';
  return truncatedLine;
}
