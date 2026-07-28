import { NETWORK } from '@/lib/network';

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-3">
      <img src={NETWORK.logoPath} alt="LITHO" className={NETWORK.isMainnet ? 'h-9 w-9 rounded-full' : 'h-8 w-auto'} />
      {!compact && (
        <span className="hidden sm:flex sm:flex-col sm:leading-none">
          <span className="text-base font-bold text-[var(--color-text-primary)]">{NETWORK.explorerTitle}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{NETWORK.shortName}</span>
        </span>
      )}
    </span>
  );
}
