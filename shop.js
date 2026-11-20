let liveShopProducts = [];
let liveShopCategories = ["All"];

// Modal Carousel & Touch State
let activeModalImages = [];
let activeModalIndex = 0;
let modalTouchStartX = 0;
let modalTouchEndX = 0;
let selectedGarmentSize = "M"; // Default selection

document.addEventListener('DOMContentLoaded', () => {
  initLiveShop();
});

async function initLiveShop() {
  const productGrid = document.getElementById('productGrid') || document.getElementById('shopProductGrid');
  if (!productGrid) return;
  
  productGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--ink-soft); font-family:var(--mono);">Accessing Curated Garment Vault...</div>';

  let deletedIds = [];
  try {
    deletedIds = JSON.parse(localStorage.getItem('pleated_deleted_product_ids') || '[]');
  } catch(e) {}
  if (window.PleatedVault) {
    const vaultDeleted = await window.PleatedVault.get('pleated_deleted_product_ids');
    if (Array.isArray(vaultDeleted)) {
      deletedIds = Array.from(new Set([...deletedIds, ...vaultDeleted]));
    }
  }

  function filterDeleted(list) {
    if (!Array.isArray(list)) return [];
    if (deletedIds.length === 0) return list;
    return list.filter(p => p && !deletedIds.includes(p.id) && !deletedIds.includes(p.code) && !deletedIds.includes(p.name));
  }

  let loadedSuccessfully = false;

  // 1. Try loading from Supabase Storage CDN (Instant, Always-Current Cloud Master)
  try {
    const sbRes = await fetch('https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/products.json?t=' + Date.now());
    if (sbRes.ok) {
      const sbProds = await sbRes.json();
      if (Array.isArray(sbProds) && sbProds.length > 0) {
        liveShopProducts = filterDeleted(sbProds);
        loadedSuccessfully = true;
        if (window.PleatedVault) {
          window.PleatedVault.set('pleated_cached_products', liveShopProducts);
        }
      }
    }
  } catch(e) {}

  // 2. Try loading from Backblaze B2 cloud storage
  if (!loadedSuccessfully) {
    try {
      const b2Res = await fetch('/api/b2-storage?action=get-products');
      if (b2Res.ok) {
        const b2Data = await b2Res.json();
        if (b2Data.products && Array.isArray(b2Data.products) && b2Data.products.length > 0) {
          liveShopProducts = filterDeleted(b2Data.products);
          loadedSuccessfully = true;
          if (window.PleatedVault) {
            window.PleatedVault.set('pleated_cached_products', liveShopProducts);
          }
        }
      }
    } catch (err) {
      console.info("Backblaze B2 cloud fetch notice:", err.message);
    }
  }

  // 3. Resilient Vault Fallback (IndexedDB / Local Vault / Curated Master)
  if (!loadedSuccessfully || liveShopProducts.length === 0) {
    let localProds = null;
    if (window.PleatedVault) {
      localProds = await window.PleatedVault.get('pleated_local_products');
    }
    if (!localProds || localProds.length === 0) {
      try { localProds = JSON.parse(localStorage.getItem('pleated_local_products') || 'null'); } catch(e) {}
    }

    let cachedProds = null;
    if (window.PleatedVault) {
      cachedProds = await window.PleatedVault.get('pleated_cached_products');
    }
    if (!cachedProds || cachedProds.length === 0) {
      try { cachedProds = JSON.parse(localStorage.getItem('pleated_cached_products') || 'null'); } catch(e) {}
    }

    if (localProds && localProds.length > 0) {
      liveShopProducts = filterDeleted(localProds);
    } else if (cachedProds && cachedProds.length > 0) {
      liveShopProducts = filterDeleted(cachedProds);
    } else if (window.DEFAULT_PLEATED_PRODUCTS && window.DEFAULT_PLEATED_PRODUCTS.length > 0) {
      liveShopProducts = filterDeleted(window.DEFAULT_PLEATED_PRODUCTS);
    }

    const uniqueCats = Array.from(new Set(liveShopProducts.map(p => p.category).filter(Boolean)));
    liveShopCategories = ["All", ...uniqueCats];
  }

  const filterBar = document.getElementById('shopFilterBar');
  if (filterBar) {
    filterBar.innerHTML = liveShopCategories.map(c => `
      <button class="filter-btn ${c === 'All' ? 'active' : ''}" onclick="filterProducts('${c}')">${c}</button>
    `).join('');
  }

  displayProducts(liveShopProducts);
}

