export function TxStatusBadge({ success }: { success: boolean }) {
  return (
    <span className={success ? 'badge-success' : 'badge-error'}>
      {success ? 'Success' : 'Failed'}
    </span>
  );
}

export function ValidatorStatusBadge({ status, jailed }: { status: number; jailed: boolean }) {
  if (jailed) return <span className="badge-error">Jailed</span>;
  switch (status) {
    case 3: return <span className="badge-success">Active</span>;
    case 2: return <span className="badge-warning">Unbonding</span>;
    case 1: return <span className="badge-neutral">Unbonded</span>;
    default: return <span className="badge-neutral">Unknown</span>;
  }
}

export function ProposalStatusBadge({ status }: { status: string | null }) {
  const label = status?.replace(/_/g, ' ') || 'Unknown';
  switch (status?.toLowerCase()) {
    case 'passed': return <span className="badge-success">{label}</span>;
    case 'rejected': return <span className="badge-error">{label}</span>;
    case 'voting_period': return <span className="badge-info">{label}</span>;
    case 'deposit_period': return <span className="badge-warning">{label}</span>;
    default: return <span className="badge-neutral">{label}</span>;
  }
}
