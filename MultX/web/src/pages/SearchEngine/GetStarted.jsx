import GetStartedImage from '../../assets/icons/get-started.svg?react';
import MetamaskIcon from '../../assets/icons/metamask.svg?react';
import WalletIcon from '../../assets/icons/wallet.svg?react';

import "../../scss/pages/SearchEngine/getStarted.scss";

const GetStarted = () => {
  return (
    <div className="getStarted">
      <GetStartedImage className="getStarted-image" />
      <div className="getStarted-content">
        <div className="content-wrap">
          <div className="getStarted-content-text">
            <h3>Get Started With Lithosphere Kamet Explorer</h3>
            <p>Connect your wallet to access additional features</p>
          </div>
        </div>
        <div className="buttons-wrap">
          <button className="getStarted-content-btn metamask">
            <div className="icon-wrap">
              <MetamaskIcon />
            </div>
            Metamask Connect
          </button>
          <button className="getStarted-content-btn wallet">
            <div className="icon-wrap">
              <WalletIcon />
            </div>
            Wallet Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default GetStarted;
