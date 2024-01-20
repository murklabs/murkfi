use anchor_lang::prelude::*;

use crate::error::MurkError;

pub const MAX_WITHDRAWAL_REQUESTS: usize = 10;

#[account]
pub struct UserDeposit {
    pub initialized: bool,
    pub vault: Pubkey,
    pub amount: u64,
    pub withdrawals: [WithdrawalRequest; MAX_WITHDRAWAL_REQUESTS],
    pub bump: u8,
}

impl UserDeposit {
    pub fn new(&mut self, vault: Pubkey, amount: u64, bump: u8) {
        self.initialized = true;
        self.vault = vault;
        self.amount = amount;
        self.withdrawals = [WithdrawalRequest {
            amount: 0,
            initiated_timestamp: 0,
            status: WithdrawalStatus::None,
        }; MAX_WITHDRAWAL_REQUESTS];
        self.bump = bump;
    }

    pub fn add_amount(&mut self, amount: u64) {
        self.amount += amount;
    }

    pub fn initiate_withdrawal(&mut self, amount: u64, current_timestamp: u64) -> Result<()> {
        if let Some(request) = self
            .withdrawals
            .iter_mut()
            .find(|req| req.status == WithdrawalStatus::None)
        {
            request.amount = amount;
            request.initiated_timestamp = current_timestamp;
            request.status = WithdrawalStatus::Initiated;
            Ok(())
        } else {
            Err(MurkError::WithdrawalRequestLimitReached.into())
        }
    }

    pub fn remove_withdrawal_request(&mut self, index: usize) {
        self.withdrawals[index] = WithdrawalRequest {
            amount: 0,
            initiated_timestamp: 0,
            status: WithdrawalStatus::None,
        };
    }
}

#[derive(Clone, Debug, AnchorSerialize, AnchorDeserialize, Copy)]
pub struct WithdrawalRequest {
    pub amount: u64,
    pub initiated_timestamp: u64,
    pub status: WithdrawalStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum WithdrawalStatus {
    None,
    Initiated,
    Cooldown,
    Ready,
    Completed,
    Cancelled,
}
