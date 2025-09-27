// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOCCRScore {
    function scoreMicro(address user) external view returns (uint32);
}

contract OCCRPredicate {
    address public immutable occr;
    uint32 public immutable maxRiskMicro;

    event PredicateCreated(address occr, uint32 maxRiskMicro);

    constructor(address _occr, uint32 _maxRiskMicro) {
        require(_occr != address(0), "occr=0");
        occr = _occr;
        maxRiskMicro = _maxRiskMicro;
        emit PredicateCreated(_occr, _maxRiskMicro);
    }

    function isAllowed(address user) external view returns (bool) {
        uint32 s = IOCCRScore(occr).scoreMicro(user);
        return s <= maxRiskMicro;
    }
}
