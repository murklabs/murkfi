use anchor_lang::prelude::*;

use crate::state::guardian::Guardian;

#[account]
#[derive(Default)]
pub struct Vault {
    pub creator: Pubkey,
    pub id: u64,
    pub asset: Pubkey,
    pub is_frozen: bool,
    pub is_closed: bool,
    pub max_deposit: u64,
    pub guardians: [Guardian; 3],
}

impl Vault {
    pub fn is_guardian(&self, pubkey: Pubkey) -> bool {
        self.guardians
            .iter()
            .any(|guardian| guardian.pubkey == pubkey)
    }
}
