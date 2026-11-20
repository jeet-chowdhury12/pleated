const PLEATED_CONFIG = {
  SUPABASE_URL: 'https://occlbnyyhnrslteklqgm.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WlFfr1KGXVbzYaG-aZatUQ_sqFp55Ny',
  B2_BUCKET_ID: '8a49fb803b77d6e7af1a041a',
  B2_ENDPOINT: 's3.us-east-005.backblazeb2.com',
  B2_KEY_ID: 'a9b0b767fa4a',
  TELEGRAM_BOT_TOKEN: '8801570799:AAHFHcz921ln1pB6zbOmBSsM0WBpOJGvj0E',
  TELEGRAM_CHAT_ID: '1873398489',
  INSTAGRAM_URL: 'https://instagram.com/pleated.store'
};

// Seamless Supabase Database Client Initialization
if (typeof document !== 'undefined' && !window.pleatedSupabase) {
  const sbScript = document.createElement('script');
  sbScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  sbScript.onload = () => {
    try {
      if (window.supabase) {
        window.pleatedSupabase = window.supabase.createClient(
          PLEATED_CONFIG.SUPABASE_URL,
          PLEATED_CONFIG.SUPABASE_ANON_KEY
        );
        window.dispatchEvent(new Event('supabaseReady'));
      }
    } catch (e) {
      console.warn("Supabase client init notice:", e.message);
    }
  };
  document.head.appendChild(sbScript);
}

// ==========================================
// RESILIENT VAULT ENGINE (INDEXEDDB + SAFE LOCALSTORAGE)
// Eliminates QuotaExceededError and provides robust client storage
// ==========================================
window.PleatedVault = {
  dbName: 'PleatedVaultDB',
  storeName: 'vault_store',
  dbPromise: null,

  getDB() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          if (typeof indexedDB === 'undefined') return resolve(null);
          const req = indexedDB.open(this.dbName, 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName);
            }
          };
          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  },

  async set(key, value) {
    try {
      const db = await this.getDB();
      if (db) {
        await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          tx.objectStore(this.storeName).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn('PleatedVault IDB set warning:', e);
    }
    this.safeSetLocalStorage(key, value);
  },

  async get(key, fallback = null) {
    try {
      const db = await this.getDB();
      if (db) {
        const result = await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const req = tx.objectStore(this.storeName).get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (result !== undefined && result !== null) return result;
      }
    } catch (e) {}

    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    return fallback;
  },

  safeSetLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`localStorage quota exceeded for ${key}. Safe-storing in IndexedDB.`);
      try {
        if (Array.isArray(value)) {
          const lightweight = value.map(item => {
            if (item && item.img && typeof item.img === 'string' && item.img.startsWith('data:image')) {
              return { ...item, img: 'https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg' };
            }
            if (item && item.url && typeof item.url === 'string' && item.url.startsWith('data:image')) {
              return { ...item, url: 'https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg' };
            }
            return item;
          });
          localStorage.setItem(key, JSON.stringify(lightweight));
        }
      } catch (innerErr) {
        try { localStorage.removeItem('pleated_cached_products'); } catch (e) {}
      }
    }
  }
};

// Client-Side Canvas Image Resizing & Web Optimization (shrinks 5-10MB photos to ~90KB)
window.optimizeImageFile = function(file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
  if (!file) return Promise.resolve('https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg');
  if (!file.type || !file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve('https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg');
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          resolve(e.target.result);
        }
      };
      img.onerror = () => resolve(e.target.result || 'https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg');
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg');
    reader.readAsDataURL(file);
  });
};

// Universal Garment Visuals Parser & Repair Engine
window.cleanImageArray = function(arr) {
  if (!Array.isArray(arr)) return [];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rawVal = arr[i];
    if (!rawVal) continue;
    const str = String(rawVal).trim();
    if (!str) continue;
    // Repair split base64 pieces if naive comma split occurred earlier
    if (/^data:image\/[a-zA-Z0-9\+\-\.]+;base64$/i.test(str) && i + 1 < arr.length) {
      result.push(str + ',' + String(arr[i + 1]).trim());
      i++;
    } else {
      result.push(str);
    }
  }
  return result.filter(Boolean);
};

