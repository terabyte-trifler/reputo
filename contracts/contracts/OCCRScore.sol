// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ILendingView {
    function baseLTVbps() external view returns (uint16);
    function price1e18() external view returns (uint256);
    function collateralBalance(address) external view returns (uint256);
    function debtBalance(address) external view returns (uint256);
    function userMaxBorrowable(address) external view returns (uint256);
}

contract OCCRScore is Ownable {
    // risk score: 0 (best) .. 1e6 (worst)
    mapping(address => uint32) public scoreMicro;

    struct Stats {
        uint32 repaidCount;
        uint32 liquidatedCount;
        uint32 txCount; // borrow/repay/liquidation events
        uint64 firstLoanTs; // first borrow timestamp
    }
    mapping(address => Stats) public stats;

    ILendingView public lendingPool;
    address public poolCaller; // only pool can notify events

    event CreditScoreUpdated(address indexed user, uint32 newScoreMicro);
    event PoolSet(address pool, address caller);

    constructor(address owner_) Ownable(owner_) {}

    function setPool(address pool, address caller) external onlyOwner {
        lendingPool = ILendingView(pool);
        poolCaller = caller;
        emit PoolSet(pool, caller);
    }

    modifier onlyPool() {
        require(msg.sender == poolCaller, "only pool");
        _;
    }

    // --- hooks from pool ---
    function onBorrow(address user) external onlyPool { 
        Stats storage s = stats[user];
        s.txCount += 1;
        if (s.firstLoanTs == 0) s.firstLoanTs = uint64(block.timestamp);
        _recompute(user);
    }

    function onRepay(address user) external onlyPool {
        Stats storage s = stats[user];
        s.txCount += 1;
        s.repaidCount += 1;
        _recompute(user);
    }

    function onLiquidation(address user) external onlyPool {
        Stats storage s = stats[user];
        s.txCount += 1;
        s.liquidatedCount += 1;
        _recompute(user);
    }

    // --- core scoring ---
    function _recompute(address user) internal {
        // pull position
        uint256 coll = lendingPool.collateralBalance(user);
        uint256 debt = lendingPool.debtBalance(user);
        uint256 price = lendingPool.price1e18();
        uint16 baseLTV = lendingPool.baseLTVbps();

        uint256 value = coll * price / 1e18;
        uint256 maxBase = value * baseLTV / 10_000;

        Stats storage st = stats[user];
        // subscores are in [0..1e6], higher is worse (more risk)
        uint256 subHistorical = _subHistorical(st.repaidCount, st.liquidatedCount);
        uint256 subCurrent    = _subCurrentRisk(debt, value, baseLTV);
        uint256 subUtil       = _subUtilization(debt, maxBase);
        uint256 subTxn        = _subTransaction(st.txCount);
        uint256 subNew        = _subNewCredit(st.firstLoanTs);

        // weights (micro): 35%, 25%, 15%, 15%, 10%
        uint256 riskMicro =
              (subHistorical * 350_000)
            + (subCurrent    * 250_000)
            + (subUtil       * 150_000)
            + (subTxn        * 150_000)
            + (subNew        * 100_000);
        riskMicro /= 1_000_000; // normalize back to micro

        uint32 r = uint32(riskMicro > 1_000_000 ? 1_000_000 : riskMicro);
        scoreMicro[user] = r;
        emit CreditScoreUpdated(user, r);
    }

    function _subHistorical(uint32 repaid, uint32 liquidated) internal pure returns (uint256) {
        uint256 tot = uint256(repaid) + uint256(liquidated);
        if (tot == 0) return 500_000; // neutral until history forms
        return (uint256(liquidated) * 1_000_000) / tot;
    }

    function _subCurrentRisk(uint256 debt, uint256 value, uint16 baseLTV) internal pure returns (uint256) {
        if (value == 0) return debt == 0 ? 0 : 1_000_000;
        // current LTV vs base LTV
        uint256 currLTVmicro = (debt * 1_000_000) / value;        // debt/value (micro)
        uint256 baseLTVmicro = uint256(baseLTV) * 100_000 / 10_000; // e.g., 5000 bps => 500_000 micro
        if (baseLTVmicro == 0) return 1_000_000;
        uint256 ratioMicro = (currLTVmicro * 1_000_000) / baseLTVmicro;
        return ratioMicro > 1_000_000 ? 1_000_000 : ratioMicro; // 1.0 = at base LTV
    }

    function _subUtilization(uint256 debt, uint256 maxBase) internal pure returns (uint256) {
        if (maxBase == 0) return debt == 0 ? 0 : 1_000_000;
        uint256 u = (debt * 1_000_000) / maxBase;
        return u > 1_000_000 ? 1_000_000 : u;
    }

    function _subTransaction(uint32 txCount) internal pure returns (uint256) {
        // more tx => lower risk. simple 1/(1+tx)
        uint256 denom = uint256(txCount) + 1;
        return (1_000_000) / denom; // 1e6, 500k, 333k, ...
    }

    function _subNewCredit(uint64 firstTs) internal view returns (uint256) {
        if (firstTs == 0) return 1_000_000; // brand new
        uint256 age = block.timestamp - uint256(firstTs);
        // ~30 days to converge from 1.0 risk downwards
        if (age >= 30 days) return 200_000; // floor
        // linear from 1e6 at 0d to 2e5 at 30d
        uint256 left = 30 days - age;
        return 200_000 + (left * 800_000) / (30 days);
    }

    // dynamic LTV: base * (1 - risk)
    function getMaxLTVbps(address user, uint16 baseLTVbps_) external view returns (uint16) {
        uint32 r = scoreMicro[user] == 0 ? 500_000 : scoreMicro[user];
        uint256 adj = uint256(baseLTVbps_) * (1_000_000 - r) / 1_000_000;
        return uint16(adj);
    }
}
