import { useContext, useEffect, useState } from 'react';
import { SelectedPageContext } from '../../context';
import '../../scss/pages/TokenExplorer/tokenExplorerPage.scss';
import { TokenChart } from './TokenChart';
import ArrowIcon from '../../assets/icons/arrow-down.svg?react';
import axios from 'axios';
import { MarketCoinsByIds, TrendingCoins } from '../../config/api';
import classNames from 'classnames';
import { TokensTable } from './TokensTable';
import { CoinInfoModal } from './CoinInfoModal';

export const TokenExplorer = () => {
  const { setSelectedPage } = useContext(SelectedPageContext);
  const [coins, setCoins] = useState([]);
  const [explorerSwitch, setExplorerSwitch] = useState('Token');
  const [showCoinInfoModal, setShowCoinInfoModal] = useState(false);
  const [selectedCoinInfo, setSelectedCoinInfo] = useState('');

  useEffect(() => {
    setSelectedPage('Explore Opportunities');
  }, [setSelectedPage]);

  useEffect(() => {
    const fetchTrendingCoins = async () => {
      const [{ data: trendingData }, { data: lithoData }] = await Promise.all([
        axios.get(TrendingCoins('usd')),
        axios.get(MarketCoinsByIds('usd', ['lithosphere'])).catch(() => ({ data: [] }))
      ]);

      const litho = Array.isArray(lithoData) ? lithoData[0] : null;
      const trending = Array.isArray(trendingData) ? trendingData : [];

      setCoins(litho ? [litho, ...trending.filter((coin) => coin.id !== litho.id)] : trending);
    };

    fetchTrendingCoins();
  }, []);

  return (
    <div className="tokenExplorer">
      <div className="tokenizedBaskets">
        <div className="tokenizedBaskets-title">
          Top 10 tokenized baskets of high quality DeFi projects
        </div>

        <div className="tokenizedBaskets-charts">
          {coins.length ? coins.map((item) => <TokenChart key={item.id} token={item} />) : 'loading'}
        </div>
      </div>

      <div className="switchExplorer">
        <button
          onClick={() => setExplorerSwitch('Token')}
          className={classNames('switchExplorer-token', {
            'primary-btn': explorerSwitch === 'Token'
          })}
        >
          Token Explorer
        </button>

        <button
          onClick={() => setExplorerSwitch('Pool')}
          className={classNames('switchExplorer-pool', {
            'primary-btn': explorerSwitch === 'Pool'
          })}
        >
          Pool Explorer
        </button>
      </div>

      <div className="tokenExplorer-table">
        <div className="tokenExplorer-table-header">
          <div></div>
          <div className="tokenExplorer-table-header-title">Token Explorer</div>
          <div className="tokenExplorer-table-header-sort">
            <span className="primaryColor">sort by:</span>
            <div>Highest Losses</div>
            <ArrowIcon className="sortArrow" />
          </div>
        </div>

        <TokensTable
          showModal={setShowCoinInfoModal}
          selectCoinInfo={setSelectedCoinInfo}
          allTokens={coins}
        />
      </div>

      {showCoinInfoModal && (
        <CoinInfoModal coinName={selectedCoinInfo} setShowModal={setShowCoinInfoModal} />
      )}
    </div>
  );
};
