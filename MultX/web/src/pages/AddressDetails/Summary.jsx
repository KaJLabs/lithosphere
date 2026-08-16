import '../../scss/pages/AddressDetails/summary.scss';

export const Summary = () => {
  return (
    <div className="summary">
      <div className="summary-title">Summary</div>

      <div className="summary-content">
        <div className="summary-content-item">
          Transactions
          <span className='summary-content-item-value'>147</span>
        </div>

        <div className="summary-content-item">
          Volume
          <span className='summary-content-item-value yellow'>$1101.64</span>
        </div>

        <div className="summary-content-item">
          Investment
          <span className='summary-content-item-value'>$168.29</span>
        </div>

        <div className="summary-content-item">
          Balance
          <span className='summary-content-item-value green'>$572.55</span>
        </div>

        <div className="summary-content-item">
          Tokens
          <span className='summary-content-item-value'>$572.55</span>
        </div>

        <div className="summary-content-item">
          Asset volatility
          <span className='summary-content-item-value red'>Low</span>
        </div>

        <div className="summary-content-item">
          Asset popularity
          <span className='summary-content-item-value'>High</span>
        </div>

        <div className="summary-content-item">
          Investment use rate
          <span className='summary-content-item-value'>1.87</span>
        </div>

        <div className="summary-content-item">
          Analyzed ratio
          <span className='summary-content-item-value'>3.68%</span>
        </div>

        <div className="summary-content-item">
          Total ROI
          <span className='summary-content-item-value green'>+17.45%</span>
        </div>

        <div className="summary-content-item">
          Last TXN sent
          <span className='summary-content-item-value'> 35 days 7 hrs ago</span>
        </div>
      </div>
    </div>
  );
};
