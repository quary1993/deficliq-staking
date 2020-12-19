var cliqStaking = artifacts.require("../contracts/cliqStaking.sol");

// 0x47E45F5a66AC1C61ab457B3551454CF73F7189bF

var cliq="0x47E45F5a66AC1C61ab457B3551454CF73F7189bF";

module.exports = function(deployer, network, accounts) {
    deployer.deploy(cliqStaking,cliq);
};