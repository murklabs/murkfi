import fs from "fs";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import type { MurkVaultManager } from "../target/types/murk_vault_manager";
import {
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";

// Configure the client to use the local cluster
// anchor.setProvider(anchor.AnchorProvider.env());

// Configure the client to use the devnet cluster
const connection = new Connection("https://api.devnet.solana.com");
const keypair = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync("./devnet-wallet.json").toString()),
  ),
);
const wallet = new Wallet(keypair);
const confirmOptions: web3.ConfirmOptions = {
  commitment: "finalized",
  preflightCommitment: "confirmed",
};
const provider = new AnchorProvider(connection, wallet, confirmOptions);
anchor.setProvider(provider);

const program = anchor.workspace
  .MurkVaultManager as anchor.Program<MurkVaultManager>;

// Devnet test token address
const USDC_MINT_ADDRESS = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"; // https://solscan.io/address/3ApJ7QVfy4qMDfbGS5DfdSBDoZuyV6vtPKHLwpravXDV?cluster=devnet
const VAULT_ID = 2;

// getNumberDecimals gets the decimal numbers for a given SPL token
// Decimal numbers are dynamic since each SPL can define their own
const getNumberDecimals = async (mintAddress: string): Promise<number> => {
  const info = await program.provider.connection.getParsedAccountInfo(
    new PublicKey(mintAddress),
  );
  return (info.value?.data as anchor.web3.ParsedAccountData).parsed.info
    .decimals as number;
};