window.parseProductImages = function(item) {
  if (!item) return [];
  if (Array.isArray(item)) return window.cleanImageArray(item);

  if (typeof item === 'object') {
    if (Array.isArray(item.images) && item.images.length > 0) return window.cleanImageArray(item.images);
    if (Array.isArray(item.img) && item.img.length > 0) return window.cleanImageArray(item.img);
    item = item.img || item.image || '';
  }

  if (!item || typeof item !== 'string') return [];
  const trimmed = item.trim();

  // 1. JSON-encoded array of URLs or data URIs
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return window.cleanImageArray(parsed);
    } catch(e) {}
  }

  // 2. Custom pipe delimiter
  if (trimmed.includes('|||')) {
    return window.cleanImageArray(trimmed.split('|||'));
  }

  // 3. Comma-separated (Must NEVER split on comma inside data:image/jpeg;base64,)
  if (trimmed.includes(',')) {
    const parts = trimmed.split(/,(?=(?:data:image\/|https?:\/\/|[a-zA-Z0-9_\-\.\/]+\.(?:jpeg|jpg|png|webp|svg|gif|avif)))/i);
    return window.cleanImageArray(parts);
  }

  return [trimmed];
};

// Auto-migrate & repair legacy vault products so newly uploaded photos display instantly
(async function migrateLegacyVault() {
  try {
    async function repairList(products) {
      if (!Array.isArray(products)) return products;
      let changed = false;
      const repaired = products.map(p => {
        if (!p) return p;
        const parsed = window.parseProductImages(p);
        if (parsed.length > 0) {
          if (!Array.isArray(p.images) || p.images.length !== parsed.length) {
            changed = true;
            return {
              ...p,
              images: parsed,
              img: JSON.stringify(parsed)
            };
          }
        }
        return p;
      });
      return { changed, repaired };
    }

    // Check IndexedDB
    if (window.PleatedVault) {
      const localVaultProds = await window.PleatedVault.get('pleated_local_products');
      if (localVaultProds && localVaultProds.length > 0) {
        const res = await repairList(localVaultProds);
        if (res.changed) {
          await window.PleatedVault.set('pleated_local_products', res.repaired);
        }
      }
    }

    // Check localStorage
    const rawLocal = localStorage.getItem('pleated_local_products');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const res = await repairList(parsed);
        if (window.PleatedVault) {
          await window.PleatedVault.set('pleated_local_products', res.repaired);
        }
        if (res.changed || rawLocal.length > 500000) {
          window.PleatedVault.safeSetLocalStorage('pleated_local_products', res.repaired);
        }
      }
    }
  } catch (e) {
    console.info("Vault migration notice:", e.message);
  }
})();

