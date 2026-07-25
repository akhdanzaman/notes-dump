# Finance Accounting Update

## Spreadsheet structure

Saving transactions continue to use the existing `Transactions` ledger rather than a second transaction table:

- `Type`: `saving` or `saving_withdrawal`
- `Wallet` / `Payment_Method`: source wallet
- `To_Wallet`: destination wallet when the saving moves into a dedicated investment wallet
- `Saving_Goal_ID`: relation to the target in `Saving Goals & Investments`

Loan transactions also remain in `Transactions` and use the existing fields:

- `Type`: `loan_out`, `loan_in`, `loan_repayment_in`, or `loan_repayment_out`
- `Wallet` / `Payment_Method`: related wallet
- `Loan_Counterparty`
- `Loan_Account_ID`
- `Loan_Due_Date`

No duplicate loan or saving amount column is required. Dashboard values are derived from the ledger.

## Accounting policy

| Transaction | Total Expense | Total Assets | Total Debt | Wallet annotation |
| --- | ---: | ---: | ---: | --- |
| `loan_out` / Saya meminjamkan | increases | unchanged | unchanged | increases `Dipinjamkan` |
| `loan_repayment_in` / Terima kembali | unchanged | unchanged | unchanged | decreases `Dipinjamkan` |
| `loan_in` / Saya meminjam | unchanged | increases by cash received | increases by outstanding payable | none |
| `loan_repayment_out` / Bayar kembali | unchanged | decreases by payment | decreases by payment | none |

The remaining receivable is attached to the wallet used when the loan was opened. Total Debt combines outstanding borrowed loans and credit-card debt.
