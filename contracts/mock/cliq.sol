pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";

//deployed on rinkeby at 0x47E45F5a66AC1C61ab457B3551454CF73F7189bF

contract CLIQ is ERC20Capped {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 cap,
        uint256 initialSupply
    ) public ERC20Capped(cap) ERC20(name, symbol) {
        _mint(_msgSender(), initialSupply * (10**uint256(decimals)));
    }
}
