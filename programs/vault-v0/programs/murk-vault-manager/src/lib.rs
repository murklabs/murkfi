use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("4ccQd4R1Z8yrb7am6qHyB6TPAwMD2Gp4cxhz1ZShHoQR");

#[program]
pub mod murk_vault_manager {
    use super::*;

    pub fn create_vault(ctx: Context<CreateVault>, id: u64) -> Result<()> {
        // Setup vault
        let vault = &mut ctx.accounts.vault;
        vault.creator = *ctx.accounts.authority.key;
        vault.id = id;
        vault.is_frozen = false;
        vault.is_closed = false;

        // Emit event for vault creation
        emit!(VaultCreated {
            creator: vault.creator,
            vault_id: vault.id,
        });

        Ok(())
    }

    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        let user_token_account = &ctx.accounts.user_token_account;
        let signer_key = ctx.accounts.signer.key();

        require!(
            user_token_account.owner == signer_key,
            MurkError::InvalidTokenAccountOwnerError
        );
        require!(
            !ctx.accounts.vault.is_frozen,
            MurkError::VaultFrozenError
        );
        require!(
            !ctx.accounts.vault.is_closed,
            MurkError::VaultClosedError
        );

        msg!("Depositing {} USDC into vault from {}", amount, signer_key);

        // Create cpi account transfer instruction
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Emit event for vault deposit
        emit!(VaultDeposit {
            depositor: signer_key,
            amount: amount,
        });

        Ok(())
    }

    pub fn withdraw_usdc(_ctx: Context<WithdrawUsdc>, _amount: u64) -> Result<()> {
        // TODO: Implement withdraw logic
        Ok(())
    }

    pub fn freeze_vault(ctx: Context<FreezeVault>) -> Result<()> {
        require!(
            ctx.accounts.vault.creator == ctx.accounts.signer.key(),
            MurkError::UnauthorizedVaultAccessError
        );
        require!(
            !ctx.accounts.vault.is_frozen,
            MurkError::VaultFrozenError
        );

        let vault = &mut ctx.accounts.vault;
        vault.is_frozen = true;

        emit!(VaultFrozen {
            vault_id: vault.id,
        });

        Ok(())
    }

     pub fn unfreeze_vault(ctx: Context<UnfreezeVault>) -> Result<()> {
        require!(
            ctx.accounts.vault.creator == ctx.accounts.signer.key(),
            MurkError::UnauthorizedVaultAccessError
        );
        require!(
            ctx.accounts.vault.is_frozen,
            MurkError::VaultUnfrozenError
        );

        let vault = &mut ctx.accounts.vault;
        vault.is_frozen = false;

        emit!(VaultUnfrozen {
            vault_id: vault.id,
        });

        Ok(())
    }

    // This is an irreversible action and vault will be permanently closed
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        require!(
            ctx.accounts.vault.creator == ctx.accounts.signer.key(),
            MurkError::UnauthorizedVaultAccessError
        );
        require!(
            !ctx.accounts.vault.is_closed,
            MurkError::VaultClosedError
        );

        // TODO: Implement redistribution of funds to vault depositors

        let vault = &mut ctx.accounts.vault;
        vault.is_closed = true;

        emit!(VaultClosed {
            vault_id: vault.id,
        });

        Ok(())
    }
}

/**
* Program Derived Accounts
*/
#[derive(Accounts)]
#[instruction(id : u64)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"vault", id.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = 8 + Vault::MAX_SIZE,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = user_token_account.owner == signer.key(),
    )]
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct FreezeVault<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct UnfreezeVault<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct CloseVault<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

/**
* Accounts
*/
#[account]
#[derive(Default)]
pub struct Vault {
    pub creator: Pubkey,
    pub id: u64,
    pub is_frozen: bool,
    pub is_closed: bool,
}

impl Vault {
    // Size requirement of Vault struct
    // See space reference: https://book.anchor-lang.com/anchor_references/space.html
    pub const MAX_SIZE: usize = 32 + 8 + 1 + 1;
}

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
    // pub vault_id: u64, TODO: Add vault_id so we know which vault was deposited to
    pub depositor: Pubkey,
    pub amount: u64,
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
}
