import { useContext, useEffect, useState } from 'react';

import StarIcon from '../../assets/icons/star.svg?react';
import ArrowIcon from '../../assets/icons/arrow-down.svg?react';

import '../../scss/pages/SearchEngine/availableAccounts.scss';
import classNames from 'classnames';
import { AccountsContext } from '../../context';
import { Link } from 'react-router-dom';
import { formatAddress } from '../../helpers/formatAddress';
import { tableSort } from '../../helpers/tableSort';

const tableDataCols = [
  'Address (truncated)',
  'Labels',
  'Transaction count',
  'Volume swapped',
  'P&L',
  'ROI',
  'Investment use rate',
  'Exposure token count',
  'Asset volatility',
  'Asset popularity',
  'Add to Watchlist'
];

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
      exposure,
      volatility,
      popularity,
      id,
      watchlist
    } = item;
    const rowsLength = 9;

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
        <td className="availableAccounts-table-td table-text-primary">${volume}</td>
        <td className="availableAccounts-table-td table-text-primary">${pl}</td>
        <td className={`availableAccounts-table-td roi-${roi.type}`}>{roi.value}%</td>
        <td className="availableAccounts-table-td table-text-primary">{investmentUse}</td>
        <td className="availableAccounts-table-td table-text-primary">{exposure}</td>
        <td className="availableAccounts-table-td table-text-primary">{volatility}</td>
        <td className="availableAccounts-table-td table-text-primary">{popularity}</td>
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

const AvailableAccounts = () => {
  const { accounts } = useContext(AccountsContext);

  const [faded, setFaded] = useState(true);
  const [sortedTableData, setSortedTableData] = useState([...accounts]);
  const [sortDirection, setSortDirection] = useState(0);
  const [prevColId, setPrevColId] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [paginationItems, setPaginationItems] = useState(3);

  const itemsVisible = 10;

  const lastIndex = currentPage * itemsVisible;
  const firstIndex = lastIndex - itemsVisible;

  const visibleDepositsWithdrawals = sortedTableData.slice(firstIndex, lastIndex);

  const numberOfPages = Math.ceil(sortedTableData.length / itemsVisible);

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);

      if (visibleArrPages.indexOf(currentPage) === 0) {
        setPaginationItems(paginationItems - 3);
      }
    }
  };

  const nextPage = () => {
    if (currentPage < numberOfPages) {
      setCurrentPage(currentPage + 1);

      if (visibleArrPages.indexOf(currentPage) === visibleArrPages.length - 1) {
        setPaginationItems(paginationItems + 3);
      }
    }
  };

  const arrPages = Array.from({ length: numberOfPages }, (_, i) => i + 1);
  const arrPagesLastIndex = paginationItems;
  const arrPagesFirstIndex = paginationItems - 3;
  const visibleArrPages = arrPages.slice(arrPagesFirstIndex, arrPagesLastIndex);

  useEffect(() => {
    setTimeout(() => {
      setFaded(false);
    }, 2000);
  }, []);

  const handleFilterClick = (colId, direction) => {
    if (!faded) {
      if (direction !== sortDirection || colId !== prevColId) {
        // not to sort if already sorted
        const sorted = [...tableSort([...accounts], colId, direction)];
        setSortedTableData(sorted);

        setSortDirection(direction);
        setPrevColId(colId);
      }
    }
  };

  return (
    <div className="availableAccounts">
      <h3>Available accounts</h3>
      <div className="table-wrap">
        <table className="availableAccounts-table" cellSpacing="0">
          <thead>
            <tr>
              {tableDataCols.map((col, id) => {
                return (
                  <th scope="col" className="availableAccounts-table-th" key={id}>
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

export default AvailableAccounts;
