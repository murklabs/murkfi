use crate::error::MurkError;
use crate::state::events::*;
use crate::state::{state::State, vault::Vault};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
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
    ctx.accounts.validate_deposit(&ctx.accounts.signer.key())?;

    // 1. Deposit token from user ATA to the vault ATA
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // 2. Create user vToken ATA
    // TODO: Implement

    // 3. Mint tokens to the user's vault ATA
    let (_, bump) = Pubkey::find_program_address(&[b"mint_authority"], ctx.program_id);
    ctx.accounts.mint_tokens_to_user(amount, bump)?;

    emit!(VaultDeposit {
        amount: amount,
        depositor: ctx.accounts.signer.key(),
        vault_id: ctx.accounts.vault.id,
    });

    Ok(())
}

pub fn handle_withdrawal(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(
        !ctx.accounts.vault.is_frozen,
        MurkError::VaultFrozenError
    );
    require!(
        !ctx.accounts.vault.is_closed,
        MurkError::VaultClosedError
    );
    require!(
        ctx.accounts.withdrawal_token_account.owner == ctx.accounts.signer.key(),
        MurkError::InvalidTokenAccountOwnerError
    );

    // 1. Determine withdrawal amount from vault usdc ATA
    // TODO: Implement

    // 2. Transfer USDC from vault usdc ATA to user usdc ATA
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.withdrawal_token_account.to_account_info(),
        authority: ctx.accounts.vault.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // 3. Burn vToken from user vToken ATA
    // TODO: Implement

    emit!(VaultWithdrawal {
        vault_id: ctx.accounts.vault.id,
        withdrawer: ctx.accounts.signer.key(),
        amount: amount,
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
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        constraint = user_token_account.owner == signer.key(),
    )]
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: The `mint_authority` is a PDA derived with known seeds and is used
    /// as the mint authority for the token. We ensure it matches the derived address
    /// and is the correct authority for minting tokens.
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: AccountInfo<'info>,
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl Deposit<'_> {
    fn validate_deposit(&self, signer_key: &Pubkey) -> Result<()> {
        let user_token_account = &self.user_token_account;

        require!(
            user_token_account.owner == *signer_key,
            MurkError::InvalidTokenAccountOwnerError
        );
        require!(!self.vault.is_frozen, MurkError::VaultFrozenError);
        require!(!self.vault.is_closed, MurkError::VaultClosedError);

        Ok(())
    }
    fn mint_tokens_to_user(&self, amount: u64, bump: u8) -> Result<()> {
        let seeds = &[b"mint_authority", &[bump][..]];
        let signer = &[&seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    mint: self.mint.to_account_info(),
                    to: self.user_vault_token_account.to_account_info(),
                    authority: self.mint_authority.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub signer: Signer<'info>,
    #[account(
        constraint = withdrawal_token_account.owner == signer.key(),
    )]
    #[account(mut)]
    pub withdrawal_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
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
