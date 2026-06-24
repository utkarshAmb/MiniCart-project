/* ============================================================
   MiniStore — front-end logic (vanilla JS)
   Responsibilities: load catalogue, search / filter / sort,
   product detail modal, and a persistent cart drawer.
   ============================================================ */

const CART_KEY = 'ministore.cart';
const FALLBACK_IMAGE = './placeholdrer.webp';

const state = {
  products: [],
  byId: new Map(),
  cart: loadCart(),        // [{ id, quantity }]
  filters: { category: 'All', query: '', sort: 'featured' },
};

const el = {
  grid: document.getElementById('products'),
  template: document.getElementById('product-card-template'),
  categoryList: document.getElementById('category-list'),
  sortSelect: document.getElementById('sort-select'),
  searchInput: document.getElementById('search-input'),
  searchForm: document.getElementById('search-form'),
  catalogTitle: document.getElementById('catalog-title'),
  resultCount: document.getElementById('result-count'),
  noResults: document.getElementById('no-results'),
  clearFilters: document.getElementById('clear-filters'),
  cartLines: document.getElementById('cart-lines'),
  cartFoot: document.getElementById('cart-foot'),
  cartTotal: document.getElementById('cart-total'),
  cartCount: document.getElementById('cart-count'),
  checkout: document.getElementById('checkout-btn'),
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatPrice = (cents) => currency.format(cents / 100);

/* ---------- Boot ---------- */
init();

async function init() {
  try {
    const res = await fetch('./product_data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.products = await res.json();
  } catch (err) {
    console.error('Could not load products:', err);
    el.grid.innerHTML =
      '<div class="empty-state"><h3>Couldn\'t load products</h3>' +
      '<p>Check that product_data.json is reachable, then refresh.</p></div>';
    return;
  }

  state.products.forEach((p) => state.byId.set(p.id, p));
  renderCategories();
  renderGrid();
  renderCart();
  bindEvents();
}

/* ---------- Events ---------- */
function bindEvents() {
  el.searchForm.addEventListener('submit', (e) => e.preventDefault());
  el.searchInput.addEventListener('input', debounce((e) => {
    state.filters.query = e.target.value.trim().toLowerCase();
    renderGrid();
  }, 180));

  el.sortSelect.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderGrid();
  });

  el.clearFilters.addEventListener('click', resetFilters);

  el.checkout.addEventListener('click', () => {
    if (!state.cart.length) return;
    el.checkout.textContent = 'Thanks! This is a demo \u2713';
    el.checkout.disabled = true;
    setTimeout(() => {
      el.checkout.textContent = 'Checkout';
      el.checkout.disabled = false;
    }, 2200);
  });
}

/* ---------- Categories sidebar ---------- */
function renderCategories() {
  const counts = state.products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});
  const categories = ['All', ...Object.keys(counts).sort()];

  el.categoryList.innerHTML = '';
  categories.forEach((cat) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.category = cat;
    btn.classList.toggle('is-active', cat === state.filters.category);
    btn.innerHTML =
      `<span>${cat}</span><span class="count">${cat === 'All' ? state.products.length : counts[cat]}</span>`;
    btn.addEventListener('click', () => {
      state.filters.category = cat;
      el.categoryList.querySelectorAll('button')
        .forEach((b) => b.classList.toggle('is-active', b === btn));
      renderGrid();
    });
    li.appendChild(btn);
    el.categoryList.appendChild(li);
  });
}

/* ---------- Product grid ---------- */
function getVisibleProducts() {
  const { category, query, sort } = state.filters;
  let list = state.products.filter((p) => {
    const inCategory = category === 'All' || p.category === category;
    const matchesQuery =
      !query ||
      p.title.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query);
    return inCategory && matchesQuery;
  });

  if (sort === 'price-asc') list.sort((a, b) => a.price_cents - b.price_cents);
  else if (sort === 'price-desc') list.sort((a, b) => b.price_cents - a.price_cents);
  else if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title));

  return list;
}

function renderGrid() {
  const list = getVisibleProducts();
  const { category, query } = state.filters;

  el.catalogTitle.textContent =
    query ? `Results for “${el.searchInput.value.trim()}”`
      : category === 'All' ? 'All products' : category;
  el.resultCount.textContent =
    `${list.length} ${list.length === 1 ? 'item' : 'items'}`;

  el.grid.innerHTML = '';
  el.noResults.hidden = list.length > 0;
  el.grid.hidden = list.length === 0;

  list.forEach((product) => el.grid.appendChild(buildCard(product)));
}

