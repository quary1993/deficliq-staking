// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract CliqStaking is AccessControl {
    using SafeMath for uint256;

    string public constant name = "Cliq Staking Contract";

    // we can improve this with a "unstaked:false" flag when the user force withdraws the funds
    // so he can collect the reward later
    struct Stake {
        uint256 _amount;
        uint256 _timestamp;
        bytes32 _packageName;
        uint256 _withdrawnTimestamp;
        uint16 _stakeRewardType; // 0 for native coin reward, 1 for CLIQ stake reward
    }

    struct YieldType {
        bytes32 _packageName;
        uint256 _daysLocked;
        uint256 _packageInterest;
        uint256 _packageCliqReward; // the number of cliq token received for each native token staked
    }

    IERC20 public tokenContract;
    IERC20 public CLIQ;

    bytes32[] public packageNames;
    uint256 decimals = 18;
    mapping(bytes32 => YieldType) public packages;
    mapping(address => uint256) public totalStakedBalance;
    mapping(address => Stake[]) public stakes;
    mapping(address => bool) public hasStaked;
    address private owner;
    address[] stakers;
    uint256 rewardProviderTokenAllowance = 0;
    uint256 public totalStakedFunds = 0;
    uint256 cliqRewardUnits = 1000000; // ciq reward for 1.000.000 tokens staked
    bytes32 public constant REWARD_PROVIDER = keccak256("REWARD_PROVIDER"); // i upgraded solc and used REWARD_PROVIDER instead of whitelist role and DEFAULT_ADMIN_ROLE instead of whiteloist admin

    event NativeTokenRewardAdded(address indexed _from, uint256 _val);
    event NativeTokenRewardRemoved(address indexed _to, uint256 _val);
    event StakeAdded(
        address indexed _usr,
        bytes32 _packageName,
        uint256 _amount,
        uint16 _stakeRewardType,
        uint256 _stakeIndex
    );
    event Unstaked(address indexed _usr, uint256 stakeIndex);
    event ForcefullyWithdrawn(address indexed _usr, uint256 stakeIndex);
    event FundsParked(
        address indexed _usr,
        address indexed _token,
        uint256 _amount
    );
    event ETHParked(address indexed _usr, uint256 _amount);

    modifier onlyRewardProvider() {
        require(
            hasRole(REWARD_PROVIDER, _msgSender()),
            "caller does not have the REWARD_PROVIDER role"
        );
        _;
    }

    modifier onlyMaintainer() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "caller does not have the Maintainer role"
        );
        _;
    }

    constructor(address _stakedToken, address _CLIQ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        tokenContract = IERC20(_stakedToken);
        CLIQ = IERC20(_CLIQ);
        //define packages here
        _definePackage("Silver Package", 30, 8, 1000000); // in 30 days you receive: 15% of staked token OR 1 cliq for 1 token staked
        _definePackage("Gold Package", 60, 18, 1500000); // 1.5 cliq for 1 token staked
        _definePackage("Platinum Package", 90, 30, 2000000); // 2 cliq for 1 token staked
    }

    function stakesLength(address _address) external view returns (uint256) {
        return stakes[_address].length;
    }

    function packageLength() external view returns (uint256) {
        return packageNames.length;
    }

    function stakeTokens(
        uint256 _amount,
        bytes32 _packageName,
        uint16 _stakeRewardType
    ) public {
        require(_amount > 0, " stake a positive number of tokens ");
        require(
            packages[_packageName]._daysLocked > 0,
            "there is no staking package with the declared name, or the staking package is poorly formated"
        );
        require(
            _stakeRewardType == 0 || _stakeRewardType == 1,
            "reward type not known: 0 is native token, 1 is CLIQ"
        );

        //add to stake sum of address
        totalStakedBalance[msg.sender] = totalStakedBalance[msg.sender].add(
            _amount
        );

        //add to stakes
        Stake memory currentStake;
        currentStake._amount = _amount;
        currentStake._timestamp = block.timestamp;
        currentStake._packageName = _packageName;
        currentStake._stakeRewardType = _stakeRewardType;
        stakes[msg.sender].push(currentStake);

        //if user is not declared as a staker, push him into the staker array
        if (!hasStaked[msg.sender]) {
            stakers.push(msg.sender);
        }

        //update the bool mapping of past and current stakers
        hasStaked[msg.sender] = true;
        totalStakedFunds = totalStakedFunds.add(_amount);

        //transfer from (need allowance)
        tokenContract.transferFrom(msg.sender, address(this), _amount);

        StakeAdded(
            msg.sender,
            _packageName,
            _amount,
            _stakeRewardType,
            stakes[msg.sender].length - 1
        );
    }

    function checkStakeReward(address _address, uint256 stakeIndex)
        public
        view
        returns (uint256)
    {
        require(
            stakes[_address][stakeIndex]._stakeRewardType == 0,
            "use checkStakeCliqReward for stakes accumulating reward in CLIQ"
        );

        uint256 currentTime = block.timestamp;
        if (stakes[_address][stakeIndex]._withdrawnTimestamp != 0) {
            currentTime = stakes[_address][stakeIndex]._withdrawnTimestamp;
        }

        uint256 stakingTime = stakes[_address][stakeIndex]._timestamp;
        uint256 daysLocked =
            packages[stakes[_address][stakeIndex]._packageName]._daysLocked;
        uint256 packageInterest =
            packages[stakes[_address][stakeIndex]._packageName]
                ._packageInterest;

        uint256 timeDiff = currentTime.sub(stakingTime);
        require(
            timeDiff >= 0,
            "Staking time cannot be later than current time"
        );

        uint256 yieldPeriods = timeDiff.div(daysLocked); // the _days is in seconds for now so can fucking test stuff

        uint256 yieldReward = 0;
        uint256 totalStake = stakes[_address][stakeIndex]._amount;

        // for each period of days defined in the package, compound the interest
        while (yieldPeriods > 0) {
            uint256 currentReward = totalStake.mul(packageInterest).div(100);

            totalStake = totalStake.add(currentReward);

            yieldReward = yieldReward.add(currentReward);

            yieldPeriods--;
        }

        return yieldReward;
    }

    function checkStakeCliqReward(address _address, uint256 stakeIndex)
        public
        view
        returns (uint256)
    {
        require(
            stakes[_address][stakeIndex]._stakeRewardType == 1,
            "use checkStakeReward for stakes accumulating reward in the Native Token"
        );

        uint256 currentTime = block.timestamp;
        if (stakes[_address][stakeIndex]._withdrawnTimestamp != 0) {
            currentTime = stakes[_address][stakeIndex]._withdrawnTimestamp;
        }

        uint256 stakingTime = stakes[_address][stakeIndex]._timestamp;
        uint256 daysLocked =
            packages[stakes[_address][stakeIndex]._packageName]._daysLocked;
        uint256 packageCliqInterest =
            packages[stakes[_address][stakeIndex]._packageName]
                ._packageCliqReward;

        uint256 timeDiff = currentTime.sub(stakingTime);
        require(
            timeDiff >= 0,
            "Staking time cannot be later than current time"
        );

        uint256 yieldPeriods = timeDiff.div(daysLocked); // the _days is in seconds for now so i can fucking test stuff

        uint256 yieldReward =
            stakes[_address][stakeIndex]._amount.mul(packageCliqInterest);

        yieldReward = yieldReward.div(cliqRewardUnits);

        yieldReward = yieldReward.mul(yieldPeriods);

        return yieldReward;
    }

    function unstake(uint256 stakeIndex) public {
        require(
            stakes[msg.sender][stakeIndex]._amount > 0,
            "The stake you are searching for is not defined"
        );
        require(
            stakes[msg.sender][stakeIndex]._withdrawnTimestamp == 0,
            "Stake already withdrawn"
        );

        // decrease total balance
        totalStakedFunds = totalStakedFunds.sub(
            stakes[msg.sender][stakeIndex]._amount
        );

        //decrease user total staked balance
        totalStakedBalance[msg.sender] = totalStakedBalance[msg.sender].sub(
            stakes[msg.sender][stakeIndex]._amount
        );

        //close the staking package (fix the withdrawn timestamp)
        stakes[msg.sender][stakeIndex]._withdrawnTimestamp = block.timestamp;

        if (stakes[msg.sender][stakeIndex]._stakeRewardType == 0) {
            uint256 reward = checkStakeReward(msg.sender, stakeIndex);

            require(
                rewardProviderTokenAllowance > reward,
                "Token creators did not place enough liquidity in the contract for your reward to be paid"
            );

            rewardProviderTokenAllowance = rewardProviderTokenAllowance.sub(
                reward
            );

            uint256 totalStake =
                stakes[msg.sender][stakeIndex]._amount.add(reward);

            stakes[msg.sender][stakeIndex]._withdrawnTimestamp = block
                .timestamp;

            tokenContract.transfer(msg.sender, totalStake);
        } else if (stakes[msg.sender][stakeIndex]._stakeRewardType == 1) {
            uint256 cliqReward = checkStakeCliqReward(msg.sender, stakeIndex);

            require(
                CLIQ.balanceOf(address(this)) >= cliqReward,
                "the isn't enough CLIQ in this contract to pay your reward right now"
            );

            CLIQ.transfer(msg.sender, cliqReward);
            tokenContract.transfer(
                msg.sender,
                stakes[msg.sender][stakeIndex]._amount
            );
        } else {
            revert();
        }

        emit Unstaked(msg.sender, stakeIndex);
    }

    function forceWithdraw(uint256 stakeIndex) public {
        require(
            stakes[msg.sender][stakeIndex]._amount > 0,
            "The stake you are searching for is not defined"
        );
        require(
            stakes[msg.sender][stakeIndex]._withdrawnTimestamp == 0,
            "Stake already withdrawn"
        );

        stakes[msg.sender][stakeIndex]._withdrawnTimestamp = block.timestamp;
        totalStakedFunds = totalStakedFunds.sub(
            stakes[msg.sender][stakeIndex]._amount
        );
        totalStakedBalance[msg.sender] = totalStakedBalance[msg.sender].sub(
            stakes[msg.sender][stakeIndex]._amount
        );

        tokenContract.transfer(
            msg.sender,
            stakes[msg.sender][stakeIndex]._amount
        );

        emit ForcefullyWithdrawn(msg.sender, stakeIndex);
    }

    function parkFunds(uint256 _parkedAmount, address tokenAddr)
        public
        onlyMaintainer
        returns (bool)
    {
        emit FundsParked(msg.sender, tokenAddr, _parkedAmount);
        return IERC20(tokenAddr).transfer(msg.sender, _parkedAmount);
    }

    function parkETH(uint256 _parkedAmount) public onlyMaintainer {
        emit ETHParked(msg.sender, _parkedAmount);
        msg.sender.transfer(_parkedAmount);
    }

    function addStakedTokenReward(uint256 _amount)
        public
        onlyRewardProvider
        returns (bool)
    {
        //transfer from (need allowance)
        rewardProviderTokenAllowance = rewardProviderTokenAllowance.add(
            _amount
        );
        tokenContract.transferFrom(msg.sender, address(this), _amount);

        emit NativeTokenRewardAdded(msg.sender, _amount);
        return true;
    }

    function removeStakedTokenReward(uint256 _amount)
        public
        onlyRewardProvider
        returns (bool)
    {
        require(
            _amount <= rewardProviderTokenAllowance,
            "you cannot withdraw this amount"
        );
        rewardProviderTokenAllowance = rewardProviderTokenAllowance.sub(
            _amount
        );
        tokenContract.transfer(msg.sender, _amount);
        emit NativeTokenRewardRemoved(msg.sender, _amount);
        return true;
    }

    function _definePackage(
        bytes32 _name,
        uint256 _days,
        uint256 _packageInterest,
        uint256 _packageCliqReward
    ) private {
        YieldType memory package;
        package._packageName = _name;
        package._daysLocked = _days;
        package._packageInterest = _packageInterest;
        package._packageCliqReward = _packageCliqReward;

        packages[_name] = package;
        packageNames.push(_name);
    }
}
