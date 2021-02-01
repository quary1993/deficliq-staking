# deficliq-staking
staking smart contract for erc20 and CLIQ


# Smart Contract Description
The smart contract will do all the “behind the scenes” work, interacting with all actors: our maintainers, token owners and users. 
An instance of a contract allows users to stake an ERC20(referred to as native token from now on) and receive rewards either in the native token or in $CLIQ.
These actors are translated into contract roles, which are allowed to make specific actions.
# Roles
o  Whitelist Admin (Maintainer):
§  Can create other “whitelist admins” and “whitelist roles”
§  Can pause the contract
o   Whitelist Role (Token Owner):
§  Can add/remove coins in reward pools ( the whitelist role isn’t allowed to remove staked coins. The whitelist role can only remove from the reward pool )
o   User (publicly available):
§  Can add coins in a staking package
§  Can withdraw coins and reward from staking package
§  Can check balance in staking package


# Contract Functions
READ functions and public variables:
1.	Name (name of the contract)
2.	totalStakedFunds (total of the funds staked in the contract, excluding rewards)
3.	CLIQ (address of the $CLIQ contract)
4.	packageLength (the length of the array containing the reward packages available in the contract)
5.	isWhitelisted (checks if address has the Whitelist Role)
6.	isWhitelistAdmin (checks if address has the Whitelist Admin Role)
7.	stakesLength (returns the number of stakes belonging to an address)
8.	getStakes (returns information about a stake, queried by address and stake index)
9.	tokenContract (the address of the native token contract)
10.	stakes (mapping of address to stakes array)
11.	checkStakeReward ( returns the amount of native token that was accumulated for a stake. Throws an error if the reward was chosen to be in CLIQ )
12.	checkStakeCliqReward ( returns the amount of CLIQ that was accumulated for a stake. Throws an error if the reward was chosen to be in native token )
13.	packages (mapping of names to “YieldType”)
14.	packageNames (returns the name of the package by index)
15.	totalStakedBalance (returns the staked balance of the address)
16.	hasStaked (returns true if the address has staked in the contract)

Write functions:

Callable ONLY by whitelist admin:
1.	addWhitelisted ( ads a whitelistRole to an address)
2.	removeWhitelisted ( removes a whitelistRole of an address) 
3.	renounceWhitelistAdmin (renounces WhitelistAdmin role of self)
4.	addWhitelistAdmin ( ads a whitelistAdmin role to an address)

Callable by whitelist role:
1.	addStakedTokenReward ( ads native token reward to contract )
2.	removeStakedTokenReward (removes from the reward pool)
3.	renounceWhitelisted ( renounces self role )

Callable publicly:
1.	stakeTokens ( stakes an “amount” of funds in a “package”, choosing the type of reward ( 0 = nativeToken, 1=$CLIQ )
2.	unstake ( unstakes and retrieves the reward )
3.	forceWithdraw ( in case the reward is insufficient, the unstake function will return an error. If that happens, users can still force withdraw their stake, without getting the reward )

# Staking Mechanism
# 1. Staking Packages
  Staking packages are defined in the constructor of the smart contract. The staking packages have the following components:
  - name
  - days (the number of days which represents the period on which the declared interest of the package is accrued)
  - percentual interest for the duration specified by the package (i.e. 5%)
  - amount of $CLIQ received for each 1.000.000 tokens staked (i.e. 1.000.000 means that for each token, at the end of the staking period, user receives 1 $CLIQ)
  
 # 2. Staking Mechanism
There are two types of rewards for the staked funds, accruing different interests:
1. Reward in the Native Token. When choosing to stake tokens and receive the reward in the native token, users accumulate rewards which compound. The unstake function will calculate the compounded interest and return the whole amount (stake + compounded reward) to the user. 
2. Reward in $CLIQ Token. When choosing to stake tokens and receive the reward in $CLIQ, the user will receive the declared (in the package) amount of $CLIQ for each 1.000.000 staked native tokens. The unstake function returns the amount staked + the number of $CLIQ accumulated during the staking time.

# 3. Examples
Given the following packages:

definePackage("Silver Package", 30, 8, 1000000); 
definePackage("Gold Package", 60, 18, 1500000);

If the user stakes 100$TOKEN in the Gold Package, opting to receive reward in $TOKEN, the user will receive 18% of the staked amount each 60 days. This staked amount compounds, such that after 120 days, the user receives 139.24$TOKEN, when calling the unstake function, instead of just 136$TOKEN. 

If the user stakes 100$TOKEN in the Silver Package, opting to receive reward in $CLIQ, the user will receive 1.000.000 $CLIQ for each 1.000.000 $TOKEN staked after each 30 day period. This amount doesn't compund, so in our example, each 30 days, 100$CLIQ is added to the user reward and will be claimed when unstaking.

# 4. Particularities of the contract at hand
1. The contract present on git uses $CLIQ as native token.
