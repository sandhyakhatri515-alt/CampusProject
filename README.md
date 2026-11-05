# CampusShare - Campus Resource Sharing Platform

Students lend and borrow cameras, calculators, books, lab gear and more.

- **frontend/** React 19 + Vite, plain CSS design system (light and dark mode)
- **backend/** Express + MySQL (mysql2), JWT auth, image uploads

## Setup

1. Configure `backend/.env` (quote any value that contains `#`):

   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASS="your-password"
   DB_NAME=campus_resource_sharing
   JWT_SECRET=a-long-random-string
   PORT=5000
   ```

2. Create the tables and demo data (this DROPS and recreates every table):

   ```
   cd backend
   npm install
   npm run db:setup
   ```

3. Run both apps in two terminals:

   ```
   cd backend && npm run dev      # http://localhost:5000
   cd frontend && npm install && npm run dev   # http://localhost:5173
   ```

## Borrow flow and deposits

There is no payment gateway. Users keep a **deposit balance** in their wallet (sidebar > Wallet) and money is set aside from it when borrowing.

1. The student records a deposit on the **Wallet** page. This is a record only: no real payment happens, and each deposit gets a receipt number (DEP-000123) as proof.
2. Each item has an optional rental fee per day and an optional refundable **security deposit** (set by the owner).
3. To send a borrow request the student must hold **fee + security deposit** in their balance. That amount is set aside ("held") when the request is sent. Not enough balance blocks the request, with a one-click top-up.
4. Declined, auto-declined or cancelled requests are refunded in full.
5. The owner accepts, then clicks **Release item**. The held rental fee moves to the owner's balance and the item goes **On loan**.
6. Only the owner can **Confirm return**. The security deposit is then refunded to the borrower, and both sides can review each other.

All balance changes run in database transactions and are logged in `wallet_transactions`; admins see them under Admin > Deposits.

## Demo accounts

| Email | Password | Role |
| --- | --- | --- |
| admin@campus.edu | admin123 | Admin |
| alice@campus.edu | alice123 | Verified student |
| bob@campus.edu | bob123 | Verified student |
| charlie@campus.edu | charlie123 | Verified student |
| diana@campus.edu | diana123 | Unverified student |

## Database

`users` (with `wallet_balance`), `categories`, `resources` (with `deposit_amount`), `borrow_requests`, `reviews`, `notifications`, `wishlist`, `messages`, `reports`, `wallet_transactions`. See `backend/db/schema.sql`.
