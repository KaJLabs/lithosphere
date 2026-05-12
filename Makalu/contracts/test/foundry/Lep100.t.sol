// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/Lep100.sol";

/**
 * Property-based fuzz tests for the production Lep100 contract.
 *
 * Foundry exercises state spaces that the Hardhat/Mocha unit suite can't
 * — random `(id, amount, address)` triples, sequences of transfers, edge
 * values like type(uint256).max. Each invariant below codifies an
 * always-true property of the contract; a counterexample failing the
 * fuzz run indicates a real bug.
 *
 * Run locally:
 *   cd Makalu/contracts && forge test --profile default -vv
 * Or with CI's higher run count:
 *   cd Makalu/contracts && forge test --profile ci -vv
 */
contract Lep100FuzzTest is Test {
    Lep100 internal token;
    address internal admin;
    address internal alice;
    address internal bob;

    function setUp() public {
        admin = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        token = new Lep100("Test Token", "TST", "https://example.com/");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Mint properties
    // ─────────────────────────────────────────────────────────────────────

    /// After mint(to, id, amt), balanceOf(to, id) increases by exactly amt.
    function testFuzz_MintAddsToBalance(uint128 id, uint128 amt) public {
        vm.assume(amt > 0);
        uint256 before_ = token.balanceOf(alice, id);
        token.mint(alice, id, amt, "");
        assertEq(token.balanceOf(alice, id), before_ + amt, "balance != before + amt");
    }

    /// After mint(to, id, amt), totalSupply[id] increases by exactly amt.
    function testFuzz_MintIncreasesTotalSupply(uint128 id, uint128 amt) public {
        vm.assume(amt > 0);
        uint256 before_ = token.totalSupply(id);
        token.mint(alice, id, amt, "");
        assertEq(token.totalSupply(id), before_ + amt, "supply != before + amt");
    }

    /// Mint to address(0) reverts. Codifies the require(to!=address(0)) check.
    function testFuzz_MintToZeroReverts(uint128 id, uint128 amt) public {
        vm.assume(amt > 0);
        vm.expectRevert();
        token.mint(address(0), id, amt, "");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Transfer properties
    // ─────────────────────────────────────────────────────────────────────

    /// safeTransferFrom conserves balance between sender and receiver.
    function testFuzz_TransferConservesBalance(uint128 id, uint128 mintAmt, uint128 sendAmt) public {
        vm.assume(mintAmt > 0);
        vm.assume(sendAmt <= mintAmt);
        token.mint(alice, id, mintAmt, "");

        uint256 beforeAlice = token.balanceOf(alice, id);
        uint256 beforeBob = token.balanceOf(bob, id);

        vm.prank(alice);
        token.safeTransferFrom(alice, bob, id, sendAmt, "");

        assertEq(token.balanceOf(alice, id), beforeAlice - sendAmt, "alice balance off");
        assertEq(token.balanceOf(bob, id), beforeBob + sendAmt, "bob balance off");
        assertEq(token.balanceOf(alice, id) + token.balanceOf(bob, id), beforeAlice + beforeBob, "sum changed");
    }

    /// safeTransferFrom reverts when sender has insufficient balance.
    function testFuzz_TransferInsufficientBalanceReverts(uint128 id, uint128 mintAmt, uint128 sendAmt) public {
        vm.assume(mintAmt > 0);
        vm.assume(sendAmt > mintAmt);
        token.mint(alice, id, mintAmt, "");
        vm.prank(alice);
        vm.expectRevert();
        token.safeTransferFrom(alice, bob, id, sendAmt, "");
    }

    /// Transfer from a non-approved third party reverts.
    function testFuzz_TransferWithoutApprovalReverts(uint128 id, uint128 amt) public {
        vm.assume(amt > 0);
        token.mint(alice, id, amt, "");
        vm.prank(bob);
        vm.expectRevert();
        token.safeTransferFrom(alice, bob, id, amt, "");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Burn properties
    // ─────────────────────────────────────────────────────────────────────

    /// Burn reduces both balance AND totalSupply by exactly the burn amount.
    function testFuzz_BurnReducesBothBalanceAndSupply(uint128 id, uint128 mintAmt, uint128 burnAmt) public {
        vm.assume(mintAmt > 0);
        vm.assume(burnAmt <= mintAmt);
        token.mint(alice, id, mintAmt, "");

        uint256 balanceBefore = token.balanceOf(alice, id);
        uint256 supplyBefore = token.totalSupply(id);

        vm.prank(alice);
        token.burn(alice, id, burnAmt);

        assertEq(token.balanceOf(alice, id), balanceBefore - burnAmt, "balance off");
        assertEq(token.totalSupply(id), supplyBefore - burnAmt, "supply off");
    }

    /// Burn more than balance reverts.
    function testFuzz_BurnInsufficientBalanceReverts(uint128 id, uint128 mintAmt, uint128 burnAmt) public {
        vm.assume(mintAmt > 0);
        vm.assume(burnAmt > mintAmt);
        token.mint(alice, id, mintAmt, "");
        vm.prank(alice);
        vm.expectRevert();
        token.burn(alice, id, burnAmt);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Pause properties
    // ─────────────────────────────────────────────────────────────────────

    /// While paused, mint reverts.
    function testFuzz_PausedBlocksMint(uint128 id, uint128 amt) public {
        vm.assume(amt > 0);
        token.pause();
        vm.expectRevert();
        token.mint(alice, id, amt, "");
    }

    /// While paused, safeTransferFrom reverts.
    function testFuzz_PausedBlocksTransfer(uint128 id, uint128 amt) public {
        vm.assume(amt > 0);
        token.mint(alice, id, amt, "");
        token.pause();
        vm.prank(alice);
        vm.expectRevert();
        token.safeTransferFrom(alice, bob, id, amt, "");
    }

    /// While paused, burn reverts.
    function testFuzz_PausedBlocksBurn(uint128 id, uint128 amt) public {
        vm.assume(amt > 0);
        token.mint(alice, id, amt, "");
        token.pause();
        vm.prank(alice);
        vm.expectRevert();
        token.burn(alice, id, amt);
    }

    /// After unpause, transfers work again.
    function test_UnpauseRestoresTransfers() public {
        token.mint(alice, 1, 100, "");
        token.pause();
        token.unpause();
        vm.prank(alice);
        token.safeTransferFrom(alice, bob, 1, 50, "");
        assertEq(token.balanceOf(bob, 1), 50);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Access control properties
    // ─────────────────────────────────────────────────────────────────────

    /// A non-MINTER caller cannot mint, regardless of (id, amount).
    function testFuzz_NonMinterCannotMint(uint128 id, uint128 amt, address attacker) public {
        vm.assume(amt > 0);
        vm.assume(attacker != admin);
        vm.assume(attacker != address(0));
        vm.prank(attacker);
        vm.expectRevert();
        token.mint(alice, id, amt, "");
    }

    /// A non-PAUSER caller cannot pause.
    function testFuzz_NonPauserCannotPause(address attacker) public {
        vm.assume(attacker != admin);
        vm.assume(attacker != address(0));
        vm.prank(attacker);
        vm.expectRevert();
        token.pause();
    }
}
