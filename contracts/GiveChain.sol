// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GiveChain
/// @notice A multi-campaign donation contract with settlement and refunds.
contract GiveChain {
    enum Stage {
        NONE,
        OPEN,
        SUCCESS,
        FAILED
    }

    struct Campaign {
        address owner;
        string title;
        uint256 goal;
        uint256 raised;
        address payable beneficiary;
        Stage stage;
    }

    error InvalidCampaign(uint256 id);
    error InvalidTitle();
    error InvalidGoal();
    error InvalidBeneficiary();
    error NotCampaignOwner();
    error NotBeneficiary();
    error InvalidStage(Stage expected, Stage actual);
    error ZeroDonation();
    error NoDonation();
    error AlreadyWithdrawn();
    error InsufficientBalance();
    error ReentrantCall();
    error TransferFailed();
    error NoDoubleRefund();

    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => bool) public withdrawn;

    bool private locked;

    event CampaignCreated(
        uint256 indexed id,
        address indexed owner,
        string title,
        uint256 goal,
        address beneficiary
    );
    event Donated(
        uint256 indexed id,
        address indexed donor,
        uint256 amount
    );
    event CampaignFinalized(uint256 indexed id, Stage stage);
    event Withdrawn(
        uint256 indexed id,
        address indexed beneficiary,
        uint256 amount
    );
    event Refunded(
        uint256 indexed id,
        address indexed donor,
        uint256 amount
    );

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    function createCampaign(
        string calldata title,
        uint256 goal,
        address payable beneficiary
    ) external returns (uint256 id) {
        if (bytes(title).length == 0) revert InvalidTitle();
        if (goal == 0) revert InvalidGoal();
        if (beneficiary == address(0)) revert InvalidBeneficiary();

        id = campaignCount++;
        campaigns[id] = Campaign({
            owner: msg.sender,
            title: title,
            goal: goal,
            raised: 0,
            beneficiary: beneficiary,
            stage: Stage.OPEN
        });

        emit CampaignCreated(id, msg.sender, title, goal, beneficiary);
    }

    function donate(uint256 id) external payable {
        Campaign storage campaign = _campaign(id);
        if (campaign.stage != Stage.OPEN) {
            revert InvalidStage(Stage.OPEN, campaign.stage);
        }
        if (msg.value == 0) revert ZeroDonation();

        campaign.raised += msg.value;
        donations[id][msg.sender] += msg.value;

        emit Donated(id, msg.sender, msg.value);
    }

    function finalizeCampaign(uint256 id) external {
        Campaign storage campaign = _campaign(id);
        if (msg.sender != campaign.owner) revert NotCampaignOwner();
        if (campaign.stage != Stage.OPEN) {
            revert InvalidStage(Stage.OPEN, campaign.stage);
        }

        campaign.stage =
            campaign.raised >= campaign.goal ? Stage.SUCCESS : Stage.FAILED;

        emit CampaignFinalized(id, campaign.stage);
    }

    function withdraw(uint256 id) external nonReentrant {
        Campaign storage campaign = _campaign(id);
        if (msg.sender != campaign.beneficiary) revert NotBeneficiary();
        if (campaign.stage != Stage.SUCCESS) {
            revert InvalidStage(Stage.SUCCESS, campaign.stage);
        }
        if (withdrawn[id]) revert AlreadyWithdrawn();

        uint256 amount = campaign.raised;
        if (amount == 0) revert NoDonation();
        if (address(this).balance < amount) revert InsufficientBalance();

        // Effects happen before the external call (CEI).
        withdrawn[id] = true;

        (bool success, ) = campaign.beneficiary.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(id, campaign.beneficiary, amount);
    }

    function refund(uint256 id) external nonReentrant {
        Campaign storage campaign = _campaign(id);
        if (campaign.stage != Stage.FAILED) {
            revert InvalidStage(Stage.FAILED, campaign.stage);
        }

        uint256 amount = donations[id][msg.sender];
        if (amount == 0) revert NoDoubleRefund();
        if (address(this).balance < amount) revert InsufficientBalance();

        // Zero the donor balance before calling the donor contract.
        donations[id][msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Refunded(id, msg.sender, amount);
    }

    function getCampaignCount() external view returns (uint256) {
        return campaignCount;
    }

    function _campaign(uint256 id)
        private
        view
        returns (Campaign storage campaign)
    {
        if (id >= campaignCount) revert InvalidCampaign(id);
        campaign = campaigns[id];
    }
}
