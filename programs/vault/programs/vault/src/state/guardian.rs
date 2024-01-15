use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Guardian {
    pub pubkey: Pubkey,
    pub is_active: bool,
}
