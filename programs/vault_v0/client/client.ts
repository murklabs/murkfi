import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { MurkBank } from "../target/types/murk_bank";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";

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

const program = anchor.workspace.MurkBank as anchor.Program<MurkBank>;

// Devnet test token address
const USDC_MINT_ADDRESS = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
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

const vaultProgramId = new anchor.web3.PublicKey(
  "HLniiF5rZHiGWtoiGQgYBCvEQjejEhCz1cDupe5MAxtK",
);

// createVault gets a vault account program address and creates the vault
const createVault = async () => {
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
    console.log(`Vault already exists, id=${vaultAccount.id}`);
  } catch {
    await program.methods
      .createVault(new anchor.BN(VAULT_ID))
      .accounts({
        authority: program.provider.publicKey,
        vault: vaultAccountAddress,
        vaultUsdcAccount: vaultUsdcAccountAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([wallet.payer])
      .rpc();
    console.log(
      `Created new vault id=${VAULT_ID}, accountAddress=${vaultAccountAddress}`,
    );
  }
};

// getVaultBalanceById gets a vaults balance based on it's id (read-only)
// by looking up the program address based on given id and then fetching it from the program
const getVaultBalanceById = async (id: number): Promise<anchor.BN> => {
  let [vaultAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new BN(id).toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const vaultAccount = await program.account.vault.fetch(vaultAccountAddress);
  return vaultAccount.usdcBalance;
};

const depositUsdc = async (vault: anchor.web3.PublicKey, amount: number) => {
  /// User USDC token account
  const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
    program.provider,
    USDC_MINT_ADDRESS,
    program.provider.wallet.publicKey,
  );

  // Program USDC token account
  const programUsdcAccount = await getProgramUsdcAccount();

  await program.methods.depositUsdc(new BN(amount)).accounts({
    vault,
    userUsdcAccount: userUsdcAccount.address,
    signer: program.provider.wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    // Add program USDC account
  });

  console.log(`Deposited ${amount} USDC to vault ${vault.toString()}`);
};

const withdrawUsdc = async (vault: anchor.web3.PublicKey, amount: number) => {
  // TODO: Implement
  console.log("Withdrawn", amount, "USDC from vault");
};

const main = async () => {
  console.log("Starting client...");
  await createVault();

  const balance = await getVaultBalanceById(VAULT_ID);
  console.log("Vault USDC balance:", balance.toNumber());

  // await depositUsdc(vault, 100);

  // const balance = await getTokenAccountBalance(provider, vault);
  // console.log("Vault USDC balance:", balance.uiAmount);

  // await withdrawUsdc(vault, 50);

  // const newBalance = await getTokenAccountBalance(provider, vault);
  // console.log("New vault USDC balance:", newBalance.uiAmount);
  console.log("Client finished!");
};

main();
