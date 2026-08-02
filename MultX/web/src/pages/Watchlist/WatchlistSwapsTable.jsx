import { useContext } from 'react'

import ArrowIcon from '../../assets/icons/arrow-down.svg?react';
import Copy from '../../assets/icons/copyWhite.svg?react';
import { NotificationContext } from '../../context';
import { Link } from 'react-router-dom';
import { formatAddress } from '../../helpers/formatAddress';

const replaceWithBr = (str) => {
  if (!str) return '—';
  const breakStr = str.split(' ');
  return (
    <>
      {breakStr[0]} <br /> {breakStr[1]}
    </>
  );
};

const tableDataCols = [
  'Address',
  'Label',
  'Transaction amount',
  'Date/    Time ago',
  'From',
  'To',
  'Total fees',
  'Links to'
];

export const WatchlistSwapsTable = ({handleFilterClickSwaps, sortedTableDataSwaps, setSortedTableDataSwaps, visibleDepositsWithdrawals}) => {
  return (
    <div className="addressDetails-swaps" style={{marginTop: 30}}>
        <div className="addressDetails-swaps-title" style={{textAlign: 'center'}}>Swaps</div>

        <div className="table-wrap" style={{overflow: 'auto'}}>
          <table className="addressDetails-table" cellSpacing="0">
            <thead>
              <tr>
                {tableDataCols.map((col, id) => {
                  return (
                    <th scope="col" className="addressDetails-table-th" key={id}>
                      <div className="wrap">
                        <p className="addressDetails-table-column">{col}</p>
                        <div className="arrows">
                          <ArrowIcon
                            className="arrow top"
                            onClick={() => handleFilterClickSwaps(id, 1)}
                          />
                          <ArrowIcon className="arrow " onClick={() => handleFilterClickSwaps(id, 0)} />
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="addressDetails-table-tbody">
              <RenderTableRow data={sortedTableDataSwaps} setNewSortedData={setSortedTableDataSwaps} data2={visibleDepositsWithdrawals} />
            </tbody>
          </table>
        </div>
      </div>
  )
}

const RenderTableRow = ({ data, data2 }) => {
  const { notification, setNotification } = useContext(NotificationContext);

  const handleCopy = (action) => {
    if (notification.length === 0) {
      setNotification(action);

      const timeout = setTimeout(() => {
        setNotification('');
        return () => clearTimeout(timeout);
      }, 2500);
    }
  };

  return data.map((item, i) => {
    let { date, amount, from, fromIcon, to, toIcon, totalFees, linksTo } = item;

    const account = data2 && data2[i];
    if (!account) return null;
    const id = account.id;
    const address = account.address;
    const labels = account.labels || [];

    return (
      <tr key={i}>
        <th scope="row" className="availableAccounts-table-td address">
          <Link to={`/AI_Search_Engine/${id}`}>{formatAddress(address)}</Link>
        </th>
        <td className="availableAccounts-table-td label">
          <div className={`label-wrap ${labels.length > 3 ? 'hidden' : ''}`}>
            {labels.map((label, i) => {
              return <img src={label} className="img" alt="strategy" key={i} />;
            })}
            <div className="arrow-wrap">
              <p>...</p>
              <ArrowIcon className="arrow " />
            </div>
          </div>
        </td>
        <td className="addressDetails-table-td">${amount}</td>
        <th scope="row" className="addressDetails-table-td date" style={{padding: 0}}>
          {replaceWithBr(date)}
        </th>
        <td className="addressDetails-table-td">
          <div className="table-currency">
            <img src={fromIcon} alt="litho" style={{ width: 13 }} /> Lithosphere <br />
          </div>
          {from}
        </td>
        <td className="addressDetails-table-td">
          <div className="table-currency">
            <img src={toIcon} alt="litho" style={{ width: 13 }} /> Lithosphere <br />
          </div>
          {to}
        </td>
        <td className="addressDetails-table-td">{totalFees} LITHO</td>
        <td className="addressDetails-table-td">
          {linksTo.map((link, i) => (
            <a href={link.link} key={i}>
              <img src={link.icon} alt="link" style={{ width: 25, marginRight: 5 }} />
            </a>
          ))}
        </td>
        <td className="addressDetails-table-td">
          <div className="addressDetails-table-btnWrapper">
            <button className="tableCopy-btn" onClick={() => handleCopy('copy')}>
              <div className="addressDetails-table-td-button">
                <Copy /> Copy strategy
              </div>
            </button>
          </div>
        </td>
      </tr>
    );
  });
};
