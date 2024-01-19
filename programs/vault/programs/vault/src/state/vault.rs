use crate::error::MurkError;
use crate::state::traits::Admin;
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
    pub guardians: Option<[Pubkey; 3]>,
}

impl Admin for Vault {
    fn is_admin(&self, pubkey: Pubkey) -> bool {
        self.creator == pubkey || self.is_guardian(pubkey)
    }
}

impl Vault {
    pub fn is_guardian(&self, pubkey: Pubkey) -> bool {
        match &self.guardians {
            Some(guardians) => guardians.iter().any(|guardian| *guardian == pubkey),
            None => false,
        }
    }

    pub fn add_guardian(&mut self, pubkey: Pubkey) -> Result<()> {
        if !self.is_admin(pubkey) {
            return Err(MurkError::UnauthorizedVaultAccess.into());
        }
        if self.is_guardian(pubkey) {
            return Err(MurkError::VaultGuardianAlreadyAdded.into());
        }

        match &mut self.guardians {
            Some(guardians) => {
                for guardian in guardians.iter_mut() {
                    if *guardian == Pubkey::default() {
                        *guardian = pubkey;
                        return Ok(());
                    }
                }
                Err(MurkError::VaultGuardianListFull.into())
            }
            None => {
                self.guardians = Some([pubkey, Pubkey::default(), Pubkey::default()]);
                Ok(())
            }
        }
    }

    pub fn remove_guardian(&mut self, pubkey: Pubkey) -> Result<()> {
        if !self.is_admin(pubkey) {
            return Err(MurkError::UnauthorizedVaultAccess.into());
        }
        match &mut self.guardians {
            Some(guardians) => {
                for guardian in guardians.iter_mut() {
                    if *guardian == pubkey {
                        *guardian = Pubkey::default();
                        return Ok(());
                    }
                }
                Err(MurkError::VaultGuardianDoesNotExist.into())
            }
            None => Err(MurkError::VaultGuardianListFull.into()),
        }
    }
}