window.filterProducts = function(category) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.textContent === category) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  if (category === 'All') {
    displayProducts(liveShopProducts);
  } else {
    const filtered = liveShopProducts.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
    displayProducts(filtered);
  }
};

window.getUnavailableSizes = function(product) {
  if (!product) return [];
  if (Array.isArray(product.unavailable_sizes)) return product.unavailable_sizes;
  if (typeof product.unavailable_sizes === 'string' && product.unavailable_sizes.trim()) {
    try {
      const parsed = JSON.parse(product.unavailable_sizes);
      if (Array.isArray(parsed)) return parsed;
    } catch(e) {
      return product.unavailable_sizes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    }
  }
  if (product.details) {
    if (typeof product.details === 'object' && Array.isArray(product.details.unavailable_sizes)) {
      return product.details.unavailable_sizes;
    }
    if (typeof product.details === 'string') {
      try {
        const parsed = JSON.parse(product.details);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.unavailable_sizes)) return parsed.unavailable_sizes;
      } catch(e) {
        if (product.details.includes('UNAVAILABLE:')) {
          const match = product.details.match(/UNAVAILABLE:([A-Z,]+)/i);
          if (match) return match[1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        }
      }
    }
  }
  return [];
};

function displayProducts(items) {
  const productGrid = document.getElementById('productGrid') || document.getElementById('shopProductGrid');
  if (!productGrid) return;

  if (items.length === 0) {
    productGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--ink-soft); font-family:var(--mono);">No pieces match this selection in the vault.</div>';
    return;
  }

  productGrid.innerHTML = items.map(p => {
    const imgArray = typeof window.parseProductImages === 'function' ? window.parseProductImages(p) : (p.images || [p.img || 'https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg']);
    
    let imgHTML = '';
    if (imgArray.length > 0) {
      imgHTML = imgArray.map((src, idx) => `
        <img src="${src}" alt="${p.name || 'Product'}" loading="lazy" decoding="async" width="400" height="400" style="opacity: ${idx === 0 ? '1' : '0'};" onerror="this.onerror=null; this.src='https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg';">
      `).join('');
    } else {
      imgHTML = `<img src="https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg" alt="Pleated Archive" loading="lazy" decoding="async" width="400" height="400" style="opacity: 1;">`;
    }

    const unavail = window.getUnavailableSizes(p);
    const isAllOut = ['S', 'M', 'L', 'XL'].every(s => unavail.includes(s));
    const hasOutSizes = unavail.length > 0 && !isAllOut;

    return `
      <div class="tag-card" onclick="openProductModal('${p.id}')">
        <div class="tag-hole"></div>
        <div class="tag-cat">${p.category || 'Archive'}</div>
        <h3 class="tag-name">${p.name || 'Untitled'}</h3>
        <p class="tag-desc">${p.description || ''}</p>
        <div class="garment-image-wrap product-img-container">
          ${imgHTML}
        </div>
        <div class="tag-meta">
          <span class="tag-price">৳${Number(p.price || 0).toLocaleString()}</span>
          <span class="tag-code">${p.code || ''}</span>
        </div>
        <button onclick="event.stopPropagation(); openProductModal('${p.id}')" class="add-btn">
          ${isAllOut ? '★ Archive Locked — Sold Out' : (hasOutSizes ? 'Select Size (Some Out)' : 'View & Select Size')}
        </button>
      </div>
    `;
  }).join('');

  if (typeof window.initProductSlideshowAndZoom === 'function') {
    window.initProductSlideshowAndZoom();
  }
}

