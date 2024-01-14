use anchor_lang::prelude::*;

/**
* Events
* https://book.anchor-lang.com/anchor_in_depth/events.html
*/
#[event]
pub struct VaultCreated {
    pub creator: Pubkey,
    pub vault_id: u64,
}

#[event]
pub struct VaultDeposit {
    pub amount: u64,
    pub depositor: Pubkey,
    pub vault_id: u64,
}

#[event]
pub struct VaultWithdrawal {
    pub amount: u64,
    pub withdrawer: Pubkey,
    pub vault_id: u64,
}

#[event]
pub struct VaultFrozen {
    pub vault_id: u64,
}

#[event]
pub struct VaultUnfrozen {
    pub vault_id: u64,
}

#[event]
pub struct VaultClosed {
    pub vault_id: u64,
}
