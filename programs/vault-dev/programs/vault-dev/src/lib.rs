use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, MintTo, Mint};

declare_id!("9qygbwmh55Af8efyfZxs2wE4iNwhbf5ac6xtcTV1QTwB");

#[program]
pub mod murk_vault_manager {
    use super::*;

    pub fn create_vault(ctx: Context<CreateVault>, id: u64) -> Result<()> {
        // Setup vault
        let vault = &mut ctx.accounts.vault;
        vault.id = id;
        vault.creator = *ctx.accounts.authority.key;
        vault.usdc_balance = 0;

        // Emit event for vault creation
        emit!(VaultCreated {
            id: vault.id,
            creator: vault.creator,
        });

        Ok(())
    }

    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        let user_token_account = &ctx.accounts.user_token_account;
        let signer_key = ctx.accounts.signer.key();

        // Assert owner of token account is signer
        require!(
            user_token_account.owner == signer_key,
            MurkError::InvalidTokenAccountOwnerError
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

        // Increment vault balance for read ops
        let vault = &mut ctx.accounts.vault;
        vault.usdc_balance += amount;

        // Emit event for vault deposit
        emit!(VaultDeposit {
            depositor: signer_key,
            amount: amount,
        });

        token::mint_to(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.from.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            }),
            amount,
            signer,
        )

        Ok(())
    }

    pub fn withdraw_usdc(_ctx: Context<WithdrawUsdc>, _amount: u64) -> Result<()> {
        // TODO: Implement withdraw logic
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
    #[account(mut)]
    pub mint: Account<'info, Mint>,

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

/**
* Accounts
*/
#[account]
#[derive(Default)]
pub struct Vault {
    pub id: u64,
    pub creator: Pubkey,
    pub usdc_balance: u64,
}

impl Vault {
    // Size requirement of Vault struct
    // See space reference: https://book.anchor-lang.com/anchor_references/space.html
    pub const MAX_SIZE: usize = 8 + 32 + 8;
}

/**
* Events
* https://book.anchor-lang.com/anchor_in_depth/events.html
*/
#[event]
pub struct VaultCreated {
    pub id: u64,
    pub creator: Pubkey,
}

#[event]
pub struct VaultDeposit {
    pub depositor: Pubkey,
    pub amount: u64,
}

/**
* Errors
* https://book.anchor-lang.com/anchor_in_depth/errors.html
*/
#[error_code]
pub enum MurkError {
    #[msg("Key is not the owner of the token account")]
    InvalidTokenAccountOwnerError,
}
