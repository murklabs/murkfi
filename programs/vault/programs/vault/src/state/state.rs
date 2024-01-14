use anchor_lang::prelude::*;

#[account]
pub struct State {
    pub next_vault_id: u64,
    pub is_initialized: bool,
}
