// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGiveChainRefund {
    function donate(uint256 id) external payable;
    function refund(uint256 id) external;
}

/// @dev Test fixture used to prove that refund cannot be re-entered.
contract RefundAttacker {
    IGiveChainRefund public target;
    uint256 public campaignId;
    bool public attackEnabled;
    uint256 public receiveCount;

    function donate(address targetAddress, uint256 id) external payable {
        IGiveChainRefund(targetAddress).donate{value: msg.value}(id);
    }

    function attack(address targetAddress, uint256 id) external {
        target = IGiveChainRefund(targetAddress);
        campaignId = id;
        attackEnabled = true;
        target.refund(id);
        attackEnabled = false;
    }

    receive() external payable {
        receiveCount += 1;
        if (attackEnabled) {
            attackEnabled = false;
            try target.refund(campaignId) {} catch {}
        }
    }
}
