import fs from "fs";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import type { MurkVaultManager } from "../target/types/murk_vault_manager";
import { ConfirmOptions, Connection, Keypair } from "@solana/web3.js";

// Configure the client to use the local cluster
// anchor.setProvider(anchor.AnchorProvider.env());

// Configure the client to use the devnet cluster
const connection = new Connection("https://api.devnet.solana.com");
const keypair = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync("./devnet-wallet.json").toString()),
  ),
);
const wallet = new anchor.Wallet(keypair);
const opts: web3.ConfirmOptions = {
  preflightCommitment: "confirmed",
};
const provider = new anchor.AnchorProvider(connection, wallet, opts);
anchor.setProvider(provider);

const program = anchor.workspace
  .MurkVaultManager as anchor.Program<MurkVaultManager>;

// Devnet test token address
const USDC_MINT_ADDRESS = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"; // https://solscan.io/address/3ApJ7QVfy4qMDfbGS5DfdSBDoZuyV6vtPKHLwpravXDV?cluster=devnet
const VAULT_ID = 1;

// getNumberDecimals gets the decimal numbers for a given SPL token
// Decimal numbers are dynamic since each SPL can define their own
const getNumberDecimals = async (mintAddress: string): Promise<number> => {
  const info = await program.provider.connection.getParsedAccountInfo(
    new anchor.web3.PublicKey(mintAddress),
  );
  return (info.value?.data as anchor.web3.ParsedAccountData).parsed.info
    .decimals as number;
};

// createVault gets a vault account program address and creates the vault
const createVault = async (): Promise<anchor.web3.PublicKey> => {
  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault", "utf8"),
      new anchor.BN(VAULT_ID).toArrayLike(Buffer, "le", 8),
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
      .createVault(new anchor.BN(VAULT_ID))
      .accounts({
        authority: program.provider.publicKey,
        vault: vaultAccountAddress,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([wallet.payer])
      .rpc();
    console.log(
      `Created new vault id=${VAULT_ID}, accountAddress=${vaultAccountAddress}, txnHash=${txnHash}`,
    );
  }
  return vaultAccountAddress;
};

// getVaultBalanceById gets a vaults balance based on it's id (read-only)
// by looking up the program address based on given id and then fetching it from the program
const getVaultBalanceById = async (id: number): Promise<anchor.BN> => {
  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new anchor.BN(id).toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const vaultAccount = await program.account.vault.fetch(vaultAccountAddress);
  return vaultAccount.usdcBalance;
};

// getTokenAccountBalance gets the balance of the vault's USDC associated token account
const getVaultUsdcAccountBalance = async (
  vaultKey: anchor.web3.PublicKey,
): Promise<number | undefined> => {
  try {
    // Vault USDC token account
    const vaultUsdcAccountKey = await getAssociatedTokenAddress(
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
      vaultKey,
      true,
    );
    if (!vaultUsdcAccountKey) {
      console.log(
        "Vault does not have a USDC token account and failed to create one. Short-circuiting.",
      );
      return;
    }

    const tokenAmount =
      await connection.getTokenAccountBalance(vaultUsdcAccountKey);

    if (!tokenAmount.value.uiAmount) {
      throw new Error("No balance found");
    }

    return tokenAmount.value.uiAmount;
  } catch (err) {
    console.log("Error getting vault USDC account, error=", err);
  }
};

const depositUsdc = async (
  vaultKey: anchor.web3.PublicKey,
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
    .depositUsdc(new anchor.BN(amount))
    .accounts({
      vault: vaultKey,
      vaultTokenAccount: vaultTokenAccountKey,
      userTokenAccount: userTokenAccountKey,
      signer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc(confirmOptions);

  console.log(
    `Deposited ${amount} USDC to vaultKey=${vaultKey.toString()}, txnHash=${txnHash}`,
  );

  return txnHash;
};

const getUserUsdcAccountKey = async (userKey: anchor.web3.PublicKey) => {
  try {
    const usdcAccount = await getAssociatedTokenAddress(
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
      userKey,
    );
    return usdcAccount;
  } catch (error) {
    console.log("User does not have a USDC token account.");
  }
};

const getOrCreateVaultUsdcAccountKey = async (
  vaultKey: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey | undefined> => {
  try {
    const vaultUsdcAccountKey = await getAssociatedTokenAddress(
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
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
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
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

const withdrawUsdc = async (vault: anchor.web3.PublicKey, amount: number) => {
  // TODO: Implement
  console.log("Withdrawn", amount, "USDC from vault");
};

const main = async () => {
  console.log("Starting client...");
  const vaultKey = await createVault();

  const balance1 = await getVaultBalanceById(VAULT_ID);
  console.log("Vault USDC balance:", balance1.toNumber());

  const txnHash = await depositUsdc(vaultKey, 1);

  const vaultUsdcAccountBalance = await getVaultUsdcAccountBalance(vaultKey);
  console.log("🚀 ~ main ~ vaultUsdcAccount:", vaultUsdcAccountBalance);

  const balance2 = await getVaultBalanceById(VAULT_ID);
  console.log("Vault USDC balance:", balance2.toNumber());

  // await withdrawUsdc(vault, 50);

  // const newBalance = await getTokenAccountBalance(provider, vault);
  // console.log("New vault USDC balance:", newBalance.uiAmount);
  console.log("Client finished!");
};

main();
