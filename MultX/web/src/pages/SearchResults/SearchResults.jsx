import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { searchExplorer } from '../../services/explorerDataService';
import GlobalSearchForm from '../../components/explorer/GlobalSearchForm';
import {
  EmptyState,
  LoadingSkeleton,
  PageHero,
  Panel,
  SectionMessage,
  StatusBadge
} from '../../components/explorer/ExplorerUI';
import {
  looksLikeAddress,
  looksLikeHeight,
  looksLikeTxHash,
  looksLikeValidatorOperator,
  sanitizeSearchInput
} from '../../helpers/explorer';
import { detectMalformedSearchInput } from '../../helpers/explorerErrors';
import '../../scss/pages/Explorer/explorerPage.scss';

const describeSearchIntent = (query) => {
  const normalized = sanitizeSearchInput(query);
  const malformedInput = detectMalformedSearchInput(normalized);

  if (!normalized) {
    return 'Enter a tx hash, block number, block hash, wallet, contract, token symbol, or validator operator address.';
  }

  if (malformedInput) {
    return malformedInput.message;
  }

  if (looksLikeHeight(normalized)) {
    return 'Numeric input is treated as a block lookup first.';
  }

  if (looksLikeValidatorOperator(normalized)) {
    return 'Validator operator address detected.';
  }

  if (looksLikeAddress(normalized)) {
    return 'Address detected. Search resolves wallet, token, or contract pages.';
  }

  if (looksLikeTxHash(normalized)) {
    return 'Full hash detected. Search resolves a transaction or a block hash.';
  }

  return 'Searching token symbols and the currently available explorer entities.';
};

const resolveMessageTone = (status) => {
  if (status === 'delayed') {
    return 'error';
  }

  if (status === 'results') {
    return 'success';
  }

  return 'info';
};

const SearchResults = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = useMemo(() => sanitizeSearchInput(searchParams.get('q') || ''), [searchParams]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(Boolean(query));
  const [error, setError] = useState('');

  usePageMeta(query ? `Search ${query}` : 'Search Results', defaultExplorerDescription);

  const loadResults = useCallback(async () => {
    if (!query) {
      setPayload(null);
      setLoading(false);
      return;
    }

    try {
      const data = await searchExplorer(query);
      setPayload(data);
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'Unable to resolve the requested search value.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    setLoading(Boolean(query));
    loadResults();
  }, [loadResults, query]);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Search"
        title={query ? `Search: ${query}` : 'Search Results'}
        description="Smart routing resolves direct hits immediately and falls back to typed explorer results when multiple or delayed matches exist."
        actions={
          <>
            <button type="button" className="secondary-btn" onClick={() => navigate('/')}>
              Home
            </button>
            <button type="button" className="secondary-btn" onClick={() => loadResults()}>
              Retry Search
            </button>
          </>
        }
      />

      <Panel title="Global Search" description={describeSearchIntent(query)}>
        <GlobalSearchForm
          initialValue={query}
          placeholder="Search tx hash, block, wallet, contract, validator, or token symbol"
        />
      </Panel>

      {error ? (
        <SectionMessage
          tone="error"
          action={<button type="button" className="secondary-btn" onClick={() => loadResults()}>Retry</button>}
        >
          {error}
        </SectionMessage>
      ) : null}

      {!query ? (
        <EmptyState
          title="No search value provided"
          description="Paste a transaction hash, block number, block hash, address, validator operator, or token symbol to search the explorer."
          action={
            <Link className="link-btn" to="/">
              Back to home
            </Link>
          }
        />
      ) : loading ? (
        <Panel title="Searching">
          <LoadingSkeleton rows={5} />
        </Panel>
      ) : !payload ? (
        <EmptyState
          title="Search unavailable"
          description="The search service did not return a usable response."
          action={
            <button type="button" className="secondary-btn" onClick={() => loadResults()}>
              Retry
            </button>
          }
        />
      ) : (
        <>
          <SectionMessage tone={resolveMessageTone(payload.status)}>
            {payload.status === 'results'
              ? `Resolved ${payload.results.length} result${payload.results.length === 1 ? '' : 's'} for this query.`
              : payload.reason}
          </SectionMessage>

          <Panel title="Results" description="Direct-match entities route to their canonical deep links.">
            {!payload.results?.length ? (
              <EmptyState
                title={
                  payload.status === 'delayed'
                    ? 'Search is delayed'
                    : payload.status === 'unsupported'
                      ? 'Unsupported object type'
                    : payload.status === 'invalid'
                      ? 'Invalid search input'
                      : 'No result found'
                }
                description={
                  payload.status === 'delayed'
                    ? 'The network may be delayed or the indexer may be unavailable. Retry shortly or check the network page.'
                    : payload.status === 'unsupported'
                      ? payload.reason || 'The search value resolved to an object type that is not directly browsable yet.'
                    : payload.status === 'invalid'
                      ? 'Bad hash, address, or search format. Check the value and retry.'
                      : 'No result found. Data may still be indexing or the network may be delayed.'
                }
                action={
                  <Link className="link-btn" to="/network">
                    Open network status
                  </Link>
                }
              />
            ) : (
              <div className="searchResultGrid">
                {payload.results.map((result) => (
                  <button
                    key={`${result.type}-${result.path}-${result.value}`}
                    type="button"
                    className="searchResultCard"
                    onClick={() => navigate(result.path)}
                  >
                    <div className="searchResultCard-top">
                      <StatusBadge tone="info">{result.type}</StatusBadge>
                      <span>{result.subtitle || 'Direct match'}</span>
                    </div>
                    <strong>{result.label}</strong>
                    <code>{result.value}</code>
                    <span className="searchResultCard-link">{result.path}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export { SearchResults };
export default SearchResults;
