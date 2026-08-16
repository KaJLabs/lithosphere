import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  looksLikeAddress,
  looksLikeHeight,
  looksLikeTxHash,
  looksLikeValidatorOperator,
  sanitizeSearchInput
} from '../../helpers/explorer';
import { detectMalformedSearchInput } from '../../helpers/explorerErrors';
import { resolveSearchDestination } from '../../services/explorerDataService';

const classifySearchHint = (value) => {
  const input = sanitizeSearchInput(value);

  if (!input) {
    return '';
  }

  if (looksLikeHeight(input)) {
    return 'Numeric input routes to block lookup.';
  }

  if (looksLikeValidatorOperator(input)) {
    return 'Validator operator address detected.';
  }

  if (looksLikeAddress(input)) {
    return 'Address detected. Routing to wallet, token, or contract.';
  }

  if (looksLikeTxHash(input)) {
    return 'Full hash detected. Resolving transaction or block.';
  }

  return 'Searching token symbols and explorer records.';
};

export const GlobalSearchForm = ({
  initialValue = '',
  placeholder = 'Search tx hash, block, address, token, validator, or contract',
  className = '',
  autoFocus = false,
  clearOnNavigate = false
}) => {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const hintId = useId();
  const validationError = useMemo(() => detectMalformedSearchInput(value), [value]);
  const hint = useMemo(() => classifySearchHint(value), [value]);
  const statusMessage = error || validationError?.message || hint;
  const showStatusMessage = Boolean(statusMessage);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const query = sanitizeSearchInput(value);

    if (!query) {
      setError('Enter a search value.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const destination = await resolveSearchDestination(query);
      navigate(destination.path);

      if (clearOnNavigate) {
        setValue('');
      }
    } catch {
      setError('Search is temporarily unavailable. Retry in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={`globalSearchForm ${className}`.trim()} onSubmit={handleSubmit}>
      <div className="globalSearchField">
        <label htmlFor={inputId} className="srOnly">
          Global explorer search
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="explorerSearchInput"
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-invalid={Boolean(error || validationError)}
          aria-describedby={showStatusMessage ? hintId : undefined}
        />
        <button type="submit" className="primary-btn explorerSearchBtn" disabled={submitting}>
          {!submitting && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          {submitting ? 'Searching…' : 'Search'}
        </button>
      </div>
      {showStatusMessage && (
        <div
          id={hintId}
          className={`searchHint ${error || validationError ? 'error' : ''}`}
          role={error || validationError ? 'alert' : 'status'}
          aria-live={error || validationError ? 'assertive' : 'polite'}
        >
          {statusMessage}
        </div>
      )}
    </form>
  );
};

export default GlobalSearchForm;
