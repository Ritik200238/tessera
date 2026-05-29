//! Solidity-compatible event topics emitted by the vault.
//!
//! Names and field orders mirror Aave/Compound conventions wherever they have
//! one (`Deposit`, `Withdraw`, `Borrow`, `Repay`), so any generic indexer
//! library decodes them with no extra schema. The Tessera-specific events
//! (`AccrueInterest`, `ParamUpdate`, `BadDebtRealized`) follow the same
//! indexed-fields conventions.

use alloy_sol_types::sol;

sol! {
    // ===== ERC-4626 lender side =====
    /// Lender supplied `assets` USDC, received `shares`.
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    /// Lender / receiver withdrew `assets` USDC, burning `shares`.
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    // ===== Borrower side =====
    /// Borrower deposited `amount` of collateral `token`.
    event CollateralDeposit(address indexed user, address indexed token, uint256 amount);
    /// Borrower withdrew `amount` of collateral `token`.
    event CollateralWithdraw(address indexed user, address indexed token, uint256 amount);
    /// Borrower drew `amount` USDC; `new_principal` is the post-action principal,
    /// `borrow_index` is the global index at the time of the call.
    event Borrow(address indexed user, uint256 amount, uint256 new_principal, uint256 borrow_index);
    /// Borrower repaid `amount` USDC; `new_principal` is the post-action principal.
    event Repay(address indexed user, uint256 amount, uint256 new_principal);

    // ===== Liquidation =====
    event Liquidate(
        address indexed borrower,
        address indexed liquidator,
        address indexed collateral_token,
        uint256 repay_amount,
        uint256 seize_amount
    );
    /// Emitted when a user's collateral is exhausted but principal > 0.
    event BadDebtRealized(address indexed user, uint256 residual);

    // ===== Accrual / config =====
    event AccrueInterest(uint256 dt_seconds, uint256 borrow_rate_bps, uint256 new_index);
    event AssetConfigured(
        address indexed token,
        uint16 max_ltv_bps,
        uint16 liq_threshold_bps,
        uint16 liq_bonus_bps,
        uint8 decimals
    );
    event ParamUpdate(bytes32 indexed key, uint256 value);
    event OracleSet(address indexed old_oracle, address indexed new_oracle);
    event AgentSet(address indexed old_agent, address indexed new_agent);
    event OwnershipTransferred(address indexed previous_owner, address indexed new_owner);
    event PausedSet(address indexed by, bool paused);
}
