import { useContext, useState } from 'react';

import '../NotificationsBar.scss';
import classNames from 'classnames';

import BellIcon from '../../../assets/icons/bell.svg?react';
import NoNotificationsBell from '../../../assets/icons/noNotificationsBell.svg?react';
import CloseIcon from '../../../assets/icons/closeLight.svg?react';
import ArrowIcon from '../../../assets/icons/sortArrowBottom.svg?react';
import { NotificationCard } from './NotificationCard';
import { AccountsContext } from '../../../context';

const sortOptions = ['All types', 'Hot', 'New'];

export const NotificationsBar = ({ isOpen, onClose }) => {
  const [openSort, setOpenSort] = useState(false);
  const [sortOption, setSortOption] = useState('');
  const { accounts } = useContext(AccountsContext);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationItems, setPaginationItems] = useState(3);

  let accountsInWishlist = accounts.filter((itemInStorage) => itemInStorage.watchlist);

  switch (sortOption) {
    case 'Hot':
      accountsInWishlist = accountsInWishlist.filter((item) => item.isHot);
      break;
    case 'New':
      accountsInWishlist = accountsInWishlist.filter((item) => item.isNew);
      break;
  }

  const itemsVisible = 3;

  const lastIndex = currentPage * itemsVisible;
  const firstIndex = lastIndex - itemsVisible;

  const visibleItems = accountsInWishlist.slice(firstIndex, lastIndex);

  const numberOfPages = Math.ceil(accountsInWishlist.length / itemsVisible);

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

  return (
    <div
      className={classNames('notificationsBar', {
        opened: isOpen
      })}>
      <div className="notificationsBar-bg" onClick={() => onClose(false)}></div>

      <div
        className={classNames('notificationsBar-menu', {
          opened: isOpen
        })}>
        <div className="notificationsBar-header">
          {accountsInWishlist.length ? (
            <div className="notificationsBar-header-title">
              <div className="header-btn bell">
                <BellIcon />
                <div className="notifications-count">{accountsInWishlist.length}</div>
              </div>
              Notifications
            </div>
          ) : (
            <NoNotificationsBell width={38} height={38} />
          )}

          <CloseIcon className="notificationsBar-closeIcon" onClick={() => onClose(false)} />
        </div>

        <div className="notificationsBar-sort">
          <div className="notificationsBar-sort-options">
            Sort by
            <ArrowIcon
              className={classNames('notificationsBar-sort-options-arrow', {
                active: openSort
              })}
              onClick={() => setOpenSort(!openSort)}
            />
            {openSort && (
              <div className="notificationsBar-sort-options-list">
                {sortOptions.map((type, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSortOption(type);
                      setOpenSort(false);
                    }}
                    className="notificationsBar-sort-options-list-item">
                    {type}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="">
            {accountsInWishlist.filter((itemFromStorage) => itemFromStorage.isNew).length} New of{' '}
            {accountsInWishlist.length}
          </div>
        </div>

        <div className="notificationsBar-list">
          <div className="notificationsBar-list-items">
            {visibleItems.length ? (
              visibleItems.map((item) => <NotificationCard key={item.id} item={item} />)
            ) : (
              <div className="notificationsBar-noItems">
                <NoNotificationsBell />

                <div className="notificationsBar-noItems-message">
                  There are no notifications for us to show yet, check back a little later
                </div>
              </div>
            )}
          </div>
        </div>

        {!!accountsInWishlist.length && (
          <div className="notificationsBar-pagination">
            <div className="availableAccounts-pagination">
              <button className="availableAccounts-pagination-arrow primary-btn" onClick={prevPage}>
                <ArrowIcon className="arrow" />
              </button>

              {visibleArrPages.map((num) => (
                <button
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

              <button className="availableAccounts-pagination-arrow primary-btn" onClick={nextPage}>
                <ArrowIcon className="arrow right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
