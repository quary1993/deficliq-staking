const CliqStaking = artifacts.require("CliqStaking");
const CLIQ = artifacts.require("CLIQ");
const ERC20Mock = artifacts.require("ERC20Mock");

const {
  expectEvent,
  expectRevert,
  time,
  send,
  balance,
  BN,
} = require("@openzeppelin/test-helpers");

const Web3 = require("web3");
const web3 = new Web3();

const { use, expect } = require("chai");
use(require("chai-bn")(BN));
use(require("chai-datetime"));

const REWARD_PROVIDER = web3.utils.keccak256("REWARD_PROVIDER");
const DEFAULT_ADMIN_ROLE = "0x00";

const SILVER = unpack("Silver Package");
const GOLD = unpack("Gold Package");
const PLATINUM = unpack("Platinum Package");

const wei = web3.utils.toWei;

function unpack(str) {
  let buf = Buffer.from(str);
  strBytes = "";
  for (var i = 0; i < buf.length; i++) strBytes += buf[i].toString(16);

  while (strBytes.length < 64) strBytes += "0";

  return "0x" + strBytes;
}

contract("CliqStaking", ([owner, user1, user2, user3, rewardProvider]) => {
  let cliqStaking;
  let tokenIris;
  let tokenCliq;

  beforeEach(async () => {
    tokenCliq = await CLIQ.new(
      "Cliq",
      "ERCC",
      "18",
      wei("10000000"),
      "10000000"
    );
    tokenIris = await ERC20Mock.new("Iris", "ERCI");

    cliqStaking = await CliqStaking.new(tokenIris.address, tokenCliq.address);

    await tokenIris.mint(user1, wei("2000000"));
    await tokenIris.mint(user2, wei("2000000"));
    await tokenIris.mint(user3, wei("2000000"));
    await tokenIris.mint(rewardProvider, wei("2000000"));

    await cliqStaking.grantRole(REWARD_PROVIDER, rewardProvider);
  });

  describe("check basic init", () => {
    it("has a name", async () => {
      expect(await cliqStaking.NAME()).to.equal("Cliq Staking Contract");
    });

    it("has a totalStakedFunds", async () => {
      expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal("0");
    });

    it("has a REWARD_PROVIDER", async () => {
      expect(await cliqStaking.REWARD_PROVIDER()).to.be.equal(REWARD_PROVIDER);
    });

    describe("check constructor", () => {
      it("should set a staked token", async () => {
        expect((await cliqStaking.tokenContract()).toString()).to.be.equal(
          tokenIris.address
        );
      });

      it("should set a Cliq token", async () => {
        expect((await cliqStaking.CLIQ()).toString()).to.be.equal(
          tokenCliq.address
        );
      });

      it("should set a role", async () => {
        expect(
          await cliqStaking.hasRole(DEFAULT_ADMIN_ROLE, owner)
        ).to.be.equal(true);
      });

      describe("should define packages", () => {
        it("should set 3 packages", async () => {
          expect(await cliqStaking.packageLength()).to.be.a.bignumber.equal(
            "3"
          );
        });

        describe("Silver Package", () => {
          let nameOfPackage;
          let package;

          before(async () => {
            nameOfPackage = await cliqStaking.packageNames(0);
            package = await cliqStaking.packages(nameOfPackage);
          });

          it("has a name", async () => {
            expect(package._packageName).to.be.equal(unpack("Silver Package"));
          });

          it("has a days period", () => {
            expect(package._daysLocked).to.be.a.bignumber.equal("30");
          });

          it("has a days blocked", () => {
            expect(package._daysBlocked).to.be.a.bignumber.equal("15");
          });

          it("has a percentage interest", () => {
            expect(package._packageInterest).to.be.a.bignumber.equal("8");
          });

          it("has amount of Cliq for each 1mln tokens staked", () => {
            expect(package._packageCliqReward).to.be.a.bignumber.equal(
              "1000000"
            );
          });
        });

        describe("Gold Package", () => {
          let nameOfPackage;
          let package;

          before(async () => {
            nameOfPackage = await cliqStaking.packageNames(1);
            package = await cliqStaking.packages(nameOfPackage);
          });

          it("has a name", async () => {
            expect(package._packageName).to.be.equal(unpack("Gold Package"));
          });

          it("has a days period", () => {
            expect(package._daysLocked).to.be.a.bignumber.equal("60");
          });

          it("has a days blocked", () => {
            expect(package._daysBlocked).to.be.a.bignumber.equal("30");
          });

          it("has a percentage interest", () => {
            expect(package._packageInterest).to.be.a.bignumber.equal("18");
          });

          it("has amount of Cliq for each 1mln tokens staked", () => {
            expect(package._packageCliqReward).to.be.a.bignumber.equal(
              "1500000"
            );
          });
        });

        describe("Platinum Package", () => {
          let nameOfPackage;
          let package;

          before(async () => {
            nameOfPackage = await cliqStaking.packageNames(2);
            package = await cliqStaking.packages(nameOfPackage);
          });

          it("has a name", async () => {
            expect(package._packageName).to.be.equal(
              unpack("Platinum Package")
            );
          });

          it("has a days period", () => {
            expect(package._daysLocked).to.be.a.bignumber.equal("90");
          });

          it("has a days blocked", () => {
            expect(package._daysBlocked).to.be.a.bignumber.equal("45");
          });

          it("has a percentage interest", () => {
            expect(package._packageInterest).to.be.a.bignumber.equal("30");
          });

          it("has amount of Cliq for each 1mln tokens staked", () => {
            expect(package._packageCliqReward).to.be.a.bignumber.equal(
              "2000000"
            );
          });
        });
      });
    });
  });

  describe("Functions", () => {
    describe("stakesLength", () => {
      it("should return correct stakes length", async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user1,
        });
        await cliqStaking.stakeTokens(wei("200"), SILVER, 0, { from: user1 });
        expect(await cliqStaking.stakesLength(user1)).to.be.a.bignumber.equal(
          "1"
        );

        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user1,
        });
        await cliqStaking.stakeTokens(wei("160"), PLATINUM, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("40"), GOLD, 0, { from: user1 });

        await tokenIris.approve(cliqStaking.address, wei("150"), {
          from: user2,
        });
        await cliqStaking.stakeTokens(wei("120"), SILVER, 0, { from: user2 });
        await cliqStaking.stakeTokens(wei("30"), PLATINUM, 0, { from: user2 });

        expect(await cliqStaking.stakesLength(user1)).to.be.a.bignumber.equal(
          "3"
        );
        expect(await cliqStaking.stakesLength(user2)).to.be.a.bignumber.equal(
          "2"
        );
      });
    });

    describe("packageLength", () => {
      it("should be a 3 packages", async () => {
        expect(await cliqStaking.packageLength()).to.be.a.bignumber.equal("3");
      });
    });

    describe("stakeTokens", () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user1,
        });
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user2,
        });
      });

      it('should revert staking on pause', async () => {
        await cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 });
        await cliqStaking.pauseStaking();

        await expectRevert(
          cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 }),
          "Staking is  paused"
        );
      });

      it("should revet if _amount !> 0", async () => {
        await expectRevert(
          cliqStaking.stakeTokens(0, SILVER, 0, { from: user1 }),
          " stake a positive number of tokens "
        );
      });

      it("should revert if no staking package", async () => {
        await expectRevert(
          cliqStaking.stakeTokens(wei("10"), REWARD_PROVIDER, 0, {
            from: user1,
          }),
          "there is no staking package with the declared name, or the staking package is poorly formated"
        );
      });

      it("should revert if stake reward type not known", async () => {
        await expectRevert(
          cliqStaking.stakeTokens(wei("10"), SILVER, 2, { from: user1 }),
          "reward type not known: 0 is native token, 1 is CLIQ"
        );
        await cliqStaking.stakeTokens(wei("10"), SILVER, 1, { from: user1 });
        await cliqStaking.stakeTokens(wei("10"), SILVER, 1, { from: user1 });
      });

      it("should add to totalStakedBalance", async () => {
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal("0");
        await cliqStaking.stakeTokens(wei("10"), SILVER, 0, { from: user1 });

        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("10"));

        await cliqStaking.stakeTokens(wei("5"), GOLD, 1, { from: user1 });
        await cliqStaking.stakeTokens(wei("15"), PLATINUM, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), GOLD, 1, { from: user2 });
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("30"));
      });

      it("should add to stakes", async () => {
        let timestamp = Math.floor(Date.now() / 1000);

        await cliqStaking.stakeTokens(wei("10"), SILVER, 0, { from: user1 });
        let stake = await cliqStaking.stakes(user1, 0);
        expect(stake._amount).to.be.a.bignumber.equal(wei("10"));
        expect(new Date(parseInt(stake._timestamp))).to.afterOrEqualDate(
          new Date(timestamp)
        );
        expect(stake._packageName).to.be.equal(SILVER);
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        expect(stake._stakeRewardType).to.be.a.bignumber.equal("0");

        await cliqStaking.stakeTokens(wei("20"), PLATINUM, 1, { from: user1 });
        stake = await cliqStaking.stakes(user1, 1);
        expect(stake._amount).to.be.a.bignumber.equal(wei("20"));
        expect(new Date(parseInt(stake._timestamp))).to.afterOrEqualDate(
          new Date(timestamp)
        );
        expect(stake._packageName).to.be.equal(PLATINUM);
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        expect(stake._stakeRewardType).to.be.a.bignumber.equal("1");

        expect(await cliqStaking.stakesLength(user1)).to.be.a.bignumber.equal(
          "2"
        );
      });

      it("should update hasStaked", async () => {
        expect(await cliqStaking.hasStaked(user1)).to.be.equal(false);
        await cliqStaking.stakeTokens(wei("10"), SILVER, 0, { from: user1 });
        expect(await cliqStaking.hasStaked(user1)).to.be.equal(true);
      });

      it("should transfer token", async () => {
        expect(
          await tokenIris.balanceOf(cliqStaking.address)
        ).to.be.a.bignumber.equal("0");
        expect(await tokenIris.balanceOf(user1)).to.be.a.bignumber.equal(
          wei("2000000")
        );
        await cliqStaking.stakeTokens(wei("100"), SILVER, 0, { from: user1 });

        expect(
          await tokenIris.balanceOf(cliqStaking.address)
        ).to.be.a.bignumber.equal(wei("100"));
        expect(await tokenIris.balanceOf(user1)).to.be.a.bignumber.equal(
          wei("1999900")
        );
      });

      it("should catch Transfer event", async () => {
        await cliqStaking.stakeTokens(wei("100"), SILVER, 0, { from: user1 });
        let logs = await tokenIris
          .getPastEvents("Transfer", { toBlock: "latest" })
          .then((events) => {
            return events;
          });

        expect(await logs[0].args["value"]).to.be.a.bignumber.equal(wei("100"));
      });

      it("should catch StakeAdded event", async () => {
        const { logs } = await cliqStaking.stakeTokens(wei("100"), SILVER, 0, {
          from: user1,
        });

        expectEvent.inLogs(logs, "StakeAdded", {
          _usr: user1,
          _packageName: SILVER,
          _amount: wei("100"),
          _stakeRewardType: "0",
          _stakeIndex: "0",
        });
      });
    });

    describe("checkStakeReward", () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user1,
        });
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user2,
        });

        await tokenIris.approve(cliqStaking.address, wei("2000000"), {
          from: rewardProvider,
        });
        await cliqStaking.addStakedTokenReward(wei("100"), {
          from: rewardProvider,
        });
      });

      it("should revert if reward type not Native token", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal("0");

        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user1 });
        await expectRevert(
          cliqStaking.checkStakeReward(user1, 1),
          "use checkStakeCliqReward for stakes accumulating reward in CLIQ"
        );
      });

      it("if it was unstaked, return reward for staked period", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(35));
        await cliqStaking.unstake(0, { from: user1 });

        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("4"));
        await time.increase(time.duration.days(35));
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("4"));
      });

      it("should calculate reward correctly", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("20"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("10"), GOLD, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("40"), PLATINUM, 0, { from: user1 });

        await time.increase(time.duration.days(29));
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal("0");
        await time.increase(time.duration.days(1));
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("4"));
        await time.increase(time.duration.days(30));
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("8.32"));
        await time.increase(time.duration.days(90));
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.closeTo(wei("23.4664"), wei("0.001"));

        expect(
          (await cliqStaking.checkStakeReward(user1, 1)).yieldReward
        ).to.be.a.bignumber.closeTo(wei("9.386"), wei("0.001"));

        expect(
          (await cliqStaking.checkStakeReward(user1, 2)).yieldReward
        ).to.be.a.bignumber.closeTo(wei("3.924"), wei("0.0001"));

        expect(
          (await cliqStaking.checkStakeReward(user1, 3)).yieldReward
        ).to.be.a.bignumber.closeTo(wei("12"), wei("0.0001"));
      });

      it("if it was unstaked return staked period", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(35));
        await cliqStaking.unstake(0, { from: user1 });

        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("35");
        await time.increase(time.duration.days(45));
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("35");
      });

      it("should calculate timeDiff correctly", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(33));

        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("33");
        await time.increase(time.duration.days(28));
        expect(
          (await cliqStaking.checkStakeReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("61");
      });
    });

    describe("checkStakeCliqReward", () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user1,
        });
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user2,
        });

        await tokenCliq.transfer(cliqStaking.address, wei("2000000"));
      });

      it("should revert if reward type not CLIQ token", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user1 });
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal("0");

        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await expectRevert(
          cliqStaking.checkStakeCliqReward(user1, 1),
          "use checkStakeReward for stakes accumulating reward in the Native Token"
        );
      });

      it("if it was unstaked return reward for staked period", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user1 });
        await time.increase(time.duration.days(35));
        await cliqStaking.unstake(0, { from: user1 });

        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("50"));
        await time.increase(time.duration.days(35));
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("50"));
      });

      it("should calculate reward correctly", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user1 });
        await cliqStaking.stakeTokens(wei("20"), SILVER, 1, { from: user1 });
        await cliqStaking.stakeTokens(wei("10"), GOLD, 1, { from: user1 });
        await cliqStaking.stakeTokens(wei("40"), PLATINUM, 1, { from: user1 });

        await time.increase(time.duration.days(29));
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal("0");
        await time.increase(time.duration.days(1));
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("50"));
        await time.increase(time.duration.days(30));
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("100"));
        await time.increase(time.duration.days(90));
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).yieldReward
        ).to.be.a.bignumber.equal(wei("250"));

        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 1)).yieldReward
        ).to.be.a.bignumber.equal(wei("100"));

        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 2)).yieldReward
        ).to.be.a.bignumber.equal(wei("30"));

        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 3)).yieldReward
        ).to.be.a.bignumber.equal(wei("80"));
      });

      it("if it was unstaked, return staked period", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user1 });
        await time.increase(time.duration.days(35));
        await cliqStaking.unstake(0, { from: user1 });

        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("35");
        await time.increase(time.duration.days(45));
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("35");
      });

      it("should calculate timeDiff correctly", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user1 });
        await time.increase(time.duration.days(33));

        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("33");
        await time.increase(time.duration.days(28));
        expect(
          (await cliqStaking.checkStakeCliqReward(user1, 0)).timeDiff
        ).to.be.a.bignumber.equal("61");
      });
    });

    describe("unstake", () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("20000"), {
          from: user1,
        });
        await tokenIris.approve(cliqStaking.address, wei("20000"), {
          from: user2,
        });

        await tokenIris.approve(cliqStaking.address, wei("2000000"), {
          from: rewardProvider,
        });
        await cliqStaking.addStakedTokenReward(wei("100"), {
          from: rewardProvider,
        });

        await tokenCliq.transfer(cliqStaking.address, wei("2000"));
      });
      //! FAILED, ERR: invalid opcode
      it("should revert if stake not defined", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user2 });

        await expectRevert(
          cliqStaking.unstake(1, { from: user1 }),
          "The stake you are searching for is not defined"
        );

        await expectRevert(
          cliqStaking.unstake(1, { from: user2 }),
          "The stake you are searching for is not defined"
        );

        await time.increase(time.duration.days(45));

        await cliqStaking.unstake(0, { from: user1 });
        await cliqStaking.unstake(0, { from: user2 });
      });

      it("should revert if stake already withdrawn ", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user2 });
        await time.increase(time.duration.days(45));

        await cliqStaking.unstake(0, { from: user1 });
        await cliqStaking.unstake(0, { from: user2 });

        await expectRevert(
          cliqStaking.unstake(0, { from: user1 }),
          "Stake already withdrawn"
        );

        await expectRevert(
          cliqStaking.unstake(0, { from: user2 }),
          "Stake already withdrawn"
        );
      });

      it("should decrease total balance", async () => {
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          "0"
        );
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("30"), GOLD, 1, { from: user2 });
        await cliqStaking.stakeTokens(wei("60"), PLATINUM, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(100));

        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("190")
        );
        await cliqStaking.unstake(0, { from: user1 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("140")
        );

        await cliqStaking.unstake(0, { from: user2 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("110")
        );

        await cliqStaking.unstake(1, { from: user1 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("50")
        );

        await cliqStaking.unstake(2, { from: user1 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("0")
        );
      });

      it("should decrease user total staked balance", async () => {
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal("0");
        expect(
          await cliqStaking.totalStakedBalance(user2)
        ).to.be.a.bignumber.equal("0");

        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("30"), GOLD, 1, { from: user2 });
        await cliqStaking.stakeTokens(wei("60"), PLATINUM, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(100));

        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("160"));
        expect(
          await cliqStaking.totalStakedBalance(user2)
        ).to.be.a.bignumber.equal(wei("30"));

        await cliqStaking.unstake(0, { from: user1 });
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("110"));

        await cliqStaking.unstake(0, { from: user2 });
        expect(
          await cliqStaking.totalStakedBalance(user2)
        ).to.be.a.bignumber.equal(wei("0"));

        await cliqStaking.unstake(1, { from: user1 });
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("50"));

        await cliqStaking.unstake(2, { from: user1 });
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("0"));
      });

      it("should close the staking package(set _withdrawnTimestamp)", async () => {
        let stake;
        let timestamp = new Date(Math.floor(Date.now() / 1000));

        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 0);
        await time.increase(time.duration.days(31));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.unstake(0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 0);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);

        await cliqStaking.stakeTokens(wei("30"), GOLD, 1, { from: user2 });
        stake = await cliqStaking.stakes(user2, 0);
        await time.increase(time.duration.days(61));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.unstake(0, { from: user2 });
        stake = await cliqStaking.stakes(user2, 0);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);

        await cliqStaking.stakeTokens(wei("60"), PLATINUM, 0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 1);
        await time.increase(time.duration.days(100));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.unstake(1, { from: user1 });
        stake = await cliqStaking.stakes(user1, 1);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);

        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 2);
        await time.increase(time.duration.days(31));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.unstake(2, { from: user1 });
        stake = await cliqStaking.stakes(user1, 2);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);
      });

      describe("reward type Native token", () => {
        it("should revert if not enough liquidity", async () => {
          await cliqStaking.stakeTokens(wei("5000"), SILVER, 0, {
            from: user1,
          });
          await time.increase(time.duration.days(31));

          await expectRevert(
            cliqStaking.unstake(0, { from: user1 }),
            "Token creators did not place enough liquidity in the contract for your reward to be paid"
          );
        });
        //! FAILED, ERR: cannot unstake sooner than the blocked time time
        it("should revert if try to unstake sooner than the blocked time", async () => {
          await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
          await time.increase(time.duration.days(6));

          await expectRevert(
            cliqStaking.unstake(0, { from: user1 }),
            "cannot unstake sooner than the blocked time time"
          );

          await time.increase(time.duration.days(10));
          await cliqStaking.unstake(0, { from: user1 });
        });

        it("should decrease reward pool", async () => {
          // reward pool 100, lets decrease on 80
          await cliqStaking.stakeTokens(wei("1000"), SILVER, 0, {
            from: user1,
          });
          await time.increase(time.duration.days(31));
          await cliqStaking.unstake(0, { from: user1 });
          // now reward pool should be 20, lets try to get 40 tokens as reward, should fail

          await cliqStaking.stakeTokens(wei("500"), SILVER, 0, { from: user1 });
          await time.increase(time.duration.days(31));
          await expectRevert(
            cliqStaking.unstake(1, { from: user1 }),
            "Token creators did not place enough liquidity in the contract for your reward to be paid"
          );
        });

        it("should transfer staked amount + reward", async () => {
          await cliqStaking.stakeTokens(wei("100"), SILVER, 0, { from: user1 });
          await time.increase(time.duration.days(31));
          await cliqStaking.unstake(0, { from: user1 });

          let logs = await tokenIris
            .getPastEvents("Transfer", { toBlock: "latest" })
            .then((events) => {
              return events;
            });

          expect(await logs[0].args["value"]).to.be.a.bignumber.equal(
            wei("108")
          );
        });

        it("should catch Unstaked event", async () => {
          await cliqStaking.stakeTokens(wei("100"), SILVER, 0, { from: user1 });
          await cliqStaking.stakeTokens(wei("200"), SILVER, 0, { from: user1 });

          await time.increase(time.duration.days(31));

          const { logs } = await cliqStaking.unstake(1, { from: user1 });

          expectEvent.inLogs(logs, "Unstaked", {
            _usr: user1,
            stakeIndex: "1",
          });
        });
      });

      describe("reward type CLIQ token", () => {
        it("should revert if not enough liquidity", async () => {
          await cliqStaking.stakeTokens(wei("5000"), SILVER, 1, {
            from: user1,
          });
          await time.increase(time.duration.days(31));

          await expectRevert(
            cliqStaking.unstake(0, { from: user1 }),
            "the isn't enough CLIQ in this contract to pay your reward right now"
          );
        });
        //! FAILED, ERR: cannot unstake sooner than the blocked time time
        it("should revert if try to unstake sooner than the blocked time", async () => {
          await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
          await time.increase(time.duration.days(6));

          await expectRevert(
            cliqStaking.unstake(0, { from: user1 }),
            "cannot unstake sooner than the blocked time time"
          );

          await time.increase(time.duration.days(10));
          await cliqStaking.unstake(0, { from: user1 });
        });

        it("should decrease reward pool", async () => {
          expect(
            await tokenCliq.balanceOf(cliqStaking.address)
          ).to.be.a.bignumber.equal(wei("2000"));
          // reward pool 2000 CLIQ, lets decrease on 500
          await cliqStaking.stakeTokens(wei("500"), SILVER, 1, { from: user1 });
          await time.increase(time.duration.days(31));
          await cliqStaking.unstake(0, { from: user1 });
          expect(
            await tokenCliq.balanceOf(cliqStaking.address)
          ).to.be.a.bignumber.equal(wei("1500"));
        });

        it("should transfer staked amount + reward", async () => {
          await cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 });
          await time.increase(time.duration.days(61));
          await cliqStaking.unstake(0, { from: user1 });

          let logs = await tokenCliq
            .getPastEvents("Transfer", { toBlock: "latest" })
            .then((events) => {
              return events;
            });

          expect(await logs[0].args["value"]).to.be.a.bignumber.equal(
            wei("120")
          );

          logs = await tokenIris
            .getPastEvents("Transfer", { toBlock: "latest" })
            .then((events) => {
              return events;
            });

          expect(await logs[0].args["value"]).to.be.a.bignumber.equal(
            wei("80")
          );
        });

        it("should catch Unstaked event", async () => {
          await cliqStaking.stakeTokens(wei("100"), SILVER, 1, { from: user1 });
          await time.increase(time.duration.days(31));

          const { logs } = await cliqStaking.unstake(0, { from: user1 });

          expectEvent.inLogs(logs, "Unstaked", {
            _usr: user1,
            stakeIndex: "0",
          });
        });
      });
    });

    describe("forceWithdraw", () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("20000"), {
          from: user1,
        });
        await tokenIris.approve(cliqStaking.address, wei("20000"), {
          from: user2,
        });

        await tokenIris.approve(cliqStaking.address, wei("2000000"), {
          from: rewardProvider,
        });
        await cliqStaking.addStakedTokenReward(wei("100"), {
          from: rewardProvider,
        });

        await tokenCliq.transfer(cliqStaking.address, wei("2000"));
      });
      //! FAILED, ERR: invalid opcode
      it("should revert if stake not defined", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user2 });

        await expectRevert(
          cliqStaking.forceWithdraw("1", { from: user1 }),
          "The stake you are searching for is not defined"
        );

        await expectRevert(
          cliqStaking.forceWithdraw("1", { from: user2 }),
          "The stake you are searching for is not defined"
        );

        await time.increase(time.duration.days(16));

        await cliqStaking.forceWithdraw(0, { from: user1 });
        await cliqStaking.forceWithdraw(0, { from: user2 });
      });

      it("should revert if stake already withdrawn", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 1, { from: user2 });
        await time.increase(time.duration.days(31));

        await cliqStaking.unstake(0, { from: user1 });
        await cliqStaking.unstake(0, { from: user2 });

        await expectRevert(
          cliqStaking.forceWithdraw(0, { from: user1 }),
          "Stake already withdrawn"
        );

        await expectRevert(
          cliqStaking.forceWithdraw(0, { from: user2 }),
          "Stake already withdrawn"
        );
      });

      it("should close the staking package(set _withdrawnTimestamp)", async () => {
        let stake;
        let timestamp = new Date(Math.floor(Date.now() / 1000));

        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 0);
        await time.increase(time.duration.days(31));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.forceWithdraw(0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 0);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);

        await cliqStaking.stakeTokens(wei("30"), GOLD, 1, { from: user2 });
        stake = await cliqStaking.stakes(user2, 0);
        await time.increase(time.duration.days(61));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.forceWithdraw(0, { from: user2 });
        stake = await cliqStaking.stakes(user2, 0);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);

        await cliqStaking.stakeTokens(wei("60"), PLATINUM, 0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 1);
        await time.increase(time.duration.days(100));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.forceWithdraw(1, { from: user1 });
        stake = await cliqStaking.stakes(user1, 1);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);

        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        stake = await cliqStaking.stakes(user1, 2);
        await time.increase(time.duration.days(31));
        expect(stake._withdrawnTimestamp).to.be.a.bignumber.equal("0");
        await cliqStaking.forceWithdraw(2, { from: user1 });
        stake = await cliqStaking.stakes(user1, 2);
        expect(
          new Date(parseInt(stake._withdrawnTimestamp))
        ).to.afterOrEqualDate(timestamp);
      });

      it("should decrease total balance", async () => {
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          "0"
        );
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("30"), GOLD, 1, { from: user2 });
        await cliqStaking.stakeTokens(wei("60"), PLATINUM, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(100));

        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("190")
        );
        await cliqStaking.forceWithdraw(0, { from: user1 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("140")
        );

        await cliqStaking.forceWithdraw(0, { from: user2 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("110")
        );

        await cliqStaking.forceWithdraw(1, { from: user1 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("50")
        );

        await cliqStaking.forceWithdraw(2, { from: user1 });
        expect(await cliqStaking.totalStakedFunds()).to.be.a.bignumber.equal(
          wei("0")
        );
      });

      it("should decrease user total staked balance", async () => {
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal("0");
        expect(
          await cliqStaking.totalStakedBalance(user2)
        ).to.be.a.bignumber.equal("0");

        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("30"), GOLD, 1, { from: user2 });
        await cliqStaking.stakeTokens(wei("60"), PLATINUM, 0, { from: user1 });
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(100));

        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("160"));
        expect(
          await cliqStaking.totalStakedBalance(user2)
        ).to.be.a.bignumber.equal(wei("30"));

        await cliqStaking.forceWithdraw(0, { from: user1 });
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("110"));

        await cliqStaking.forceWithdraw(0, { from: user2 });
        expect(
          await cliqStaking.totalStakedBalance(user2)
        ).to.be.a.bignumber.equal(wei("0"));

        await cliqStaking.forceWithdraw(1, { from: user1 });
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("50"));

        await cliqStaking.forceWithdraw(2, { from: user1 });
        expect(
          await cliqStaking.totalStakedBalance(user1)
        ).to.be.a.bignumber.equal(wei("0"));
      });

      //! FAILED, ERR: cannot unstake sooner than the blocked time time
      it("should revert if try to forceWithdraw sooner than the blocked time", async () => {
        await cliqStaking.stakeTokens(wei("50"), SILVER, 0, { from: user1 });
        await time.increase(time.duration.days(6));

        await expectRevert(
          cliqStaking.forceWithdraw(0, { from: user1 }),
          "cannot unstake sooner than the blocked time time"
        );

        await time.increase(time.duration.days(10));
        await cliqStaking.forceWithdraw(0, { from: user1 });
      });

      it("should transfer staked amount", async () => {
        await cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 });
        await time.increase(time.duration.days(61));
        await cliqStaking.forceWithdraw(0, { from: user1 });

        logs = await tokenIris
          .getPastEvents("Transfer", { toBlock: "latest" })
          .then((events) => {
            return events;
          });

        expect(await logs[0].args["value"]).to.be.a.bignumber.equal(wei("80"));
      });

      it("should catch ForcefullyWithdrawn event", async () => {
        await cliqStaking.stakeTokens(wei("100"), SILVER, 1, { from: user1 });
        await time.increase(time.duration.days(31));

        const { logs } = await cliqStaking.forceWithdraw(0, { from: user1 });

        expectEvent.inLogs(logs, "ForcefullyWithdrawn", {
          _usr: user1,
          stakeIndex: "0",
        });
      });
    });

    // describe("parkFunds", () => {
    //   it("only owner can park Funds", async () => {
    //     expect(
    //       await tokenIris.balanceOf(cliqStaking.address)
    //     ).to.be.a.bignumber.equal("0");
    //     expect(
    //       await tokenCliq.balanceOf(cliqStaking.address)
    //     ).to.be.a.bignumber.equal("0");

    //     await tokenIris.transfer(cliqStaking.address, wei("4"));
    //     await tokenCliq.transfer(cliqStaking.address, wei("4"));

    //     let ownerBalanceIris = await tokenIris.balanceOf(owner);
    //     let ownerBalanceCLIQ = await tokenCliq.balanceOf(owner);

    //     expect(
    //       await tokenIris.balanceOf(cliqStaking.address)
    //     ).to.be.a.bignumber.equal(wei("4"));
    //     expect(
    //       await tokenCliq.balanceOf(cliqStaking.address)
    //     ).to.be.a.bignumber.equal(wei("4"));

    //     await expectRevert(
    //       cliqStaking.parkFunds(wei("2"), tokenIris.address, { from: user2 }),
    //       "caller does not have the Maintainer role"
    //     );
    //     await expectRevert(
    //       cliqStaking.parkFunds(wei("2"), tokenIris.address, {
    //         from: rewardProvider,
    //       }),
    //       "caller does not have the Maintainer role"
    //     );
    //     await cliqStaking.parkFunds(wei("2"), tokenIris.address);
    //     expect(
    //       await tokenIris.balanceOf(cliqStaking.address)
    //     ).to.be.a.bignumber.equal(wei("2"));
    //     expect(await tokenIris.balanceOf(owner)).to.be.a.bignumber.equal(
    //       ownerBalanceIris.add(new BN(wei("2")))
    //     );

    //     await expectRevert(
    //       cliqStaking.parkFunds(wei("2"), tokenCliq.address, { from: user2 }),
    //       "caller does not have the Maintainer role"
    //     );
    //     await expectRevert(
    //       cliqStaking.parkFunds(wei("2"), tokenCliq.address, {
    //         from: rewardProvider,
    //       }),
    //       "caller does not have the Maintainer role"
    //     );
    //     await cliqStaking.parkFunds(wei("2"), tokenCliq.address);
    //     expect(
    //       await tokenCliq.balanceOf(cliqStaking.address)
    //     ).to.be.a.bignumber.equal(wei("2"));
    //     expect(await tokenCliq.balanceOf(owner)).to.be.a.bignumber.equal(
    //       ownerBalanceCLIQ.add(new BN(wei("2")))
    //     );
    //   });

    //   describe("should catch FundsParked event", () => {
    //     it("for Native token", async () => {
    //       await tokenIris.transfer(cliqStaking.address, wei("4"));

    //       const { logs } = await cliqStaking.parkFunds(
    //         wei("2"),
    //         tokenIris.address
    //       );
    //       expectEvent.inLogs(logs, "FundsParked", {
    //         _usr: owner,
    //         _token: tokenIris.address,
    //         _amount: wei("2"),
    //       });

    //       let log = await tokenIris
    //         .getPastEvents("Transfer", { toBlock: "latest" })
    //         .then((events) => {
    //           return events;
    //         });

    //       expect(await log[0].args["value"]).to.be.a.bignumber.equal(wei("2"));
    //     });

    //     it("for CLIQ token", async () => {
    //       await tokenCliq.transfer(cliqStaking.address, wei("4"));

    //       const { logs } = await cliqStaking.parkFunds(
    //         wei("2"),
    //         tokenCliq.address
    //       );
    //       expectEvent.inLogs(logs, "FundsParked", {
    //         _usr: owner,
    //         _token: tokenCliq.address,
    //         _amount: wei("2"),
    //       });

    //       let log = await tokenCliq
    //         .getPastEvents("Transfer", { toBlock: "latest" })
    //         .then((events) => {
    //           return events;
    //         });

    //       expect(await log[0].args["value"]).to.be.a.bignumber.equal(wei("2"));
    //     });
    //   });
    // });

    // describe("parkETH", () => {
    //   beforeEach(async () => {
    //     await send.ether(owner, cliqStaking.address, wei("3"));
    //   });

    //   it("only owner can park ETH", async () => {
    //     let ownerBalance = await balance.current(owner);
    //     expect(
    //       await balance.current(cliqStaking.address)
    //     ).to.be.a.bignumber.equal(wei("3"));

    //     await expectRevert(
    //       cliqStaking.parkETH(wei("2"), { from: user2 }),
    //       "caller does not have the Maintainer role"
    //     );

    //     await expectRevert(
    //       cliqStaking.parkETH(wei("2"), { from: rewardProvider }),
    //       "caller does not have the Maintainer role"
    //     );

    //     await cliqStaking.parkETH(wei("2"));
    //     expect(
    //       await balance.current(cliqStaking.address)
    //     ).to.be.a.bignumber.equal(wei("1"));
    //     expect(await balance.current(owner)).to.be.a.bignumber.closeTo(
    //       ownerBalance.add(new BN(wei("2"))),
    //       wei("0.001")
    //     );
    //   });

    //   it("should catch ETHParked event", async () => {
    //     const { logs } = await cliqStaking.parkETH(wei("2"));

    //     expectEvent.inLogs(logs, "ETHParked", {
    //       _usr: owner,
    //       _amount: wei("2"),
    //     });
    //   });
    // });

    describe('pauseStaking', () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user1,
        });
      });

      it('can call only owner', async () => {
        await expectRevert(
          cliqStaking.pauseStaking({ from: user1 }),
          "caller does not have the Maintainer role"
        );
        await expectRevert(
          cliqStaking.pauseStaking({ from: rewardProvider }),
          "caller does not have the Maintainer role"
        );

        await cliqStaking.pauseStaking();
      });

      it('should pause staking', async () => {
        await cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 });
        await cliqStaking.pauseStaking();

        await expectRevert(
          cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 }),
          "Staking is  paused"
        );
      });

      it('should cath Paused event', async () => {
        const { logs } = await cliqStaking.pauseStaking();
        
        expectEvent.inLogs(logs, "Paused", {});
      });
    });

    describe('unpauseStaking', () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: user1,
        });
      });
      
      it('can call only owner', async () => {
        await expectRevert(
          cliqStaking.unpauseStaking({ from: user1 }),
          "caller does not have the Maintainer role"
        );
        await expectRevert(
          cliqStaking.unpauseStaking({ from: rewardProvider }),
          "caller does not have the Maintainer role"
        );

        await cliqStaking.unpauseStaking();
      });

      it('should unpause staking', async () => {
        await cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 });
        await cliqStaking.pauseStaking();

        await expectRevert(
          cliqStaking.stakeTokens(wei("80"), GOLD, 1, { from: user1 }),
          "Staking is  paused"
        );

        await cliqStaking.unpauseStaking();
        await cliqStaking.stakeTokens(wei("30"), PLATINUM, 1, { from: user1 });
      });

      it('should cath Unpaused event', async () => {
        const { logs } = await cliqStaking.unpauseStaking();
        
        expectEvent.inLogs(logs, "Unpaused", {});
      });
    });

    describe("addStakedTokenReward", () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: rewardProvider,
        });
      });

      it("only Reward provider can call", async () => {
        await expectRevert(
          cliqStaking.addStakedTokenReward(wei("20"), { from: user2 }),
          "caller does not have the REWARD_PROVIDER role"
        );

        await expectRevert(
          cliqStaking.addStakedTokenReward(wei("20"), { from: owner }),
          "caller does not have the REWARD_PROVIDER role"
        );
        await cliqStaking.addStakedTokenReward(wei("20"), {
          from: rewardProvider,
        });
      });

      it("should transfer tokens", async () => {
        await cliqStaking.addStakedTokenReward(wei("20"), {
          from: rewardProvider,
        });

        let log = await tokenIris
          .getPastEvents("Transfer", { toBlock: "latest" })
          .then((events) => {
            return events;
          });

        expect(await log[0].args["value"]).to.be.a.bignumber.equal(wei("20"));
      });

      it("should catch NativeTokenRewardAdded event", async () => {
        const { logs } = await cliqStaking.addStakedTokenReward(wei("20"), {
          from: rewardProvider,
        });
        expectEvent.inLogs(logs, "NativeTokenRewardAdded", {
          _from: rewardProvider,
          _val: wei("20"),
        });
      });
    });

    describe("removeStakedTokenReward", () => {
      beforeEach(async () => {
        await tokenIris.approve(cliqStaking.address, wei("200"), {
          from: rewardProvider,
        });
        await cliqStaking.addStakedTokenReward(wei("20"), {
          from: rewardProvider,
        });
      });

      it("only Reward provider can call", async () => {
        await expectRevert(
          cliqStaking.removeStakedTokenReward(wei("10"), { from: user2 }),
          "caller does not have the REWARD_PROVIDER role"
        );
        await expectRevert(
          cliqStaking.removeStakedTokenReward(wei("10"), { from: owner }),
          "caller does not have the REWARD_PROVIDER role"
        );

        await cliqStaking.removeStakedTokenReward(wei("10"), {
          from: rewardProvider,
        });
      });

      it("should revert if reward pool > removing amount", async () => {
        await expectRevert(
          cliqStaking.removeStakedTokenReward(wei("25"), {
            from: rewardProvider,
          }),
          "you cannot withdraw this amount"
        );
        await cliqStaking.removeStakedTokenReward(wei("20"), {
          from: rewardProvider,
        });
      });

      it("should transfer tokens", async () => {
        await cliqStaking.removeStakedTokenReward(wei("20"), {
          from: rewardProvider,
        });
        let log = await tokenIris
          .getPastEvents("Transfer", { toBlock: "latest" })
          .then((events) => {
            return events;
          });

        expect(await log[0].args["value"]).to.be.a.bignumber.equal(wei("20"));
      });

      it("should catch NativeTokenRewardRemoved event", async () => {
        const { logs } = await cliqStaking.removeStakedTokenReward(wei("15"), {
          from: rewardProvider,
        });
        expectEvent.inLogs(logs, "NativeTokenRewardRemoved", {
          _to: rewardProvider,
          _val: wei("15"),
        });
      });
    });
  });
});
