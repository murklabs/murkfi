use crate::instructions::*;
use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

declare_id!("9qygbwmh55Af8efyfZxs2wE4iNwhbf5ac6xtcTV1QTwB");

#[program]
pub mod murkfi {
    use super::*;

    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        handle_create_vault(ctx)
    }

    pub fn deposit_usdc(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        handle_deposit(ctx, amount)
    }

    pub fn withdraw_usdc(_ctx: Context<WithdrawUsdc>, _amount: u64) -> Result<()> {
        // TODO: Implement withdraw logic
        Ok(())
    }

    pub fn freeze_vault(ctx: Context<FreezeVault>) -> Result<()> {
        handle_freeze_vault(ctx)
    }

    pub fn unfreeze_vault(ctx: Context<UnfreezeVault>) -> Result<()> {
        handle_unfreeze_vault(ctx)
    }

    // This is an irreversible action and vault will be permanently closed
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        handle_close_vault(ctx)
    }

    // Run after program deployment to initialize global state
    pub fn initialize_state(ctx: Context<InitializeState>) -> Result<()> {
        handle_initialize_state(ctx)
    }
}
