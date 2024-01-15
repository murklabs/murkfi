use crate::instructions::*;
use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

declare_id!("9qygbwmh55Af8efyfZxs2wE4iNwhbf5ac6xtcTV1QTwB");

#[program]
pub mod murkfi {
    use super::*;

    // Run after program deployment to initialize global state
    pub fn initialize_state(ctx: Context<InitializeState>) -> Result<()> {
        handle_initialize_state(ctx)
    }

    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        handle_create_vault(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        handle_withdrawal(ctx, amount)
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
}
