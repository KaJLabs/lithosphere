import axios from 'axios';
import '../../scss/pages/TokenExplorer/tokenChart.scss';
import { MarketChart } from '../../config/api';
import { useContext, useEffect, useState } from 'react';

import { Chart as ChartJS, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ThemeContext } from '../../context';

import Link from '../../assets/icons/link.svg?react';
import classNames from 'classnames';

ChartJS.register(...registerables);

const options = {
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      enabled: false
    },
    legend: {
      display: false
    }
  },
  scales: {
    x: {
      ticks: {
        display: false
      },
      grid: {
        display: false,
        lineWidth: 0,
        drawOnChartArea: false
      }
    },
    y: {
      ticks: {
        display: false
      },
      grid: {
        display: false
      }
    }
  },
  layout: {
    padding: {
      left: -10,
      bottom: -10
    }
  }
};

export const TokenChart = ({ token }) => {
  const { theme } = useContext(ThemeContext);
  const [chartData, setChartData] = useState([]);

  const { id, name, price_change_percentage_24h_in_currency, image, current_price } = token;

  useEffect(() => {
    const fetchChartData = async () => {
      if (!id) {
        setChartData([]);
        return;
      }

      try {
        const { data } = await axios.get(MarketChart(id, 'usd', 30));
        setChartData((data.prices || []).map((item) => item[1]));
      } catch (error) {
        setChartData([]);
      }
    };

    fetchChartData();
  }, [id]);

  const isTokenProfit = Number(price_change_percentage_24h_in_currency ?? 0) > 0;

  const data = {
    labels: chartData.map(() => 'label'),
    datasets: [
      {
        data: chartData,
        pointRadius: 0,
        borderColor: isTokenProfit ? '#25A50E' : '#EF4E4E',
        borderWidth: 1,
        fill: true,
        backgroundColor: (context) => {
          const bgColor = isTokenProfit ? 'rgba(37, 165, 14, 0.20)' : 'rgba(239, 78, 78, 0.20)';
          const bgColor3 = theme ? 'rgba(249, 249, 251, 0.50)' : 'rgba(13, 13, 31, 0.50)';

          if (!context.chart.chartArea) {
            return undefined;
          }

          const {
            ctx,
            chartArea: { top, bottom }
          } = context.chart;

          const gradientBg = ctx.createLinearGradient(0, top, 0, bottom);
          gradientBg.addColorStop(0, bgColor);
          gradientBg.addColorStop(1, bgColor3);

          return gradientBg;
        }
      }
    ]
  };

  return (
    <div className="tokenChart">
      <div className="tokenChart-title">
        <div className="tokenChart-title-name">
          <img src={image} alt="coin image" style={{ width: 30 }} />

          {name}

          <Link />
        </div>

        <div className="tokenChart-title-price">
          {current_price ? `$${current_price}` : '--'}
          <div
            className={classNames('tokenChart-changePercentage', {
              red: !isTokenProfit
            })}
          >
            <div
              className={classNames('triangle', {
                unProfitable: !isTokenProfit
              })}
              style={{
                marginRight: 3
              }}
            ></div>

            {Number(price_change_percentage_24h_in_currency ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="tokenChart-chart">
        <Line options={options} data={data} />
      </div>
    </div>
  );
};
