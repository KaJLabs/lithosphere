/* eslint-disable no-unused-vars */
import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccountsContext, NotificationContext, SelectedPageContext } from '../../context';

import ArrowWhiteLeft from '../../assets/icons/arrowWhiteLeft.svg?react';
import ArrowIcon from '../../assets/icons/arrow-down.svg?react';
import EthLight from '../../assets/icons/ethLight.svg?react';
import PencilIcon from '../../assets/icons/pencil.svg?react';
import HeartIcon from '../../assets/icons/heartIcon.svg?react';
import BellIcon from '../../assets/icons/bellSolid.svg?react';
import Copy from '../../assets/icons/copyWhite.svg?react';
import Calendar from '../../assets/icons/calendar.svg?react';

import '../../scss/pages/AddressDetails/addressDetailsPage.scss';

import { Summary } from './Summary';
import { ChartCard } from './ChartCard';

import { addressSwaps } from '../../db/addressSwaps';
import { swapsSort } from '../../helpers/tableSort';
import { MainChart } from './MainChart';
import axios from 'axios';
import { MarketChart } from '../../config/api';
import classNames from 'classnames';

const replaceWithBr = (str) => {
  const breakStr = str.split(' ');
  return (
    <>
      {breakStr[0]} <br /> {breakStr[1]}
    </>
  );
};

const chartsData = [
  {
    title: 'Asset allocation pie chart',
    date: 'As of March 19, 2023',
    values: [
      { name: 'LITHO', value: 34, color: '#01A8D8' },
      { name: 'wLITHO', value: 29, color: '#538BE8' },
      { name: 'LitBTC', value: 21, color: '#8953E8' },
      { name: 'COLLE', value: 17, color: '#FED065' },
      { name: 'JOT', value: 5, color: '#FF7176' }
    ]
  },
  {
    title: 'Asset volatility pie chart',
    date: 'As of March 18, 2023',
    values: [
      { name: 'High', value: 42, color: '#0E98FE' },
      { name: 'Medium', value: 28, color: '#AFFE92' },
      { name: 'Low', value: 30, color: '#B9F6FE' }
    ]
  },
  {
    title: 'Asset popularity pie chart',
    date: 'As of March 17, 2023',
    values: [
      { name: 'High', value: 42, color: '#72DE94' },
      { name: 'Medium', value: 28, color: '#FEE17A' },
      { name: 'Low', value: 30, color: '#FE8A81' }
    ]
  }
];

const tableDataCols = [
  'Date/    Time ago',
  'Transaction amount',
  'From',
  'To',
  'Total fees',
  'Links to'
];