function buildCard(product) {
  const node = el.template.content.cloneNode(true);
  const card = node.querySelector('.product-card');
  const img = node.querySelector('.product-image');

  card.dataset.id = product.id;
  node.querySelector('.product-tag').textContent = product.category;
  node.querySelector('.product-title').textContent = product.title;
  node.querySelector('.product-price').textContent = formatPrice(product.price_cents);

  img.src = product.image;
  img.alt = product.title;
  img.addEventListener('error', () => { img.src = FALLBACK_IMAGE; }, { once: true });

  node.querySelector('.btn-view').addEventListener('click', () => openModal(product.id));
  node.querySelector('.btn-add-trigger').addEventListener('click', (e) => addToCart(product.id, e.currentTarget));

  return node;
}

/* ---------- Product modal ---------- */
let productModal;
function openModal(id) {
  const p = state.byId.get(id);
  if (!p) return;

  const img = document.getElementById('modal-image');
  img.src = p.image;
  img.alt = p.title;
  img.onerror = () => { img.src = FALLBACK_IMAGE; img.onerror = null; };

  document.getElementById('modal-category').textContent = p.category;
  document.getElementById('modal-title').textContent = p.title;
  document.getElementById('modal-price').textContent = formatPrice(p.price_cents);
  document.getElementById('modal-description').textContent = p.description || '';

  const addBtn = document.getElementById('modal-add');
  addBtn.onclick = () => { addToCart(p.id, addBtn); };

  productModal = productModal || new bootstrap.Modal('#productModal');
  productModal.show();
}

/* ---------- Cart ---------- */
function addToCart(id, btn) {
  const line = state.cart.find((item) => item.id === id);
  if (line) line.quantity += 1;
  else state.cart.push({ id, quantity: 1 });

  saveCart();
  renderCart();
  flashButton(btn);
}

function changeQty(id, delta) {
  const line = state.cart.find((item) => item.id === id);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) {
    state.cart = state.cart.filter((item) => item.id !== id);
  }
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  state.cart = state.cart.filter((item) => item.id !== id);
  saveCart();
  renderCart();
}

function cartTotalCents() {
  return state.cart.reduce((sum, item) => {
    const p = state.byId.get(item.id);
    return sum + (p ? p.price_cents * item.quantity : 0);
  }, 0);
}

function cartItemCount() {
  return state.cart.reduce((n, item) => n + item.quantity, 0);
}

function renderCart() {
  const count = cartItemCount();

  // header badge
  el.cartCount.textContent = count;
  el.cartCount.hidden = count === 0;

  if (!state.cart.length) {
    el.cartLines.innerHTML = `
      <div class="cart-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p>Your cart is empty. Add something from the catalogue to get started.</p>
      </div>`;
    el.cartFoot.hidden = true;
    return;
  }

  el.cartLines.innerHTML = '';
  state.cart.forEach((item) => {
    const p = state.byId.get(item.id);
    if (!p) return;

    const row = document.createElement('div');
    row.className = 'cart-line';
    row.innerHTML = `
      <div class="cart-line-media"><img src="${p.image}" alt="" /></div>
      <div>
        <p class="cart-line-title">${p.title}</p>
        <div class="cart-line-meta">
          <div class="qty">
            <button type="button" aria-label="Decrease quantity" data-act="dec">&minus;</button>
            <span>${item.quantity}</span>
            <button type="button" aria-label="Increase quantity" data-act="inc">+</button>
          </div>
          <button type="button" class="cart-remove" data-act="remove">Remove</button>
        </div>
      </div>
      <div class="cart-line-price">${formatPrice(p.price_cents * item.quantity)}</div>`;

    const thumb = row.querySelector('img');
    thumb.addEventListener('error', () => { thumb.src = FALLBACK_IMAGE; }, { once: true });

    row.querySelector('[data-act="dec"]').addEventListener('click', () => changeQty(item.id, -1));
    row.querySelector('[data-act="inc"]').addEventListener('click', () => changeQty(item.id, 1));
    row.querySelector('[data-act="remove"]').addEventListener('click', () => removeFromCart(item.id));

    el.cartLines.appendChild(row);
  });

  el.cartTotal.textContent = formatPrice(cartTotalCents());
  el.cartFoot.hidden = false;
}

/* ---------- Persistence ---------- */
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch {
    /* storage unavailable (e.g. private mode) — cart stays in memory */
  }
}

/* ---------- Helpers ---------- */
function resetFilters() {
  state.filters = { category: 'All', query: '', sort: 'featured' };
  el.searchInput.value = '';
  el.sortSelect.value = 'featured';
  el.categoryList.querySelectorAll('button')
    .forEach((b) => b.classList.toggle('is-active', b.dataset.category === 'All'));
  renderGrid();
}

function flashButton(btn) {
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = 'Added \u2713';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1000);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
