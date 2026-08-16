import { useState, useEffect } from 'react';

import ArrowIcon from '../../assets/icons/arrow-down.svg?react';
import {
  isBridgeTxHash,
  shortenBridgeTxHash,
  splitBridgeHistoryTimestamp
} from '@litho/multx-sdk';

const tableDataCols = [
  'Date',
  'From Token',
  'To Token',
  'Amount',
  'TX Hash',
  'Status',
  'Explorer'
];

const getSortableValue = (item, columnId) => {
  switch (columnId) {
    case 0:
      return new Date(item.timestamp || 0).getTime();
    case 1:
      return String(item.fromToken || '').toLowerCase();
    case 2:
      return String(item.toToken || '').toLowerCase();
    case 3:
      return Number(item.amount || 0);
    case 4:
      return String(item.txHash || '').toLowerCase();
    case 5:
      return String(item.status || '').toLowerCase();
    case 6:
      return String(item.explorerUrl || '').toLowerCase();
    default:
      return '';
  }
};

const sortBridgeHistoryRows = (rows, columnId, direction) => {
  const sorted = [...rows].sort((left, right) => {
    const leftValue = getSortableValue(left, columnId);
    const rightValue = getSortableValue(right, columnId);

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return leftValue - rightValue;
    }

    return String(leftValue).localeCompare(String(rightValue));
  });

  return direction ? sorted.reverse() : sorted;
};

const getStatusBadge = (status) => {
  const statusMap = {
    locked: { text: 'Locked', className: 'status-locked' },
    signing: { text: 'Signing', className: 'status-signing' },
    signed: { text: 'Signed', className: 'status-signed' },
    completed: { text: 'Complete', className: 'status-completed' },
    failed: { text: 'Failed', className: 'status-failed' },
    pending: { text: 'Pending', className: 'status-pending' }
  };

  const info = statusMap[status] || statusMap.pending;
  return <span className={`status-badge ${info.className}`}>{info.text}</span>;
};

const RenderTableRow = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <tr>
        <td colSpan={tableDataCols.length} className="addressDetails-table-td empty">
          No transactions found
        </td>
      </tr>
    );
  }

  return data.map((item, index) => {
    const {
      timestamp = new Date().toISOString(),
      fromToken = 'LITHO',
      toToken = 'LITHO',
      amount = '0',
      txHash = null,
      status = 'pending',
      failureReason = '',
      explorerUrl = ''
    } = item;

    const { primary, secondary } = splitBridgeHistoryTimestamp(timestamp);
    const hasValidTxHash = isBridgeTxHash(txHash);
    const displayAmount = typeof amount === 'number' ? amount.toFixed(6) : amount;
    const rowKey = txHash || `${timestamp}-${index}`;
    const txHashTitle = hasValidTxHash ? txHash : failureReason || 'Bridge transaction hash unavailable';

    return (
      <tr key={rowKey}>
        <th scope="row" className="addressDetails-table-td date">
          <span>{primary}</span>
          {secondary && (
            <>
              <br />
              <span>{secondary}</span>
            </>
          )}
        </th>
        <td className="addressDetails-table-td">
          <div className="table-token-info">
            {fromToken}
          </div>
        </td>
        <td className="addressDetails-table-td">
          <div className="table-token-info">
            {toToken}
          </div>
        </td>
        <td className="addressDetails-table-td">
          {displayAmount}
        </td>
        <td className="addressDetails-table-td tx-hash" title={txHashTitle}>
          {hasValidTxHash ? shortenBridgeTxHash(txHash) : 'Unavailable'}
        </td>
        <td className="addressDetails-table-td">
          <div className="bridge-status-cell">
            {getStatusBadge(status)}
            {failureReason && (
              <div className="bridge-status-reason" title={failureReason}>
                {failureReason}
              </div>
            )}
          </div>
        </td>
        <td className="addressDetails-table-td">
          {hasValidTxHash && explorerUrl ? (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
              View on Explorer
            </a>
          ) : (
            <span className="bridge-explorer-unavailable">--</span>
          )}
        </td>
      </tr>
    );
  });
};

export const SwapTable = ({ data = [] }) => {
  const [sortDirection, setSortDirection] = useState(0);
  const [prevColId, setPrevColId] = useState(0);
  const [sortedTableData, setSortedTableData] = useState([...data]);

  const handleFilterClick = (colId, direction) => {
    if (direction !== sortDirection || colId !== prevColId) {
      const sorted = sortBridgeHistoryRows(data, colId, direction);
      setSortedTableData(sorted);
      setSortDirection(direction);
      setPrevColId(colId);
    }
  };

  useEffect(() => {
    setSortedTableData([...data]);
  }, [data]);

  return (
    <div className="table-wrap">
      <table className="addressDetails-table" cellSpacing="0">
        <thead>
          <tr>
            {tableDataCols.map((col, id) => (
              <th scope="col" className="addressDetails-table-th" key={id}>
                <div className="wrap">
                  <p className="addressDetails-table-column">{col}</p>
                  <div className="arrows">
                    <ArrowIcon className="arrow top" onClick={() => handleFilterClick(id, 1)} />
                    <ArrowIcon className="arrow" onClick={() => handleFilterClick(id, 0)} />
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="addressDetails-table-tbody">
          <RenderTableRow data={sortedTableData} />
        </tbody>
      </table>
    </div>
  );
};
