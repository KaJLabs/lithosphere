// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import "@ensdomains/ens-contracts/contracts/ethregistrar/IPriceOracle.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract LithoStablePriceOracle is IPriceOracle {
    address public owner;
    uint256 public price5Letter;
    uint256 public price4Letter;
    uint256 public price3Letter;
    AggregatorV3Interface public lithoUsdOracle;

    event PricesSet(uint256 price5Letter, uint256 price4Letter, uint256 price3Letter);
    event OracleSet(address indexed oracle);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "LithoStablePriceOracle: not owner");
        _;
    }

    constructor(
        address _lithoUsdOracle,
        uint256 _price5Letter,
        uint256 _price4Letter,
        uint256 _price3Letter
    ) {
        require(_lithoUsdOracle != address(0), "LithoStablePriceOracle: empty oracle");
        owner = msg.sender;
        lithoUsdOracle = AggregatorV3Interface(_lithoUsdOracle);
        price5Letter = _price5Letter;
        price4Letter = _price4Letter;
        price3Letter = _price3Letter;
        emit OracleSet(_lithoUsdOracle);
        emit PricesSet(_price5Letter, _price4Letter, _price3Letter);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function price(
        string calldata name,
        uint256,
        uint256 duration
    ) external view override returns (Price memory) {
        uint256 yearlyUsdPrice = _usdPriceForName(bytes(name).length);
        uint256 proratedUsdPrice = (yearlyUsdPrice * duration) / 365 days;
        return Price({base: _usdToLitho(proratedUsdPrice), premium: 0});
    }

    function setPrices(
        uint256 _price5Letter,
        uint256 _price4Letter,
        uint256 _price3Letter
    ) external onlyOwner {
        price5Letter = _price5Letter;
        price4Letter = _price4Letter;
        price3Letter = _price3Letter;
        emit PricesSet(_price5Letter, _price4Letter, _price3Letter);
    }

    function setOracle(address _lithoUsdOracle) external onlyOwner {
        require(_lithoUsdOracle != address(0), "LithoStablePriceOracle: empty oracle");
        lithoUsdOracle = AggregatorV3Interface(_lithoUsdOracle);
        emit OracleSet(_lithoUsdOracle);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "LithoStablePriceOracle: empty owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _usdPriceForName(uint256 length) internal view returns (uint256) {
        if (length <= 3) return price3Letter;
        if (length == 4) return price4Letter;
        return price5Letter;
    }

    function _usdToLitho(uint256 usdAmount) internal view returns (uint256) {
        (, int256 answer,,,) = lithoUsdOracle.latestRoundData();
        require(answer > 0, "LithoStablePriceOracle: invalid price");
        uint8 oracleDecimals = lithoUsdOracle.decimals();
        return (usdAmount * (10 ** uint256(oracleDecimals))) / uint256(answer);
    }
}