// 2. MODAL IMAGE VIEWER & SWIPER ENGINE (Classic Clean UI)
function updateModalImageDisplay() {
  const modalImg = document.getElementById('pdModalImg');
  const dotsContainer = document.getElementById('pdModalDots');
  const thumbsContainer = document.getElementById('pdModalThumbs');
  const prevBtn = document.getElementById('pdModalPrevBtn');
  const nextBtn = document.getElementById('pdModalNextBtn');

  if (!modalImg || activeModalImages.length === 0) return;

  const currentSrc = activeModalImages[activeModalIndex] || activeModalImages[0];
  modalImg.src = currentSrc;

  // Toggle prev/next buttons visibility based on image count
  const hasMultiple = activeModalImages.length > 1;
  if (prevBtn) prevBtn.style.display = hasMultiple ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = hasMultiple ? 'flex' : 'none';

  // Render navigation dots
  if (dotsContainer) {
    if (hasMultiple) {
      dotsContainer.style.display = 'flex';
      dotsContainer.innerHTML = activeModalImages.map((_, i) => `
        <span class="swiper-dot ${i === activeModalIndex ? 'active' : ''}" 
              onclick="event.stopPropagation(); setModalImageIndex(${i})" 
              aria-label="View image ${i + 1}"></span>
      `).join('');
    } else {
      dotsContainer.style.display = 'none';
    }
  }

  // Render thumbnail strip
  if (thumbsContainer) {
    if (hasMultiple) {
      thumbsContainer.style.display = 'flex';
      thumbsContainer.innerHTML = activeModalImages.map((src, i) => `
        <img src="${src}" class="swiper-thumb ${i === activeModalIndex ? 'active' : ''}" 
             onclick="event.stopPropagation(); setModalImageIndex(${i})" 
             alt="Thumbnail ${i + 1}"
             onerror="this.onerror=null; this.src='https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg';">
      `).join('');
    } else {
      thumbsContainer.style.display = 'none';
    }
  }

  // Update Lightbox image if active
  const lbImg = document.getElementById('lightboxImg');
  if (lbImg) lbImg.src = currentSrc;
  const lbPrev = document.getElementById('lbPrevBtn');
  const lbNext = document.getElementById('lbNextBtn');
  if (lbPrev) lbPrev.style.display = hasMultiple ? 'flex' : 'none';
  if (lbNext) lbNext.style.display = hasMultiple ? 'flex' : 'none';
}

window.modalNextImage = function() {
  if (activeModalImages.length <= 1) return;
  activeModalIndex = (activeModalIndex + 1) % activeModalImages.length;
  updateModalImageDisplay();
};

window.modalPrevImage = function() {
  if (activeModalImages.length <= 1) return;
  activeModalIndex = (activeModalIndex - 1 + activeModalImages.length) % activeModalImages.length;
  updateModalImageDisplay();
};

window.setModalImageIndex = function(index) {
  activeModalIndex = index;
  updateModalImageDisplay();
};

