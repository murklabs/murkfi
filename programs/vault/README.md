# Murk Finance Protocol Design Document

## Program Workflow

### Initialization

- Initialize the program state
  - Contains the next available vault id for creating new vaults
- Create cross-margin account manager on Zeta
  - This account will be used to manage cross-margin accounts
- Create a protocol treasury [P~tr~] account to receive fees
- Set the protocol fees (protocol management fee and protocol performance fee)

### Create Vault

- Create a new vault account [V~a~]
  - The vault account will be owned by the user
  - The vault account will include:
    - A strategy name
    - A session time limit
    - Performance and management fees
    - A `vault_fee_address` address that will receive performance and management fee
- Create the vault's cross-margin account [V~cm~]
  - The cross-margin account will be owned by the vault account?

### Deposit to Vault

- Transfer funds from the user's account [U~a~] to the vault's cross-margin account

### Deposit from Vault to Cross-Margin Account

- Transfer funds from the vault's account [V~a~] to the vault's cross-margin account [V~cm~]

### Place Perpetual Order (Zeta)

- Place an order on Zeta Markets using the vault's cross-margin account [V~cm~]
  - Validate that the vault has an active session

### Cancel Perpetual Order (Zeta)

- Cancel an order on Zeta Markets using the vault's cross-margin account [V~cm~]

### End Session

- Needs to take place in order for withdrawals to be possible
- Closes positions on Zeta Markets using the vault's cross-margin account [V~cm~]
- Cancel all open orders on Zeta Markets using the vault's cross-margin account [V~cm~]
- Transfer funds from the vault's cross-margin account [V~cm~] to the vault's account [V~a~]
- Compute management fee and transfer to:
  - the `vault_fee_address` pubkey
  - the protocol treasury [P~tr~]
- Compute performance fee and transfer to:
  - the `vault_fee_address` pubkey
  - the protocol treasury [P~tr~]

### Withdrawal from Vault

- Withdraw funds from the vault's account [V~a~] to the user's account [U~a~]

## Formulas

Management Fee = (V~a~ Final Balance _ Management Fee Rate) _ (Session Time / 1 year)
Performance Fee = (V~a~ Final Balance - Management Fee) - Sum(V~a~ Initial Balance) \* Performance Fee Rate
