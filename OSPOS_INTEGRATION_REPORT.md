# OSPOS Catalog & Inventory Integration Report

This report documents the architectural design, communication protocols, endpoints, and data flows governing the integration between the **Tile Vista** virtual 3D showroom system and the legacy **OSPOS (Open Source Point Of Sale)** system.

---

## 1. Overview
In our production architecture, **OSPOS is the single source of truth for inventory items and stock levels**.
The Tile Vista database (`tilevista_db`) stores only the visual attributes (such as 3D GLB models, scales, rotations, material properties, and tags) associated with these items. The backend dynamically merges live stock data and metadata from the OSPOS API with local design assets, serving unified payloads to the client applications.

---

## 2. Authentication & Connection Method
* **Protocol**: HTTP/HTTPS REST API.
* **Authentication Scheme**: Bearer Token Authentication.
* **Authorization Header**: `Authorization: Bearer <token>`
* **Token Location**: Set in backend environment configurations (`OSPOS_API_TOKEN` / `OSPOS_API_AUTH_TOKEN`).
* **Connection Handshake**: Encapsulated using NestJS `HttpModule` and `HttpService` with a configured connection timeout limit of **5000ms**.

---

## 3. Key Endpoints & Queries Used

### External OSPOS Endpoints Called
The backend integration service (`OsposIntegrationService`) invokes the following legacy REST endpoints:

1. **GET `<OSPOS_API_BASE_URL>/items`**
   * **Purpose**: Fetches the entire active catalog of products containing raw names, SKUs, descriptions, pricing, and showroom inventory counts.
   * **Return Payload**: Array of items mapping to the `OsposItem` interface.
2. **GET `<OSPOS_API_BASE_URL>/stock/:itemId`**
   * **Purpose**: Fetches live quantity available for a specific SKU or item ID.
   * **Return Payload**: Captures raw high-precision decimals (e.g. `"250.0000"`), which are parsed and sanitized into floating-point numbers.
3. **GET `<OSPOS_API_BASE_URL>/categories`**
   * **Purpose**: Retrieves the hierarchical category taxonomy for catalog classification. All frontend category filtering relies on this live data rather than a local database table.

### Tile Vista Internal Database Mappings (Prisma Schema)
The integration maps POS data with visual assets via:
* **Table `products`**: Stores `ospos_item_id` (unique integer mapping to OSPOS primary key) and local `product_id` (UUID). (Note: The `category_id` field was removed to rely entirely on live OSPOS categories).
* **Table `product_assets`**: Links visual properties (`image_url`, `glb_url`, material/color family, visibility status) to `product_id`.
* **Table `asset_sizes`**: Defines physical unit dimensions (width, height, depth) tied to `asset_id`.
* **Table `asset_transformations`**: Details 3D model transforms (rotation, scale X/Y/Z) tied to `asset_id`.

---

## 4. Data Flow Diagram (Text Description)

```
[Storefront Customer]          [Admin Dashboard]
        |                             |
        v                             v
+------------------+          +-----------------------+
|  Public Catalog  |          |  Asset Management     |
|   /api/items     |          |  /api/admin/items     |
+--------+---------+          +-----------+-----------+
         |                                |
         +---------------+----------------+
                         |
                         v
            +---------------------------+
            |    ProductsController     |
            +------------+--------------+
                         | (Invokes)
                         v
            +---------------------------+
            |      ProductsService      |
            +------------+--------------+
                         |
      +------------------+------------------+
      | (Queries)                           | (Fetches Catalog/Stock)
      v                                     v
+-----------+                       +-----------------------------+
| MySQL DB  |                       |  OsposIntegrationService    |
| (Prisma)  |                       +--------------+--------------+
+-----------+                                      |
                                                   | (Bearer Auth REST API)
                                                   v
                                            +-------------+
                                            |  OSPOS POS  |
                                            |   Server    |
                                            +-------------+
```

1. **Catalog Retrieval**:
   * Customer requests `/api/items`.
   * `ProductsService` queries OSPOS API `fetchAllItems` and local DB `products` in parallel.
   * Merges records by mapping OSPOS primary keys to visual assets, returning a unified `UnifiedItemDto` payload.
2. **Checkout Order Placement**:
   * Order submitted.
   * `OrdersService` checks OSPOS live stock balance and subtracts active local `inventory_reservations` to determine effective available stock.
   * If stock is sufficient, creates an order in pending state and reserves stock.
3. **Downstream Deductions**:
   * Administrators approve orders, which triggers OSPOS API stock deduction routines in a transaction block. If deduction or endpoint fails, the local status update rolls back.

---

## 5. Troubleshooting Guide

### Issue: "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
* **Scenario**: Admin is unable to log in, and local web console requests return a 401 status.
* **Root Cause**: The default database SQL dump (`tilevista.sql`) contains structure definitions but no initial data. An empty `users` table means the admin account does not exist.
* **Solution**: Seed the local database using the project's CommonJS database script to populate default admin (`admin@tilevista.com` / `admin123`) and customer accounts:
  ```bash
  node database/prisma/seed.cjs
  ```

### Issue: OSPOS Connection Offline (Stale Data Warnings)
* **Scenario**: Storefront details pages load, but stock displays `0` and a stale data warning is visible.
* **Root Cause**: The local POS computer (XAMPP instance) or connection gateway is temporarily offline or refused connection.
* **Solution**: The backend automatically falls back to safe defaults when POS connection times out. Verify the remote POS host (`OSPOS_API_BASE_URL` in `.env`) is running, reachable, and the `OSPOS_API_TOKEN` matches the POS server authentication secret.
