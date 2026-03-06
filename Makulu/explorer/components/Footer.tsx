import { EXPLORER_TITLE } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-8">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-text-muted)]">
        <div className="flex items-center gap-3">
          <img
            src="https://lithosphere.network/wp-content/uploads/2026/02/icon-tex-whitet.png"
            alt="Lithosphere"
            className="h-6 w-auto"
          />
          <span>&mdash;</span>
          <span>{EXPLORER_TITLE} | Lithosphere Testnet Makalu</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            Website
          </a>
        </div>
      </div>
    </footer>
  );
}
