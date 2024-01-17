use anchor_lang::prelude::*;
pub trait Admin {
    fn is_admin(&self, is_admin: Pubkey) -> bool;
}