// getOrCreateVault gets a vault account program address and creates the vault
const getOrCreateVault = async (vaultId: number): Promise<PublicKey> => {
  let [vaultAccountAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault", "utf8"),
      new BN(vaultId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId,
  );

  try {
    // Get vault to check if it already exists
    const vaultAccount = await program.account.vault.fetch(vaultAccountAddress);
    console.log(
      `Vault already exists, id=${vaultAccount.id}, accountAddress=${vaultAccountAddress}`,
    );
  } catch {
    const txnHash = await program.methods
      .createVault(new BN(vaultId))
      .accounts({
        authority: program.provider.publicKey,
        vault: vaultAccountAddress,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([wallet.payer])
      .rpc();
    console.log(
      `Created new vault id=${vaultId}, accountAddress=${vaultAccountAddress}, txnHash=${txnHash}`,
    );
  }
  return vaultAccountAddress;
};

// getUsdcAccountBalance gets the balance of the account key USDC associated token account
const getUsdcAccountBalance = async (
  accountKey: PublicKey,
): Promise<number | undefined> => {
  try {
    // Vault USDC token account
    const ataKey = await getAssociatedTokenAddress(
      new PublicKey(USDC_MINT_ADDRESS),
      accountKey,
      true,
    );
    if (!ataKey) {
      console.log(
        `Account key=${accountKey} not have a USDC associated token account. Short-circuiting.`,
      );
      return;
    }

    const tokenAmount = await connection.getTokenAccountBalance(ataKey);
    if (!tokenAmount.value.uiAmount) {
      throw new Error("No balance found");
    }

    return tokenAmount.value.uiAmount;
  } catch (err) {
    console.log("Error getting USDC ATA account, error=", err);
  }
};

const depositUsdc = async (
  vaultKey: PublicKey,
  amount: number,
): Promise<string | undefined> => {
  // User USDC token account
  const userTokenAccountKey = await getUserUsdcAccountKey(wallet.publicKey);
  console.log(`User USDC token account=${userTokenAccountKey.toString()}`);
  if (!userTokenAccountKey) {
    console.log("User does not have a USDC token account. Short-circuiting.");
    return;
  }

  // Vault USDC token account
  const vaultTokenAccountKey = await getOrCreateVaultUsdcAccountKey(vaultKey);
  if (!vaultTokenAccountKey) {
    console.log(
      "Vault does not have a USDC token account and failed to create one. Short-circuiting.",
    );
    return;
  }

  const confirmOptions: ConfirmOptions = {
    commitment: "finalized",
    maxRetries: 3,
  };
  const txnHash = await program.methods
    .depositUsdc(new BN(amount))
    .accounts({
      vault: vaultKey,
      vaultTokenAccount: vaultTokenAccountKey,
      userTokenAccount: userTokenAccountKey,
      signer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc(confirmOptions);

  return txnHash;
};

const getUserUsdcAccountKey = async (userKey: PublicKey) => {
  try {
    const usdcAccount = await getAssociatedTokenAddress(
      new PublicKey(USDC_MINT_ADDRESS),
      userKey,
    );
    return usdcAccount;
  } catch (error) {
    console.log("User does not have a USDC token account.");
  }
};

const getOrCreateVaultUsdcAccountKey = async (
  vaultKey: PublicKey,
): Promise<PublicKey | undefined> => {
  try {
    const vaultUsdcAccountKey = await getAssociatedTokenAddress(
      new PublicKey(USDC_MINT_ADDRESS),
      vaultKey,
      true,
    );

    const vaultUsdcAccountInfo =
      await connection.getAccountInfo(vaultUsdcAccountKey);
    if (vaultUsdcAccountInfo) {
      console.log(
        `Vault USDC account already exists, vaultUsdcTokenAccountKey=${vaultUsdcAccountKey}`,
      );
      return vaultUsdcAccountKey;
    }

    console.log("Vault USDC account does not exist, creating...");
    const confirmOptions: ConfirmOptions = {
      commitment: "finalized",
      maxRetries: 3,
    };
    const newVaultUsdcAccount = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet.payer,
      new PublicKey(USDC_MINT_ADDRESS),
      vaultKey,
      true,
      undefined,
      confirmOptions,
    );

    console.log(
      `Vault USDC account created, vaultUsdcTokenAccount=${newVaultUsdcAccount}`,
    );
    return vaultUsdcAccountKey;
  } catch (err) {
    console.log("Error creating program USDC account, error=", err);
  }
};

const withdrawUsdc = async (vaultKey: PublicKey, amount: number) => {
  // User USDC token account
  const userTokenAccountKey = await getUserUsdcAccountKey(wallet.publicKey);
  if (!userTokenAccountKey) {
    console.log("User does not have a USDC token account. Short-circuiting.");
    return;
  }

  // Vault USDC token account
  const vaultTokenAccountKey = await getOrCreateVaultUsdcAccountKey(vaultKey);
  if (!vaultTokenAccountKey) {
    console.log(
      "Vault does not have a USDC token account and failed to create one. Short-circuiting.",
    );
    return;
  }

  const confirmOptions: ConfirmOptions = {
    commitment: "finalized",
    maxRetries: 3,
  };
  const txnHash = await program.methods
    .withdrawUsdc(new BN(amount))
    .accounts({
      vault: vaultKey,
      vaultTokenAccount: vaultTokenAccountKey,
      withdrawalTokenAccount: userTokenAccountKey,
      signer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc(confirmOptions);

  return txnHash;
};

const main = async () => {
  try {
    console.log("Starting client...");
    const vaultKey = await getOrCreateVault(VAULT_ID);

    const userUsdcAccountBalance1 = await getUsdcAccountBalance(
      wallet.publicKey,
    );
    console.log(`User USDC balance=${userUsdcAccountBalance1}`);
    const vaultUsdcAccountBalance1 = await getUsdcAccountBalance(vaultKey);
    console.log(`Vault USDC balance=${vaultUsdcAccountBalance1}`);

    const amount = 1;
    const depTxnHash = await depositUsdc(vaultKey, amount);
    console.log(
      `Deposit of ${amount} USDC to vaultKey=${vaultKey.toString()} complete, txnHash=${depTxnHash}`,
    );

    const userUsdcAccountBalance2 = await getUsdcAccountBalance(
      wallet.publicKey,
    );
    console.log(`User USDC balance=${userUsdcAccountBalance2}`);
    const vaultUsdcAccountBalance2 = await getUsdcAccountBalance(vaultKey);
    console.log(`Vault USDC balance=${vaultUsdcAccountBalance2}`);

    const withTxnHash = await withdrawUsdc(vaultKey, amount);
    console.log(
      `Withdrawal of ${amount} USDC to vaultKey=${vaultKey.toString()} complete, txnHash=${withTxnHash}`,
    );

    const userUsdcAccountBalance3 = await getUsdcAccountBalance(
      wallet.publicKey,
    );
    console.log(`User USDC balance=${userUsdcAccountBalance3}`);
    const vaultUsdcAccountBalance3 = await getUsdcAccountBalance(vaultKey);
    console.log(`Vault USDC balance=${vaultUsdcAccountBalance3}`);

    console.log("Client finished!");
  } catch (err) {
    console.log("Error running client, error=", err);
  }
};

main();
