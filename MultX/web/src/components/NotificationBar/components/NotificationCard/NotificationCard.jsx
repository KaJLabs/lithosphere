import classNames from 'classnames';
import hotIcon from '../../../../assets/icons/hotIcon.svg';

import ArrowIcon from '../../../../assets/icons/sortArrowBottom.svg?react';
import Details from '../../../../assets/icons/detailsIcon.svg?react';
import Copy from '../../../../assets/icons/copyWhite.svg?react';
import CopiedIcon from '../../../../assets/icons/copiedIcon.svg?react';

import './NotificationCard.scss';
import { useContext, useState } from 'react';
import { nFormatter } from './helpers';
import { NotificationContext } from '../../../../context';
import { Link } from 'react-router-dom';

export const NotificationCard = ({ item }) => {
  const {
    date,
    time,
    isHot,
    isNew,
    address,
    labels,
    DEX,
    iconDEX,
    tokenIn,
    nameTokenIn,
    iconTokenIn,
    tokenOut,
    nameTokenOut,
    iconTokenOut,
    swaps,
    id
  } = item;

  const [lebelsVisible, setLabelsVisible] = useState(false);
  const [openSwapIndex, setOpenSwapIndex] = useState('');
  const [copiedSwapIndex, setCopiedSwapIndex] = useState('');

  const { notification, setNotification } = useContext(NotificationContext);

  const visibleLabels = () => {
    if (lebelsVisible) {
      return labels;
    }

    return labels.slice(0, 3);
  };

  const handleCopy = (action) => {
    if (notification.length === 0) {
      setNotification(action);

      const timeout = setTimeout(() => {
        setNotification('');
        return () => clearTimeout(timeout);
      }, 2500);
    }
  };

  return (
    <div className="notificationCard">
      <div className="notificationCard-header">
        <div className="">
          {date}, {time} EET
        </div>

        <div className="notificationCard-header-labels">
          <div className="notificationCard-header-label" style={{ color: 'var(--text-active)' }}>
            #Trading
          </div>

          {isHot && (
            <div className="notificationCard-header-label">
              <img src={hotIcon} alt="hotIcon" />
              Hot
            </div>
          )}

          {isNew && (
            <div className="notificationCard-header-label">
              <div className="dot"></div> New
            </div>
          )}
        </div>
      </div>

      <div className="notificationCard-address">{address}</div>

      <div className="labels">
        <div
          className={classNames('labels-wrap', {
            hidden: labels.length > 3
          })}>
          {visibleLabels().map((label, i) => {
            return <img src={label} className="labels-img" alt="strategy" key={i} />;
          })}
        </div>

        {labels.length > 3 && (
          <>
            {visibleLabels().length === 3 && <p>...</p>}
            <ArrowIcon
              className={classNames('labels-arrow', {
                'labels-arrow_rotated': lebelsVisible
              })}
              onClick={() => setLabelsVisible(!lebelsVisible)}
            />
          </>
        )}
      </div>

      <div className="notificationCard-info">
        <div className="notificationCard-info-item">
          <div className="">DEX:</div>

          <div className="notificationCard-info-item-dex">
            {DEX} <img src={iconDEX} alt="iconDEX" />
          </div>
        </div>

        <div className="notificationCard-info-item">
          <div className="">Token in</div>

          <div className="notificationCard-info-item-dex">{tokenIn.toFixed(2)}</div>
        </div>

        <div className="notificationCard-info-item">
          <div className="">Name token in</div>

          <div className="notificationCard-info-item-dex">
            <img src={iconTokenIn} style={{ width: 18 }} alt="iconTokenIn" /> {nameTokenIn}
          </div>
        </div>

        <div className="notificationCard-info-item">
          <div className="">Token out</div>

          <div className="notificationCard-info-item-dex">{tokenOut.toFixed(2)}</div>
        </div>

        <div className="notificationCard-info-item">
          <div className="">Name token out</div>

          <div className="notificationCard-info-item-dex">
            <img src={iconTokenOut} alt="iconTokenOut" /> {nameTokenOut}
          </div>
        </div>
      </div>

      <div className="notificationCard-wrapper">
        <div className="notificationCard-transaction">
          <div className="">Transaction</div>
          <div className="">
            {nFormatter(tokenIn, 1)} {nameTokenIn} <span style={{ color: '#DEA101' }}>{'>'}</span>{' '}
            {nFormatter(tokenOut, 1)} {nameTokenOut}
          </div>
        </div>

        <div className="notificationCard-amountSwaps">
          <div className="">Amount of swaps</div>
          <div className="">{swaps.length}</div>
        </div>
      </div>

      <div className="notificationCard-swapsList">
        {swaps.map((swap, i) => (
          <div
            key={i}
            className={classNames('notificationCard-swapsList-item', {
              open: openSwapIndex === i
            })}>
            <div className="notificationCard-swapsList-item-header">
              <div className="notificationCard-swapsList-item-header-index">{i + 1}</div>

              <div className="notificationCard-swapsList-item-header-title">
                <div className="notificationCard-transaction">
                  <img src={iconDEX} alt="iconDEX" />
                  <div className="">
                    {nFormatter(swap.tokenIn, 1)} {swap.nameTokenIn}{' '}
                    <span style={{ color: '#DEA101' }}>{'>'}</span> {nFormatter(swap.tokenOut, 1)}{' '}
                    {swap.nameTokenOut}
                  </div>
                </div>

                <div className="">
                  {swap.value + '$ '}
                  <ArrowIcon
                    onClick={() =>
                      openSwapIndex === i ? setOpenSwapIndex('') : setOpenSwapIndex(i)
                    }
                    className={classNames('arrowOpen', { openedArrow: openSwapIndex === i })}
                  />
                </div>
              </div>
            </div>

            <div className="notificationCard-swapsList-item-buttons">
              <button
                className={classNames('primary-btn notificationCard-button', {
                  copied: copiedSwapIndex === i
                })}
                onClick={() => {
                  handleCopy('copy');
                  setCopiedSwapIndex(i);
                }}>
                {copiedSwapIndex === i ? (
                  <>
                    <CopiedIcon className="notificationCard-copyIcon" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="notificationCard-copyIcon" /> Copy Swap
                  </>
                )}
              </button>

              <Link
                to={`/AI_Search_Engine/${id}`}
                className="secondary-btn notificationCard-button"
                style={{ textDecoration: 'none' }}>
                <button className="secondary-btn ">
                  <Details className="notificationCard-detailsIcon" /> Details
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
