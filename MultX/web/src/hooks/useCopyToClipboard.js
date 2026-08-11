import { useCallback, useState } from 'react';

export const useCopyToClipboard = (timeoutMs = 2000) => {
  const [copiedValue, setCopiedValue] = useState('');

  const copy = useCallback(
    async (value) => {
      const text = String(value || '');

      if (!text) {
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopiedValue(text);
        window.setTimeout(() => {
          setCopiedValue('');
        }, timeoutMs);
        return true;
      } catch {
        return false;
      }
    },
    [timeoutMs]
  );

  return {
    copiedValue,
    copy
  };
};
