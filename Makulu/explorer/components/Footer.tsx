import { EXPLORER_TITLE } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-8">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <img
            src="/litho-logo.png"
            alt="Lithosphere"
            className="h-5 w-auto"
          />
          <span className="text-white/40">&mdash;</span>
          <span>{EXPLORER_TITLE} Makalu</span>
        </div>
        <div className="flex items-center flex-wrap justify-center gap-3">
          <a href="https://litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            LITHO.ai
          </a>
          <a href="https://access.litho.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            ACCESS
          </a>
          <a href="https://deals.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            LITHO TGE
          </a>
          <a href="https://validator.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            Validators
          </a>
          <a href="https://vote.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            Governance
          </a>
          <a href="https://lithiclang.ai/verifier" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            Contracts
          </a>
          <a href="https://status.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400">
            Status
          </a>
        </div>
      </div>
    </footer>
  );
}
