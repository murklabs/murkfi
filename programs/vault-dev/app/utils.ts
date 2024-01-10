import BN from "bn.js";

// encodeAmount encodes a number to a BN based on the decimals of the SPL
export const encodeAmount = (amount: number | string, decimals: number): BN => {
  let amountStr = amount.toString();
  let [integerPart, fractionalPart = ""] = amountStr.split(".");
  fractionalPart = fractionalPart.padEnd(decimals, "0");

  const fullAmountStr = integerPart + fractionalPart.slice(0, decimals);

  return new BN(fullAmountStr);
};

// decodeAmount decodes a BN to a number based on the decimals of the SPL
export const decodeAmount = (amountBN: BN, decimals: number): string => {
  const divisor = new BN(10).pow(new BN(decimals));
  const integerPart = amountBN.div(divisor);
  const fractionalPart = amountBN.mod(divisor);
  const fractionalPartStr = fractionalPart.toString(10).padStart(decimals, "0");

  return `${integerPart.toString()}.${fractionalPartStr}`;
};
