pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/access/roles/WhitelistedRole.sol";

contract CliqStaking is WhitelistedRole {
    using SafeMath for uint256;

    struct YieldType {
        bytes32 _packageName;
        uint256 _daysLocked;
        uint256 _packageInterest;
    }

    // we can improve this with a "unstaked:false" flag when the user force withdraws the funds
    // so he can collect the reward later
    struct Stake {
        uint256 _amount;
        uint256 _timestamp;
        bytes32 _packageName;
        uint256 _withdrawnTimestamp;
    }

    function toWei(uint256 num) private view returns (uint256) {
        return num * 10**decimals;
    }

    function definePackage(
        bytes32 _name,
        uint256 _days,
        uint256 _packageInterest
    ) private {
        YieldType memory package;
        package._packageName = _name;
        package._daysLocked = _days;
        package._packageInterest = _packageInterest;
        packages[_name] = package;
    }

    string public name = "Cliq Staking Contract";

    uint256 decimals = 18;

    mapping(bytes32 => YieldType) public packages;

    address private owner;
    IERC20 public tokenContract;

    address[] stakers;

    uint256 whitelistRoleTokenAllowance = 0;

    mapping(address => uint256) public totalStakedBalance;
    mapping(address => Stake[]) public stakes;
    mapping(address => bool) public hasStaked;
    uint256 public totalStakedFunds = 0;

    constructor(address _stakedToken) public {
        owner = msg.sender;
        tokenContract = IERC20(_stakedToken);
        //define packages here
        definePackage("Silver Package", 30, 8);
        definePackage("Gold Package", 60, 18);
        definePackage("Platinum Package", 90, 28);
    }

    function getAddrTokensBalance(address _address)
        private
        view
        returns (uint256 balance)
    {
        return tokenContract.balanceOf(_address);
    }

    function stakeTokens(uint256 _amount, bytes32 _packageName) public {
        require(_amount > 0, " stake a positive number of tokens ");
        require(
            packages[_packageName]._daysLocked > 0,
            "there is no staking package with the declared name, or the staking package is poorly formated"
        );

        //transfer from (need allowance)
        tokenContract.transferFrom(msg.sender, address(this), _amount);

        //add to stake sum of address
        totalStakedBalance[msg.sender] = totalStakedBalance[msg.sender].add(
            _amount
        );

        //add to stakes
        Stake memory currentStake;
        currentStake._amount = _amount;
        currentStake._timestamp = block.timestamp;
        currentStake._packageName = _packageName;
        stakes[msg.sender].push(currentStake);

        //if user is not declared as a staker, push him into the staker array
        if (!hasStaked[msg.sender]) {
            stakers.push(msg.sender);
        }

        //update the bool mapping of past and current stakers
        hasStaked[msg.sender] = true;
        totalStakedFunds = totalStakedFunds.add(_amount);
    }

    function checkStakeReward(address _address, uint256 stakeIndex)
        external
        view
        returns (uint256)
    {
        uint256 withdrawnTimestamp = block.timestamp;
        if (stakes[_address][stakeIndex]._withdrawnTimestamp != 0) {
            withdrawnTimestamp = stakes[_address][stakeIndex]
                ._withdrawnTimestamp;
        }

        return _checkStakeReward(_address, stakeIndex, withdrawnTimestamp);
    }

    function _checkStakeReward(
        address _address,
        uint256 stakeIndex,
        uint256 untilTimestamp
    ) private view returns (uint256) {
        require(
            stakes[_address][stakeIndex]._amount > 0,
            "The stake you are searching for is not defined"
        );
        uint256 currentTime = untilTimestamp;
        uint256 stakingTime = stakes[_address][stakeIndex]._timestamp;
        uint256 daysLocked = packages[stakes[_address][stakeIndex]._packageName]
            ._daysLocked;
        uint256 packageInterest = packages[stakes[_address][stakeIndex]
            ._packageName]
            ._packageInterest;

        uint256 timeDiff = currentTime.sub(stakingTime);
        require(timeDiff > 0, "Staking time cannot be later than current time");

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

    function unstake(uint256 stakeIndex) public {
        require(
            stakes[msg.sender][stakeIndex]._amount > 0,
            "The stake you are searching for is not defined"
        );
        require(
            stakes[msg.sender][stakeIndex]._withdrawnTimestamp == 0,
            "Stake already withdrawn"
        );

        uint256 reward = _checkStakeReward(
            msg.sender,
            stakeIndex,
            block.timestamp
        );

        require(
            whitelistRoleTokenAllowance > reward,
            "Token creators did not place enough liquidity in the contract for your reward to be paid"
        );

        whitelistRoleTokenAllowance = whitelistRoleTokenAllowance.sub(reward);

        uint256 totalStake = stakes[msg.sender][stakeIndex]._amount.add(reward);

        tokenContract.transfer(msg.sender, totalStake);
        stakes[msg.sender][stakeIndex]._withdrawnTimestamp = block.timestamp;
        totalStakedFunds = totalStakedFunds.sub(
            stakes[msg.sender][stakeIndex]._amount
        );
        totalStakedBalance[msg.sender] = totalStakedBalance[msg.sender].sub(
            stakes[msg.sender][stakeIndex]._amount
        );
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

        tokenContract.transfer(
            msg.sender,
            stakes[msg.sender][stakeIndex]._amount
        );
        stakes[msg.sender][stakeIndex]._withdrawnTimestamp = block.timestamp;
        totalStakedFunds = totalStakedFunds.sub(
            stakes[msg.sender][stakeIndex]._amount
        );
        totalStakedBalance[msg.sender] = totalStakedBalance[msg.sender].sub(
            stakes[msg.sender][stakeIndex]._amount
        );
    }

    function parkFunds(uint256 _parkedAmount)
        public
        onlyWhitelistAdmin
        returns (bool)
    {
        return tokenContract.transfer(msg.sender, _parkedAmount);
    }

    function addStakedTokenReward(uint256 _amount)
        public
        onlyWhitelisted
        returns (bool)
    {
        //transfer from (need allowance)
        tokenContract.transferFrom(msg.sender, address(this), _amount);
        whitelistRoleTokenAllowance = whitelistRoleTokenAllowance.add(_amount);
        return true;
    }

    function removeStakedTokenReward(uint256 _amount)
        public
        onlyWhitelisted
        returns (bool)
    {
        require(
            _amount <= whitelistRoleTokenAllowance,
            "you cannot withdraw this amount"
        );
        whitelistRoleTokenAllowance = whitelistRoleTokenAllowance.sub(_amount);
        tokenContract.transfer(msg.sender, _amount);
        return true;
    }
}
