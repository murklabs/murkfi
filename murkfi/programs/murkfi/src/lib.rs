use anchor_lang::prelude::*;

declare_id!("G41tUc85R5a8DbrHSsjcLUTNqDEULKZrU9kPDN3waWSv");

#[program]
pub mod murkfi {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
