/* eslint-disable no-unused-vars */
import React, { useContext, useState } from 'react';
import { useEffect } from 'react';
import '../../scss/pages/TokenExplorer/tokenExplorerPage.scss';
import '../../scss/pages/SearchEngine/availableAccounts.scss';
import { AccountsContext, SelectedPageContext } from '../../context';
import { swapsSort, tableSort } from '../../helpers/tableSort';

import StarIcon from '../../assets/icons/bellSolid.svg?react';
import ArrowIcon from '../../assets/icons/arrow-down.svg?react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { formatAddress } from '../../helpers/formatAddress';
import { formatNumberToView } from '../TokenExplorer/helpers';
import { WatchlistFilters } from './WatchlistFilters';
import { MyWishlistTable } from './MyWishlistTable';
import { WatchlistSwapsTable } from './WatchlistSwapsTable';
import { addressSwaps } from '../../db/addressSwaps';

export const Watchlist = () => {
  const { selectedPage, setSelectedPage } = useContext(SelectedPageContext);

  useEffect(() => setSelectedPage('Watchlist'));

  const { accounts, setAccounts } = useContext(AccountsContext);
  const [swaps, setSwaps] = useState(addressSwaps);

  const [faded, setFaded] = useState(true);
  const [sortedTableData, setSortedTableData] = useState([...accounts]);
  const [sortedTableDataSwaps, setSortedTableDataSwaps] = useState([...swaps]);
  const [sortDirection, setSortDirection] = useState(0);
  const [prevColId, setPrevColId] = useState(0);

  const [tableSwitch, setTableSwitch] = useState('My Wishlist');

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

  const handleFilterClickSwaps = (colId, direction) => {
    if (direction !== sortDirection || colId !== prevColId) {
      // not to sort if already sorted
      const sorted = [...swapsSort([...swaps], colId, direction)];
      setSortedTableData(sorted);

      setSortDirection(direction);
      setPrevColId(colId);
    }
  };

  return (
    <div className="watchlist-page">
      <div className="switchExplorer">
        <button
          onClick={() => setTableSwitch('My Wishlist')}
          className={classNames('switchExplorer-token', {
            'primary-btn': tableSwitch === 'My Wishlist'
          })}>
          My Wishlist
        </button>

        <button
          onClick={() => setTableSwitch('Swaps')}
          className={classNames('switchExplorer-pool', {
            'primary-btn': tableSwitch === 'Swaps'
          })}>
          Swaps
        </button>
      </div>

      <WatchlistFilters isSwapsFilters={tableSwitch === 'Swaps'} />

      {tableSwitch === 'My Wishlist' ? (
        <MyWishlistTable
          handleFilterClick={handleFilterClick}
          faded={faded}
          visibleArrPages={visibleArrPages}
          setCurrentPage={setCurrentPage}
          currentPage={currentPage}
          numberOfPages={numberOfPages}
          nextPage={nextPage}
          prevPage={prevPage}
          visibleDepositsWithdrawals={visibleDepositsWithdrawals}
          setSortedTableData={setSortedTableData}
        />
      ) : (
        <WatchlistSwapsTable
          handleFilterClickSwaps={handleFilterClickSwaps}
          sortedTableDataSwaps={sortedTableDataSwaps}
          setSortedTableDataSwaps={setSortedTableDataSwaps}
          visibleDepositsWithdrawals={accounts}
        />
      )}
    </div>
  );
};
