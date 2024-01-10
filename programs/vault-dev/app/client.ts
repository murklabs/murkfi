import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  encodeAmount,
  decodeAmount,
  getSPLTotalSupply,
  createSPLToken,
} from "./utils";
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { MurkVaultManager } from "../target/types/murk_vault_manager";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";

// Configure the client to use the local cluster
// anchor.setProvider(anchor.AnchorProvider.env());

// Configure the client to use the devnet cluster
const connection = new Connection("https://api.devnet.solana.com");
const keypair = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync("./devnet-wallet.json").toString())
  )
);
const wallet = new anchor.Wallet(keypair);
const opts: web3.ConfirmOptions = {
  preflightCommitment: "confirmed",
};
const provider = new anchor.AnchorProvider(connection, wallet, opts);
anchor.setProvider(provider);

const program = anchor.workspace
  .MurkVaultManager as anchor.Program<MurkVaultManager>;

const USDC_MINT_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; // USDC token address on devnet
const VAULT_ID = 1;

// getNumberDecimals gets the decimal numbers for a given SPL token
// Decimal numbers are dynamic since each SPL can define their own
const getNumberDecimals = async (mintAddress: string): Promise<number> => {
  const info = await program.provider.connection.getParsedAccountInfo(
    new anchor.web3.PublicKey(mintAddress)
  );
  return (info.value?.data as anchor.web3.ParsedAccountData).parsed.info
    .decimals as number;
};

// createVault gets a vault account program address and creates the vault
const createVault = async (
  commitment: web3.Commitment
): Promise<anchor.web3.PublicKey> => {
  console.log(`Finding vault...`);
  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault", "utf8"),
      new anchor.BN(VAULT_ID).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  try {
    // Get vault to check if it already exists
    const vaultAccount = await program.account.vault.fetch(vaultAccountAddress);
    console.log(
      `Vault already exists, id=${vaultAccount.id}, accountAddress=${vaultAccountAddress}`
    );
  } catch {
    let tx = await program.methods
      .createVault(new anchor.BN(VAULT_ID))
      .accounts({
        authority: program.provider.publicKey,
        vault: vaultAccountAddress,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([wallet.payer])
      .rpc({
        commitment,
      });
    console.log(
      `Created new vault id=${VAULT_ID}, accountAddress=${vaultAccountAddress}`
    );
  }
  return vaultAccountAddress;
};

// getVaultBalanceById gets a vaults balance based on it's id (read-only)
// by looking up the program address based on given id and then fetching it from the program
const getVaultBalanceById = async (id: number): Promise<anchor.BN> => {
  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new BN(id).toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  const vaultAccount = await program.account.vault.fetch(vaultAccountAddress);
  return vaultAccount.usdcBalance;
};

const depositUsdc = async (
  vault: anchor.web3.PublicKey,
  amount: BN,
  commitment: web3.Commitment
): Promise<string | undefined> => {
  // User USDC token account
  const userTokenAccount = await getUserUsdcAccount(
    wallet.publicKey,
    commitment
  );
  console.log(`User USDC token account=${userTokenAccount.toString()}`);

  // Vault USDC token account
  const vaultTokenAccount = await getOrCreateVaultUsdcAccount(
    vault,
    commitment
  );
  console.log(`Vault USDC token account=${vaultTokenAccount.toString()}`);

  const txnHash = await program.methods
    .depositUsdc(amount)
    .accounts({
      vault: vault,
      vaultTokenAccount: vaultTokenAccount,
      userTokenAccount: userTokenAccount,
      signer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc({
      commitment,
    });
  console.log("🚀 ~ file: client.ts:125 ~ txnHash:", txnHash);

  console.log(`Deposited ${amount} USDC to vault ${vault.toString()}`);
  return txnHash;
};

const getUserUsdcAccount = async (
  userKey: anchor.web3.PublicKey,
  commitment: web3.Commitment
) => {
  try {
    const usdcAccount = await getAssociatedTokenAddress(
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
      userKey
    );
    const userUSDCAccountInfo = await connection.getAccountInfo(usdcAccount);
    if (userUSDCAccountInfo) {
      return usdcAccount;
    }
    console.log("User USDC account does not exist, creating...");
    const newUserUSDCAccount = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet.payer,
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
      userKey,
      true,
      commitment
    );
    console.log(`Created new user USDC token account | ${newUserUSDCAccount}`);
    return usdcAccount;
  } catch (error) {
    throw new Error(error);
  }
};

const getOrCreateVaultUsdcAccount = async (
  vaultKey: anchor.web3.PublicKey,
  commitment: web3.Commitment
) => {
  try {
    const vaultUsdcAccount = await getAssociatedTokenAddress(
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
      vaultKey,
      true
    );

    const vaultUsdcAccountInfo = await connection.getAccountInfo(
      vaultUsdcAccount
    );
    if (vaultUsdcAccountInfo) {
      console.log(
        `Vault USDC account already exists, vaultUsdcTokenAccount=${vaultUsdcAccount}`
      );
      return vaultUsdcAccount;
    }

    console.log("Vault USDC account does not exist, creating...");
    const newVaultUsdcAccount = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet.payer,
      new anchor.web3.PublicKey(USDC_MINT_ADDRESS),
      vaultKey,
      true,
      commitment
    );

    console.log(
      `Vault USDC account created, vaultUsdcTokenAccount=${newVaultUsdcAccount}`
    );
    return vaultUsdcAccount;
  } catch (err) {
    throw new Error(err);
  }
};

const withdrawUsdc = async (vault: anchor.web3.PublicKey, amount: number) => {
  // TODO: Implement
  console.log("Withdrawn", amount, "USDC from vault");
};

const main = async () => {
  console.log("Starting client...");
  const decimals = await getNumberDecimals(USDC_MINT_ADDRESS);
  const vaultKey = await createVault("finalized");

  const balance1 = await getVaultBalanceById(VAULT_ID);
  console.log("Vault USDC balance:", decodeAmount(balance1, decimals));

  await depositUsdc(vaultKey, encodeAmount(0.1, decimals), "finalized");

  const balance2 = await getVaultBalanceById(VAULT_ID);
  console.log("Vault USDC balance:", decodeAmount(balance2, decimals));

  console.log("Client finished!");
};

main();
