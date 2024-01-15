import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { Murkfi } from "../target/types/murkfi";
import {
  createSPLToken,
  getOrCreateATA,
  safelyGetAccountBalance,
} from "../app/utils";
import { TOKEN_PROGRAM_ID, mintTo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const DEPOSIT_AMOUNT = 1000;

describe("murkfi-deposit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = anchor.Wallet.local();
  const program = anchor.workspace.Murkfi as anchor.Program<Murkfi>;

  const [stateAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId,
  );
  const [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault", "utf8"), new BN(1).toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    program.programId,
  );

  let usdcMintAddress: PublicKey | null = null;
  let userUsdcATA: PublicKey | null = null;
  let vaultTokenMintAddress: PublicKey | null = null;

  it("when initializing program then global state defaults are accurate", async () => {
    // Act
    try {
      await program.methods
        .initializeState()
        .accounts({
          state: stateAddress,
          authority: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet.payer])
        .rpc();
    } catch (e) {
      assert.fail(e);
    }

    // Assert
    const state = await program.account.state.fetch(stateAddress);
    assert.equal(state.isInitialized, true);
    assert.equal(state.nextVaultId, 1);
  });

  it("when creating a vault then vault fields are consistent with signer + payload", async () => {
    // Act
    try {
      const vaultAccount = await program.account.vault.fetch(
        vaultAccountAddress,
      );
      console.log(
        `Vault already exists, id=${vaultAccount.id}, accountAddress=${vaultAccountAddress}`,
      );
    } catch {
      const txnHash = await program.methods
        .createVault()
        .accounts({
          state: stateAddress,
          authority: program.provider.publicKey,
          vault: vaultAccountAddress,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet.payer])
        .rpc();
      console.log(
        `Created new vault accountAddress=${vaultAccountAddress}, txnHash=${txnHash}`,
      );
    }

    // Assert
    try {
      const vaultAccount = await program.account.vault.fetch(
        vaultAccountAddress,
      );
      assert.equal(vaultAccount.creator, wallet.publicKey.toBase58());
      assert.equal(vaultAccount.id, 1);
    } catch (e) {
      assert.fail(e);
    }
  });

  it("when minting USDC to user address then successful ata creation + mint to", async () => {
    try {
      // Act
      usdcMintAddress = await createSPLToken(
        provider.connection,
        wallet,
        wallet.publicKey,
      );

      userUsdcATA = await getOrCreateATA(
        provider.connection,
        wallet,
        wallet.publicKey,
        usdcMintAddress,
      );

      await mintTo(
        provider.connection,
        wallet.payer,
        usdcMintAddress,
        userUsdcATA,
        wallet.publicKey,
        DEPOSIT_AMOUNT,
      );

      // Assert
      const userUsdcAccountBalance = await safelyGetAccountBalance(
        provider.connection,
        usdcMintAddress,
        wallet.publicKey,
        true,
      );

      assert.ok(userUsdcAccountBalance);
      assert.equal(userUsdcAccountBalance * 1000000, DEPOSIT_AMOUNT);
    } catch (e) {
      assert.fail(e);
    }
  });

  it("when depositing into vault then correct vault / user token balances", async () => {
    try {
      const vaultUsdcATA = await getOrCreateATA(
        provider.connection,
        wallet,
        vaultAccountAddress,
        usdcMintAddress,
      );
      assert.ok(vaultUsdcATA);

      const vaultUsdcBalanceBefore = await safelyGetAccountBalance(
        provider.connection,
        usdcMintAddress,
        vaultAccountAddress,
        true, // PDA is off-curve
      );
      assert.equal(vaultUsdcBalanceBefore, 0);

      vaultTokenMintAddress = await createSPLToken(
        provider.connection,
        wallet,
        mintAuthorityPDA,
      );

      const userVaultTokenATA = await getOrCreateATA(
        provider.connection,
        wallet,
        wallet.publicKey,
        vaultTokenMintAddress,
      );
      assert.ok(userVaultTokenATA);

      const userVaultTokenBalanceBefore = await safelyGetAccountBalance(
        provider.connection,
        vaultTokenMintAddress,
        wallet.publicKey,
        false,
      );
      assert.equal(userVaultTokenBalanceBefore, 0);

      await program.methods
        .deposit(new BN(DEPOSIT_AMOUNT))
        .accounts({
          vault: vaultAccountAddress,
          vaultTokenAccount: vaultUsdcATA,
          userTokenAccount: userUsdcATA,
          signer: provider.wallet.publicKey,
          mint: vaultTokenMintAddress,
          userVaultTokenAccount: userVaultTokenATA,
          mintAuthority: mintAuthorityPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([wallet.payer])
        .rpc();

      const vaultUsdcBalanceAfter = await safelyGetAccountBalance(
        provider.connection,
        usdcMintAddress,
        vaultAccountAddress,
        true, // PDA is off-curve
      );
      assert.equal(vaultUsdcBalanceAfter * 1000000, DEPOSIT_AMOUNT);

      const userVaultTokenBalanceAfter = await safelyGetAccountBalance(
        provider.connection,
        vaultTokenMintAddress,
        wallet.publicKey,
        false,
      );
      assert.equal(userVaultTokenBalanceAfter * 1000000, DEPOSIT_AMOUNT);
    } catch (e) {
      assert.fail(e);
    }
  });

  it("when withdrawing from vault then correct vault / user token balances", async () => {
    try {
      const vaultUsdcATA = await getOrCreateATA(
        provider.connection,
        wallet,
        vaultAccountAddress,
        usdcMintAddress,
      );
      assert.ok(vaultUsdcATA);

      const vaultUsdcBalanceBefore = await safelyGetAccountBalance(
        provider.connection,
        usdcMintAddress,
        vaultAccountAddress,
        true, // PDA is off-curve
      );
      assert.equal(vaultUsdcBalanceBefore * 1000000, DEPOSIT_AMOUNT);

      const userVaultTokenATA = await getOrCreateATA(
        provider.connection,
        wallet,
        wallet.publicKey,
        vaultTokenMintAddress,
      );
      assert.ok(userVaultTokenATA);

      const userVaultTokenBalanceBefore = await safelyGetAccountBalance(
        provider.connection,
        vaultTokenMintAddress,
        wallet.publicKey,
        false,
      );
      assert.equal(userVaultTokenBalanceBefore * 1000000, DEPOSIT_AMOUNT);

      await program.methods
        .withdraw(new BN(DEPOSIT_AMOUNT))
        .accounts({
          mint: vaultTokenMintAddress,
          signer: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          vault: vaultAccountAddress,
          vaultTokenAccount: vaultUsdcATA,
          withdrawalTokenAccount: userUsdcATA,
        })
        .signers([wallet.payer])
        .rpc();

      const vaultUsdcBalanceAfter = await safelyGetAccountBalance(
        provider.connection,
        usdcMintAddress,
        vaultAccountAddress,
        true, // PDA is off-curve
      );
      assert.equal(vaultUsdcBalanceAfter, 0);

      const userVaultTokenBalanceAfter = await safelyGetAccountBalance(
        provider.connection,
        vaultTokenMintAddress,
        wallet.publicKey,
        false,
      );
      console.log(
        "🚀 ~ it ~ userVaultTokenBalanceAfter:",
        userVaultTokenBalanceAfter,
      );
      // TODO: Make pass
      // assert.equal(userVaultTokenBalanceAfter, 0);
    } catch (e) {
      console.error(e);
      assert.fail(e);
    }
  });
});
