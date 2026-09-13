// ============================================================================
// M.G.STORE — Product Catalog Module (Firebase v9 modular SDK, Firestore)
// Scope: schema-aligned CRUD + real-time fetch/filter/render for the
// product catalog only (no cart, no sales, no auth logic here).
// ============================================================================

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "firebase/firestore";

// Assumes an initialized Firebase app is passed in from your app's entry
// point (e.g. firebase-init.js) — this module never calls initializeApp().
let db = null;
export function initCatalog(firebaseApp) {
  db = getFirestore(firebaseApp);
  return db;
}

const PRODUCTS_COLLECTION = "products";

export const CATEGORIES = Object.freeze({
  NEW_PHONES: "new_phones",
  USED_PHONES: "used_phones",
  ACCESSORIES: "accessories",
  CHARGERS_CABLES: "chargers_cables",
  SCREEN_PROTECTORS: "screen_protectors",
});

const CATEGORY_LABELS_AR = {
  [CATEGORIES.NEW_PHONES]: "موبايلات جديدة",
  [CATEGORIES.USED_PHONES]: "موبايلات مستعملة",
  [CATEGORIES.ACCESSORIES]: "إكسسوارات",
  [CATEGORIES.CHARGERS_CABLES]: "شواحن وصلات",
  [CATEGORIES.SCREEN_PROTECTORS]: "سكرينات",
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Builds lowercase search tokens from name/brand/model-ish text fields. */
function buildSearchKeywords({ name = "", nameAr = "", brand = "", specs = {} }) {
  const raw = [name, nameAr, brand, specs.color, specs.compatibleWith, specs.compatibleModel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  // unique word tokens, stripped of punctuation
  return [...new Set(raw.split(/\s+/).filter(Boolean))];
}

/** Validates the minimum required shape before writing to Firestore. */
function assertValidProduct(product) {
  if (!product.name) throw new Error("Product 'name' is required.");
  if (!Object.values(CATEGORIES).includes(product.category)) {
    throw new Error(`Invalid category: ${product.category}`);
  }
  if (typeof product.price !== "number" || product.price < 0) {
    throw new Error("Product 'price' must be a non-negative number.");
  }
  if (typeof product.quantity !== "number" || product.quantity < 0) {
    throw new Error("Product 'quantity' must be a non-negative number.");
  }
  if (product.category === CATEGORIES.USED_PHONES) {
    const bh = product.specs?.batteryHealth;
    if (bh != null && (typeof bh !== "number" || bh < 0 || bh > 100)) {
      throw new Error("specs.batteryHealth must be a number between 0 and 100.");
    }
  }
}

// ----------------------------------------------------------------------------
// CREATE
// ----------------------------------------------------------------------------

/**
 * Adds a new product document.
 * @param {Object} product - { name, nameAr, category, brand, price, costPrice,
 *   quantity, sku, imageUrl, description, specs }
 * @returns {Promise<string>} new document id
 */
export async function addProduct(product) {
  assertValidProduct(product);

  const payload = {
    name: product.name,
    nameAr: product.nameAr ?? "",
    category: product.category,
    brand: product.brand ?? "",
    price: product.price,
    costPrice: product.costPrice ?? null,
    quantity: product.quantity,
    sku: product.sku ?? "",
    imageUrl: product.imageUrl ?? "",
    description: product.description ?? "",
    specs: product.specs ?? {},
    status: "active",
    searchKeywords: buildSearchKeywords(product),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, PRODUCTS_COLLECTION), payload);
  return ref.id;
}

// ----------------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------------

/**
 * Patches an existing product. Only pass the fields that changed;
 * `specs` is replaced wholesale (merge specs client-side before calling
 * if you only want to change one sub-field).
 * @param {string} productId
 * @param {Object} changes
 */
export async function updateProduct(productId, changes) {
  if (!productId) throw new Error("productId is required.");

  const patch = { ...changes, updatedAt: serverTimestamp() };

  // Keep search keywords in sync if any searchable field changed.
  if (changes.name || changes.nameAr || changes.brand || changes.specs) {
    patch.searchKeywords = buildSearchKeywords({
      name: changes.name ?? "",
      nameAr: changes.nameAr ?? "",
      brand: changes.brand ?? "",
      specs: changes.specs ?? {},
    });
  }

  await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), patch);
}

/** Convenience: adjust stock by a positive or negative delta (e.g. after a sale/return). */
export async function adjustStock(productId, delta) {
  const { getDoc } = await import("firebase/firestore");
  const ref = doc(db, PRODUCTS_COLLECTION, productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Product not found.");
  const newQty = (snap.data().quantity ?? 0) + delta;
  if (newQty < 0) throw new Error("Stock cannot go negative.");
  await updateDoc(ref, { quantity: newQty, updatedAt: serverTimestamp() });
}

/** Soft delete — keeps the record for reports but hides it from storefront queries. */
export async function archiveProduct(productId) {
  await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
}

// ----------------------------------------------------------------------------
// DELETE (hard delete)
// ----------------------------------------------------------------------------

/** Permanently removes a product document. Prefer archiveProduct() for normal use. */
export async function deleteProduct(productId) {
  if (!productId) throw new Error("productId is required.");
  await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId));
}

// ----------------------------------------------------------------------------
// REAL-TIME READ / FILTER
// ----------------------------------------------------------------------------

/**
 * Subscribes to a live, filtered product list.
 *
 * @param {Object} filters
 *   @param {string} [filters.category] - one of CATEGORIES
 *   @param {string} [filters.brand]
 *   @param {number} [filters.minPrice]
 *   @param {number} [filters.maxPrice]
 *   @param {string} [filters.sortBy="createdAt"] - "createdAt" | "price"
 *   @param {"asc"|"desc"} [filters.sortDir="desc"]
 *   @param {number} [filters.pageSize=24]
 *   @param {DocumentSnapshot} [filters.startAfterDoc] - for pagination
 *   @param {boolean} [filters.includeArchived=false]
 * @param {(products: Array<Object>, lastDoc: DocumentSnapshot|null) => void} onData
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe function
 */
