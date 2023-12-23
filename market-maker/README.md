# MM Bot Todo

## How To Run

## Dependencies

1. Install Homebrew

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Install python3

```
brew install python3
```

3. Install Anaconda

```
brew install --cask anaconda
```

Execute via the CLI:

1. Create conda environment

```
conda create -n zeta python=3.10
```

2. Activate conda environment

```
conda activate zeta
```

2. Run market maker
   python market_maker -s 10 -e 25 -url <RPC_URL>

```

python market_maker -s 10 -e 25 -url https://mainnet.helius-rpc.com/?api-key=b0545ad4-8d0e-48cd-8e65-ebce93d72181

## High Importance

- [ ] Create a client abstraction to rotate RPC API keys to prevent rate limits @mmnavarr
- [ ] Investigate how to monitor orderbook once to stop race conditions on updating fair_price + update_quotes() @rtalamas
- [ ] Push bot information to csv files to better track executions, orders, and other metrics @rtalamas

# Low Importance

- [ ] Better encapsulate the trigger_order_update() function to not rely on MM class implementation details
```
