import Link from 'next/link';

import { NETWORK } from '@/lib/network';

import BrandLogo from './BrandLogo';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-12 bg-black/20">
      <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-[var(--color-text-muted)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label={`${NETWORK.explorerTitle} home`}><BrandLogo compact /></Link>
            <span className="text-white/40 hidden sm:inline">&mdash;</span>
            <span className="font-medium">{NETWORK.explorerTitle} {NETWORK.shortName}</span>
          </div>
          <div className="flex items-center flex-wrap justify-center gap-x-6 gap-y-4">
            <a href="https://litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400 transition-colors p-1">
              LITHO.ai
            </a>
            <a href="https://access.litho.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400 transition-colors p-1">
              ACCESS
            </a>
            <a href="https://tge.ignite.trade" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400 transition-colors p-1">
              LITHO TGE
            </a>
            <a href="https://validator.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400 transition-colors p-1">
              Validators
            </a>
            <a href="https://vote.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400 transition-colors p-1">
              Governance
            </a>
            <a href="https://lithiclang.ai/verifier" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400 transition-colors p-1">
              Contracts
            </a>
            <a href="https://status.litho.ai" target="_blank" rel="noopener noreferrer" className="hover:text-litho-400 transition-colors p-1">
              Status
            </a>
          </div>
        </div>
        <div className="mt-8 border-t border-white/5 pt-6 text-center text-sm font-medium tracking-tight text-white/55 sm:text-base">
          Lithosphere Core Protocol • Operated by{' '}
          <a
            href="https://litho.foundation"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-litho-400 transition-colors"
          >
            LITHO Foundation
          </a>
        </div>
      </div>
    </footer>
  );
}
