# M.G.STORE — Firestore Product Catalog Schema

## Design decision: single `products` collection, category-discriminated

One flat collection (`products`) holds every item, distinguished by a `category` field, rather than five separate collections. Reasons:

- Firestore has no cross-collection `JOIN`/`OR` query — a shared "all products" view (search bar, homepage grid, low-stock report) would otherwise need 5 separate listeners merged client-side.
- Category-specific attributes (battery health, IMEI, wattage...) live inside a single `specs` map, so the shared fields (price, stock, images) stay uniform for sorting/filtering while category fields stay flexible.
- Composite indexes on `category + <field>` give you the filtering speed of separate collections without losing the unified view.

If the catalog is expected to grow into the tens of thousands of items *per category* with heavy independent pagination, a per-category collection (or a top-level collection group) is the alternative — but for a shop catalog this single-collection design is the better tradeoff.

## Collection: `products/{productId}`

Common fields (every document, every category):

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name (Latin/English) |
| `nameAr` | string | Arabic display name |
| `category` | string | One of: `new_phones`, `used_phones`, `accessories`, `chargers_cables`, `screen_protectors` |
| `brand` | string | e.g. "Apple", "Samsung", "Anker" — indexed for filtering |
| `price` | number | Selling price (EGP) |
| `costPrice` | number | Optional, for margin reports — keep out of any public-read rules |
| `quantity` | number | Current stock count |
| `sku` | string | Internal code / barcode |
| `imageUrl` | string | Primary product photo URL (Firebase Storage) |
| `description` | string | Free text |
| `status` | string | `active` \| `archived` — archived items are soft-deleted (excluded from storefront queries) |
| `searchKeywords` | array\<string\> | Lowercased tokens (name, brand, model) for prefix search |
| `createdAt` | timestamp | `serverTimestamp()` |
| `updatedAt` | timestamp | `serverTimestamp()`, refreshed on every update |

Category-specific fields live under a nested `specs` map, so the document shape only grows where relevant:

**`new_phones`**
```
specs: {
  storage: "256GB",
  ram: "8GB",
  color: "Titanium Black",
  imei1: "3549...",
  imei2: "3549...",         // optional, dual SIM
  warrantyMonths: 12
}
```

**`used_phones`** (extends new_phones fields, plus the two fields the brief calls out)
```
specs: {
  storage: "128GB",
  ram: "6GB",
  color: "Space Gray",
  imei1: "3549...",
  imei2: null,
  batteryHealth: 87,           // number, 0–100
  condition: "excellent",      // "excellent" | "good" | "fair" | "poor"
  accessoriesIncluded: ["box", "cable"]
}
```

**`accessories`**
```
specs: {
  type: "case",              // e.g. case, earbuds, powerbank, smartwatch
  compatibleWith: "iPhone 15 Pro"
}
```

**`chargers_cables`**
```
specs: {
  type: "charger",           // "charger" | "cable"
  connectorType: "USB-C",
  wattage: 20,
  length: "1m"                // for cables
}
```

**`screen_protectors`**
```
specs: {
  compatibleModel: "iPhone 15 Pro",
  material: "tempered_glass"  // "tempered_glass" | "plastic" | "hydrogel"
}
```

## Required composite indexes

Firestore auto-suggests these on first query failure, but declare them upfront in `firestore.indexes.json`:

```json
{
  "indexes": [
    { "collectionGroup": "products", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "category", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "products", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "category", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "price", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "products", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "category", "order": "ASCENDING" },
      { "fieldPath": "brand", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]}
  ]
}
```

## Notes on the `specs` map approach

- Querying *inside* a map works fine for equality (`where("specs.condition", "==", "excellent")`) but Firestore cannot range-filter two different map fields in one query without a matching composite index on those exact dot-paths — add one only if you actually ship that filter combination.
- `batteryHealth` and `condition` are kept inside `specs` (not top-level) since they only apply to `used_phones`; this keeps the top-level document schema identical across categories, which is what makes the single-collection design clean.
