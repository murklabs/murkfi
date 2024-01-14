use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use core::mem::size_of;

declare_id!("9qygbwmh55Af8efyfZxs2wE4iNwhbf5ac6xtcTV1QTwB");

#[program]
pub mod murk_vault_manager {
    use super::*;

    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        // Setup vault
        let vault = &mut ctx.accounts.vault;
        vault.creator = *ctx.accounts.authority.key;
        vault.id = global_state.next_vault_id;
        vault.is_frozen = false;
        vault.is_closed = false;
        global_state.next_vault_id += 1;

        // Emit event for vault creation
        emit!(VaultCreated {
            creator: vault.creator,
            vault_id: vault.id,
        });

        Ok(())
    }

    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        let signer_key = ctx.accounts.signer.key();

        msg!("Depositing {} USDC into vault from {}", amount, signer_key);

        // Validate deposit requirements
        validate_deposit(&ctx, &signer_key)?;

        // Transfer USDC to the vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Emit event for vault deposit
        emit!(VaultDeposit {
            depositor: signer_key,
            amount: amount,
        });

        // Mint tokens to the user's vault token account
        let (_, bump) = Pubkey::find_program_address(&[b"mint_authority"], ctx.program_id);
        mint_tokens_to_user(&ctx, amount, bump)?;

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
        require!(!ctx.accounts.vault.is_frozen, MurkError::VaultFrozenError);

        let vault = &mut ctx.accounts.vault;
        vault.is_frozen = true;

        emit!(VaultFrozen { vault_id: vault.id });

        Ok(())
    }

    pub fn unfreeze_vault(ctx: Context<UnfreezeVault>) -> Result<()> {
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
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
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

    // Run after program deployment to initialize global state
    pub fn initialize_global_state(ctx: Context<InitializeGlobalState>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        require!(!global_state.is_initialized, MurkError::AlreadyInitialized);
        global_state.next_vault_id = 1;
        global_state.is_initialized = true;
        Ok(())
    }
}

// Internal Functions
fn mint_tokens_to_user(ctx: &Context<DepositUsdc>, amount: u64, bump: u8) -> Result<()> {
    let seeds = &[b"mint_authority", &[bump][..]];
    let signer = &[&seeds[..]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_vault_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;

    Ok(())
}

fn validate_deposit(ctx: &Context<DepositUsdc>, signer_key: &Pubkey) -> Result<()> {
    let user_token_account = &ctx.accounts.user_token_account;

    require!(
        user_token_account.owner == *signer_key,
        MurkError::InvalidTokenAccountOwnerError
    );
    require!(!ctx.accounts.vault.is_frozen, MurkError::VaultFrozenError);
    require!(!ctx.accounts.vault.is_closed, MurkError::VaultClosedError);

    Ok(())
}

/**
* Program Derived Accounts
*/
#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"vault", global_state.next_vault_id.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = 8 + size_of::<Vault>(),
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
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

#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"global_state"],
        bump,
        space = 8 + size_of::<GlobalState>()
    )]
    pub global_state: Account<'info, GlobalState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
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

#[account]
pub struct GlobalState {
    pub next_vault_id: u64,
    pub is_initialized: bool,
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
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    #[msg("Program state already initialized")]
    AlreadyInitialized,
}
