import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../config/api';
import {
  GOVERNANCE_PRECOMPILE_ADDRESS,
  GOVERNANCE_PRECOMPILE_ABI,
  VOTE_OPTIONS,
} from '../data/kametRegistry';

// In dev the Vite proxy at /lcd-proxy/* forwards to the Cosmos LCD so the
// browser doesn't hit CORS. In production, nginx on kamet.litho.ai must serve
// the same path: `location /lcd-proxy/ { proxy_pass https://api-3.litho.ai/; }`
// with `add_header 'Access-Control-Allow-Origin' '*' always;`.
const LCD_BASE = import.meta.env.DEV
  ? '/lcd-proxy'
  : CHAIN_CONFIG.restUrl;

// Cosmos gov v1beta1 status strings → human labels
const STATUS_LABEL = {
  PROPOSAL_STATUS_UNSPECIFIED: 'Unknown',
  PROPOSAL_STATUS_DEPOSIT_PERIOD: 'Deposit',
  PROPOSAL_STATUS_VOTING_PERIOD: 'Voting',
  PROPOSAL_STATUS_PASSED: 'Passed',
  PROPOSAL_STATUS_REJECTED: 'Rejected',
  PROPOSAL_STATUS_FAILED: 'Failed',
};

const STATUS_CLASS = {
  PROPOSAL_STATUS_VOTING_PERIOD: 'voting',
  PROPOSAL_STATUS_PASSED: 'passed',
  PROPOSAL_STATUS_REJECTED: 'rejected',
  PROPOSAL_STATUS_FAILED: 'failed',
  PROPOSAL_STATUS_DEPOSIT_PERIOD: 'deposit',
};

const parseAmount = (coins = []) =>
  coins.map((c) => ({ denom: c.denom, amount: c.amount }));

const normalizeTally = (tally) => {
  if (!tally) return { yes: '0', abstain: '0', no: '0', noWithVeto: '0' };
  return {
    yes: tally.yes || tally.yes_count || '0',
    abstain: tally.abstain || tally.abstain_count || '0',
    no: tally.no || tally.no_count || '0',
    noWithVeto: tally.no_with_veto || tally.no_with_veto_count || '0',
  };
};

const tallyTotal = (t) =>
  BigInt(t.yes) + BigInt(t.abstain) + BigInt(t.no) + BigInt(t.noWithVeto);

export const tallyPercent = (tally) => {
  const total = tallyTotal(tally);
  if (total === 0n) return { yes: 0, abstain: 0, no: 0, noWithVeto: 0 };
  const pct = (v) => Number((BigInt(v) * 10000n) / total) / 100;
  return {
    yes: pct(tally.yes),
    abstain: pct(tally.abstain),
    no: pct(tally.no),
    noWithVeto: pct(tally.noWithVeto),
  };
};

const normalizeProposal = (p) => ({
  id: p.proposal_id || p.id || '',
  title: p.content?.title || p.title || `Proposal #${p.proposal_id || p.id}`,
  description: p.content?.description || p.summary || '',
  type: p.content?.['@type'] || p.messages?.[0]?.['@type'] || 'Unknown',
  status: p.status || 'PROPOSAL_STATUS_UNSPECIFIED',
  statusLabel: STATUS_LABEL[p.status] || p.status || 'Unknown',
  statusClass: STATUS_CLASS[p.status] || 'unknown',
  submitTime: p.submit_time || '',
  depositEndTime: p.deposit_end_time || '',
  votingStartTime: p.voting_start_time || '',
  votingEndTime: p.voting_end_time || '',
  totalDeposit: parseAmount(p.total_deposit),
  tally: normalizeTally(p.final_tally_result),
});

const govUrl = (path) => `${LCD_BASE}/cosmos/gov/v1beta1${path}`;

// Cosmos SDK v1beta1 accepts string or numeric status; use numeric to be safe.
const STATUS_PARAM = {
  PROPOSAL_STATUS_DEPOSIT_PERIOD: 1,
  PROPOSAL_STATUS_VOTING_PERIOD: 2,
  PROPOSAL_STATUS_PASSED: 3,
  PROPOSAL_STATUS_REJECTED: 4,
  PROPOSAL_STATUS_FAILED: 5,
};

export const fetchProposals = async (statusFilter = 'ALL') => {
  const statusParam = STATUS_PARAM[statusFilter];
  const qs = statusParam
    ? `?proposal_status=${statusParam}&pagination.limit=100&pagination.reverse=true`
    : `?pagination.limit=100&pagination.reverse=true`;
  const url = govUrl(`/proposals${qs}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch proposals (${res.status})`);
  const data = await res.json();
  return (data.proposals || []).map(normalizeProposal);
};

export const fetchProposalDetail = async (id) => {
  const [propRes, tallyRes] = await Promise.all([
    fetch(govUrl(`/proposals/${id}`)),
    fetch(govUrl(`/proposals/${id}/tally`)),
  ]);

  if (!propRes.ok) throw new Error(`Proposal #${id} not found (${propRes.status})`);
  const propData = await propRes.json();
  const proposal = normalizeProposal(propData.proposal);

  if (tallyRes.ok) {
    const tallyData = await tallyRes.json();
    proposal.tally = normalizeTally(tallyData.tally);
  }

  return proposal;
};

export const submitVote = async (signer, proposalId, voteOption) => {
  if (!Object.values(VOTE_OPTIONS).includes(voteOption)) {
    throw new Error(`Invalid vote option: ${voteOption}`);
  }
  const contract = new ethers.Contract(
    GOVERNANCE_PRECOMPILE_ADDRESS,
    GOVERNANCE_PRECOMPILE_ABI,
    signer
  );
  const tx = await contract.vote(BigInt(proposalId), voteOption, '');
  const receipt = await tx.wait();
  return receipt.transactionHash;
};

export { VOTE_OPTIONS };