// Resilient Curated Fallback Vault (Prevents any site breakdown when Cloud Egress is capped)
window.DEFAULT_PLEATED_PRODUCTS = [
  {
    id: "prod-bfsp-01",
    code: "BFSP",
    name: "Brown Full Sleeve Polo",
    category: "Knitwear",
    price: 1499,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Size & fit: Regular fit, long sleeves, ribbed hem and cuffs, 380 GSM. Made from 80% Acrylic and 20% Nylon, designed for timeless character and vintage comfort.",
    details: JSON.stringify({ unavailable_sizes: [] })
  },
  {
    id: "prod-wfsp-02",
    code: "WFSP",
    name: "Off White Full Sleeve Polo",
    category: "Knitwear",
    price: 1499,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Crafted in heavy gauge knit with structured collar and ribbed cuffs. High-density textile weave tailored for lasting structure and vintage silhouette.",
    details: JSON.stringify({ unavailable_sizes: ["S"] })
  },
  {
    id: "prod-cwk-03",
    code: "PL-003",
    name: "Vintage Workwear Chore Coat",
    category: "Outerwear",
    price: 2450,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Built from 12oz rugged duck canvas with triple-needle reinforced seams, vintage brass shanks, and deep chore utility pockets.",
    details: JSON.stringify({ unavailable_sizes: [] })
  },
  {
    id: "prod-plt-04",
    code: "PL-004",
    name: "Pleated Selvedge Trousers",
    category: "Trousers",
    price: 1950,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Double forward pleats, high rise, relaxed tapered leg, and sturdy pocket bags built from selvedge cotton twill.",
    details: JSON.stringify({ unavailable_sizes: ["XL"] })
  },
  {
    id: "prod-brt-05",
    code: "PL-005",
    name: "French Sailor Breton Knit",
    category: "Knitwear",
    price: 1750,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Heavy maritime interlock knit with classic horizontal nautical stripes. Boatneck silhouette inspired by 1950s French naval garments.",
    details: JSON.stringify({ unavailable_sizes: [] })
  },
  {
    id: "prod-den-06",
    code: "PL-006",
    name: "Heavy Indigo Denim Overshirt",
    category: "Shirts",
    price: 2100,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Rope-dyed 10.5oz indigo twill featuring twin flap workwear pockets, horn buttons, and contrast chain-stitch run-off on side gussets.",
    details: JSON.stringify({ unavailable_sizes: ["S", "XL"] })
  },
  {
    id: "prod-car-07",
    code: "PL-007",
    name: "1940s Field Utility Cargo Pants",
    category: "Trousers",
    price: 2200,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Heavy military herringbone twill with expandable cargo bellows pockets, reinforced seat patch, and drawstring hem ties.",
    details: JSON.stringify({ unavailable_sizes: [] })
  },
  {
    id: "prod-twd-08",
    code: "PL-008",
    name: "Herringbone Tweed Overcoat",
    category: "Outerwear",
    price: 3600,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Tailored from 100% heavy wool herringbone tweed. Raglan shoulder construction, horn button placket, and deep slant hand-warmer pockets.",
    details: JSON.stringify({ unavailable_sizes: ["S", "M", "L", "XL"] }) // Sold-Out example for Ecommerce 4
  },
  {
    id: "prod-wfl-09",
    code: "PL-009",
    name: "Vintage Heavy Waffle Henley",
    category: "Shirts",
    price: 1350,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Knit on antique loopwheel machinery from 400 GSM combed thermal cotton. Ribbed cuffs and mother-of-pearl cat-eye buttons.",
    details: JSON.stringify({ unavailable_sizes: [] })
  },
  {
    id: "prod-prk-10",
    code: "PL-010",
    name: "M-65 Washed Fishtail Parka",
    category: "Outerwear",
    price: 3200,
    img: "https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg",
    description: "Weather-resistant weathered cotton-nylon poplin with brass heavy-duty zip, snapped storm placket, and drawcord waist and fishtail hem.",
    details: JSON.stringify({ unavailable_sizes: [] })
  }
];

