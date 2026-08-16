import classNames from 'classnames';

import ArrowIcon from '../../assets/icons/arrow-down.svg?react';
import StarIcon from '../../assets/icons/bellSolid.svg?react';

import { useContext } from 'react';
import { AccountsContext } from '../../context';
import { formatNumberToView } from '../TokenExplorer/helpers';
import { formatAddress } from '../../helpers/formatAddress';
import { Link } from 'react-router-dom';

const tableDataCols = [
  'Address (truncated)',
  'Labels',
  'Transaction count',
  'Swap count',
  'Volume swapped',
  'Investment',
  'Balance',
  'P&L',
  'ROI',
  'Investment use rate',
  'Exposure token',
  'Asset volatility',
  'Asset popularity',
  'Analysed ratio',
  'Still active',
  'Enough data',
  'Notifications'
];

export const MyWishlistTable = ({
  handleFilterClick,
  faded,
  visibleArrPages,
  setCurrentPage,
  currentPage,
  numberOfPages,
  nextPage,
  prevPage,
  visibleDepositsWithdrawals,
  setSortedTableData
}) => {
  return (
    <div className="availableAccounts">
      <h3>My wishlist</h3>
      <div className="table-wrap">
        <table className="availableAccounts-table" cellSpacing="0">
          <thead>
            <tr>
              {tableDataCols.map((col, id) => {
                return (
                  <th
                    scope="col"
                    className="availableAccounts-table-th"
                    style={{ padding: 5 }}
                    key={id}>
                    <div className="wrap">
                      <p>{col}</p>
                      <div className="arrows">
                        <ArrowIcon className="arrow top" onClick={() => handleFilterClick(id, 1)} />
                        <ArrowIcon className="arrow " onClick={() => handleFilterClick(id, 0)} />
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="availableAccounts-table-tbody">
            <RenderTableRow
              data={visibleDepositsWithdrawals}
              setNewSortedData={setSortedTableData}
              faded={faded}
            />
          </tbody>
        </table>
      </div>
      <div className="availableAccounts-pagination">
        <button
          className="availableAccounts-pagination-arrow primary-btn"
          disabled={faded}
          onClick={prevPage}>
          <ArrowIcon className="arrow" />
        </button>

        {visibleArrPages.map((num) => (
          <button
            key={num}
            onClick={() => setCurrentPage(num)}
            className={classNames('availableAccounts-pagination-page', {
              active: currentPage === num
            })}
            disabled={faded}>
            {num}
          </button>
        ))}

        {visibleArrPages.length > 3 && (
          <>
            <button className="availableAccounts-pagination-page">...</button>
            <button
              onClick={() => setCurrentPage(numberOfPages)}
              className="availableAccounts-pagination-page">
              {numberOfPages}
            </button>
          </>
        )}

        <button
          className="availableAccounts-pagination-arrow primary-btn"
          disabled={faded}
          onClick={nextPage}>
          <ArrowIcon className="arrow right" />
        </button>
      </div>
    </div>
  );
};

const RenderTableRow = ({ data, faded, setNewSortedData }) => {
  const { accounts, setAccounts } = useContext(AccountsContext);

  return data.map((item) => {
    let {
      address,
      labels,
      transactions,
      volume,
      pl,
      roi,
      investmentUse,
      // exposure,
      volatility,
      popularity,
      id,
      watchlist
    } = item;
    const rowsLength = 15;

    if (faded) {
      return (
        <tr key={id}>
          <th scope="row" className="availableAccounts-table-td">
            <div className="faded"></div>
          </th>
          {new Array(rowsLength).fill(0).map((el, i) => {
            return (
              <td className="availableAccounts-table-td" key={i}>
                <div className="faded"></div>
              </td>
            );
          })}
          <td className="availableAccounts-table-td">
            <div className="star-wrap faded">
              <StarIcon className={`star`} />
            </div>
          </td>
        </tr>
      );
    }

    const handleAddToWishlist = () => {
      const newData = accounts.map((itemInStorage) =>
        itemInStorage.id === id ? { ...itemInStorage, watchlist: !watchlist } : itemInStorage
      );
      setAccounts(newData);
      setNewSortedData(newData);
    };

    const isActive = !(Math.random() < 0.5);
    const isEnoughData = !(Math.random() < 0.5);

    return (
      <tr key={id}>
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
        <td className="availableAccounts-table-td table-text-primary">{transactions}</td>
        <td className="availableAccounts-table-td table-text-primary">{transactions - 1}</td>
        <td className="availableAccounts-table-td table-text-primary">
          ${formatNumberToView(volume)}
        </td>
        <td className="availableAccounts-table-td table-text-primary">
          ${formatNumberToView(+volume + 144)}
        </td>
        <td className="availableAccounts-table-td table-text-primary">
          ${formatNumberToView((+volume - 61).toFixed(2))}
        </td>
        <td className={`availableAccounts-table-td table-text-primary roi-${roi.type}`}>${pl}</td>
        <td className={`availableAccounts-table-td roi-${roi.type}`}>{roi.value}%</td>
        <td className="availableAccounts-table-td table-text-primary">{investmentUse}</td>
        <td className="availableAccounts-table-td table-text-primary">
          ${formatNumberToView(Math.floor(Math.random() * (3000000 - 8000 + 1)) + 8000)}
        </td>
        <td className="availableAccounts-table-td table-text-primary">{volatility}</td>
        <td className="availableAccounts-table-td table-text-primary">{popularity}</td>
        <td className="availableAccounts-table-td table-text-primary">
          {Math.floor(Math.random() * 2) + 1}
        </td>
        <td
          className="availableAccounts-table-td table-text-primary"
          style={isActive ? { color: '#25A50E' } : { color: '#FF7272' }}>
          {isActive.toString().charAt(0).toUpperCase() + isActive.toString().slice(1)}
        </td>
        <td
          className="availableAccounts-table-td table-text-primary"
          style={isEnoughData ? { color: '#25A50E' } : { color: '#FF7272' }}>
          {isEnoughData.toString().charAt(0).toUpperCase() + isEnoughData.toString().slice(1)}
        </td>
        <td className="availableAccounts-table-td">
          <div className="star-wrap" onClick={handleAddToWishlist}>
            <StarIcon
              className={classNames('star', {
                filled: watchlist
              })}
            />
          </div>
        </td>
      </tr>
    );
  });
};
