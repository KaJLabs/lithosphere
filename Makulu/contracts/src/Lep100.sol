// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./ILep100.sol";
import "./Lep100Access.sol";
import "./libs/Strings.sol";
contract Lep100 is ILep100, Lep100Access {
    using Strings for uint256;
    string public override name;
    string public override symbol;
    mapping(uint256 => mapping(address => uint256)) internal _balances;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    mapping(uint256 => uint256) public totalSupply;
    string internal _baseURI;
    bool public paused;
    event Paused(address account);
    event Unpaused(address account);
    modifier whenNotPaused(){ require(!paused, "paused"); _; }
    constructor(string memory _n, string memory _s, string memory base){
        name=_n; symbol=_s; _baseURI=base;
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(PAUSER_ROLE, msg.sender);
    }
    function pause() external onlyRole(PAUSER_ROLE){ require(!paused); paused=true; emit Paused(msg.sender); }
    function unpause() external onlyRole(PAUSER_ROLE){ require(paused); paused=false; emit Unpaused(msg.sender); }
    function balanceOf(address a, uint256 id) public view override returns (uint256){ require(a!=address(0)); return _balances[id][a]; }
    function balanceOfBatch(address[] calldata a, uint256[] calldata ids) public view override returns (uint256[] memory b){
        require(a.length==ids.length); b=new uint256[](a.length); for(uint256 i;i<a.length;i++){ b[i]=balanceOf(a[i],ids[i]); }
    }
    function isApprovedForAll(address a,address o) public view override returns(bool){ return _operatorApprovals[a][o]; }
    function setApprovalForAll(address o,bool appr) public override { require(msg.sender!=o); _operatorApprovals[msg.sender][o]=appr; emit ApprovalForAll(msg.sender,o,appr); }
    function uri(uint256 id) public view override returns(string memory){ return string(abi.encodePacked(_baseURI, id.toString())); }
    function setBaseURI(string calldata base) external onlyRole(ADMIN_ROLE){ _baseURI=base; emit URI(base,0); }
    function safeTransferFrom(address from,address to,uint256 id,uint256 amt,bytes calldata) public override whenNotPaused {
        require(from==msg.sender || isApprovedForAll(from,msg.sender), "not approved"); require(to!=address(0));
        uint256 f=_balances[id][from]; require(f>=amt,"insufficient"); unchecked{ _balances[id][from]=f-amt; } _balances[id][to]+=amt;
        emit TransferSingle(msg.sender, from, to, id, amt);
    }
    function safeBatchTransferFrom(address from,address to,uint256[] calldata ids,uint256[] calldata amts,bytes calldata) public override whenNotPaused {
        require(ids.length==amts.length && (from==msg.sender || isApprovedForAll(from,msg.sender)) && to!=address(0));
        for(uint256 i;i<ids.length;i++){ uint256 id=ids[i]; uint256 a=amts[i]; uint256 f=_balances[id][from]; require(f>=a); unchecked{_balances[id][from]=f-a;} _balances[id][to]+=a; }
        emit TransferBatch(msg.sender, from, to, ids, amts);
    }
    function mint(address to,uint256 id,uint256 amt,bytes calldata) external override onlyRole(MINTER_ROLE) whenNotPaused {
        require(to!=address(0)); _balances[id][to]+=amt; totalSupply[id]+=amt; emit TransferSingle(msg.sender, address(0), to, id, amt);
    }
    function burn(address from,uint256 id,uint256 amt) external override whenNotPaused {
        require(from==msg.sender || isApprovedForAll(from,msg.sender)); uint256 f=_balances[id][from]; require(f>=amt);
        unchecked{_balances[id][from]=f-amt;} totalSupply[id]-=amt; emit TransferSingle(msg.sender, from, address(0), id, amt);
    }
}
