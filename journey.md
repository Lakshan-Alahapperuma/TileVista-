# Tile Vista Development Journey

This file documents the journey of refactoring and migrating the **Tile Vista** backend, implementing integrations, handling schema updates, and enhancing system resilience.

---

## 1. Initial State & Scope
We started with a mock database setup (`tilevista_db`) and a basic structure for the catalog and items. The target was to:
1. **OSPOS Point of Sale Integration**: Query stock balances live from OSPOS and normalize high-precision string numeric values (e.g. `"250.0000"`) into TypeScript numbers.
2. **Transactional Deductions**: Implement transaction boundaries to deduct stock from OSPOS during online order confirmations, rolling back database changes if the OSPOS connection fails.
3. **Resilience**: Ensure Storefront stability when local OSPOS instances (e.g., local XAMPP computers) are offline by using graceful timeouts and default fallback states (`stock = 0`, `isStaleData = true`).
4. **Database Schema Migration**: Swap out mock tables for a normalized, production-ready 28-table database schema from [tilevista.sql](file:///d:/Documents/TileVista/database/tilevista.sql).
5. **Architectural Naming Conventions**: Align database naming from `items` to `products`, but retain public API routing under `/items` to prevent breaking the Next.js frontend app.

---

## 2. Refactoring Steps & Implementation Path

### Phase 1: OSPOS Integration & Resilience
- **OSPOS Service & DTO**: Created `OsposIntegrationService` and `OsposStockResponseDto` to encapsulate Axios requests to OSPOS, handling token authentication, timeouts, and logging. If OSPOS fails, it catches errors and returns fallback quantities.
- **Resilient Catalog Mapping**: Added `isStaleData` flag to `UnifiedItemDto` and implemented fallback try/catch blocks in `ProductsService.findAll` and `ProductsService.findOne`. If OSPOS is unreachable, local database records are still retrieved and returned with fallback stock metadata, preventing web frontend crashes.

### Phase 2: Schema Migration & Prisma Integration
- **Database Introspection**: Updated database connections to target the new `tilevista` schema, pulling the 28 new tables (`products`, `product_assets`, `asset_transformations`, `tags`, `orders`, `order_items`, `users`, `room_designs`, etc.) via `npx prisma db pull`.
- **Regenerating Client**: Executed `prisma generate` to establish static type safety across the new models.

### Phase 3: Service-by-Service Refactoring
- **Auth & Users Service**: Refactored query calls to target the new `users` table instead of `user`. Handled field mappings (`user_id` -> `id`, `first_name` -> `firstName`, etc.) and preserved uppercase role enums (`CUSTOMER`/`ADMIN`) inside JWT tokens for frontend validation guards.
- **3D Room Designer**: Refactored `designer.service.ts` to map mock geometry models and layouts to the new `room_designs` table.
- **Product Module Consolidation**: Restored the primary `ProductsModule`, deprecated and deleted the temporary `items` module, and mapped the GET `/items` and `/admin/items` endpoints in `ProductsController` to `ProductsService`.
- **Orders & Checkout**: Refactored `OrdersService` to target `orders` and `order_items` tables, fetched OSPOS prices and stock live during checkout, and mapped order status enums to match lowercase MySQL database values.
- **Packages Service**: Refactored `packages.service.ts` to query `packages` and `package_items` tables and look up local product UUIDs using OSPOS item IDs.
- **Analytics Service**: Refactored `analytics.service.ts` to aggregate revenue using `subtotal` from `order_items`, sum up total sales using `total_amount`, and group items using `ospos_item_id`.

---

## 3. Verification & Build
The entire backend codebase has been validated using the TypeScript compiler:
```bash
npm run build
```
The build executes successfully without any compilation errors.

---

## 4. Current State & Code Cleanliness
* **Branch**: Dev branch `feature/ospos-integration`.
* **Codebase Health**: Redundant files from the old `items` module were fully deleted. There are no duplicate functions, files, or unused imports.
* **Commit**: Commits have been created to save all refactoring progress cleanly.

---

## 5. June 27, 2026 Session Updates: Admin Login Resolution & Codebase Audit
During this session, we audited the project structure and addressed a critical access issue:
* **Admin Login 401 Unauthorized Issue**: Investigated reports of admin users being unable to log in (returning a 401 response). Discovered that importing `database/tilevista.sql` only creates the relational table definitions but does not populate the initial data. Consequently, the `users` table is left empty.
  * **Solution**: To log in with default credentials (`admin@tilevista.com` / `admin123`), the database seeder must be run locally to insert mock records:
    ```bash
    node database/prisma/seed.cjs
    ```
* **OSPOS Integration Architecture Analysis**: Documented how the NestJS backend maps, queries, and deduplicates calls to the external OSPOS API using an HTTP data aggregation design, maintaining full storefront resilience via custom stale stock indicators.
* **Cleanup of Temporary/Orphaned Files**:
  * Deleted diagnostic scripts `backend/_check_users.cjs` and `backend/_test_login.cjs`.
  * Highlighted `database/prisma/seed.ts` as a redundant duplicate of `database/prisma/seed.cjs` (CommonJS version), marking it for cleanup to ensure code cleanliness.

---

## 6. June 27, 2026 Session Updates: Environment Consolidation & Seeding Automation
We optimized workspace hygiene and streamlined the configuration loading processes:
* **Consolidation of `.env` files**: 
  * Merged the OSPOS configurations from `backend/.env` into the root `.env` and `.env.example`, establishing a single source of truth configuration at the workspace root.
  * Installed `@nestjs/config` in the backend and configured it globally inside `AppModule` to load settings from `../.env` (the parent root directory).
  * Removed the duplicate/redundant local `backend/.env` file.
* **Database Seeding Improvements**:
  * Configured `prisma.seed` inside `backend/package.json` to execute `node ../database/prisma/seed.cjs`. This aligns standard `npx prisma db seed` calls to run the correct CommonJS database seeder.
  * Added programmatic loading (`process.loadEnvFile`) within `database/prisma/seed.cjs` so that running database seed operations inside child processes (e.g., from the Prisma CLI) automatically resolves the `DATABASE_URL` from the workspace root.
  * Safely deleted the redundant/unused TypeScript seed file (`database/prisma/seed.ts`).
* **Database Schema Cleanup**:
  * Deleted the obsolete `backend/prisma` directory containing outdated schema definitions and migration histories, establishing `database/prisma` as the sole source of truth for the database schema.


---

## 7. Category Model Cleanup & OSPOS Reliance
* **Removed Local `categories` Table**: Identified that the local `categories` Prisma model was dead weight, serving only as a placeholder to satisfy the `products.category_id` foreign key. No frontend or backend services actually read `category_name` from the local database.
* **Full OSPOS Category Delegation**: Cleaned up `products.service.ts` and `packages.service.ts` to remove dummy category creation. The application now fully relies on the live OSPOS API for all category and subcategory filtering across the frontend (Shop Catalogue, 3D Designer, Admin Inventory).
* **Database Schema Pruned**: Dropped the `categories` table and `category_id` column from the `products` table using a Prisma migration (`remove_unused_local_categories`), maintaining a leaner, sync-free schema.

## 8. June 29, 2026 Session Updates: Publishing Pipeline & Visibility Gates
We hardened the boundary between OSPOS inventory and the public storefront to prevent unfinished or unreviewed items from leaking to consumers.
* **Strict Visibility Gates**: Implemented `hasAssetEntry && is_visible` checks across the platform. Items missing a local `products` row or marked invisible are now explicitly stripped from public catalog lists, block single-product page access (returning 404), and reject checkout/cart attempts.
* **Cart Resilience**: Updated the cart logic to flag items that become unpublished after being added to a cart with an `isAvailable: false` flag, gracefully disabling checkout for those items instead of silently removing them.
* **Publishing Pipeline**: Built the `POST /admin/products/publish` endpoint to transition "pending review" items from OSPOS into the TileVista database. This endpoint runs a robust, ACID-compliant Prisma transaction that creates the `products`, `product_assets`, `asset_sizes`, and `asset_transformations` rows simultaneously, preventing orphaned DB states.
* **DTO Validation**: Hardened DTOs (`PublishProductDto` and `UpsertAssetDto`) with `@IsPositive()` and `@IsIn()` class-validator constraints to reject corrupted geometry/scale configurations from the admin panel.
