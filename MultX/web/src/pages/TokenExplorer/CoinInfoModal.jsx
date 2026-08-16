import { Blur } from '../../components/Blur';
import { useClickOutside } from '../../hooks/useClickOutside';
import '../../scss/pages/TokenExplorer/coinInfoModal.scss';

import TwitterIcon from '../../assets/icons/sidebar/socials/twitter.svg?react';
import Planet from '../../assets/icons/sidebar/socials/planet.svg?react';
import CoinGecko from '../../assets/icons/sidebar/socials/coinGecko.svg?react';
import Etherscan from '../../assets/icons/detailsIconDark.svg?react';
import Zerion from '../../assets/icons/zerionLogo.svg?react';
import Cross from '../../assets/icons/cross.svg?react';
import GreenIcon from '../../assets/icons/sidebar/socials/green.svg?react';
import CryptoCom from '../../assets/icons/sidebar/socials/cryptoCom.svg?react';

export const CoinInfoModal = ({ coinName, setShowModal }) => {
  const modalRef = useClickOutside(() => {
    setShowModal(false);
  });

  return (
    <div className="coinInfoModal">
      <Blur />

      <div ref={modalRef} className="coinInfoModal-content">
        <div className="coinInfoModal-close" onClick={() => setShowModal(false)}><Cross /></div>

        <div className="coinInfoModal-content-title">About {coinName}</div>

        <div className="coinInfoModal-content-description">
          The user can update the ledger, assigning some of their bitcoin to another entry in the
          ledger. Because the token has characteristics of money, it can be thought of as a digital
          currency.
        </div>

        <div className="coinInfoModal-content-links">
          <div className="">
            <div className="coinInfoModal-content-title" style={{ fontSize: 14, marginBottom: 18 }}>
              Social
            </div>

            <div className="sidebar-contact-socials" style={{gap: 10}}>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social">
                <TwitterIcon />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social">
                <Planet />
              </a>
              <a href="https://coingecko.com" target="_blank" rel="noreferrer" className="social">
                <CoinGecko />
              </a>
            </div>
          </div>

          <div className="">
            <div className="coinInfoModal-content-title" style={{ fontSize: 14, marginBottom: 18 }}>
              Explorers
            </div>

            <div className="sidebar-contact-socials" style={{gap: 10}}>
              <a href="https://etherscan.io/" target="_blank" rel="noreferrer" className="social">
                <Etherscan style={{width: 18}} />
              </a>
              <a href="https://zerion.io/" target="_blank" rel="noreferrer" className="social">
                <Zerion style={{width: 18}} />
              </a>
              <a href="https://www.blockchain.com/" target="_blank" rel="noreferrer" className="social">
                <GreenIcon />
              </a>
              <a href="https://crypto.com/" target="_blank" rel="noreferrer" className="social">
                <CryptoCom />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
