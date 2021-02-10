// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// mock class using ERC20
contract ERC20Mock is ERC20 {
    constructor (
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _mint(_msgSender(), 10000000000000000000000000);
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
