import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { MurkVaultManager } from "../target/types/murk_vault_manager";
import { createSPLToken, getOrCreateATA } from "../app/utils";
import { TOKEN_PROGRAM_ID, mintTo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

describe("deposit", () => {
  const vaultId = 1;
  const depositAmount = 1000;
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = anchor.Wallet.local();
  const nonCreatorWallet = anchor.web3.Keypair.generate();
  const program = anchor.workspace
    .MurkVaultManager as anchor.Program<MurkVaultManager>;
  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new anchor.BN(vaultId).toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  it("deposits USDC into vault", async () => {
    const usdcMintAddress = await createSPLToken(
      provider.connection,
      wallet,
      wallet.publicKey
    );

    const user_USDC_ATA = await getOrCreateATA(
      provider.connection,
      wallet,
      wallet.publicKey,
      usdcMintAddress
    );
    let amount = BigInt(depositAmount);
    await mintTo(
      provider.connection,
      wallet.payer,
      usdcMintAddress,
      user_USDC_ATA,
      wallet.publicKey,
      amount
    );

    // init global state
    let [globalStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );
    try {
      await program.methods
        .initializeGlobalState()
        .accounts({
          globalState: globalStateAddress,
          authority: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet.payer])
        .rpc();
    } catch (e) {
      throw new Error(e);
    }
    console.log("Initialized global state");

    // create vault
    try {
      const vaultAccount = await program.account.vault.fetch(
        vaultAccountAddress
      );
      console.log(
        `Vault already exists, id=${vaultAccount.id}, accountAddress=${vaultAccountAddress}`
      );
    } catch {
      try {
        console.log("Creating new vault...");
        const txnHash = await program.methods
          .createVault()
          .accounts({
            authority: wallet.publicKey,
            globalState: globalStateAddress,
            vault: vaultAccountAddress,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([wallet.payer])
          .rpc();
        console.log(
          `Created new vault id=${vaultId}, accountAddress=${vaultAccountAddress}, txnHash=${txnHash}`
        );
      } catch (e) {
        throw new Error(e);
      }
    }
    const vault_USDC_ATA = await getOrCreateATA(
      provider.connection,
      wallet,
      vaultAccountAddress,
      usdcMintAddress
    );

    const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    );
    const vaultTokenMintAddress = await createSPLToken(
      provider.connection,
      wallet,
      mintAuthorityPDA
    );

    const user_VaultToken_ATA = await getOrCreateATA(
      provider.connection,
      wallet,
      wallet.publicKey,
      vaultTokenMintAddress
    );

    try {
      console.log("Depositing USDC into vault...");
      await program.methods
        .depositUsdc(new anchor.BN(depositAmount))
        .accounts({
          vault: vaultAccountAddress,
          vaultTokenAccount: vault_USDC_ATA,
          userTokenAccount: user_USDC_ATA,
          signer: provider.wallet.publicKey,
          mint: vaultTokenMintAddress,
          userVaultTokenAccount: user_VaultToken_ATA,
          mintAuthority: mintAuthorityPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([wallet.payer])
        .rpc();
    } catch (e) {
      throw new Error(e);
    }
    assert.ok(true);
  });
});
