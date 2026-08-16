import { useEffect } from 'react';
import { CHAIN_CONFIG } from '../config/api';

const getDescriptionTag = () =>
  document.querySelector('meta[name="description"]') ||
  document.querySelector('meta[property="og:description"]');

export const usePageMeta = (title, description) => {
  useEffect(() => {
    document.title = title ? `${title} | Kamet Explorer` : 'Kamet Explorer';

    if (description) {
      const tag = getDescriptionTag();

      if (tag) {
        tag.setAttribute('content', description);
      }
    }
  }, [title, description]);
};

export const defaultExplorerDescription = `${CHAIN_CONFIG.chainName} block explorer for blocks, transactions, addresses, validators, tokens, and verified contracts.`;
