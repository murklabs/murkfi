use crate::error::MurkError;
use crate::state::state::State;
use anchor_lang::prelude::*;
use core::mem::size_of;

pub fn handle_initialize_state(ctx: Context<InitializeState>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    require!(!state.is_initialized, MurkError::AlreadyInitialized);
    state.next_vault_id = 1;
    state.is_initialized = true;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeState<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"state"],
        bump,
        space = 8 + size_of::<State>()
    )]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
