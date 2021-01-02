var cliqStaking = artifacts.require("../contracts/cliqStaking.sol");

// 0x47E45F5a66AC1C61ab457B3551454CF73F7189bF

var nativeToken="0x47E45F5a66AC1C61ab457B3551454CF73F7189bF";
var cliq="0x47e45f5a66ac1c61ab457b3551454cf73f7189bf";

module.exports = function(deployer, network, accounts) {
    deployer.deploy(cliqStaking,nativeToken,cliq);
};