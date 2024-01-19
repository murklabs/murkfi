use anchor_lang::prelude::*;

/**
* Errors
* https://book.anchor-lang.com/anchor_in_depth/errors.html
*/
#[error_code]
pub enum MurkError {
    #[msg("Signer is not the owner of the token account")]
    InvalidTokenAccountOwner,
    #[msg("Signer is not vault creator. Action cannot be performed")]
    UnauthorizedVaultAccess,
    #[msg("Vault is frozen. Action cannot be performed")]
    VaultFrozen,
    #[msg("Vault is not frozen. Action cannot be performed")]
    VaultUnfrozen,
    #[msg("Vault is closed. Action cannot be performed")]
    VaultClosed,
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    #[msg("Program state already initialized")]
    AlreadyInitialized,
    #[msg("Vault guardian does not exist")]
    VaultGuardianDoesNotExist,
    #[msg("Vault guardian already added")]
    VaultGuardianAlreadyAdded,
    #[msg("Vault guardian list is full")]
    VaultGuardianListFull,
    #[msg("Invalid associated token account")]
    InvalidAssociatedTokenAccount,
    #[msg("Max number of withdrawal requests reached")]
    WithdrawalRequestLimitReached,
}
