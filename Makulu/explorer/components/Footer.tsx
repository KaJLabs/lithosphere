import { CHAIN_NAME, EXPLORER_TITLE } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-8">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--color-text-secondary)]">{EXPLORER_TITLE}</span>
          <span>&mdash;</span>
          <span>{CHAIN_NAME} Mainnet</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            Website
          </a>
          <a href="https://rpc.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            RPC
          </a>
          <a href="https://api.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            API
          </a>
        </div>
      </div>
    </footer>
  );
}
