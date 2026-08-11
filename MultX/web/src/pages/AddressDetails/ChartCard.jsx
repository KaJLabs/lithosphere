import '../../scss/pages/AddressDetails/chartCard.scss';

import ArrowIcon from '../../assets/icons/arrow-down.svg?react';

import { Chart as ChartJS, registerables } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(...registerables);

export const ChartCard = ({ cardData }) => {
  const { title, date, values } = cardData;

  const data = {
    datasets: [
      {
        order: 2,
        data: values.map(({ value }) => value),
        backgroundColor: values.map(({ color }) => color),
        borderWidth: 0,
        cutout: '85%',
        borderRadius: 999
      }
    ]
  };

  const options = {
    maintainAspectRatio: false,
    interaction: {
      mode: 'index'
    },
    layout: {
      // padding: 10
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false // <-- this option disables tooltips
      }
    }
  };

  return (
    <div className="chartCard">
      <div className="chartCard-title">{title}</div>
      <div className="chartCard-date">{date}</div>

      <div className="chartCard-chart">
        <div className="chartCard-chart-wrapper">
          <Doughnut data={data} options={options} width={280} height={280} />

          <div className="chartCard-chart-wrapper-label">
            <div className="chartCard-chart-wrapper-label-title">{values[0].value.toFixed(2)}%</div>

            <div className="chartCard-chart-wrapper-label-name">{values[0].name}</div>
          </div>
        </div>
      </div>

      <div className="chartCard-pagination">
        <div className="chartCard-pagination-items">
          <div className="chartCard-pagination-item">
            <ArrowIcon className="pagination-arrow left" />
          </div>
          <div className="chartCard-pagination-item">1</div>
          <div className="chartCard-pagination-item">
            <ArrowIcon className="pagination-arrow right" />
          </div>
        </div>
      </div>

      <div className="chartCard-content">
        {values.map(({ name, color, value }, i) => (
          <div key={i} className="chartCard-content-item">
            <div className="chartCard-content-item-name">
              <div
                className="chartCard-content-item-color"
                style={{ backgroundColor: color }}></div>
              {name}
            </div>
            <span className="chartCard-content-item-value">{value.toFixed(2)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
