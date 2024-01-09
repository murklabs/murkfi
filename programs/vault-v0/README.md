# How to run

1. Build the program with `anchor build`
2. Deploy the program with `anchor deploy`
   If you need SOL use https://faucet.solana.com/
3. Run the client with `anchor run client`

## Debug

If you run into the below error:

> error[E0658]: use of unstable library feature 'build_hasher_simple_hash_one

Try running the following command:

```
cargo update -p ahash@0.8.7 --precise 0.8.6
```