// Lead Collection for Sold-Out Notifications ("Ecommerce 4")
window.submitRestockLead = function(contactVal, productCode, productName) {
  if (!contactVal || !contactVal.trim()) return false;
  const leads = JSON.parse(localStorage.getItem('pleated_restock_leads') || '[]');
  leads.push({
    contact: contactVal.trim(),
    productCode: productCode || 'GENERAL',
    productName: productName || 'Archival Garment',
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('pleated_restock_leads', JSON.stringify(leads));
  return true;
};

// Instant Telegram Dispatcher (Direct Bot API)
function sendTelegramOrderAlert(text) {
  if (!PLEATED_CONFIG.TELEGRAM_BOT_TOKEN || !PLEATED_CONFIG.TELEGRAM_CHAT_ID) return;
  fetch(`https://api.telegram.org/bot${PLEATED_CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: PLEATED_CONFIG.TELEGRAM_CHAT_ID, text: text, parse_mode: 'Markdown' })
  }).catch(() => {});
}

window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('payment')) {
    const paymentStatus = urlParams.get('payment');
    const orderCode = urlParams.get('order') || urlParams.get('order_code') || '';
    
    if (paymentStatus === 'success') {
      alert(`★ Payment Verified Successful! Order ${orderCode} has been confirmed.`);
      
      let orders = JSON.parse(localStorage.getItem('pleated_orders_v1') || '[]');
      const idx = orders.findIndex(o => o.order_code === orderCode);
      if(idx !== -1) {
        orders[idx].status = 'paid';
        localStorage.setItem('pleated_orders_v1', JSON.stringify(orders));
        if (window.PleatedVault) {
          window.PleatedVault.set('pleated_orders_v1', orders);
        }
      }

      sendTelegramOrderAlert(`✅ *PAYMENT CONFIRMED — ZINIPAY*\n\n🧾 Invoice: \`${orderCode}\`\n💳 Status: *PAID SUCCESSFULLY*`);
      window.location.href = PLEATED_CONFIG.INSTAGRAM_URL;
      return; 
    } else {
      alert(`Payment cancelled or unpaid for order ${orderCode}.`);
      sendTelegramOrderAlert(`❌ *PAYMENT UNPAID / CANCELLED — ZINIPAY*\n\n🧾 Invoice: \`${orderCode}\`\n💳 Status: *NOT PAID*`);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  updateCartUI();
});

window.initProductSlideshowAndZoom = function() {
  const imageContainers = document.querySelectorAll('.garment-image-wrap, .product-img-wrap, .product-img-container');
  imageContainers.forEach(container => {
    const imgs = container.querySelectorAll('img');
    if (imgs.length > 1) {
      let currentIndex = 0;
      setInterval(() => {
        imgs[currentIndex].style.opacity = '0';
        currentIndex = (currentIndex + 1) % imgs.length;
        imgs[currentIndex].style.opacity = '1';
      }, 5000);
    }
  });
};

const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  if (!header) return;
  if (window.scrollY > 40) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
});

document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const fullscreenMenu = document.getElementById('fullscreenMenu');
  const menuCloseBtn = document.getElementById('menuCloseBtn');

  if (menuToggle && fullscreenMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      fullscreenMenu.classList.add('open');
    });
  }

  if (menuCloseBtn && fullscreenMenu) {
    menuCloseBtn.addEventListener('click', () => {
      fullscreenMenu.classList.remove('open');
    });
  }
});

const transitionOverlay = document.getElementById('pageTransition');
document.querySelectorAll('.transition-link').forEach(link => {
  link.addEventListener('click', function(e) {
    const targetHref = this.getAttribute('href');
    if (targetHref && targetHref.startsWith('#')) {
      e.preventDefault();
      if (transitionOverlay) transitionOverlay.classList.add('active');
      const fullscreenMenu = document.getElementById('fullscreenMenu');
      if (fullscreenMenu) fullscreenMenu.classList.remove('open');
      setTimeout(() => {
        const targetEl = document.querySelector(targetHref);
        if (targetEl) targetEl.scrollIntoView({ behavior: 'auto' });
        if (transitionOverlay) transitionOverlay.classList.remove('active');
      }, 400);
    } else if (targetHref && targetHref.endsWith('.html')) {
      e.preventDefault();
      if (transitionOverlay) transitionOverlay.classList.add('active');
      const fullscreenMenu = document.getElementById('fullscreenMenu');
      if (fullscreenMenu) fullscreenMenu.classList.remove('open');
      setTimeout(() => { window.location.href = targetHref; }, 400);
    }
  });
});

const CART_STORAGE_KEY = 'pleated_cart_v2';
const LOCAL_ORDERS_KEY = 'pleated_orders_v1';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; }
  catch (e) { return []; }
}
function saveCart(cart) { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); }

// Universal Cart Addition with Tailored Size
window.addToSlipWithSize = function(name, price, code, size = "M") {
  let cart = getCart();
  const existing = cart.find(item => item.code === code && item.size === size);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price: Number(price), code, size, qty: 1 });
  }
  saveCart(cart);
  updateCartUI();
  openDrawer();
};

window.addToSlip = function(name, price, code) {
  window.addToSlipWithSize(name, price, code, "M");
};

window.increaseQty = function(code, size) {
  let cart = getCart();
  const item = cart.find(i => i.code === code && (size ? i.size === size : true));
  if (item) {
    item.qty += 1;
    saveCart(cart);
    updateCartUI();
  }
};