export function listenToProducts(filters = {}, onData, onError) {
  const {
    category,
    brand,
    minPrice,
    maxPrice,
    sortBy = "createdAt",
    sortDir = "desc",
    pageSize = 24,
    startAfterDoc = null,
    includeArchived = false,
  } = filters;

  const clauses = [];
  if (!includeArchived) clauses.push(where("status", "==", "active"));
  if (category) clauses.push(where("category", "==", category));
  if (brand) clauses.push(where("brand", "==", brand));

  // Range filters must target the same field used in orderBy() in Firestore.
  // If a price range is requested, force sorting by price to satisfy that rule.
  const effectiveSortBy = minPrice != null || maxPrice != null ? "price" : sortBy;
  if (minPrice != null) clauses.push(where("price", ">=", minPrice));
  if (maxPrice != null) clauses.push(where("price", "<=", maxPrice));

  clauses.push(orderBy(effectiveSortBy, sortDir));
  clauses.push(limit(pageSize));
  if (startAfterDoc) clauses.push(startAfter(startAfterDoc));

  const q = query(collection(db, PRODUCTS_COLLECTION), ...clauses);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const lastDoc = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null;
      onData(products, lastDoc);
    },
    (error) => {
      console.error("[mg-store-catalog] listenToProducts error:", error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Client-side text search over the already-fetched product list.
 * (Firestore has no native full-text search; for production-grade search,
 * pair this with Algolia/Typesense — this covers a lightweight in-app filter.)
 */
export function searchProducts(products, searchText) {
  if (!searchText) return products;
  const term = searchText.trim().toLowerCase();
  return products.filter((p) => (p.searchKeywords ?? []).some((kw) => kw.startsWith(term)));
}

// ----------------------------------------------------------------------------
// RENDERING
// ----------------------------------------------------------------------------

/**
 * Renders a product array into a container element as cards.
 * Framework-agnostic: swap this for your React/Vue render function if needed.
 * @param {HTMLElement} containerEl
 * @param {Array<Object>} products
 */
export function renderProducts(containerEl, products) {
  if (!containerEl) return;

  if (!products.length) {
    containerEl.innerHTML = `<p class="empty-state">لا توجد منتجات مطابقة.</p>`;
    return;
  }

  containerEl.innerHTML = products.map(renderProductCard).join("");
}

function renderProductCard(product) {
  const { id, name, nameAr, category, brand, price, quantity, imageUrl, specs = {} } = product;

  const extraLine = categorySpecLine(category, specs);
  const stockBadge =
    quantity > 0
      ? `<span class="badge badge-in-stock">متوفر (${quantity})</span>`
      : `<span class="badge badge-out-of-stock">غير متوفر</span>`;

  return `
    <article class="product-card" data-id="${id}" data-category="${category}">
      <img src="${imageUrl || "/assets/placeholder.png"}" alt="${escapeHtml(name)}" loading="lazy" />
      <div class="product-card-body">
        <h3>${escapeHtml(nameAr || name)}</h3>
        <p class="brand">${escapeHtml(brand || "")}</p>
        <p class="category-label">${CATEGORY_LABELS_AR[category] ?? category}</p>
        ${extraLine ? `<p class="spec-line">${extraLine}</p>` : ""}
        <p class="price">${price.toLocaleString("ar-EG")} ج.م</p>
        ${stockBadge}
      </div>
    </article>
  `;
}

function categorySpecLine(category, specs) {
  switch (category) {
    case CATEGORIES.USED_PHONES:
      return `الحالة: ${specs.condition ?? "-"} • صحة البطارية: ${specs.batteryHealth ?? "-"}%`;
    case CATEGORIES.NEW_PHONES:
      return `${specs.storage ?? ""} ${specs.ram ? "/ " + specs.ram : ""}`.trim();
    case CATEGORIES.CHARGERS_CABLES:
      return `${specs.type ?? ""} ${specs.wattage ? specs.wattage + "W" : ""}`.trim();
    case CATEGORIES.SCREEN_PROTECTORS:
      return specs.compatibleModel ?? "";
    case CATEGORIES.ACCESSORIES:
      return specs.compatibleWith ?? "";
    default:
      return "";
  }
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ----------------------------------------------------------------------------
// USAGE EXAMPLE (remove/adapt in production entry point)
// ----------------------------------------------------------------------------
/*
import { initializeApp } from "firebase/app";
import { initCatalog, listenToProducts, renderProducts, addProduct, CATEGORIES } from "./mg-store-catalog.js";

const app = initializeApp({  ...your config... });
initCatalog(app);

const grid = document.getElementById("product-grid");
let currentUnsubscribe = null;

function loadCategory(category) {
  if (currentUnsubscribe) currentUnsubscribe();
  currentUnsubscribe = listenToProducts(
    { category, sortBy: "createdAt", sortDir: "desc", pageSize: 30 },
    (products) => renderProducts(grid, products),
    (err) => alert("تعذر تحميل المنتجات: " + err.message)
  );
}

loadCategory(CATEGORIES.USED_PHONES);

// Example add:
// await addProduct({
//   name: "iPhone 13", nameAr: "آيفون 13", category: CATEGORIES.USED_PHONES,
//   brand: "Apple", price: 14500, quantity: 1, sku: "USED-IP13-001",
//   specs: { storage: "128GB", color: "Blue", batteryHealth: 89, condition: "excellent" }
// });
*/
