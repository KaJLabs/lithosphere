import { useEffect, useState } from 'react';

import ArrowIcon from '../../assets/icons/arrow-down.svg?react';
import Link from '../../assets/icons/link.svg?react';
import classNames from 'classnames';
import { formatNumberToView } from './helpers';
import { tokensSort } from '../../helpers/tableSort';

const tableDataCols = [
  'Name',
  'Pool name',
  'Token label',
  'Current Price',
  '1 day change',
  '7 days change',
  '30 days change',
  'Market cap'
];

const RenderTableRow = ({ data, faded, showModal, selectCoinInfo }) => {
  const rowsLength = 9;

  if (faded) {
    return Array(rowsLength)
      .fill(0)
      .map((el, id) => (
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
          <td className="availableAccounts-table-td"></td>
        </tr>
      ));
  }

  return data.map((item) => {
    const { id, name, market_cap, image, current_price, symbol, price_change_percentage_24h } =
      item;

    const is1DayProfit = price_change_percentage_24h > 0;
    const is7DayProfit = price_change_percentage_24h - 0.9 > 0;
    const is30DayProfit = price_change_percentage_24h + 0.9 > 0;

    return (
      <tr key={id}>
        <th scope="row" className="addressDetails-table-td date">
          <div className="tokenChart-title-name">
            <img src={image} alt="coin image" style={{ width: 30 }} />

            {name}

            <Link
              onClick={() => {
                showModal(true);
                selectCoinInfo(item.name.charAt(0).toUpperCase() + item.name.slice(1));
              }}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </th>
        <td className="addressDetails-table-td">Curve 3 Pool</td>
        <td className="addressDetails-table-td">{symbol.toUpperCase()}</td>
        <td className="addressDetails-table-td">${current_price}</td>
        <td className="addressDetails-table-td">
          <div
            className={classNames('tokenChart-changePercentage', {
              red: !is1DayProfit
            })}
            style={{ justifyContent: 'start' }}>
            <div
              className={classNames('triangle', {
                unProfitable: !is1DayProfit
              })}
              style={{
                marginRight: 3
              }}></div>
            {(price_change_percentage_24h - 0.7).toFixed(2)}%
          </div>
        </td>
        <td className="addressDetails-table-td">
          <div
            className={classNames('tokenChart-changePercentage', {
              red: !is7DayProfit
            })}
            style={{ justifyContent: 'start' }}>
            <div
              className={classNames('triangle', {
                unProfitable: !is7DayProfit
              })}
              style={{
                marginRight: 3
              }}></div>
            {(price_change_percentage_24h - 0.9).toFixed(2)}%
          </div>
        </td>
        <td className="addressDetails-table-td">
          <div
            className={classNames('tokenChart-changePercentage', {
              red: !is30DayProfit
            })}
            style={{ justifyContent: 'start' }}>
            <div
              className={classNames('triangle', {
                unProfitable: !is30DayProfit
              })}
              style={{
                marginRight: 3
              }}></div>
            {(price_change_percentage_24h + 0.9).toFixed(2)}%
          </div>
        </td>
        <td className="addressDetails-table-td">${formatNumberToView(market_cap)}</td>
      </tr>
    );
  });
};

export const TokensTable = ({ allTokens, showModal, selectCoinInfo }) => {
  const [sortDirection, setSortDirection] = useState(0);
  const [prevColId, setPrevColId] = useState(0);
  const [sortedTableData, setSortedTableData] = useState([...allTokens]);
  const [faded, setFaded] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [paginationItems, setPaginationItems] = useState(3);

  useEffect(() => {
    setSortedTableData(allTokens);
  }, [allTokens]);

  useEffect(() => {
    if (allTokens.length > 1) {
      setFaded(false);
    }
  }, [allTokens]);

  const handleFilterClick = (colId, direction) => {
    if (!faded) {
      if (direction !== sortDirection || colId !== prevColId) {
        // not to sort if already sorted
        const sorted = [...tokensSort([...allTokens], colId, direction)];
        setSortedTableData(sorted);

        setSortDirection(direction);
        setPrevColId(colId);
      }
    }
  };
  const itemsVisible = 10;
  const numberOfPages = Math.ceil(allTokens.length / itemsVisible);

  const arrPages = Array.from({ length: numberOfPages }, (_, i) => i + 1);
  const arrPagesLastIndex = paginationItems;
  const arrPagesFirstIndex = paginationItems - 3;
  const visibleArrPages = arrPages.slice(arrPagesFirstIndex, arrPagesLastIndex);

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
  return (
    <div className="table-wrap">
      <table className="addressDetails-table" cellSpacing="0">
        <thead>
          <tr>
            {tableDataCols.map((col, id) => {
              return (
                <th scope="col" className="addressDetails-table-th" key={id}>
                  <div className="wrap">
                    <p className="addressDetails-table-column">{col}</p>
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
        <tbody className="addressDetails-table-tbody">
          <RenderTableRow
            showModal={showModal}
            selectCoinInfo={selectCoinInfo}
            data={sortedTableData}
            setNewSortedData={setSortedTableData}
            faded={faded}
          />
        </tbody>
      </table>

      <div className="availableAccounts-pagination" style={{ marginTop: 30 }}>
        <button
          disabled={faded}
          className="availableAccounts-pagination-arrow primary-btn"
          onClick={prevPage}>
          <ArrowIcon className="arrow" />
        </button>

        {visibleArrPages.map((num) => (
          <button
            disabled={faded}
            key={num}
            onClick={() => setCurrentPage(num)}
            className={classNames('availableAccounts-pagination-page', {
              active: currentPage === num
            })}>
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
          disabled={faded}
          className="availableAccounts-pagination-arrow primary-btn"
          onClick={nextPage}>
          <ArrowIcon className="arrow right" />
        </button>
      </div>
    </div>
  );
};
