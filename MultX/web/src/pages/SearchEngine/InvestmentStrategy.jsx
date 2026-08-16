import { useEffect, useState } from 'react';
import uuid from 'react-uuid';
import RangeSlider from './RangeSliderComponent/RangeSlider';

import AdvancedIcon from '../../assets/icons/advanced.svg?react';
import PlusIcon from '../../assets/icons/add-list-plus.svg?react';
import FilterIcon from '../../assets/icons/filter.svg?react';
import CloseIcon from '../../assets/icons/close.svg?react';
import ArrowDownIcon from '../../assets/icons/arrow-down.svg?react';
import { useClickOutside } from '../../hooks/useClickOutside';

import whaleIcon from '../../assets/strategies/whale.png';
import botIcon from '../../assets/strategies/bot.png';
import holderIcon from '../../assets/strategies/holder.png';
import traderIcon from '../../assets/strategies/trader.png';
import riskProneIcon from '../../assets/strategies/risk-prone.png';
import riskAverseIcon from '../../assets/strategies/risk-averse.png';
import riskDegenIcon from '../../assets/strategies/degen.png';
import riskFocusedIcon from '../../assets/strategies/focused.png';
import riskArbitrageurIcon from '../../assets/strategies/arbitrageur.png';

import '../../scss/pages/SearchEngine/investmentStrategy.scss';

const range = [];
const data = [
  0, 5, 10, 10, 10, 15, 15, 15, 15, 20, 20, 25, 25, 30, 35, 35, 40, 40, 40, 40, 45, 45, 50, 50, 50,
  55, 60, 60, 65, 65, 70, 70, 75, 80, 80, 80, 85, 90, 90, 95, 100, 105, 110, 110, 110, 115, 115,
  115, 120
];
const minPrice = Math.min.apply(null, data);
const maxPrice = Math.max.apply(null, data);
range.push(minPrice, maxPrice + 1);

const strategiesList = [
  {
    title: 'Whale',
    src: whaleIcon,
    text: 'Account with a lot of money, and high volume'
  },
  {
    title: 'Bot',
    src: botIcon,
    text: 'Bot has high trading frequency'
  },
  {
    title: 'Holder',
    src: holderIcon,
    text: 'Holder invests and waits'
  },
  {
    title: 'Trader',
    src: traderIcon,
    text: 'Someone with a high investment use rate'
  },
  {
    title: 'Risk prone',
    src: riskProneIcon,
    text: 'Someone that takes risk'
  },
  {
    title: 'Risk averse',
    src: riskAverseIcon,
    text: 'Someone that avoids risk'
  },
  {
    title: 'Degen',
    src: riskDegenIcon,
    text: 'Someone that invests in a lots of tokens'
  },
  {
    title: 'Single pair focused ',
    src: riskFocusedIcon,
    text: 'Trader who trades only a small number of tokens'
  },
  {
    title: 'Arbitrageur ',
    src: riskArbitrageurIcon,
    text: 'Someone that performs arbitrage'
  }
];

const dropdownList = [
  { label: 'All types' },
  { label: 'Low' },
  { label: 'Medium' },
  { label: 'High' }
];

const dropdownFilterData = {
  label: 'Asset volatility',
  placeholder: 'Choose the volatility',
  list: dropdownList
};

const rangeSliderData = {
  data,
  range,
  label: 'Volume  swapped',
  unit: '$'
};

