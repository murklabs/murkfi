use crate::state::guardian::Guardian;

use anchor_lang::prelude::*;

pub fn handle_create_gaurdian(ctx: Context<CreateGuardian>) -> Result<()> {
    let guardian = &mut ctx.accounts.guardian;
    guardian.is_active = true;
    Ok(())
}

#[derive(Accounts)]
pub struct CreateGuardian<'info> {
    #[account(
        init,
        seeds = [b"guardian", payer.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + std::mem::size_of::<Guardian>()
    )]
    pub guardian: Account<'info, Guardian>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
