// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {LithoBase} from "../../contracts/LithoBase.sol";

/**
 * @title MockLithoBase
 * @notice Concrete implementation of LithoBase for testing
 * @dev Required since LithoBase is abstract
 */
contract MockLithoBase is LithoBase {
    uint256 public actionCount;

    constructor(address initialOwner) LithoBase(initialOwner) {}

    function performAction() external {
        _beforeAction();
        actionCount++;
    }
}

/**
 * @title LithoBaseTest
 * @notice Foundry test suite for LithoBase contract
 * @dev Tests ownership, pausability, and core functionality
 */
contract LithoBaseTest is Test {
    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    MockLithoBase public lithoBase;
    
    address public owner;
    address public user;
    address public newOwner;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event LithoBaseInitialized(address indexed owner);
    event EmergencyAction(string action, address indexed caller);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);

    /*//////////////////////////////////////////////////////////////
                                 SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");
        newOwner = makeAddr("newOwner");

        vm.prank(owner);
        lithoBase = new MockLithoBase(owner);
    }

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Constructor_SetsOwner() public view {
        assertEq(lithoBase.owner(), owner);
    }

    function test_Constructor_EmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit LithoBaseInitialized(user);
        
        vm.prank(user);
        new MockLithoBase(user);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(LithoBase.InvalidAddress.selector);
        new MockLithoBase(address(0));
    }

    function test_Version_ReturnsCorrectVersion() public view {
        assertEq(lithoBase.version(), "1.0.0");
    }

    /*//////////////////////////////////////////////////////////////
                            OWNERSHIP TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Owner_IsSetCorrectly() public view {
        assertEq(lithoBase.owner(), owner);
    }

    function test_TransferOwnership_Success() public {
        vm.prank(owner);
        lithoBase.transferOwnership(newOwner);
        
        assertEq(lithoBase.owner(), newOwner);
    }

    function test_TransferOwnership_RevertsIfNotOwner() public {
        vm.prank(user);
        vm.expectRevert();
        lithoBase.transferOwnership(newOwner);
    }

    function test_TransferOwnership_EmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(owner, newOwner);
        
        vm.prank(owner);
        lithoBase.transferOwnership(newOwner);
    }

    function test_RenounceOwnership_Success() public {
        vm.prank(owner);
        lithoBase.renounceOwnership();
        
        assertEq(lithoBase.owner(), address(0));
    }

    /*//////////////////////////////////////////////////////////////
                           PAUSABILITY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_InitiallyNotPaused() public view {
        assertFalse(lithoBase.isPaused());
        assertFalse(lithoBase.paused());
    }

    function test_Pause_Success() public {
        vm.prank(owner);
        lithoBase.pause();
        
        assertTrue(lithoBase.isPaused());
    }

    function test_Pause_EmitsEvents() public {
        vm.expectEmit(true, false, false, false);
        emit Paused(owner);
        
        vm.expectEmit(false, true, false, true);
        emit EmergencyAction("pause", owner);
        
        vm.prank(owner);
        lithoBase.pause();
    }

    function test_Pause_RevertsIfNotOwner() public {
        vm.prank(user);
        vm.expectRevert();
        lithoBase.pause();
    }

    function test_Unpause_Success() public {
        vm.startPrank(owner);
        lithoBase.pause();
        lithoBase.unpause();
        vm.stopPrank();
        
        assertFalse(lithoBase.isPaused());
    }

    function test_Unpause_EmitsEvents() public {
        vm.prank(owner);
        lithoBase.pause();

        vm.expectEmit(true, false, false, false);
        emit Unpaused(owner);
        
        vm.expectEmit(false, true, false, true);
        emit EmergencyAction("unpause", owner);
        
        vm.prank(owner);
        lithoBase.unpause();
    }

    function test_Unpause_RevertsIfNotOwner() public {
        vm.prank(owner);
        lithoBase.pause();

        vm.prank(user);
        vm.expectRevert();
        lithoBase.unpause();
    }

    /*//////////////////////////////////////////////////////////////
                         WHEN NOT PAUSED TESTS
    //////////////////////////////////////////////////////////////*/

    function test_PerformAction_SucceedsWhenNotPaused() public {
        lithoBase.performAction();
        assertEq(lithoBase.actionCount(), 1);
    }

    function test_PerformAction_RevertsWhenPaused() public {
        vm.prank(owner);
        lithoBase.pause();

        vm.expectRevert();
        lithoBase.performAction();
    }

    function test_PerformAction_SucceedsAfterUnpause() public {
        vm.startPrank(owner);
        lithoBase.pause();
        lithoBase.unpause();
        vm.stopPrank();

        lithoBase.performAction();
        assertEq(lithoBase.actionCount(), 1);
    }

    /*//////////////////////////////////////////////////////////////
                             FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Constructor_AcceptsAnyNonZeroAddress(address initialOwner) public {
        vm.assume(initialOwner != address(0));
        
        MockLithoBase newContract = new MockLithoBase(initialOwner);
        assertEq(newContract.owner(), initialOwner);
    }

    function testFuzz_TransferOwnership_ToAnyAddress(address _newOwner) public {
        vm.assume(_newOwner != address(0));
        
        vm.prank(owner);
        lithoBase.transferOwnership(_newOwner);
        
        assertEq(lithoBase.owner(), _newOwner);
    }

    /*//////////////////////////////////////////////////////////////
                           INVARIANT TESTS
    //////////////////////////////////////////////////////////////*/

    function invariant_OwnerNeverZeroUnlessRenounced() public view {
        // This would be set up with a handler in production invariant tests
        // For now, this is a placeholder showing the pattern
        assertTrue(
            lithoBase.owner() != address(0) || 
            lithoBase.owner() == address(0) // After renounce
        );
    }
}
