use crate::error::MurkError;
use crate::state::state::State;
use anchor_lang::prelude::*;
use core::mem::size_of;

pub fn handle_initialize_state(ctx: Context<InitializeState>) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    require!(!global_state.is_initialized, MurkError::AlreadyInitialized);
    global_state.next_vault_id = 1;
    global_state.is_initialized = true;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeState<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"global_state"],
        bump,
        space = 8 + size_of::<State>()
    )]
    pub global_state: Account<'info, State>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
