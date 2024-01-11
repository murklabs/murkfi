import BN from "bn.js";
import { PublicKey, Connection, Commitment } from "@solana/web3.js";
import {
  MintLayout,
  createMint,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { Wallet } from "@coral-xyz/anchor";

/**
 * Creates a new SPL token mint and sets the calling wallet as the mint authority.
 * The function creates the mint with a specified number of decimals and returns
 * the new mint's public key.
 *
 * @param connection - The Solana blockchain connection to use.
 * @param wallet - The wallet creating the SPL token. This wallet will be set as the mint authority.
 * @returns A Promise that resolves to the PublicKey of the newly created SPL token mint.
 */
export const createSPLToken = async (
  connection: Connection,
  wallet: Wallet,
  authority: PublicKey
): Promise<PublicKey> => {
  return await createMint(
    connection,
    wallet.payer,
    authority, // can be anything but should be the vault program
    null, // dont need freeze authority now
    6 // standard decimals for now
  );
};

/**
 * Encodes a human-readable amount into a BigNumber (BN) considering the token's decimals.
 *
 * @param amount - The amount to be encoded. Can be a number or a string.
 * @param decimals - The number of decimals the SPL token uses.
 * @returns A BigNumber (BN) representing the amount in the smallest unit of the token.
 */
export const encodeAmount = (amount: number | string, decimals: number): BN => {
  let amountStr = amount.toString();
  let [integerPart, fractionalPart = ""] = amountStr.split(".");
  fractionalPart = fractionalPart.padEnd(decimals, "0");

  const fullAmountStr = integerPart + fractionalPart.slice(0, decimals);

  return new BN(fullAmountStr);
};

/**
 * Decodes a BigNumber (BN) amount to a human-readable string, considering the token's decimals.
 * This is useful for converting amounts from the smallest unit of an SPL token back to a standard format.
 *
 * @param amount - The BigNumber amount to be decoded, representing the token amount in its smallest unit.
 * @param decimals - The number of decimals the SPL token uses.
 * @returns A string representing the human-readable amount.
 */
export const decodeAmount = (amount: BN, decimals: number): string => {
  const divisor = new BN(10).pow(new BN(decimals));
  const integerPart = amount.div(divisor);
  const fractionalPart = amount.mod(divisor);
  const fractionalPartStr = fractionalPart.toString(10).padStart(decimals, "0");

  return `${integerPart.toString()}.${fractionalPartStr}`;
};

/**
 * Retrieves the total supply of an SPL token in a human-readable format.
 * This function fetches the mint account information and decodes it to find the total supply,
 * adjusting for the token's decimals.
 *
 * @param connection - The Solana blockchain connection.
 * @param mintAddress - The public key of the SPL token's mint account.
 * @returns A string representing the total supply of the token in a human-readable format.
 */
export const getSPLTotalSupply = async (
  connection: Connection,
  mintAddress: PublicKey
): Promise<string> => {
  const mintAccountInfo = await connection.getAccountInfo(mintAddress);
  if (!mintAccountInfo) {
    throw new Error("Mint account not found");
  }
  const tokenMintData = MintLayout.decode(mintAccountInfo.data);
  const totalSupply = tokenMintData.supply;
  const decimals = tokenMintData.decimals;
  const divisor = BigInt(Math.pow(10, decimals));
  const baseSupply = totalSupply / divisor;
  return baseSupply.toString();
};

/**
 * Creates a new ATA for a given SPL token and wallet.
 *
 * @param connection - The Solana blockchain connection.
 * @param wallet - The wallet creating the ATA.
 * @param pubKey - The public key of the wallet creating the ATA.
 * @param tokenKey - The public key of the SPL token's mint account.
 * @param commitment - The Solana commitment level to use.
 * @returns A Promise that resolves to the PublicKey of the newly created ATA.
 */
export const getOrCreateATA = async (
  connection: Connection,
  wallet: Wallet,
  pubKey: PublicKey,
  tokenKey: PublicKey,
  commitment: Commitment
): Promise<PublicKey> => {
  try {
    const ata = await getAssociatedTokenAddress(tokenKey, pubKey, true);
    console.log(`ATA: ${ata}`);
    const ataInfo = await connection.getAccountInfo(ata);
    if (ataInfo) {
      console.log(`Attached token account exists, ATA: ${ata}`);
      return ata; // ATA exists, return its address
    }

    console.log("ATA does not exist, creating...");
    const newATA = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      tokenKey,
      pubKey,
      true,
      commitment
    );

    console.log(
      `Attached token account created, ATA: ${newATA.address.toString()}`
    );
    return newATA.address; // Return the address of the new ATA
  } catch (err) {
    console.error("Error in getOrCreateATA:", err);
    throw new Error(err.message); // More specific error message
  }
};