const DropdownFilter = ({ label, placeholder, list, handleFilterDelete, id }) => {
  const [dropdownActive, setDropdownActive] = useState(false);
  const [selectedValue, setSelectedValue] = useState('');

  const handleSelectValue = (label) => {
    setSelectedValue(label);
    setDropdownActive(!dropdownActive);
  };

  const modalRef = useClickOutside(() => {
    setDropdownActive(false);
  });

  return (
    <div className="dropdown-filter" ref={modalRef}>
      <div className="dropdown-filter-head">
        <p>{label}</p>
        <CloseIcon className="close" onClick={() => handleFilterDelete(id)} />
      </div>
      <div className="dropdown-filter-select" onClick={() => setDropdownActive(!dropdownActive)}>
        <p>{selectedValue.length > 0 ? selectedValue : placeholder}</p>
        <ArrowDownIcon className={`arrow ${dropdownActive ? 'top' : ''}`} />
      </div>
      <div className={`dropdown-filter-dropdown ${dropdownActive ? 'active' : ''}`}>
        {list.map((item, id) => {
          return (
            <div
              className="dropdown-filter-dropdown-item"
              key={id}
              onClick={() => handleSelectValue(item.label)}>
              <p>{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EmptyFilter = () => {
  return (
    <div className="strategy-advanced-filters-filter">
      <FilterIcon />
      <p>Click on a filter to add it</p>
    </div>
  );
};

const RenderFilterAdd = ({ filtersList, handleFilterAdd, faded }) => {
  return (
    <div className="strategy-advanced-add-list">
      {filtersList.map((item, id) => {
        if (item.active) {
          return (
            <div className="strategy-advanced-add-list-item" key={id}>
              <p>{item.label}</p>
              <PlusIcon
                className={`plus ${faded ? 'faded' : ''}`}
                onClick={() => handleFilterAdd(item)}
              />
            </div>
          );
        }
      })}
    </div>
  );
};

const addFiltersList = [
  { label: 'Benefit P&L', Component: DropdownFilter, data: dropdownFilterData, active: true },
  { label: 'Investment use rate', Component: RangeSlider, data: rangeSliderData, active: true },
  { label: 'Exposure token count', Component: RangeSlider, data: rangeSliderData, active: true },
  { label: 'Swap count', Component: RangeSlider, data: rangeSliderData, active: true },
  { label: 'Investment', Component: DropdownFilter, data: dropdownFilterData, active: true },
  { label: 'Balance', Component: DropdownFilter, data: dropdownFilterData, active: true },
  { label: 'Arbitrage count', Component: DropdownFilter, data: dropdownFilterData, active: true },
  { label: 'Benefit P&L 2', Component: DropdownFilter, data: dropdownFilterData, active: true },
  { label: 'Investment use rate 2', Component: RangeSlider, data: rangeSliderData, active: true },
  { label: 'Exposure token count 2', Component: RangeSlider, data: rangeSliderData, active: true },
  { label: 'Swap count 2', Component: RangeSlider, data: rangeSliderData, active: true },
  { label: 'Investment 2', Component: DropdownFilter, data: dropdownFilterData, active: true },
  { label: 'Balance 2', Component: DropdownFilter, data: dropdownFilterData, active: true },
  { label: 'Arbitrage count 2', Component: DropdownFilter, data: dropdownFilterData, active: true }
];

const InvestmentStrategy = () => {
  const [faded, setFaded] = useState(true);
  const [advancedActive, setAdvancedActive] = useState(false);
  const [strategyActiveId, setStrategyActiveId] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [filtersList, setFiltersList] = useState([...addFiltersList]);

  useEffect(() => {
    setTimeout(() => {
      setFaded(false);
    }, 1600);
  }, []);

  useEffect(() => {
    const emptyFilters = new Array(6).fill(0).map(() => {
      return {
        Component: EmptyFilter,
        data: [],
        id: uuid()
      };
    });

    setActiveFilters(emptyFilters);
  }, []); // on component load fill area with empty filters

  const handleFilterAdd = (filter) => {
    const id = uuid(),
      newFilter = { ...filter, id };
    let newArray;
    let index = activeFilters.findIndex((a) => a.Component === EmptyFilter); // find where to place item
    if (index > -1) {
      newArray = [...activeFilters.slice(0, index), newFilter, ...activeFilters.slice(index, -1)];
    } else {
      newArray = [...activeFilters, newFilter];
    }

    if (newArray.length % 2) {
      newArray = [...newArray.concat({ Component: EmptyFilter, data: [], id: uuid() })];
    }

    setFiltersList((state) => [
      ...state.map((el) => {
        if (el.label === filter.label) {
          return {
            ...el,
            active: false
          };
        }
        return el;
      })
    ]);
    setActiveFilters([...newArray]);
  };

  const handleFilterDelete = (id) => {
    let newArray = [...activeFilters];
    const curIdx = activeFilters.findIndex((a) => a.id === id);
    newArray = [...activeFilters.slice(0, curIdx), ...activeFilters.slice(curIdx + 1)];

    if (!(newArray.length % 2) || newArray[newArray.length - 1].Component === EmptyFilter) {
      newArray = [...newArray.slice(0, -1)];
    } else {
      newArray = [...newArray.concat({ Component: EmptyFilter, data: [], id: uuid() })];
    }

    while (newArray.length < 6) {
      newArray = newArray.concat({ Component: EmptyFilter, data: [], id: uuid() });
    }
    setFiltersList((state) => [
      ...state.map((el) => {
        if (el.label === activeFilters[curIdx].label) {
          return {
            ...el,
            active: true
          };
        } else {
          return el;
        }
      })
    ]);
    setActiveFilters([...newArray]);
  };

  return (
    <div className="strategy">
      <h3>Quickly define your investment strategy</h3>
      <div className="strategy-list">
        {strategiesList.map(({ title, src, text }, id) => {
          return (
            <div
              className={`strategy-list-item ${faded ? 'blackout' : ''} ${
                strategyActiveId !== null ? (strategyActiveId === id ? 'active' : 'hidden') : ''
              }`}
              onClick={() => setStrategyActiveId(id)}
              key={id}>
              <div className="strategy-list-item-title">{title}</div>
              <img className="strategy-list-item-image" src={src} alt="strategy" />
              <div className="strategy-list-item-text">{text}</div>
              <div className="strategy-list-item-blackout"></div>
            </div>
          );
        })}
      </div>
      <div className="strategy-navigation">
        <div className="advanced-wrap">
          <button
            className={`advanced-btn ${advancedActive ? 'active' : ''}`}
            onClick={() => setAdvancedActive(!advancedActive)}>
            <AdvancedIcon />
            Advanced mode
          </button>
        </div>
        <div className="nav-wrap">
          <button
            className="cancel-btn btn"
            disabled={strategyActiveId === null}
            onClick={() => setStrategyActiveId(null)}>
            Clear All
          </button>
          <button className="primary-btn btn" disabled={faded}>
            Search
          </button>
        </div>
        <div className="line"></div>
      </div>

      <div className={`strategy-advanced ${advancedActive ? 'active' : ''}`}>
        <div className="strategy-advanced-add">
          <p>Add a filter</p>
          <RenderFilterAdd
            faded={faded}
            filtersList={filtersList}
            handleFilterAdd={handleFilterAdd}
          />
        </div>
        <div className="strategy-advanced-filters">
          {activeFilters.map(({ Component, data, id }) => {
            return <Component {...data} handleFilterDelete={handleFilterDelete} id={id} key={id} />;
          })}
        </div>
      </div>
    </div>
  );
};

export default InvestmentStrategy;
