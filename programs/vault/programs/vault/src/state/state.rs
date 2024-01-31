use anchor_lang::prelude::*;

#[account]
pub struct State {
    pub next_vault_id: u64,
    pub is_initialized: bool,
}

impl State {
    pub fn increase_vault_count(&mut self) {
        self.next_vault_id = self.next_vault_id + 1;
    }
}
