use crate::state::events::*;
use anchor_lang::prelude::*;

pub fn handle_create_vault(ctx: Context<CreateVault>) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    // Setup vault
    let vault = &mut ctx.accounts.vault;
    vault.creator = *ctx.accounts.authority.key;
    vault.id = global_state.next_vault_id;
    vault.is_frozen = false;
    vault.is_closed = false;
    global_state.next_vault_id += 1;

    // Emit event for vault creation
    emit!(VaultCreated {
        creator: vault.creator,
        vault_id: vault.id,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"vault", global_state.next_vault_id.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = 8 + size_of::<Vault>(),
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    pub system_program: Program<'info, System>,
}
