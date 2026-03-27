import Link from 'next/link';

interface FormattedValueElementProps {
  formattedStr: string;
  tokenAddress?: string | null;
}

export function FormattedValueElement({ formattedStr, tokenAddress }: FormattedValueElementProps) {
  const match = formattedStr.match(/^(.*?)\s+([^ ]+)$/);
  if (match) {
    const amount = match[1];
    const symbol = match[2];
    const linkHref = tokenAddress ? `/token/${tokenAddress}` : '/token/native';
    return (
      <span className="font-mono">
        {amount}{' '}
        <Link href={linkHref} className="text-emerald-400 hover:text-emerald-300 transition" onClick={(e) => e.stopPropagation()}>
          {symbol}
        </Link>
      </span>
    );
  }
  return <span className="font-mono">{formattedStr}</span>;
}
