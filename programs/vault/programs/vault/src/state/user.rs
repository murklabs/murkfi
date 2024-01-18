use anchor_lang::prelude::*;

#[account]
pub struct UserDeposit {
    pub vault: Pubkey,
    pub amount: u64,
    pub withdrawal_initiated: bool,
    pub withdrawal_status: WithdrawalStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum WithdrawalStatus {
    None,
    Pending,
    Completed,
}

impl UserDeposit {
    pub fn new(vault: Pubkey, amount: u64, bump: u8) -> Self {
        Self {
            vault,
            amount,
            withdrawal_initiated: false,
            withdrawal_status: WithdrawalStatus::None,
            bump,
        }
    }

    pub fn add_amount(&mut self, amount: u64) {
        self.amount += amount;
    }
}
