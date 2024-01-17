use anchor_lang::prelude::*;

/**
* Errors
* https://book.anchor-lang.com/anchor_in_depth/errors.html
*/
#[error_code]
pub enum MurkError {
    #[msg("Signer is not the owner of the token account")]
    InvalidTokenAccountOwnerError,
    #[msg("Signer is not vault creator. Action cannot be performed")]
    UnauthorizedVaultAccessError,
    #[msg("Vault is frozen. Action cannot be performed")]
    VaultFrozenError,
    #[msg("Vault is not frozen. Action cannot be performed")]
    VaultUnfrozenError,
    #[msg("Vault is closed. Action cannot be performed")]
    VaultClosedError,
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
}