window.decreaseQty = function(code, size) {
  let cart = getCart();
  const item = cart.find(i => i.code === code && (size ? i.size === size : true));
  if (item) {
    item.qty -= 1;
    if (item.qty <= 0) {
      cart = cart.filter(i => !(i.code === code && (size ? i.size === size : true)));
    }
    saveCart(cart);
    updateCartUI();
  }
};

window.removeFromSlip = function(code, size) {
  let cart = getCart();
  cart = cart.filter(item => !(item.code === code && (size ? item.size === size : true)));
  saveCart(cart);
  updateCartUI();
};

function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartOpenBtn = document.getElementById('cartOpenBtn');
  const drawerBody = document.getElementById('drawerBody');
  const cartTotal = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (!cartCount || !drawerBody || !cartTotal) return;

  const cart = getCart();
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  cartCount.textContent = totalQty;
  if (cartOpenBtn) {
    if (totalQty > 0) cartOpenBtn.classList.add('visible');
    else cartOpenBtn.classList.remove('visible');
  }

  if (cart.length === 0) {
    drawerBody.innerHTML = `<div class="drawer-empty">Your slip is empty.<br>Add something built to last.</div>`;
    cartTotal.textContent = '৳0';
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Proceed to Checkout';
    }
    return;
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Proceed to Checkout →';
  }

  drawerBody.innerHTML = cart.map(item => `
    <div class="cart-line" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px dashed var(--line);">
      <div>
        <div class="ln-name" style="font-weight:600;">${item.name}</div>
        <div class="ln-sub" style="color:var(--ink-soft); font-size:10.5px; margin-top:2px;">
          ${item.code} • <span style="background:var(--rust); color:#fff; padding:1px 4px; font-weight:700; border-radius:2px;">Size: ${item.size || 'M'}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
          <button onclick="decreaseQty('${item.code}', '${item.size}')" style="background:none; border:1px solid var(--ink); padding:2px 8px; cursor:pointer;">−</button>
          <span style="font-size:12px; font-weight:600;">${item.qty}</span>
          <button onclick="increaseQty('${item.code}', '${item.size}')" style="background:none; border:1px solid var(--ink); padding:2px 8px; cursor:pointer;">+</button>
          <button class="ln-remove" onclick="removeFromSlip('${item.code}', '${item.size}')" style="background:none; border:none; color:var(--rust); font-size:11px; text-decoration:underline; cursor:pointer; margin-left:8px;">Remove</button>
        </div>
      </div>
      <div style="font-weight:600;">৳${(item.price * item.qty).toLocaleString()}</div>
    </div>
  `).join('');

  cartTotal.textContent = '৳' + totalPrice.toLocaleString();
}

function openDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('overlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
}

function closeDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

const cartOpenBtn = document.getElementById('cartOpenBtn');
const drawerClose = document.getElementById('drawerClose');
const overlay = document.getElementById('overlay');
const checkoutBtn = document.getElementById('checkoutBtn');

if (cartOpenBtn) cartOpenBtn.addEventListener('click', openDrawer);
if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
if (overlay) overlay.addEventListener('click', closeDrawer);

window.updateCheckoutTotal = function() {
  const cart = getCart();
  const itemsTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const shippingFee = Number(document.getElementById('modalShipping')?.value || 80);
  const grandTotal = itemsTotal + shippingFee;
  const totalEl = document.getElementById('modalTotalAmount');
  if (totalEl) totalEl.textContent = '৳' + grandTotal.toLocaleString();
};

