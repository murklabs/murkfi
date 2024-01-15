use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Guardian {
    pub is_active: bool,
}
