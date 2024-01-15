use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Vault {
    pub creator: Pubkey,
    pub id: u64,
    pub asset: Pubkey,
    pub is_frozen: bool,
    pub is_closed: bool,
    pub max_deposit: u64,
    pub gaurdians: [Pubkey; 3],
}
