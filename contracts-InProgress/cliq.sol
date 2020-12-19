pragma solidity ^0.5.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";

//deployed on rinkeby at 0x47E45F5a66AC1C61ab457B3551454CF73F7189bF

contract CLIQ is ERC20Detailed, ERC20Burnable, ERC20Capped {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 cap,
        uint256 initialSupply
    ) public ERC20Capped(cap) ERC20Detailed(name, symbol, decimals) {
        _mint(_msgSender(), initialSupply * (10**uint256(decimals)));
    }
}
