// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract OCCRScore {
    // 0..1 scaled to 0..1_000_000 (micro)
    mapping(address => uint32) public scoreMicro; // default 500_000 (~0.5)

    event CreditScoreUpdated(address indexed user, uint32 newScoreMicro);

    function getScore(address user) public view returns (uint32) {
        uint32 s = scoreMicro[user];
        return s == 0 ? uint32(500_000) : s;
    }

    function adminSetScore(address user, uint32 newScoreMicro) external {
        require(newScoreMicro <= 1_000_000, "range");
        scoreMicro[user] = newScoreMicro;
        emit CreditScoreUpdated(user, newScoreMicro);
    }

    function getMaxLTVbps(address user, uint16 baseLTVbps) external view returns (uint16) {
        uint32 s = getScore(user);
        uint256 oneMinus = 1_000_000 - uint256(s);
        uint256 result = uint256(baseLTVbps) * oneMinus / 1_000_000;
        return uint16(result);
    }
}