const RenderTableRow = ({ data }) => {
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

    return (
      <tr key={i}>
        <th scope="row" className="addressDetails-table-td date">
          {replaceWithBr(date)}
        </th>
        <td className="addressDetails-table-td">${amount}</td>
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

export const AddressDetails = () => {
  const { accounts, setAccounts } = useContext(AccountsContext);
  const [swaps, setSwaps] = useState(addressSwaps);
  const [currentAddress, setCurrentAddress] = useState({});
  const [sortDirection, setSortDirection] = useState(0);
  const [prevColId, setPrevColId] = useState(0);
  const [sortedTableData, setSortedTableData] = useState([...swaps]);
  const { selectedPage, setSelectedPage } = useContext(SelectedPageContext);

  const [currChartData, setCurrChartData] = useState([]);
  const [dailySelected, setDailySelected] = useState('bitcoin');
  const [timeSelected, setTimeSelected] = useState(1095);

  const { id = '' } = useParams();
  const navigate = useNavigate();

  const fetchChartData = useCallback(async () => {
    try {
      const { data } = await axios.get(MarketChart(dailySelected, 'usd', timeSelected));

      setCurrChartData(
        await data.prices.map((item, i) => ({
          time: item[0] / 1000,
          value: item[1],
          open: item[1] / 1000,
          high: item[1] / 10,
          low: 0,
          close: 0
        }))
      );
    } catch (err) {
      // Handle Error Here
      console.error(err);
    }
  }, [dailySelected, timeSelected]);

  useEffect(() => {
    setSelectedPage('Address details');
  }, [setSelectedPage]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  useEffect(() => {
    setCurrentAddress(accounts.find((account) => account.id === +id));
  }, [id, accounts]);

  const handleFilterClick = (colId, direction) => {
    if (direction !== sortDirection || colId !== prevColId) {
      // not to sort if already sorted
      const sorted = [...swapsSort([...swaps], colId, direction)];
      setSortedTableData(sorted);

      setSortDirection(direction);
      setPrevColId(colId);
    }
  };

  return (
    <div className="addressDetails">
      <div className="addressDetails-header">
        <div className="return-button shadowBox" onClick={() => navigate(-1)}>
          <ArrowWhiteLeft className="arrowReturn" />
        </div>

        <div className="addressDetails-header-address shadowBox">
          <div className="address-token">
            <EthLight />
            Lithosphere
          </div>

          <div className="addressHash">
            <div className="addressHash-item">
              <PencilIcon /> <span className="addressHash-address">{currentAddress.address}</span>
            </div>

            <div className="addressHash-item">
              <HeartIcon />
              <BellIcon />
            </div>
          </div>
        </div>
      </div>

      <div className="addressDetails-cards">
        <Summary />

        {chartsData.map((item, i) => (
          <ChartCard key={i} cardData={item} />
        ))}
      </div>

      <div className="addressDetails-chart">
        <div className="chart-toolBar">
          <div className="chart-toolBar-container">
            <button
              onClick={() => setDailySelected('bitcoin')}
              className={classNames('chart-toolBar-btn', {
                active: dailySelected === 'bitcoin'
              })}>
              Daily ROI
            </button>

            <button
              onClick={() => setDailySelected('ethereum')}
              className={classNames('chart-toolBar-btn', {
                active: dailySelected === 'ethereum'
              })}>
              Daily transactions
            </button>

            <button
              onClick={() => setDailySelected('solana')}
              className={classNames('chart-toolBar-btn', {
                active: dailySelected === 'solana'
              })}>
              Daily volume
            </button>
          </div>

          <div className="chart-toolBar-container">
            <button
              onClick={() => setTimeSelected(1)}
              className={classNames('chart-toolBar-timeBtn', {
                active: timeSelected === 1
              })}>
              1D
            </button>

            <button
              onClick={() => setTimeSelected(7)}
              className={classNames('chart-toolBar-timeBtn', {
                active: timeSelected === 7
              })}>
              7D
            </button>

            <button
              onClick={() => setTimeSelected(30)}
              className={classNames('chart-toolBar-timeBtn', {
                active: timeSelected === 30
              })}>
              1M
            </button>

            <button
              onClick={() => setTimeSelected(60)}
              className={classNames('chart-toolBar-timeBtn', {
                active: timeSelected === 60
              })}>
              3M
            </button>

            <button
              onClick={() => setTimeSelected(364)}
              className={classNames('chart-toolBar-timeBtn', {
                active: timeSelected === 364
              })}>
              1Y
            </button>

            <button
              onClick={() => setTimeSelected(730)}
              className={classNames('chart-toolBar-timeBtn', {
                active: timeSelected === 730
              })}>
              YTD
            </button>

            <button
              onClick={() => setTimeSelected(1095)}
              className={classNames('chart-toolBar-timeBtn', {
                active: timeSelected === 1095
              })}>
              ALL
            </button>

            <div className="chart-toolBar-timeBtn">
              <Calendar />
            </div>

            <div className="chart-toolBar-timeBtn">LOG</div>
          </div>
        </div>

        <MainChart data={currChartData} />
      </div>

      <div className="addressDetails-swaps">
        <div className="addressDetails-swaps-title">Swaps</div>

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
                          <ArrowIcon
                            className="arrow top"
                            onClick={() => handleFilterClick(id, 1)}
                          />
                          <ArrowIcon className="arrow " onClick={() => handleFilterClick(id, 0)} />
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="addressDetails-table-tbody">
              <RenderTableRow data={sortedTableData} setNewSortedData={setSortedTableData} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