// Fullscreen Modal Injection & Engine
window.openProductModal = function(id) {
  const item = liveShopProducts.find(p => p.id === id);
  if (!item) return;

  const unavailableSizes = window.getUnavailableSizes(item);
  const allSizes = ['S', 'M', 'L', 'XL'];
  const availableSizes = allSizes.filter(s => !unavailableSizes.includes(s));
  const isSoldOut = availableSizes.length === 0;

  if (availableSizes.includes("M")) {
    selectedGarmentSize = "M";
  } else if (availableSizes.length > 0) {
    selectedGarmentSize = availableSizes[0];
  } else {
    selectedGarmentSize = null;
  }

  if (!document.getElementById('productDetailOverlay')) {
    const modalHTML = `
      <div id="productDetailOverlay" class="product-modal-backdrop">
        <div class="product-modal-dialog">
          <button onclick="closeProductModal()" class="product-modal-close" aria-label="Close modal">✕</button>
          
          <!-- Image Swiper Area (Classic Clean UI) -->
          <div class="product-modal-visual-pane">
            <div id="pdModalSwiper" class="product-modal-swiper" onclick="openFullscreenLightbox()" title="Click to view fullscreen">
              <img id="pdModalImg" src="" alt="Garment Visual" onerror="this.onerror=null; this.src='https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg';">
              <button type="button" id="pdModalPrevBtn" onclick="event.stopPropagation(); modalPrevImage()" class="swiper-nav swiper-nav-prev" aria-label="Previous image">‹</button>
              <button type="button" id="pdModalNextBtn" onclick="event.stopPropagation(); modalNextImage()" class="swiper-nav swiper-nav-next" aria-label="Next image">›</button>
              <div class="tap-fullscreen-hint" onclick="event.stopPropagation(); openFullscreenLightbox()">Tap for Fullscreen ⤢</div>
            </div>
            <!-- Pagination Dots -->
            <div id="pdModalDots" class="swiper-dots-container"></div>
            <!-- Thumbnails Strip -->
            <div id="pdModalThumbs" class="swiper-thumbs-container"></div>
          </div>
          
          <!-- Garment Info & Sizing Pane -->
          <div class="product-modal-info-pane">
            <div id="pdModalCat" class="product-modal-cat"></div>
            <h2 id="pdModalName" class="product-modal-title"></h2>
            <div class="product-modal-pricing-row">
              <span id="pdModalPrice" class="product-modal-price"></span>
              <span id="pdModalCode" class="product-modal-code"></span>
            </div>

            <!-- Size Selector Pills -->
            <div class="size-picker-section" id="pdModalSizeSection">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div class="size-picker-label" style="margin-bottom:0;">Select Tailored Size:</div>
                <span id="pdModalSizeNote" style="font-size:10px; color:var(--rust); font-family:var(--mono); font-weight:600;"></span>
              </div>
              <div class="size-pills-row" id="pdModalSizesRow">
                <!-- Dynamically injected sizes with cross options -->
              </div>
            </div>
            
            <!-- Description with Expandable Plus Button -->
            <div class="product-modal-desc-wrap">
              <div class="desc-header-row">
                <span class="desc-heading">Garment Story & Specs</span>
                <button type="button" id="pdDescToggleBtn" onclick="toggleModalDescription()" class="desc-toggle-btn" aria-label="Expand story">+</button>
              </div>
              <p id="pdModalDesc" class="product-modal-desc collapsed"></p>
            </div>
            
            <button id="pdModalAddBtn" class="btn-stamp modal-cta-btn">Add to Slip</button>
          </div>
        </div>
      </div>

      <!-- Lightbox for Tap-to-Zoom Fullscreen -->
      <div id="fullscreenLightbox" class="fullscreen-lightbox" onclick="closeFullscreenLightbox(event)">
        <button type="button" class="lightbox-close" onclick="closeFullscreenLightbox(event)" aria-label="Close fullscreen">✕</button>
        <button type="button" id="lbPrevBtn" class="lightbox-nav lightbox-prev" onclick="event.stopPropagation(); modalPrevImage()" aria-label="Previous image">‹</button>
        <img id="lightboxImg" src="" alt="Fullscreen asset" onclick="event.stopPropagation()">
        <button type="button" id="lbNextBtn" class="lightbox-nav lightbox-next" onclick="event.stopPropagation(); modalNextImage()" aria-label="Next image">›</button>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const swiperEl = document.getElementById('pdModalSwiper');
    if (swiperEl) {
      swiperEl.addEventListener('touchstart', (e) => {
        modalTouchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      swiperEl.addEventListener('touchend', (e) => {
        modalTouchEndX = e.changedTouches[0].screenX;
        const diff = modalTouchEndX - modalTouchStartX;
        if (diff < -40) {
          window.modalNextImage(); // Swiped left -> next
        } else if (diff > 40) {
          window.modalPrevImage(); // Swiped right -> prev
        }
      }, { passive: true });
    }

    const lbEl = document.getElementById('fullscreenLightbox');
    if (lbEl) {
      let lbTouchStartX = 0;
      let lbTouchEndX = 0;
      lbEl.addEventListener('touchstart', (e) => {
        lbTouchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      lbEl.addEventListener('touchend', (e) => {
        lbTouchEndX = e.changedTouches[0].screenX;
        const diff = lbTouchEndX - lbTouchStartX;
        if (diff < -40) {
          window.modalNextImage(); // Swiped left -> next
        } else if (diff > 40) {
          window.modalPrevImage(); // Swiped right -> prev
        }
      }, { passive: true });
    }

    document.addEventListener('keydown', (e) => {
      const lb = document.getElementById('fullscreenLightbox');
      if (lb && lb.classList.contains('active')) {
        if (e.key === 'Escape') {
          closeFullscreenLightbox();
        } else if (e.key === 'ArrowRight') {
          modalNextImage();
        } else if (e.key === 'ArrowLeft') {
          modalPrevImage();
        }
      }
    });
  }

  // Parse images for Click Stack
  activeModalImages = typeof window.parseProductImages === 'function' ? window.parseProductImages(item) : (item.images || [item.img || 'https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg']);
  if (!activeModalImages || activeModalImages.length === 0) activeModalImages = ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'];
  activeModalIndex = 0;

  updateModalImageDisplay();

  document.getElementById('pdModalCat').textContent = `★ ${item.category || 'Archival Series'}`;
  document.getElementById('pdModalName').textContent = item.name || 'Untitled';
  document.getElementById('pdModalPrice').textContent = `৳${Number(item.price || 0).toLocaleString()}`;
  document.getElementById('pdModalCode').textContent = `CODE: ${item.code || 'N/A'}`;
  
  const descEl = document.getElementById('pdModalDesc');
  descEl.textContent = item.description || 'Custom crafted heavy silhouette built for timeless character.';
  descEl.classList.add('collapsed');
  document.getElementById('pdDescToggleBtn').textContent = '+';

  // Render sizes with crossed-out styling for unavailable options
  const sizesRow = document.getElementById('pdModalSizesRow');
  const sizeNote = document.getElementById('pdModalSizeNote');
  if (sizesRow) {
    sizesRow.innerHTML = allSizes.map(sz => {
      const isOut = unavailableSizes.includes(sz);
      if (isOut) {
        return `
          <button type="button" class="size-pill unavailable crossed-out" disabled title="Size ${sz} is currently unavailable (Out of stock)" aria-label="Size ${sz} unavailable">
            <span class="size-strike">${sz}</span>
            <span class="size-out-badge">✕</span>
          </button>
        `;
      } else {
        const isActive = (sz === selectedGarmentSize);
        return `
          <button type="button" class="size-pill ${isActive ? 'active' : ''}" onclick="selectModalSize(this, '${sz}')">${sz}</button>
        `;
      }
    }).join('');
  }

  if (sizeNote) {
    if (unavailableSizes.length > 0 && availableSizes.length > 0) {
      sizeNote.textContent = `${unavailableSizes.join(', ')} crossed out (out of stock)`;
    } else if (availableSizes.length === 0) {
      sizeNote.textContent = `All sizes out of stock`;
    } else {
      sizeNote.textContent = '';
    }
  }

  // Configure Add to Slip action
  const addBtn = document.getElementById('pdModalAddBtn');
  if (addBtn) {
    if (!isSoldOut && selectedGarmentSize) {
      addBtn.disabled = false;
      addBtn.style.opacity = '1';
      addBtn.style.cursor = 'pointer';
      addBtn.textContent = `Add to Slip — Selected Size: ${selectedGarmentSize}`;
      addBtn.onclick = () => {
        closeProductModal();
        window.addToSlipWithSize(item.name, item.price || 0, item.code, selectedGarmentSize);
      };
    } else {
      addBtn.disabled = true;
      addBtn.style.opacity = '0.5';
      addBtn.style.cursor = 'not-allowed';
      addBtn.textContent = 'Archive Locked — Currently Sold Out';
      addBtn.onclick = null;
    }
  }

  const overlay = document.getElementById('productDetailOverlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => { overlay.classList.add('active'); }, 10);
};

window.closeProductModal = function() {
  const overlay = document.getElementById('productDetailOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.style.display = 'none'; }, 280);
  }
};

window.selectModalSize = function(buttonEl, size) {
  if (buttonEl.classList.contains('unavailable') || buttonEl.disabled) return;
  selectedGarmentSize = size;
  document.querySelectorAll('#pdModalSizesRow .size-pill').forEach(btn => btn.classList.remove('active'));
  buttonEl.classList.add('active');
  const addBtn = document.getElementById('pdModalAddBtn');
  if (addBtn) {
    addBtn.textContent = `Add to Slip — Selected Size: ${selectedGarmentSize}`;
  }
};

window.toggleModalDescription = function() {
  const descEl = document.getElementById('pdModalDesc');
  const toggleBtn = document.getElementById('pdDescToggleBtn');
  if (!descEl || !toggleBtn) return;
  
  const isCollapsed = descEl.classList.contains('collapsed');
  if (isCollapsed) {
    descEl.classList.remove('collapsed');
    toggleBtn.textContent = '−';
  } else {
    descEl.classList.add('collapsed');
    toggleBtn.textContent = '+';
  }
};

window.setModalImageIndex = function(index) {
  activeModalIndex = index;
  updateModalImageDisplay();
};

window.openFullscreenLightbox = function() {
  const lb = document.getElementById('fullscreenLightbox');
  const img = document.getElementById('lightboxImg');
  if (!lb || !img) return;

  const currentSrc = (activeModalImages && activeModalImages[activeModalIndex]) 
    ? activeModalImages[activeModalIndex] 
    : (document.getElementById('pdModalImg')?.src || '');

  if (currentSrc) {
    img.src = currentSrc;
    lb.style.display = 'flex';
    requestAnimationFrame(() => {
      lb.classList.add('active');
    });

    const hasMultiple = activeModalImages && activeModalImages.length > 1;
    const lbPrev = document.getElementById('lbPrevBtn');
    const lbNext = document.getElementById('lbNextBtn');
    if (lbPrev) lbPrev.style.display = hasMultiple ? 'flex' : 'none';
    if (lbNext) lbNext.style.display = hasMultiple ? 'flex' : 'none';

    document.body.style.overflow = 'hidden';
  }
};

window.closeFullscreenLightbox = function(e) {
  if (e && e.target && (e.target.id === 'lightboxImg' || e.target.classList.contains('lightbox-nav'))) {
    return;
  }
  const lb = document.getElementById('fullscreenLightbox');
  if (lb) {
    lb.classList.remove('active');
    setTimeout(() => {
      lb.style.display = 'none';
    }, 280);
    if (!document.getElementById('productDetailOverlay')?.classList.contains('active')) {
      document.body.style.overflow = '';
    }
  }
};
