use crate::error::MurkError;
use crate::state::events::*;
use crate::state::{state::State, user::UserDeposit, vault::Vault};
use anchor_lang::{prelude::*, solana_program::program_pack::Pack};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};
use core::mem::size_of;
use spl_token::state::Account as TokenAccountData;

pub fn handle_create_vault(
    ctx: Context<CreateVault>,
    asset: Pubkey,
    max_deposit: u64,
) -> Result<()> {
    let state = &mut ctx.accounts.state;
    let vault = &mut ctx.accounts.vault;
    let bump = vault.bump;
    vault.new(
        *ctx.accounts.authority.key,
        state.next_vault_id,
        asset,
        max_deposit,
        bump,
    );
    state.increase_vault_count();

    emit!(VaultCreated {
        creator: vault.creator,
        vault_id: vault.id,
    });

    Ok(())
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // Validate deposit requirements
    ctx.accounts.validate_deposit()?;

    // Deposit token from user ATA to the vault ATA
    ctx.accounts.deposit_to_vault(amount)?;

    // Update/Create user deposit account
    ctx.accounts.update_user_deposit(amount)?;

    // Mint tokens to the user's vault ATA
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

    // Transfer token from vault ATA to user ATA
    ctx.accounts.withdraw_from_vault(ctx.program_id, amount)?;

    // Burn vToken from user vToken ATA
    ctx.accounts.burn_vtoken_from_user(amount)?;

    emit!(VaultWithdrawal {
        amount: amount,
        vault_id: ctx.accounts.vault.id,
        withdrawer: ctx.accounts.signer.key(),
    });

    Ok(())
}

pub fn handle_freeze_vault(ctx: Context<FreezeVault>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.vault.creator,
        ctx.accounts.signer.key(),
        MurkError::UnauthorizedVaultAccess
    );
    require!(!ctx.accounts.vault.is_frozen, MurkError::VaultFrozen);

    let vault = &mut ctx.accounts.vault;
    vault.is_frozen = true;

    emit!(VaultFrozen { vault_id: vault.id });

    Ok(())
}

pub fn handle_unfreeze_vault(ctx: Context<UnfreezeVault>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.vault.creator,
        ctx.accounts.signer.key(),
        MurkError::UnauthorizedVaultAccess
    );
    require!(ctx.accounts.vault.is_frozen, MurkError::VaultUnfrozen);

    let vault = &mut ctx.accounts.vault;
    vault.is_frozen = false;

    emit!(VaultUnfrozen { vault_id: vault.id });

    Ok(())
}

// This is an irreversible action and vault will be permanently closed
pub fn handle_close_vault(ctx: Context<CloseVault>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.vault.creator,
        ctx.accounts.signer.key(),
        MurkError::UnauthorizedVaultAccess
    );
    require!(!ctx.accounts.vault.is_closed, MurkError::VaultClosed);

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
    pub signer: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    // This is the vault's ATA for the token they are depositing
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    // This is the user's ATA for the token they are depositing
    #[account(mut, constraint = user_token_account.owner == signer.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer
    )]
    pub user_vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: The `mint_authority` is a PDA derived with known seeds and is used
    /// as the mint authority for the token. We ensure it matches the derived address
    /// and is the correct authority for minting tokens.
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: AccountInfo<'info>,
    #[account(
        init_if_needed,
        seeds = [b"user_deposit", signer.key().as_ref(), vault.id.to_le_bytes().as_ref()],
        bump,
        payer = signer,
        space = 8 + size_of::<UserDeposit>(),
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    // this is needed to create the associated token account if not already created
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl Deposit<'_> {
    fn validate_deposit(&self) -> Result<()> {
        require_keys_eq!(
            self.user_token_account.owner,
            self.signer.key(),
            MurkError::InvalidTokenAccountOwner
        );
        require!(!self.vault.is_frozen, MurkError::VaultFrozen);
        require!(!self.vault.is_closed, MurkError::VaultClosed);

        if self.user_vault_token_account.to_account_info().data_len() > 0 {
            let ata_data = TokenAccountData::unpack(
                &self
                    .user_vault_token_account
                    .to_account_info()
                    .data
                    .borrow(),
            )?;
            // Ensure the ATA is for the correct mint
            require!(
                ata_data.mint == self.mint.key(),
                MurkError::InvalidAssociatedTokenAccount
            );
        }

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
    fn update_user_deposit(&mut self, amount: u64) -> Result<()> {
        let bump = self.user_deposit.bump;
        let user_deposit = &mut self.user_deposit;
        if user_deposit.initialized {
            user_deposit.add_amount(amount);
        } else {
            // if a user deposit account doesn't exist, create one
            user_deposit.new(*self.vault.to_account_info().key, amount, bump);
        }

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

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
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

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl Withdraw<'_> {
    fn validate_withdrawal(&self) -> Result<()> {
        require_keys_eq!(
            self.withdrawal_token_account.owner,
            self.signer.key(),
            MurkError::InvalidTokenAccountOwner
        );
        require_keys_eq!(
            self.user_vault_token_account.owner,
            self.signer.key(),
            MurkError::InvalidTokenAccountOwner
        );
        require!(!self.vault.is_frozen, MurkError::VaultFrozen);
        require!(!self.vault.is_closed, MurkError::VaultClosed);

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
        let (_, bump) =
            Pubkey::find_program_address(&[b"vault", vault_id_bytes.as_ref()], program_id);
        let seeds: &[&[u8]; 3] = &[b"vault", vault_id_bytes.as_ref(), &[bump][..]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
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

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
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
