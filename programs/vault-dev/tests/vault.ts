import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { MurkVaultManager } from "../target/types/murk_vault_manager";
import { createSPLToken, getOrCreateATA } from "../app/utils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("murk-vault-manager", () => {
  const vaultId = 1;

  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const wallet = anchor.Wallet.local();
  const nonCreatorWallet = anchor.web3.Keypair.generate();
  const program = anchor.workspace
    .MurkVaultManager as anchor.Program<MurkVaultManager>;

  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault", "utf8"),
      new anchor.BN(vaultId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  it("when creating a vault then vault fields are consistent with signer + payload", async () => {
    // Act
    try {
      const vaultAccount = await program.account.vault.fetch(
        vaultAccountAddress
      );
      console.log(
        `Vault already exists, id=${vaultAccount.id}, accountAddress=${vaultAccountAddress}`
      );
    } catch {
      const txnHash = await program.methods
        .createVault(new anchor.BN(vaultId))
        .accounts({
          authority: program.provider.publicKey,
          vault: vaultAccountAddress,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet.payer])
        .rpc();
      console.log(
        `Created new vault id=${vaultId}, accountAddress=${vaultAccountAddress}, txnHash=${txnHash}`
      );
    }

    // Assert
    const vaultAccount = await program.account.vault.fetch(vaultAccountAddress);
    assert.equal(vaultAccount.creator, wallet.publicKey.toBase58());
    assert.equal(vaultAccount.id, vaultId);
  });

  it("when freezing unfrozen vault then successful freeze", async () => {
    // Act
    await program.methods
      .freezeVault()
      .accounts({
        vault: vaultAccountAddress,
        signer: provider.wallet.publicKey,
      })
      .signers([wallet.payer])
      .rpc();

    // Assert
    const vault = await program.account.vault.fetch(vaultAccountAddress);
    assert.ok(vault.isFrozen);
  });

  it("when freezing vault with non-creator keypair then unauthorized error", async () => {
    try {
      // Act
      await program.methods
        .freezeVault()
        .accounts({
          vault: vaultAccountAddress,
          signer: nonCreatorWallet.publicKey,
        })
        .signers([nonCreatorWallet])
        .rpc();
    } catch (e) {
      assert.equal(e.error.errorCode.number, program.idl.errors[1].code); // MurkError::UnauthorizedVaultAccessError
    }
  });

  it("when freezing frozen vault then vault frozen error", async () => {
    try {
      // Act
      await program.methods
        .freezeVault()
        .accounts({
          vault: vaultAccountAddress,
          signer: provider.wallet.publicKey,
        })
        .signers([wallet.payer])
        .rpc();
    } catch (e) {
      assert.equal(e.error.errorCode.number, program.idl.errors[2].code); // MurkError::VaultFrozenError
    }
  });

  it("when unfreezing frozen vault then successful unfreeze", async () => {
    // Act
    await program.methods
      .unfreezeVault()
      .accounts({
        vault: vaultAccountAddress,
        signer: provider.wallet.publicKey,
      })
      .signers([wallet.payer])
      .rpc();

    // Assert
    const vault = await program.account.vault.fetch(vaultAccountAddress);
    assert.ok(!vault.isFrozen);
  });

  it("when unfreezing vault with non-creator keypair then unauthorized error", async () => {
    try {
      // Act
      await program.methods
        .unfreezeVault()
        .accounts({
          vault: vaultAccountAddress,
          signer: nonCreatorWallet.publicKey,
        })
        .signers([nonCreatorWallet])
        .rpc();
    } catch (e) {
      assert.equal(e.error.errorCode.number, program.idl.errors[1].code); // MurkError::UnauthorizedVaultAccessError
    }
  });

  it("when unfreezing unfrozen vault then vault unfrozen error", async () => {
    try {
      // Act
      await program.methods
        .unfreezeVault()
        .accounts({
          vault: vaultAccountAddress,
          signer: provider.wallet.publicKey,
        })
        .rpc();
    } catch (e) {
      assert.equal(e.error.errorCode.number, program.idl.errors[3].code); // MurkError::VaultUnfrozenError
    }
  });

  it("when closing unclosed vault then close the vault", async () => {
    // Act
    await program.methods
      .closeVault()
      .accounts({
        vault: vaultAccountAddress,
        signer: provider.wallet.publicKey,
      })
      .signers([wallet.payer])
      .rpc();

    // Assert
    const vault = await program.account.vault.fetch(vaultAccountAddress);
    assert.ok(vault.isClosed);
  });

  it("when closing vault with non-creator keypair then unauthorized error", async () => {
    try {
      // Act
      await program.methods
        .closeVault()
        .accounts({
          vault: vaultAccountAddress,
          signer: nonCreatorWallet.publicKey,
        })
        .signers([nonCreatorWallet])
        .rpc();
    } catch (e) {
      assert.equal(e.error.errorCode.number, program.idl.errors[1].code); // MurkError::UnauthorizedVaultAccessError
    }
  });

  it("when closing closed vault then do except vault closed error", async () => {
    try {
      // Act
      await program.methods
        .closeVault()
        .accounts({
          vault: vaultAccountAddress,
          signer: provider.wallet.publicKey,
        })
        .signers([wallet.payer])
        .rpc();
    } catch (e) {
      assert.equal(e.error.errorCode.number, program.idl.errors[4].code); // MurkError::VaultClosedError
    }
  });
});
describe("deposit", () => {
  const vaultId = 1;
  const depositAmount = 1000;
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const wallet = anchor.Wallet.local();
  const nonCreatorWallet = anchor.web3.Keypair.generate();
  const program = anchor.workspace
    .MurkVaultManager as anchor.Program<MurkVaultManager>;
  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault", "utf8"),
      new anchor.BN(vaultId).toArrayLike(Buffer, "le", 8),
    ],
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
      usdcMintAddress,
      "finalized"
    );
    // create vault
    await program.methods
      .createVault(new anchor.BN(vaultId))
      .accounts({
        authority: program.provider.publicKey,
        vault: vaultAccountAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([wallet.payer])
      .rpc({ commitment: "finalized" });

    const vault_USDC_ATA = await getOrCreateATA(
      provider.connection,
      wallet,
      vaultAccountAddress,
      usdcMintAddress,
      "finalized"
    );

    // deposit USDC
    await program.methods
      .depositUsdc(new anchor.BN(depositAmount))
      .accounts({
        vault: vaultAccountAddress,
        vaultTokenAccount: vault_USDC_ATA,
        userTokenAccount: user_USDC_ATA,
        signer: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet.payer])
      .rpc();
    assert.ok(true);
  });
});
