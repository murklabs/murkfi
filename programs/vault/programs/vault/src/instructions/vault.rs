use crate::error::MurkError;
use crate::state::events::*;
use crate::state::{state::State, vault::Vault};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer, Burn};
use core::mem::size_of;

pub fn handle_create_vault(ctx: Context<CreateVault>) -> Result<()> {
    let state = &mut ctx.accounts.state;

    let vault = &mut ctx.accounts.vault;
    vault.creator = *ctx.accounts.authority.key;
    vault.id = state.next_vault_id;
    vault.is_frozen = false;
    vault.is_closed = false;
    state.next_vault_id += 1;

    emit!(VaultCreated {
        creator: vault.creator,
        vault_id: vault.id,
    });

    Ok(())
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // Validate deposit requirements
    ctx.accounts.validate_deposit()?;

    // 1. Deposit token from user ATA to the vault ATA
    ctx.accounts.deposit_to_vault(amount)?;

    // 2. Mint tokens to the user's vault ATA
    ctx.accounts.mint_vtokens_to_user(ctx.program_id, amount)?;

    emit!(VaultDeposit {
        amount: amount,
        depositor: ctx.accounts.signer.key(),
        vault_id: ctx.accounts.vault.id,
    });

    Ok(())
}

pub fn handle_withdrawal(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Validate withdrawal requirements
    ctx.accounts.validate_withdrawal()?;

    // 1. Determine withdrawal amount from vault usdc ATA
    // TODO: Implement

    // 2. Transfer USDC from vault usdc ATA to user usdc ATA
    ctx.accounts.withdraw_from_vault(ctx.program_id, amount)?;

    // 3. Burn vToken from user vToken ATA
    ctx.accounts.burn_vtoken_from_user(amount)?;

    emit!(VaultWithdrawal {
        amount: amount,
        vault_id: ctx.accounts.vault.id,
        withdrawer: ctx.accounts.signer.key(),
    });

    Ok(())
}

pub fn handle_freeze_vault(ctx: Context<FreezeVault>) -> Result<()> {
    require!(
        ctx.accounts.vault.creator == ctx.accounts.signer.key(),
        MurkError::UnauthorizedVaultAccessError
    );
    require!(!ctx.accounts.vault.is_frozen, MurkError::VaultFrozenError);

    let vault = &mut ctx.accounts.vault;
    vault.is_frozen = true;

    emit!(VaultFrozen { vault_id: vault.id });

    Ok(())
}

pub fn handle_unfreeze_vault(ctx: Context<UnfreezeVault>) -> Result<()> {
    require!(
        ctx.accounts.vault.creator == ctx.accounts.signer.key(),
        MurkError::UnauthorizedVaultAccessError
    );
    require!(ctx.accounts.vault.is_frozen, MurkError::VaultUnfrozenError);

    let vault = &mut ctx.accounts.vault;
    vault.is_frozen = false;

    emit!(VaultUnfrozen { vault_id: vault.id });

    Ok(())
}

// This is an irreversible action and vault will be permanently closed
pub fn handle_close_vault(ctx: Context<CloseVault>) -> Result<()> {
    require!(
        ctx.accounts.vault.creator == ctx.accounts.signer.key(),
        MurkError::UnauthorizedVaultAccessError
    );
    require!(!ctx.accounts.vault.is_closed, MurkError::VaultClosedError);

    // TODO: Implement redistribution of funds to vault depositors

    let vault = &mut ctx.accounts.vault;
    vault.is_closed = true;

    emit!(VaultClosed { vault_id: vault.id });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"vault", state.next_vault_id.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = 8 + size_of::<Vault>(),
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub state: Account<'info, State>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub signer: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = user_token_account.owner == signer.key(),
    )]
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: The `mint_authority` is a PDA derived with known seeds and is used
    /// as the mint authority for the token. We ensure it matches the derived address
    /// and is the correct authority for minting tokens.
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

impl Deposit<'_> {
    fn validate_deposit(&self) -> Result<()> {
        require!(
            self.user_token_account.owner == self.signer.key(),
            MurkError::InvalidTokenAccountOwnerError
        );
        require!(!self.vault.is_frozen, MurkError::VaultFrozenError);
        require!(!self.vault.is_closed, MurkError::VaultClosedError);

        Ok(())
    }
    fn deposit_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user_token_account.to_account_info(),
            to: self.vault_token_account.to_account_info(),
            authority: self.signer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
    fn mint_vtokens_to_user(&self, program_id: &Pubkey, amount: u64) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.mint.to_account_info(),
            to: self.user_vault_token_account.to_account_info(),
            authority: self.mint_authority.to_account_info(),
        };

        let (_, bump) = Pubkey::find_program_address(&[b"mint_authority"], program_id);
        let seeds: &[&[u8]; 2] = &[b"mint_authority", &[bump][..]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            cpi_program,
            cpi_accounts,
            signer,
        );
        token::mint_to(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        constraint = withdrawal_token_account.owner == signer.key(),
    )]
    pub withdrawal_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_vault_token_account.owner == signer.key(),
    )]
    pub user_vault_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    /// CHECK: The `mint_authority` is a PDA derived with known seeds and is used
    /// as the mint authority for the token. We ensure it matches the derived address
    /// and is the correct authority for minting tokens.
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: AccountInfo<'info>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl Withdraw<'_> {
    fn validate_withdrawal(&self) -> Result<()> {
        require!(
            self.withdrawal_token_account.owner == self.signer.key(),
            MurkError::InvalidTokenAccountOwnerError
        );
        require!(
            self.user_vault_token_account.owner == self.signer.key(),
            MurkError::InvalidTokenAccountOwnerError
        );
        require!(!self.vault.is_frozen, MurkError::VaultFrozenError);
        require!(!self.vault.is_closed, MurkError::VaultClosedError);

        Ok(())
    }
    fn withdraw_from_vault(&self, program_id: &Pubkey, amount: u64) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.vault_token_account.to_account_info(),
            to: self.withdrawal_token_account.to_account_info(),
            authority: self.vault.to_account_info(),
        };

        let vault_id_bytes: [u8; 8] = self.vault.id.to_le_bytes();
        let (_, bump) = Pubkey::find_program_address(
            &[b"vault", vault_id_bytes.as_ref()],
            program_id,
        );
        let seeds: &[&[u8]; 3] = &[b"vault", vault_id_bytes.as_ref(), &[bump][..]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            cpi_program,
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
    fn burn_vtoken_from_user(&self, amount: u64) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Burn {
            mint: self.mint.to_account_info(),
            from: self.user_vault_token_account.to_account_info(),
            authority: self.signer.to_account_info(),
        };
        msg!("Mint: {:?}", self.mint.to_account_info());
        msg!("From: {:?}", self.user_vault_token_account.to_account_info());
        msg!("Authority: {:?}", self.signer.to_account_info());

        let cpi_ctx = CpiContext::new(
            cpi_program,
            cpi_accounts,
        );
        token::burn(cpi_ctx, amount)?;

        Ok(())
    }
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