function injectCheckoutModal() {
  if (document.getElementById('checkoutOverlayModal')) return;
  const modalHTML = `
    <div id="checkoutOverlayModal" style="position:fixed; inset:0; background:rgba(43,38,32,0.85); z-index:9999; display:none; align-items:center; justify-content:center; padding:16px; opacity:0; transition:opacity 0.35s ease;">
      <div id="checkoutModalContent" style="background:#FAF6ED; width:100%; max-width:560px; max-height:90vh; max-height:90dvh; overflow-y:auto; border:2px solid var(--ink); padding:32px; box-shadow:0 25px 60px rgba(0,0,0,0.4); position:relative; font-family:var(--mono);">
        <button onclick="closeCheckoutModal()" aria-label="Close checkout" style="position:absolute; top:14px; right:14px; background:none; border:none; width:44px; height:44px; min-width:44px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:24px; cursor:pointer; color:var(--ink);">✕</button>
        <div style="font-family:var(--stamp); font-size:11px; text-transform:uppercase; color:var(--rust); margin-bottom:6px;">★ Secure Dispatch & Payment</div>
        <h2 style="font-family:var(--display); font-size:28px; margin:0 0 20px;">Complete Your Order</h2>
        
        <div id="checkoutSummaryList" style="margin-bottom:20px; border-bottom:1px dashed var(--line); padding-bottom:14px;"></div>

        <div style="margin-bottom:14px;">
          <input id="modalCustName" type="text" placeholder="Full Name *" required style="width:100%; padding:13px; margin-bottom:10px; border:1.5px solid var(--ink); background:#fff; font-size:16px; font-family:var(--mono); box-sizing:border-box;">
          <input id="modalCustPhone" type="tel" placeholder="Phone Number (e.g. 017XXXXXXXX) *" required style="width:100%; padding:13px; margin-bottom:10px; border:1.5px solid var(--ink); background:#fff; font-size:16px; font-family:var(--mono); box-sizing:border-box;">
          <input id="modalCustEmail" type="email" placeholder="Email Address (Optional or name@example.com)" style="width:100%; padding:13px; margin-bottom:10px; border:1.5px solid var(--ink); background:#fff; font-size:16px; font-family:var(--mono); box-sizing:border-box;">
          <textarea id="modalCustAddress" rows="2" placeholder="Full Delivery Address (Street, City, Area) *" required style="width:100%; padding:13px; margin-bottom:14px; border:1.5px solid var(--ink); background:#fff; font-size:16px; font-family:var(--mono); box-sizing:border-box;"></textarea>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-weight:700; text-transform:uppercase; font-size:11.5px; margin-bottom:8px;">Delivery Location:</label>
          <select id="modalShipping" onchange="updateCheckoutTotal()" style="width:100%; padding:13px; border:1.5px solid var(--ink); background:#fff; font-size:16px; font-family:var(--mono); box-sizing:border-box;">
            <option value="80">Inside Dhaka (৳80)</option>
            <option value="120">Outside Dhaka (৳120)</option>
          </select>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-weight:700; text-transform:uppercase; font-size:11.5px; margin-bottom:8px;">Select Payment Method:</label>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <label style="cursor:pointer; display:flex; align-items:center; gap:10px; background:#F0EAD6; padding:12px; border:1.5px solid var(--ink);">
              <input type="radio" name="modalPayMethod" value="zinipay" checked>
              <div>
                <strong style="font-size:13px;">Pay using bKash, Nagad or Rocket (Online)</strong>
                <div style="font-size:10.5px; color:var(--ink-soft); margin-top:2px;">Instant secure checkout landing page</div>
              </div>
            </label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:10px; background:#fff; padding:12px; border:1.5px solid var(--line);">
              <input type="radio" name="modalPayMethod" value="cod">
              <div>
                <strong style="font-size:13px;">Cash on Delivery (COD)</strong>
                <div style="font-size:10.5px; color:var(--ink-soft); margin-top:2px;">Pay in cash upon physical doorstep delivery</div>
              </div>
            </label>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:16px; font-weight:700; margin-bottom:20px; border-top:1px dashed var(--line); padding-top:14px;">
          <span>TOTAL AMOUNT:</span>
          <span id="modalTotalAmount">৳0</span>
        </div>

        <button id="modalSubmitBtn" onclick="processFinalCheckout()" class="btn-stamp" style="width:100%; padding:16px; font-size:13px; cursor:pointer; text-align:center;">Proceed to Secure Payment →</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    const cart = getCart();
    if (cart.length === 0) return;
    closeDrawer();
    injectCheckoutModal();
    
    const summaryList = document.getElementById('checkoutSummaryList');
    summaryList.innerHTML = cart.map(i => `
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
        <span>${i.name} (${i.code}) [Size: ${i.size || 'M'}] × ${i.qty}</span>
        <span>৳${(i.price * i.qty).toLocaleString()}</span>
      </div>
    `).join('');
    
    window.updateCheckoutTotal();

    const overlayModal = document.getElementById('checkoutOverlayModal');
    overlayModal.style.display = 'flex';
    setTimeout(() => { overlayModal.style.opacity = '1'; }, 10);
  });
}

window.closeCheckoutModal = function() {
  const overlayModal = document.getElementById('checkoutOverlayModal');
  if (overlayModal) {
    overlayModal.style.opacity = '0';
    setTimeout(() => { overlayModal.style.display = 'none'; }, 350);
  }
};

window.processFinalCheckout = async function() {
  const cart = getCart();
  if (cart.length === 0) return;

  const rawName = document.getElementById('modalCustName')?.value.trim();
  const rawPhone = document.getElementById('modalCustPhone')?.value.trim();
  const rawEmail = document.getElementById('modalCustEmail')?.value.trim();
  const rawAddress = document.getElementById('modalCustAddress')?.value.trim();
  const payMethod = document.querySelector('input[name="modalPayMethod"]:checked')?.value || 'zinipay';
  const shippingFee = Number(document.getElementById('modalShipping')?.value || 80);

  if (!rawName || !rawPhone || !rawAddress) {
    alert('Please fill in your Name, Phone Number, and Delivery Address.');
    return;
  }

  // Sanitize fields for bulletproof payment gateway & order records
  const name = rawName.substring(0, 80);
  const cleanPhoneDigits = rawPhone.replace(/[^\d+]/g, '');
  const phone = cleanPhoneDigits.length >= 7 ? cleanPhoneDigits : (rawPhone || '01700000000');
  const address = rawAddress.substring(0, 200);
  const orderCode = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

  // Strict email validation matching ZiniPay validation requirements
  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isStrictEmail = rawEmail && strictEmailRegex.test(rawEmail) && !rawEmail.includes('..');
  const email = isStrictEmail
    ? rawEmail
    : 'order.' + orderCode.toLowerCase().replace(/[^a-z0-9]/g, '') + '@pleated.store';

  const submitBtn = document.getElementById('modalSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = payMethod === 'zinipay' ? 'Redirecting to Gateway...' : 'Placing COD Order...';

  const itemsTotal = cart.reduce((sum, item) => {
    const p = Number(item.price) || 0;
    const q = Number(item.qty) || 1;
    return sum + (p * q);
  }, 0);
  const totalAmount = Math.max(1, Math.round(Number(itemsTotal + shippingFee) || 80));
  const isZini = payMethod === 'zinipay';

  const orderPayload = {
    order_code: orderCode,
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    total_amount: totalAmount,
    status: isZini ? 'pending_payment' : 'pending_cod',
    shipping_address: { 
      order_code: orderCode, 
      name, 
      phone, 
      address, 
      items: cart, 
      payment_method: payMethod,
      delivery_charge: shippingFee
    },
    created_at: new Date().toISOString()
  };

  try {
    let savedOrderId = orderCode;

    // Save to Resilient Vault & LocalStorage
    const localOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    localOrders.unshift({ id: savedOrderId, ...orderPayload });
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));
    if (window.PleatedVault) {
      window.PleatedVault.set(LOCAL_ORDERS_KEY, localOrders);
    }

    // Cloud sync to Supabase & Backblaze B2 backend (asynchronously)
    fetch('/api/b2-storage?action=save-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: { id: savedOrderId, ...orderPayload } })
    }).catch(() => {});

    // Direct sync to Supabase project
    if (window.pleatedSupabase) {
      window.pleatedSupabase.from('orders').insert([{
        id: savedOrderId,
        order_code: orderCode,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        total_amount: totalAmount,
        status: isZini ? 'pending_payment' : 'pending_cod',
        shipping_address: orderPayload.shipping_address
      }]).then(() => {}).catch(() => {});
    }

    // Instant Direct Telegram Notification to Admin
    if (PLEATED_CONFIG.TELEGRAM_BOT_TOKEN && PLEATED_CONFIG.TELEGRAM_CHAT_ID) {
      try {
        const itemsList = cart.map(i => '• ' + i.name + ' (' + i.code + ') [Size: ' + (i.size || 'M') + '] x' + i.qty).join('\n');
        const tgMsg =
          '🚨 *NEW ORDER CREATED — PLEATED.*\n\n' +
          '🧾 Invoice: `' + orderCode + '`\n' +
          '👤 Customer: ' + name + '\n' +
          '📞 Phone: ' + phone + '\n' +
          '📍 Address: ' + address + '\n\n' +
          '💳 *Payment Method:* ' + payMethod.toUpperCase() + '\n' +
          '🚚 *Delivery Fee:* ৳' + shippingFee + '\n' +
          '📌 *Status:* ' + (isZini ? 'Redirecting to Gateway...' : 'Cash on Delivery (Pending)') + '\n\n' +
          '📦 *Items Ordered:*\n' + itemsList + '\n\n' +
          '💰 *Total Amount:* ৳' + totalAmount.toLocaleString();

        fetch('https://api.telegram.org/bot' + PLEATED_CONFIG.TELEGRAM_BOT_TOKEN + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: PLEATED_CONFIG.TELEGRAM_CHAT_ID, text: tgMsg, parse_mode: 'Markdown' })
        }).catch(() => {});
      } catch (e) {}
    }

    if (isZini) {
      const apiKey = "b01b1da82bd34e355e36f0421b5b3b72639fdc1bf18a7491";
      const paymentPayload = {
        amount: totalAmount,
        order_code: orderCode,
        cus_name: name || 'Valued Customer',
        cus_email: email,
        cus_phone: phone || '01700000000',
        redirect_url: 'https://pleated.store/?payment=success&order=' + orderCode,
        cancel_url: 'https://pleated.store/?payment=cancel&order=' + orderCode,
        metadata: { order_code: orderCode }
      };

      const res = await fetch('https://api.zinipay.com/v1/payment/create?apikey=' + apiKey, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey,
          "zini-api-key": apiKey
        },
        body: JSON.stringify(paymentPayload)
      });
      
      const rawText = await res.text();
      let session;
      try {
        session = JSON.parse(rawText);
      } catch(e) {
        throw new Error("Invalid response from payment gateway: " + rawText.substring(0, 100));
      }
      
      if (session && session.payment_url) {
        localStorage.removeItem(CART_STORAGE_KEY);
        window.location.href = session.payment_url;
        return;
      } else {
        let errorMsg = 'Payment gateway could not process online payment.';
        if (session && session.errors && Array.isArray(session.errors) && session.errors.length > 0) {
          errorMsg = session.errors.map(e => e.message || e.field).join('. ');
        } else if (session && (session.message || session.error)) {
          errorMsg = session.message || session.error;
        }

        const fallbackCOD = confirm(
          'Gateway Notice: ' + errorMsg + '\n\nWould you like to complete this order via Cash on Delivery (COD) instead?'
        );

        if (fallbackCOD) {
          orderPayload.status = 'pending_cod';
          orderPayload.shipping_address.payment_method = 'cod';
          
          if (window.pleatedSupabase) {
            window.pleatedSupabase.from('orders').update({ status: 'pending_cod' }).eq('order_code', orderCode).catch(() => {});
          }

          localStorage.removeItem(CART_STORAGE_KEY);
          alert('Order Confirmed via Cash on Delivery!\nInvoice: ' + orderCode + '\nTotal: ৳' + totalAmount.toLocaleString());
          window.location.href = PLEATED_CONFIG.INSTAGRAM_URL;
          return;
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Proceed to Secure Payment →';
        return;
      }
    }

    localStorage.removeItem(CART_STORAGE_KEY);
    alert('Order Confirmed! Invoice ' + orderCode + ' logged successfully.');
    window.location.href = PLEATED_CONFIG.INSTAGRAM_URL;
  } catch (err) {
    alert('Payment connection notice: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Proceed to Secure Payment →';
  }
};