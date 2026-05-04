// ==================== DATA STORAGE ====================
let menus = [];
let cart = [];
let transactions = [];
let users = [];
let currentUserObj = null;
let storeStatus = 'closed';
let operationalHours = { open: '08:00', close: '22:00' };
let autoSchedule = true;
let autoPrint = false;
let selectedPlatform = 'Grabfood';
let currentRekapFilter = 'harian';
let currentPlatformFilter = 'all';
let currentPendapatanPlatform = 'all';
let pendapatanStartDate = null, pendapatanEndDate = null;
let pendapatanDateFilter = 'today';
let ppnEnabled = false;
let salesChart = null;
let profitChart = null;
let selectedPaymentMethod = 'Cash';
let autoDiscountMin = 0;
let autoDiscountAmount = 0;
let lastDeletedCart = null;
let invoiceCounter = {};
let isSearchActive = false;
let lastSearchTerm = '';
let storeInfo = { name: 'DewePOS Basic', address: '', phone: '' };

// Manajemen User
let currentUserPage = 1;
const usersPerPage = 5;

// Flag untuk konfirmasi QRIS
window.qrisConfirmed = false;

// ==================== UTILITY ====================
function formatRupiah(angka) { return `Rp ${angka.toLocaleString()}`; }
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const yearStart = new Date(d.getFullYear(),0,1);
  return Math.ceil(((d - yearStart) / 86400000 + 1)/7);
}
function generateInvoiceNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0,10).replace(/-/g,'');
  if(!invoiceCounter[dateStr]) invoiceCounter[dateStr] = 0;
  invoiceCounter[dateStr]++;
  saveSettings();
  return `INV/${dateStr}/${String(invoiceCounter[dateStr]).padStart(4,'0')}`;
}
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ==================== ROLE CHECK ====================
function hasRole(roles) {
  if(!currentUserObj) return false;
  if(typeof roles === 'string') return currentUserObj.role === roles;
  return roles.includes(currentUserObj.role);
}

// ==================== LOAD & SAVE ====================
function loadData() {
  try {
    const savedMenus = localStorage.getItem('dewepos_menus');
    if(savedMenus) menus = JSON.parse(savedMenus);
    const savedTrans = localStorage.getItem('dewepos_transactions');
    if(savedTrans) transactions = JSON.parse(savedTrans);
    const savedUsers = localStorage.getItem('dewepos_users');
    if(savedUsers) users = JSON.parse(savedUsers);
    else users = [
      { username: 'admin', password: 'admin', role: 'owner' },
      { username: 'admin2', password: 'admin2', role: 'admin' },
      { username: 'kasir', password: 'kasir', role: 'kasir' }
    ];
    const savedStoreInfo = localStorage.getItem('dewepos_storeInfo');
    if(savedStoreInfo) storeInfo = JSON.parse(savedStoreInfo);
    const savedStatus = localStorage.getItem('dewepos_storeStatus');
    if(savedStatus) storeStatus = savedStatus;
    const savedHours = localStorage.getItem('dewepos_hours');
    if(savedHours) operationalHours = JSON.parse(savedHours);
    const savedAuto = localStorage.getItem('dewepos_autoSchedule');
    if(savedAuto !== null) autoSchedule = savedAuto === 'true';
    const savedAutoPrint = localStorage.getItem('dewepos_autoPrint');
    if(savedAutoPrint !== null) autoPrint = savedAutoPrint === 'true';
    const savedPpn = localStorage.getItem('dewepos_ppn');
    if(savedPpn !== null) ppnEnabled = savedPpn === 'true';
    const savedAutoDiscountMin = localStorage.getItem('dewepos_autoDiscountMin');
    if(savedAutoDiscountMin !== null) autoDiscountMin = parseInt(savedAutoDiscountMin);
    const savedAutoDiscountAmount = localStorage.getItem('dewepos_autoDiscountAmount');
    if(savedAutoDiscountAmount !== null) autoDiscountAmount = parseInt(savedAutoDiscountAmount);
    const savedInvoiceCounter = localStorage.getItem('dewepos_invoiceCounter');
    if(savedInvoiceCounter) invoiceCounter = JSON.parse(savedInvoiceCounter);
  } catch(e) { console.log(e); }
  if(menus.length === 0) {
    menus = [
      { id: 1, kategori: 'Makanan', subMenu: 'Nasi', nama: 'Nasi Goreng', variant: 'Biasa', harga: 15000, stok: 50, modal: 8000 },
      { id: 2, kategori: 'Makanan', subMenu: 'Nasi', nama: 'Nasi Goreng Spesial', variant: 'Spesial', harga: 20000, stok: 30, modal: 10000 },
      { id: 3, kategori: 'Minuman', subMenu: 'Kopi', nama: 'Kopi Hitam', variant: 'Panas', harga: 8000, stok: 100, modal: 3000 },
      { id: 4, kategori: 'Minuman', subMenu: 'Kopi', nama: 'Kopi Susu', variant: 'Dingin', harga: 12000, stok: 80, modal: 5000 }
    ];
    saveMenus();
  }
  saveUsers();
}
function saveMenus() { localStorage.setItem('dewepos_menus', JSON.stringify(menus)); }
function saveTransactions() { localStorage.setItem('dewepos_transactions', JSON.stringify(transactions)); }
function saveUsers() { localStorage.setItem('dewepos_users', JSON.stringify(users)); }
function saveSettings() {
  localStorage.setItem('dewepos_autoSchedule', autoSchedule);
  localStorage.setItem('dewepos_autoPrint', autoPrint);
  localStorage.setItem('dewepos_ppn', ppnEnabled);
  localStorage.setItem('dewepos_autoDiscountMin', autoDiscountMin);
  localStorage.setItem('dewepos_autoDiscountAmount', autoDiscountAmount);
  localStorage.setItem('dewepos_storeInfo', JSON.stringify(storeInfo));
  localStorage.setItem('dewepos_invoiceCounter', JSON.stringify(invoiceCounter));
}

// ==================== STOK & PROFIT ====================
function cekStok(menu, qty=1) { return menu.stok >= qty; }
function kurangiStok(menuId, qty) {
  const idx = menus.findIndex(m => m.id == menuId);
  if(idx !== -1) { menus[idx].stok -= qty; saveMenus(); }
}
function hitungProfitTransaksi(trans) {
  let totalModal = 0;
  trans.items.forEach(item => {
    const menu = menus.find(m => m.id == item.id);
    if(menu) totalModal += (menu.modal || 0) * item.qty;
  });
  return trans.total - totalModal;
}

// ==================== LOGIN ====================
function login(username, password) {
  const user = users.find(u => u.username === username && u.password === password);
  if(user) {
    currentUserObj = user;
    const userNameSpan = document.getElementById('currentUserName');
    if(userNameSpan) userNameSpan.innerText = user.username;
    const userRoleSpan = document.getElementById('currentUserRole');
    if(userRoleSpan) userRoleSpan.innerText = user.role.toUpperCase();
    const welcomeSpan = document.getElementById('welcomeUser');
    if(welcomeSpan) welcomeSpan.innerText = user.username;
    if(user.role === 'kasir') {
      document.querySelectorAll('.admin-owner-only, .owner-only').forEach(el => el.style.display = 'none');
    } else if(user.role === 'admin') {
      document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.admin-owner-only').forEach(el => el.style.display = 'block');
    } else if(user.role === 'owner') {
      document.querySelectorAll('.admin-owner-only, .owner-only').forEach(el => el.style.display = 'block');
    }
    updateKasirFilters();
    return true;
  }
  return false;
}
function updateKasirFilters() {
  const kasirList = [...new Set(transactions.map(t => t.user))];
  const selects = ['filterKasirRekap', 'filterKasirPendapatan', 'filterKasirRiwayat'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if(select) {
      const currentVal = select.value;
      select.innerHTML = '<option value="all">Semua Kasir</option>';
      kasirList.forEach(k => { select.innerHTML += `<option value="${k}">${k}</option>`; });
      if(currentVal !== 'all' && kasirList.includes(currentVal)) select.value = currentVal;
      else select.value = 'all';
    }
  });
}

// ==================== EDIT MENU (hanya admin/owner) ====================
function showEditMenu(menu) {
  if(!hasRole(['admin','owner'])) { alert('Akses ditolak!'); return; }
  document.getElementById('editMenuId').value = menu.id;
  document.getElementById('editNama').value = menu.nama;
  document.getElementById('editKategori').value = menu.kategori;
  document.getElementById('editSubMenu').value = menu.subMenu;
  document.getElementById('editVariant').value = menu.variant;
  document.getElementById('editHarga').value = menu.harga;
  document.getElementById('editStok').value = menu.stok;
  document.getElementById('editModal').value = menu.modal || 0;
  document.getElementById('editMenuModal').style.display = 'block';
}
function saveEditMenu() {
  if(!hasRole(['admin','owner'])) { alert('Akses ditolak!'); return; }
  const id = parseInt(document.getElementById('editMenuId').value);
  const idx = menus.findIndex(m => m.id === id);
  if(idx !== -1) {
    let stokBaru = parseInt(document.getElementById('editStok').value);
    if (stokBaru < 0) {
      alert('Stok tidak boleh negatif!');
      return;
    }
    menus[idx] = {
      ...menus[idx],
      nama: document.getElementById('editNama').value,
      kategori: document.getElementById('editKategori').value,
      subMenu: document.getElementById('editSubMenu').value,
      variant: document.getElementById('editVariant').value,
      harga: parseInt(document.getElementById('editHarga').value),
      stok: stokBaru,
      modal: parseInt(document.getElementById('editModal').value)
    };
    saveMenus();
    displayAdminMenus();
    alert('Menu berhasil diupdate');
  }
  document.getElementById('editMenuModal').style.display = 'none';
}
function tambahMenu() {
  if(!hasRole(['admin','owner'])) { alert('Akses ditolak!'); return; }
  const k = document.getElementById('kategori').value;
  const s = document.getElementById('subMenu').value;
  const n = document.getElementById('namaItem').value;
  const v = document.getElementById('variant').value;
  const h = parseInt(document.getElementById('harga').value);
  const st = parseInt(document.getElementById('stok').value);
  const m = parseInt(document.getElementById('modal').value);
  if (st < 0) {
    alert('Stok tidak boleh negatif!');
    return;
  }
  if(k && s && n && v && h && st>=0 && m>=0) {
    menus.push({ id: Date.now(), kategori: k, subMenu: s, nama: n, variant: v, harga: h, stok: st, modal: m });
    saveMenus();
    displayAdminMenus();
    document.getElementById('kategori').value = '';
    document.getElementById('subMenu').value = '';
    document.getElementById('namaItem').value = '';
    document.getElementById('variant').value = '';
    document.getElementById('harga').value = '';
    document.getElementById('stok').value = '';
    document.getElementById('modal').value = '';
    alert('Menu ditambahkan!');
  } else alert('Isi semua field!');
}
function deleteMenu(id) {
  if(!hasRole(['admin','owner'])) { alert('Akses ditolak!'); return; }
  if(confirm('Hapus menu ini?')) {
    menus = menus.filter(m => m.id !== id);
    saveMenus();
    displayAdminMenus();
    displayCategories();
  }
}

// ==================== DASHBOARD & REAL TIME ====================
function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('currentDate');
  const timeEl = document.getElementById('currentTime');
  if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  if(timeEl) timeEl.innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if(autoSchedule) checkAutoSchedule();
}
function checkAutoSchedule() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  let shouldBeOpen = false;
  if(operationalHours.open <= operationalHours.close) shouldBeOpen = currentTime >= operationalHours.open && currentTime <= operationalHours.close;
  else shouldBeOpen = currentTime >= operationalHours.open || currentTime <= operationalHours.close;
  if(shouldBeOpen && storeStatus !== 'open') { storeStatus = 'open'; updateStoreToggleButton(); updateScheduleInfo(); }
  else if(!shouldBeOpen && storeStatus !== 'closed') { storeStatus = 'closed'; updateStoreToggleButton(); updateScheduleInfo(); }
}
function updateStoreToggleButton() {
  const btn = document.getElementById('toggleStoreBtn');
  if(!btn) return;
  const icon = btn.querySelector('.store-icon');
  const text = btn.querySelector('.store-text');
  if(storeStatus === 'open') { icon.innerHTML = '🟢'; text.innerHTML = 'Buka'; btn.classList.add('open'); btn.classList.remove('closed'); }
  else { icon.innerHTML = '🔴'; text.innerHTML = 'Tutup'; btn.classList.add('closed'); btn.classList.remove('open'); }
}
function toggleStoreStatus() {
  if(autoSchedule) { autoSchedule = false; const cb = document.getElementById('autoScheduleCheckbox'); if(cb) cb.checked = false; saveSettings(); updateScheduleInfo(); }
  storeStatus = storeStatus === 'open' ? 'closed' : 'open';
  localStorage.setItem('dewepos_storeStatus', storeStatus);
  updateStoreToggleButton();
  alert(`Toko ${storeStatus === 'open' ? 'dibuka' : 'ditutup'}`);
}
function updateScheduleInfo() {
  const info = document.getElementById('scheduleInfo');
  if(!info) return;
  if(autoSchedule) info.innerHTML = `🕐 Mode Otomatis: Toko ${storeStatus === 'open' ? 'buka' : 'tutup'} (${operationalHours.open} - ${operationalHours.close})`;
  else info.innerHTML = `🔧 Mode Manual: Toko ${storeStatus === 'open' ? 'buka' : 'tutup'}`;
}

// ==================== TRANSAKSI & KERANJANG ====================
function getUniqueCategories() { return [...new Set(menus.map(m => m.kategori))]; }
function getSubMenus(kategori) { return [...new Set(menus.filter(m => m.kategori === kategori).map(m => m.subMenu))]; }
function getMenus(kategori, sub) { return menus.filter(m => m.kategori === kategori && m.subMenu === sub); }
function displayCategories() {
  const container = document.getElementById('kategoriList');
  if(!container) return;
  container.innerHTML = '';
  getUniqueCategories().forEach(kat => {
    const btn = document.createElement('button');
    btn.className = 'kategori-btn';
    btn.innerText = kat;
    btn.onclick = () => { document.querySelectorAll('.kategori-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); displaySubMenus(kat); };
    container.appendChild(btn);
  });
}

function displaySubMenus(kat) {
  const subList = document.getElementById('submenuList');
  const subContainer = document.getElementById('submenuButtons');
  const menuContainer = document.getElementById('menuListTransaksi');
  const searchMenuInput = document.getElementById('searchMenuInput');
  if(searchMenuInput) {
    searchMenuInput.value = '';
    lastSearchTerm = '';
    isSearchActive = false;
  }
  if(subList) subList.style.display = 'block';
  if(menuContainer) menuContainer.style.display = 'none';
  if(subContainer) {
    subContainer.innerHTML = '';
    getSubMenus(kat).forEach(sub => {
      const btn = document.createElement('button');
      btn.className = 'submenu-btn';
      btn.innerText = sub;
      btn.onclick = () => { document.querySelectorAll('.submenu-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); displayMenus(kat, sub); };
      subContainer.appendChild(btn);
    });
  }
}

// ==================== FUNGSI BARU: TAMBAH DENGAN JUMLAH TERTENTU ====================
function addToCartWithQty(menu, qty) {
  if(storeStatus !== 'open') { alert('Toko tutup!'); return; }
  if(!cekStok(menu, qty)) { alert(`Stok ${menu.nama} tidak mencukupi!`); return; }
  const existing = cart.find(item => item.id === menu.id);
  if(existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...menu, qty: qty });
  }
  updateCart();
}

// ==================== UPDATE DISPLAY MENU DENGAN INPUT JUMLAH ====================
// ==================== DISPLAY MENU (TANPA TOMBOL TAMBAH, TAPI BISA TAP CARD) ====================
function displayMenus(kat, sub) {
  const menuContainer = document.getElementById('menuListTransaksi');
  const menuItems = document.getElementById('menuItemsTransaksi');
  if (menuContainer) menuContainer.style.display = 'block';
  if (!menuItems) return;

  let menusToShow = [];
  if (isSearchActive && lastSearchTerm) {
    menusToShow = menus.filter(m => 
      m.nama.toLowerCase().includes(lastSearchTerm.toLowerCase()) ||
      (m.variant && m.variant.toLowerCase().includes(lastSearchTerm.toLowerCase()))
    );
  } else {
    menusToShow = getMenus(kat, sub);
  }

  menuItems.innerHTML = '';
  menusToShow.forEach(menu => {
    // Cek apakah menu sudah ada di keranjang
    const cartItem = cart.find(item => item.id === menu.id);
    const qtyInCart = cartItem ? cartItem.qty : 0;
    const badgeHtml = qtyInCart > 0 ? `<span class="cart-badge">${qtyInCart}</span>` : '';

    const card = document.createElement('div');
    card.className = 'menu-item-transaksi';
    // Tampilkan informasi menu + badge
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin:0;">${escapeHtml(menu.nama)} ${badgeHtml}</h4>
      </div>
      <p>${escapeHtml(menu.variant)}</p>
      <div class="harga">Rp ${menu.harga.toLocaleString()}</div>
      <div class="stok">Stok: ${menu.stok}</div>
    `;
    // Tap/klik pada card akan menambah 1 item
    card.onclick = () => addToCart(menu);
    menuItems.appendChild(card);
  });
}
function searchMenu() {
  const searchInput = document.getElementById('searchMenuInput');
  if(!searchInput) return;
  const searchTerm = searchInput.value.trim().toLowerCase();
  lastSearchTerm = searchTerm;
  
  if(searchTerm === '') {
    isSearchActive = false;
    const activeKategori = document.querySelector('.kategori-btn.active');
    const activeSub = document.querySelector('.submenu-btn.active');
    if(activeKategori && activeSub) {
      const kat = activeKategori.innerText;
      const sub = activeSub.innerText;
      displayMenus(kat, sub);
    }
    return;
  }
  
  isSearchActive = true;
  const activeKategori = document.querySelector('.kategori-btn.active');
  if(activeKategori) {
    const kat = activeKategori.innerText;
    const activeSubBtn = document.querySelector('.submenu-btn.active');
    if(activeSubBtn) {
      displayMenus(kat, activeSubBtn.innerText);
    } else {
      displayMenus(kat, '');
    }
  } else {
    const menuContainer = document.getElementById('menuListTransaksi');
    const menuItems = document.getElementById('menuItemsTransaksi');
    if(menuContainer) menuContainer.style.display = 'block';
    if (menuItems) {
      const filtered = menus.filter(m => 
        m.nama.toLowerCase().includes(searchTerm) ||
        (m.variant && m.variant.toLowerCase().includes(searchTerm))
      );
      menuItems.innerHTML = '';
      filtered.forEach(menu => {
        const cartItem = cart.find(c => c.id === menu.id);
        const qtyInCart = cartItem ? cartItem.qty : 0;
        const badgeHtml = qtyInCart > 0 ? `<span style="background:#ef4444; color:white; border-radius:20px; padding:2px 8px; font-size:10px; font-weight:bold; margin-left:8px;">${qtyInCart}</span>` : '';
        const card = document.createElement('div');
        card.className = 'menu-item-transaksi';
        card.onclick = () => addToCart(menu);
        card.innerHTML = `<h4>${menu.nama} ${badgeHtml}</h4><p>${menu.variant}</p><div class="harga">Rp ${menu.harga.toLocaleString()}</div><div class="stok">Stok: ${menu.stok}</div>`;
        menuItems.appendChild(card);
      });
    }
  }
}
function addToCart(menu) {
  if(storeStatus !== 'open') { alert('Toko tutup!'); return; }
  if(!cekStok(menu, 1)) { alert(`Stok ${menu.nama} habis!`); return; }
  const existing = cart.find(item => item.id === menu.id);
  if(existing) existing.qty++;
  else cart.push({ ...menu, qty: 1 });
  updateCart();
  refreshCurrentMenuDisplay();
}
function removeFromCart(index) {
  if (confirm('Apakah Anda yakin ingin menghapus item ini dari keranjang?')) {
    lastDeletedCart = cart[index];
    cart.splice(index,1);
    updateCart();
  }
}
function undoCart() {
  if(lastDeletedCart) {
    cart.push(lastDeletedCart);
    lastDeletedCart = null;
    updateCart();
  } else alert('Tidak ada item yang baru dihapus');
}
// ==================== UPDATE KERANJANG DENGAN TOMBOL +/- ====================
function updateCart() {
  const cartList = document.getElementById('cartList');
  if(cartList) {
    cartList.innerHTML = '';
    cart.forEach((item, idx) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.gap = '8px';
      li.style.padding = '8px';
      li.style.borderBottom = '1px solid #e2e8f0';
      li.innerHTML = `
        <div style="flex:2;">${item.nama} (${item.variant})</div>
        <div style="display:flex; align-items:center; gap:5px;">
          <button class="cart-qty-minus" data-index="${idx}" style="background:#f59e0b; border:none; border-radius:8px; width:28px; height:28px; cursor:pointer;">-</button>
          <span style="min-width:30px; text-align:center;">${item.qty}</span>
          <button class="cart-qty-plus" data-index="${idx}" style="background:#10b981; border:none; border-radius:8px; width:28px; height:28px; cursor:pointer;">+</button>
        </div>
        <div style="flex:1; text-align:right;">Rp ${(item.harga * item.qty).toLocaleString()}</div>
        <button class="cart-remove" data-index="${idx}" style="background:#ef4444; padding:4px 10px; border:none; border-radius:8px; color:white; cursor:pointer;">Hapus</button>
      `;
      cartList.appendChild(li);
    });

    // ✅ Tambahkan event listener untuk tombol + dan - setelah elemen dibuat
    document.querySelectorAll('.cart-qty-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index);
        changeQty(index, 1);
      });
    });
    document.querySelectorAll('.cart-qty-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index);
        changeQty(index, -1);
      });
    });
    document.querySelectorAll('.cart-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index);
        if(confirm('Hapus item ini?')) {
          cart.splice(index, 1);
          updateCart();
        }
      });
    });
  }
  hitungTotal();
  const count = cart.reduce((s,i)=>s+i.qty,0);
  const itemCountSpan = document.getElementById('cartItemCount');
  if(itemCountSpan) itemCountSpan.innerText = count + ' item';
  refreshCurrentMenuDisplay();
}

function changeQty(index, delta) {
  if(!cart[index]) return;
  const newQty = cart[index].qty + delta;
  if(newQty <= 0) {
    if(confirm(`Hapus ${cart[index].nama} dari keranjang?`)) {
      cart.splice(index, 1);
    }
  } else {
    cart[index].qty = newQty;
  }
  updateCart();
}
function refreshCurrentMenuDisplay() {
  const activeKategori = document.querySelector('.kategori-btn.active');
  const activeSub = document.querySelector('.submenu-btn.active');
  if(activeKategori && activeSub) {
    const kat = activeKategori.innerText;
    const sub = activeSub.innerText;
    displayMenus(kat, sub);
  } else if(activeKategori) {
    const kat = activeKategori.innerText;
    displaySubMenus(kat);
  }
}
function getVoucherValue(selectId, manualId) {
  const selectEl = document.getElementById(selectId);
  const manualEl = document.getElementById(manualId);
  const selectVal = selectEl ? parseInt(selectEl.value || 0) : 0;
  const manualVal = manualEl ? parseInt(manualEl.value || 0) : 0;
  return selectVal > 0 ? selectVal : manualVal;
}
function hitungTotal() {
  const totalHarga = cart.reduce((s,i)=>s+(i.harga*i.qty),0);
  let autoDisc = 0;
  if(autoDiscountMin > 0 && autoDiscountAmount > 0 && totalHarga >= autoDiscountMin) {
    autoDisc = autoDiscountAmount;
    const autoInfo = document.getElementById('autoDiscountInfo');
    if(autoInfo) autoInfo.innerText = `🎉 Auto Diskon: -Rp ${autoDisc.toLocaleString()} (min belanja Rp ${autoDiscountMin.toLocaleString()})`;
  } else {
    const autoInfo = document.getElementById('autoDiscountInfo');
    if(autoInfo) autoInfo.innerText = '';
  }
  const vPlatform = getVoucherValue('voucherPlatformSelect','voucherPlatformManual');
  const vDinein = getVoucherValue('voucherDineinSelect','voucherDineinManual');
  const dPersen = getVoucherValue('diskonPersenSelect','diskonPersenManual');
  const dNominal = parseInt(document.getElementById('diskonNominal')?.value || 0);
  const shouldApplyPpn = ppnEnabled && selectedPlatform !== 'Dinein';
  let afterVoucher = Math.max(0, totalHarga - vPlatform - vDinein - dNominal - autoDisc);
  let diskonPersenVal = (afterVoucher * dPersen) / 100;
  let totalAkhir = Math.max(0, afterVoucher - diskonPersenVal);
  if (shouldApplyPpn) totalAkhir = totalAkhir * 1.11;
  totalAkhir = Math.round(totalAkhir);
  const totalHargaSpan = document.getElementById('totalHarga');
  if(totalHargaSpan) totalHargaSpan.innerText = totalHarga.toLocaleString();
  const totalSetelahSpan = document.getElementById('totalSetelahDiskon');
  if(totalSetelahSpan) totalSetelahSpan.innerText = totalAkhir.toLocaleString();
  let detail = '';
  if(autoDisc>0) detail += `Auto Diskon -Rp ${autoDisc.toLocaleString()} `;
  if(vPlatform>0) detail += `Voucher Platform -Rp ${vPlatform.toLocaleString()} `;
  if(vDinein>0) detail += `Voucher Dinein -Rp ${vDinein.toLocaleString()} `;
  if(dNominal>0) detail += `Diskon Nominal -Rp ${dNominal.toLocaleString()} `;
  if(dPersen>0) detail += `Diskon ${dPersen}% -Rp ${Math.round(diskonPersenVal).toLocaleString()}`;
  if(ppnEnabled) detail += ` + PPN 11%`;
  const detailDiskon = document.getElementById('detailDiskon');
  if(detailDiskon) detailDiskon.innerText = detail || 'Tidak ada diskon';
  return { totalAkhir, totalHarga, vPlatform, vDinein, dPersen, dNominal, diskonPersenVal, autoDisc, ppnApplied: shouldApplyPpn };
}
function toggleVoucherPanel() {
  const panel = document.getElementById('voucherPanel');
  const icon = document.getElementById('voucherToggleIcon');
  if(panel && icon) {
    if(panel.style.display === 'none') { panel.style.display = 'block'; icon.innerHTML = '▲'; }
    else { panel.style.display = 'none'; icon.innerHTML = '▼'; }
  }
}

// ==================== PEMBAYARAN & STRUK ====================
function setupPaymentOptions() {
  const container = document.getElementById('paymentOptionsContainer');
  if(!container) return;
  if(selectedPlatform === 'Dinein') {
    container.innerHTML = `<label class="payment-option"><input type="radio" name="paymentMethod" value="Cash" checked> 💵 Cash</label><label class="payment-option"><input type="radio" name="paymentMethod" value="QRIS"> 📱 QRIS</label>`;
  } else {
    const paymentName = { Grabfood:'Grab', Gofood:'Gopay', Shopeefood:'ShopeePay', TikTok:'TikTok Pay' }[selectedPlatform] || 'Cash';
    container.innerHTML = `<label class="payment-option"><input type="radio" name="paymentMethod" value="${paymentName}" checked> 📱 ${paymentName}</label>`;
  }
  document.querySelectorAll('#paymentOptionsContainer input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', function() { selectedPaymentMethod = this.value; updatePaymentUI(); });
  });
  if(selectedPlatform === 'Dinein') selectedPaymentMethod = 'Cash';
  else selectedPaymentMethod = { Grabfood:'Grab', Gofood:'Gopay', Shopeefood:'ShopeePay', TikTok:'TikTok Pay' }[selectedPlatform] || 'Cash';
  updatePaymentUI();
}
function updatePaymentUI() {
  const cashGroup = document.getElementById('cashInputGroup');
  const qrisInfo = document.getElementById('qrisInfo');
  const total = hitungTotal();
  if(selectedPaymentMethod === 'Cash') {
    if(cashGroup) cashGroup.style.display = 'block';
    if(qrisInfo) qrisInfo.style.display = 'none';
    const bayarInput = document.getElementById('jumlahBayar');
    if(bayarInput) { bayarInput.removeEventListener('input', updateKembalian); bayarInput.addEventListener('input', updateKembalian); }
    updateKembalian();
  } else if(selectedPaymentMethod === 'QRIS') {
    if(cashGroup) cashGroup.style.display = 'none';
    if(qrisInfo) {
      qrisInfo.style.display = 'block';
      const qrisTotalSpan = document.getElementById('qrisTotal');
      if(qrisTotalSpan) qrisTotalSpan.innerText = total.totalAkhir.toLocaleString();
      const qrcodeDiv = document.getElementById('qrcode');
      if(qrcodeDiv && typeof QRCode !== 'undefined') {
        qrcodeDiv.innerHTML = '';
        new QRCode(qrcodeDiv, { text: `DewePOS Payment: Rp ${total.totalAkhir}`, width: 120, height: 120 });
      }
      let confirmBtn = document.getElementById('qrisConfirmPayment');
      if(!confirmBtn) {
        confirmBtn = document.createElement('button');
        confirmBtn.id = 'qrisConfirmPayment';
        confirmBtn.innerText = '✅ Saya Sudah Bayar';
        confirmBtn.style.marginTop = '15px';
        confirmBtn.style.width = '100%';
        confirmBtn.style.padding = '8px';
        confirmBtn.style.backgroundColor = '#10b981';
        confirmBtn.style.color = 'white';
        confirmBtn.style.border = 'none';
        confirmBtn.style.borderRadius = '8px';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.onclick = () => {
          window.qrisConfirmed = true;
          alert('Terima kasih, konfirmasi pembayaran diterima. Silakan klik "Bayar & Print Struk".');
        };
        qrisInfo.appendChild(confirmBtn);
      } else {
        confirmBtn.style.display = 'block';
      }
      window.qrisConfirmed = false;
    }
  } else {
    if(cashGroup) cashGroup.style.display = 'none';
    if(qrisInfo) {
      qrisInfo.style.display = 'none';
      const confirmBtn = document.getElementById('qrisConfirmPayment');
      if(confirmBtn) confirmBtn.style.display = 'none';
    }
  }
}
function updateKembalian() {
  const total = hitungTotal();
  const bayar = parseInt(document.getElementById('jumlahBayar')?.value || 0);
  const kembalian = bayar - total.totalAkhir;
  const text = document.getElementById('kembalianText');
  if(text) {
    if(bayar > 0 && kembalian >= 0) { text.innerHTML = `💰 Kembalian: Rp ${kembalian.toLocaleString()}`; text.style.color = '#10b981'; }
    else if(bayar > 0 && kembalian < 0) { text.innerHTML = `⚠️ Kurang: Rp ${Math.abs(kembalian).toLocaleString()}`; text.style.color = '#ef4444'; }
    else text.innerHTML = 'Masukkan jumlah uang';
  }
}

function generatePreviewStruk() {
  const total = hitungTotal();
  const now = new Date();
  let kembalianPreview = '';
  if (selectedPaymentMethod === 'Cash') {
    const bayar = parseInt(document.getElementById('jumlahBayar')?.value || 0);
    const kembali = bayar - total.totalAkhir;
    if (bayar > 0 && kembali >= 0) kembalianPreview = `<div>Bayar Cash: Rp ${bayar.toLocaleString()}</div><div>Kembalian: Rp ${kembali.toLocaleString()}</div>`;
  }
  const storeNameStatic = "KIOS KI WOKWOK";
  const storeAddressStatic = "JL NEGARA API NO.77 MARS PLANET, BIMA SAKTI";
  const storePhoneStatic = "Telp: 0812 0813 0814";
  return `<div style="text-align:center;">
      <h3>${storeNameStatic}</h3>
      <p style="font-size:10px;">${storeAddressStatic}</p>
      <p style="font-size:10px;">${storePhoneStatic}</p>
      <p>${now.toLocaleString()}</p>
      <p>Platform: ${selectedPlatform}</p>
      <p>Metode: ${selectedPaymentMethod}</p>
      <hr></div>
    ${cart.map(i=>`<div>${i.nama} (${i.variant}) x${i.qty} = Rp ${(i.harga*i.qty).toLocaleString()}</div>`).join('')}
    <hr><div>Total Harga: Rp ${total.totalHarga.toLocaleString()}</div>
    ${total.autoDisc>0?`<div>Auto Diskon: -Rp ${total.autoDisc.toLocaleString()}</div>`:''}
    ${total.vPlatform>0?`<div>Voucher Platform: -Rp ${total.vPlatform.toLocaleString()}</div>`:''}
    ${total.vDinein>0?`<div>Voucher Dinein: -Rp ${total.vDinein.toLocaleString()}</div>`:''}
    ${total.dNominal>0?`<div>Diskon Nominal: -Rp ${total.dNominal.toLocaleString()}</div>`:''}
    ${total.dPersen>0?`<div>Diskon ${total.dPersen}%: -Rp ${Math.round(total.diskonPersenVal).toLocaleString()}</div>`:''}
    ${total.ppnApplied ? `<div>PPN 11%: +Rp ${Math.round(total.totalAkhir * 0.11 / 1.11).toLocaleString()}</div>` : ''}
    <hr><div style="font-weight:bold;">TOTAL BAYAR: Rp ${total.totalAkhir.toLocaleString()}</div>
    ${kembalianPreview}<hr><div style="text-align:center;">Terima Kasih!</div>`;
}
function showPreview() {
  if(cart.length===0) { alert('Keranjang kosong!'); return; }
  if(storeStatus !== 'open') { alert('Toko tutup!'); return; }
  window.qrisConfirmed = false;
  setupPaymentOptions();
  const previewContent = document.getElementById('previewStrukContent');
  if(previewContent) previewContent.innerHTML = generatePreviewStruk();
  const previewModal = document.getElementById('previewStrukModal');
  if(previewModal) previewModal.style.display = 'block';
}
function closePreview() { const modal = document.getElementById('previewStrukModal'); if(modal) modal.style.display = 'none'; }
function processPayment() {
  if(selectedPaymentMethod === 'QRIS' && !window.qrisConfirmed) {
    alert('⚠️ Silakan scan QR Code dan klik tombol "Saya Sudah Bayar" sebelum melanjutkan!');
    return;
  }
  if(cart.length===0) { alert('Keranjang kosong!'); return; }
  if(storeStatus !== 'open') { alert('Toko tutup!'); return; }
  for(let item of cart) if(!cekStok(item, item.qty)) { alert(`Stok ${item.nama} tidak cukup!`); return; }
  const totalCalc = hitungTotal();
  let cashAmount = null, change = null;
  if(selectedPaymentMethod === 'Cash') {
    cashAmount = parseInt(document.getElementById('jumlahBayar')?.value || 0);
    change = cashAmount - totalCalc.totalAkhir;
    if(change < 0) { alert(`Uang kurang!`); return; }
  }
  cart.forEach(item => kurangiStok(item.id, item.qty));
  const profit = cart.reduce((sum,item) => { const m = menus.find(m=>m.id===item.id); return sum + ((item.harga - (m?.modal||0)) * item.qty); },0);
  const invoiceNumber = generateInvoiceNumber();
 const transaction = {
  id: Date.now(), invoiceNumber, date: new Date().toISOString(), items: [...cart],
  totalAsli: totalCalc.totalHarga, autoDiscount: totalCalc.autoDisc,
  diskonPlatform: totalCalc.vPlatform, diskonDinein: totalCalc.vDinein,
  diskonNominal: totalCalc.dNominal, diskonPersen: totalCalc.dPersen, diskonPersenValue: totalCalc.diskonPersenVal,
  total: totalCalc.totalAkhir,        // ← hanya satu
  ppnApplied: totalCalc.ppnApplied,
  user: currentUserObj.username, platform: selectedPlatform,
  paymentMethod: selectedPaymentMethod, cashAmount, change, profit, voided: false
};
  transactions.push(transaction);
  saveTransactions();
  saveSettings();
  alert(`✅ Transaksi sukses! Invoice: ${invoiceNumber} | Total: Rp ${totalCalc.totalAkhir.toLocaleString()}`);
  closePreview();
  showFinalStruk(transaction);
  if(autoPrint) {
    setTimeout(() => {
      const content = document.getElementById('strukContent')?.innerHTML;
      if(content) {
        const win = window.open('', '_blank');
        if(win) {
          win.document.write(`<html><head><title>Struk DewePOS</title><style>body{font-family:'Courier New',monospace;padding:20px;}</style></head><body>${content}</body></html>`);
          win.document.close();
          win.print();
        }
      }
    }, 500);
  }
  cart = [];
  updateCart();
  updateBerandaStats();
  displayRiwayat();
  displayRekapDetail();
  updatePendapatanSummary();
  updateLowStockWarning();
  updateTopProducts();
  updateSalesChart();
  updateProfitChart();
  updateKasirFilters();
}
function showFinalStruk(transaction) {
  const now = new Date();
  let paymentDetail = '';
  if (transaction.paymentMethod === 'Cash') {
    paymentDetail = `<div>Bayar Cash: Rp ${transaction.cashAmount?.toLocaleString()} | Kembali: Rp ${transaction.change?.toLocaleString()}</div>`;
  } else {
    paymentDetail = `<div>Metode: ${transaction.paymentMethod}</div>`;
  }

  // Gunakan flag ini
  const isPpnApplied = transaction.ppnApplied === true;

  const storeNameStatic = "KIOS KI WOKWOK";
  const storeAddressStatic = "JL NEGARA API NO.77 MARS PLANET, BIMA SAKTI";
  const storePhoneStatic = "Telp: 0812 0813 0814";

  const strukContent = `
    <div style="text-align:center;">
      <h3>${storeNameStatic}</h3>
      <p style="font-size:10px;">${storeAddressStatic}</p>
      <p style="font-size:10px;">${storePhoneStatic}</p>
      <p>${now.toLocaleString()}</p>
      <p>Invoice: ${transaction.invoiceNumber}</p>
      <p>Kasir: ${transaction.user}</p>
      <p>Platform: ${transaction.platform}</p>
      <hr>
    </div>
    ${transaction.items.map(item => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 2px 0;">
        <span style="flex: 2; text-align: left;">${item.nama} (${item.variant})</span>
        <span style="flex: 0; text-align: center; min-width: 35px;">×${item.qty}</span>
        <span style="flex: 1; text-align: right;">${formatRupiah(item.harga * item.qty)}</span>
      </div>
    `).join('')}
    <hr><div>Total Harga: Rp ${transaction.totalAsli.toLocaleString()}</div>
    ${transaction.autoDiscount > 0 ? `<div>Auto Diskon: -Rp ${transaction.autoDiscount.toLocaleString()}</div>` : ''}
    ${transaction.diskonPlatform > 0 ? `<div>Voucher Platform: -Rp ${transaction.diskonPlatform.toLocaleString()}</div>` : ''}
    ${transaction.diskonDinein > 0 ? `<div>Voucher Dinein: -Rp ${transaction.diskonDinein.toLocaleString()}</div>` : ''}
    ${transaction.diskonNominal > 0 ? `<div>Diskon Nominal: -Rp ${transaction.diskonNominal.toLocaleString()}</div>` : ''}
    ${transaction.diskonPersen > 0 ? `<div>Diskon ${transaction.diskonPersen}%: -Rp ${Math.round(transaction.diskonPersenValue).toLocaleString()}</div>` : ''}
    ${isPpnApplied ? `<div>PPN 11%: +Rp ${Math.round(transaction.total * 0.11 / 1.11).toLocaleString()}</div>` : ''}
    <hr><div style="font-weight:bold;">TOTAL BAYAR: Rp ${transaction.total.toLocaleString()}</div>
    ${paymentDetail}<hr><div style="text-align:center;">Terima Kasih!<br>⭐ Rating & Review ⭐</div>
    <div style="text-align:center; margin-top:10px;"><div id="strukQRCode"></div></div>
  `;

  const strukContentDiv = document.getElementById('strukContent');
  if (strukContentDiv) strukContentDiv.innerHTML = strukContent;
  setTimeout(() => {
    const qrDiv = document.getElementById('strukQRCode');
    if (qrDiv && typeof QRCode !== 'undefined') new QRCode(qrDiv, { text: `Invoice: ${transaction.invoiceNumber}\nTotal: Rp ${transaction.total}`, width: 80, height: 80 });
  }, 100);
  const strukModal = document.getElementById('strukModal');
  if (strukModal) strukModal.style.display = 'block';
}

// ==================== PRINT STRUK ====================
const printStrukBtn = document.getElementById('printStrukBtn');
if(printStrukBtn) {
  printStrukBtn.addEventListener('click', () => {
  const content = document.getElementById('strukContent').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Struk DewePOS</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            width: 280px;
            margin: 0 auto;
            padding: 10px;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  win.document.close();
  win.print();
});
}

function reprintStruk(transaction) {
  // Siapkan konten struk (copy dari showFinalStruk, tapi tanpa modal)
  const now = new Date();
  const isPpnApplied = transaction.ppnApplied === true;
  const storeNameStatic = "KIOS KI WOKWOK";
  const storeAddressStatic = "JL NEGARA API NO.77 MARS PLANET, BIMA SAKTI";
  const storePhoneStatic = "Telp: 0812 0813 0814";
  
  let paymentDetail = '';
  if (transaction.paymentMethod === 'Cash') {
    paymentDetail = `<div>Bayar Cash: Rp ${transaction.cashAmount?.toLocaleString()} | Kembali: Rp ${transaction.change?.toLocaleString()}</div>`;
  } else {
    paymentDetail = `<div>Metode: ${transaction.paymentMethod}</div>`;
  }

  const strukContent = `
    <div style="text-align:center;">
      <h3>${storeNameStatic}</h3>
      <p style="font-size:10px;">${storeAddressStatic}</p>
      <p style="font-size:10px;">${storePhoneStatic}</p>
      <p>${now.toLocaleString()}</p>
      <p>Invoice: ${transaction.invoiceNumber}</p>
      <p>Kasir: ${transaction.user}</p>
      <p>Platform: ${transaction.platform}</p>
      <hr>
    </div>
    ${transaction.items.map(item => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 2px 0;">
        <span style="flex: 2; text-align: left;">${item.nama} (${item.variant})</span>
        <span style="flex: 0; text-align: center; min-width: 35px;">×${item.qty}</span>
        <span style="flex: 1; text-align: right;">${formatRupiah(item.harga * item.qty)}</span>
      </div>
    `).join('')}
    <hr><div>Total Harga: Rp ${transaction.totalAsli.toLocaleString()}</div>
    ${transaction.autoDiscount > 0 ? `<div>Auto Diskon: -Rp ${transaction.autoDiscount.toLocaleString()}</div>` : ''}
    ${transaction.diskonPlatform > 0 ? `<div>Voucher Platform: -Rp ${transaction.diskonPlatform.toLocaleString()}</div>` : ''}
    ${transaction.diskonDinein > 0 ? `<div>Voucher Dinein: -Rp ${transaction.diskonDinein.toLocaleString()}</div>` : ''}
    ${transaction.diskonNominal > 0 ? `<div>Diskon Nominal: -Rp ${transaction.diskonNominal.toLocaleString()}</div>` : ''}
    ${transaction.diskonPersen > 0 ? `<div>Diskon ${transaction.diskonPersen}%: -Rp ${Math.round(transaction.diskonPersenValue).toLocaleString()}</div>` : ''}
    ${isPpnApplied ? `<div>PPN 11%: +Rp ${Math.round(transaction.total * 0.11 / 1.11).toLocaleString()}</div>` : ''}
    <hr><div style="font-weight:bold;">TOTAL BAYAR: Rp ${transaction.total.toLocaleString()}</div>
    ${paymentDetail}<hr><div style="text-align:center;">Terima Kasih!<br>⭐ Rating & Review ⭐</div>
    <div style="text-align:center; margin-top:10px;"><div id="strukQRCode"></div></div>
  `;

  // Cetak langsung
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Cetak Ulang Struk - ${transaction.invoiceNumber}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 280px; margin: 0 auto; padding: 10px; }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>${strukContent}</body>
    </html>
  `);
  win.document.close();
  win.print();
  win.close();
}

// ==================== DASHBOARD STATS ====================
function updateBerandaStats() {
  const today = new Date().toDateString();
  let todayCount=0, todayTotal=0, todayProfit=0;
  transactions.forEach(t => {
    if(!t.voided && new Date(t.date).toDateString() === today) {
      todayCount++;
      todayTotal += t.total;
      todayProfit += t.profit;
    }
  });
  const countEl = document.getElementById('berandaTransaksiCount');
  if(countEl) countEl.innerText = todayCount;
  const pendapatanEl = document.getElementById('berandaPendapatanHariIni');
  if(pendapatanEl) pendapatanEl.innerHTML = formatRupiah(todayTotal);
  const profitEl = document.getElementById('berandaProfitHariIni');
  if(profitEl) profitEl.innerHTML = formatRupiah(todayProfit);
  updateLowStockWarning();
  updateTopProducts();
  updateSalesChart();
  updateProfitChart();
}
function updateLowStockWarning() {
  const low = menus.filter(m => m.stok <= 5);
  const container = document.getElementById('lowStockList');
  if(container) container.innerHTML = low.length ? low.map(m=>`<div class="low-stock-item">⚠️ ${m.nama} (${m.variant}) sisa ${m.stok}</div>`).join('') : '<p>Semua stok aman</p>';
}
function updateTopProducts() {
  const productSales = {};
  transactions.forEach(t => {
    if(t.voided) return;
    t.items.forEach(item => { const key = `${item.nama} (${item.variant})`; productSales[key] = (productSales[key] || 0) + item.qty; });
  });
  const top = Object.entries(productSales).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const container = document.getElementById('topProductsList');
  if(container) container.innerHTML = top.length ? top.map(([name,qty])=>`<div class="top-product-item"><span>${name}</span><span>${qty} terjual</span></div>`).join('') : '<p>Belum ada data</p>';
}
function updateSalesChart() {
  const last7 = [];
  for(let i=6;i>=0;i--) {
    const date = new Date(); date.setDate(date.getDate()-i);
    const dateStr = date.toDateString();
    const total = transactions.filter(t=>!t.voided && new Date(t.date).toDateString()===dateStr).reduce((s,t)=>s+t.total,0);
    last7.push(total);
  }
  const ctx = document.getElementById('salesChart')?.getContext('2d');
  if(ctx && typeof Chart !== 'undefined') {
    if(salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, { type: 'line', data: { labels: ['H-6','H-5','H-4','H-3','H-2','Kemarin','Hari Ini'], datasets: [{ label: 'Pendapatan', data: last7, borderColor: '#4361ee', tension: 0.3 }] } });
  }
}
function updateProfitChart() {
  const last7 = [];
  for(let i=6;i>=0;i--) {
    const date = new Date(); date.setDate(date.getDate()-i);
    const dateStr = date.toDateString();
    const profit = transactions.filter(t=>!t.voided && new Date(t.date).toDateString()===dateStr).reduce((s,t)=>s+t.profit,0);
    last7.push(profit);
  }
  const ctx = document.getElementById('profitChart')?.getContext('2d');
  if(ctx && typeof Chart !== 'undefined') {
    if(profitChart) profitChart.destroy();
    profitChart = new Chart(ctx, { type: 'bar', data: { labels: ['H-6','H-5','H-4','H-3','H-2','Kemarin','Hari Ini'], datasets: [{ label: 'Profit', data: last7, backgroundColor: '#10b981' }] } });
  }
}
function updateLastSales() {
  const list = document.getElementById('lastSalesList');
  if(!list) return;
  if(transactions.length===0) { list.innerHTML = '<p>Belum ada transaksi</p>'; return; }
  list.innerHTML = '';
  transactions.filter(t=>!t.voided).slice(-5).reverse().forEach(t => {
    const div = document.createElement('div');
    div.className = 'last-sale-item';
    div.innerHTML = `<div>${new Date(t.date).toLocaleString()}</div><div><strong>${t.platform}</strong> - Rp ${t.total.toLocaleString()}</div><div>Profit: Rp ${t.profit.toLocaleString()}</div><div>Invoice: ${t.invoiceNumber}</div>`;
    list.appendChild(div);
  });
}

// ==================== REKAP PENJUALAN ====================
function filterRekap(p) {
  currentRekapFilter = p;
  document.querySelectorAll('.rekap-filter .filter-btn').forEach(btn => {
    btn.classList.remove('active');
    const match = btn.getAttribute('onclick')?.match(/filterRekap\('([^']+)'\)/);
    if (match && match[1] === p) btn.classList.add('active');
  });
  displayRekapDetail();
}
function filterRekapByPlatform(p) {
  currentPlatformFilter = p;
  document.querySelectorAll('#rekapPage .platform-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-platform') === p) tab.classList.add('active');
  });
  displayRekapDetail();
}
function displayRekapDetail() {
  let filtered = transactions.filter(t=>!t.voided);
  const now = new Date();
  if(currentRekapFilter === 'harian') filtered = filtered.filter(t=>new Date(t.date).toDateString()===now.toDateString());
  else if(currentRekapFilter === 'mingguan') { const week = getWeekNumber(now); filtered = filtered.filter(t=>getWeekNumber(new Date(t.date))===week); }
  else if(currentRekapFilter === 'bulanan') filtered = filtered.filter(t=>new Date(t.date).getMonth()===now.getMonth() && new Date(t.date).getFullYear()===now.getFullYear());
  if(currentPlatformFilter !== 'all') filtered = filtered.filter(t=>t.platform === currentPlatformFilter);
  const kasirFilter = document.getElementById('filterKasirRekap')?.value;
  if(kasirFilter && kasirFilter !== 'all') filtered = filtered.filter(t=>t.user === kasirFilter);
  const totalTrans = filtered.length;
  const totalPendapatan = filtered.reduce((s,t)=>s+t.total,0);
  const totalProfit = filtered.reduce((s,t)=>s+t.profit,0);
  const totalTransEl = document.getElementById('rekapTotalTransaksi'); if(totalTransEl) totalTransEl.innerText = totalTrans;
  const totalPendapatanEl = document.getElementById('rekapTotalPendapatan'); if(totalPendapatanEl) totalPendapatanEl.innerHTML = formatRupiah(totalPendapatan);
  const totalProfitEl = document.getElementById('rekapTotalProfit'); if(totalProfitEl) totalProfitEl.innerHTML = formatRupiah(totalProfit);
  const container = document.getElementById('rekapDetailList');
  if(container) container.innerHTML = filtered.map(t=>`<div class="rekap-group"><div class="rekap-group-header" onclick="this.nextElementSibling.classList.toggle('show')"><span>${new Date(t.date).toLocaleString()} - ${t.platform} (${t.invoiceNumber})</span><span>Rp ${t.total.toLocaleString()}</span></div><div class="rekap-group-content" style="display:none;">${t.items.map(i=>`${i.nama} x${i.qty}`).join(', ')}<br>Kasir: ${t.user}<br>Profit: Rp ${t.profit.toLocaleString()}</div></div>`).join('');
}

// ==================== PENDAPATAN & PROFIT ====================
function getFilteredTransactionsByDate() {
  let filtered = transactions.filter(t=>!t.voided);
  if(pendapatanStartDate && pendapatanEndDate) {
    const start = new Date(pendapatanStartDate);
    const end = new Date(pendapatanEndDate); end.setHours(23,59,59);
    filtered = filtered.filter(t=>new Date(t.date) >= start && new Date(t.date) <= end);
  } else {
    const now = new Date();
    if(pendapatanDateFilter === 'today') filtered = filtered.filter(t=>new Date(t.date).toDateString()===now.toDateString());
    else if(pendapatanDateFilter === 'week') { const weekAgo = new Date(now); weekAgo.setDate(now.getDate()-7); filtered = filtered.filter(t=>new Date(t.date) >= weekAgo); }
    else if(pendapatanDateFilter === 'month') filtered = filtered.filter(t=>new Date(t.date).getMonth()===now.getMonth() && new Date(t.date).getFullYear()===now.getFullYear());
  }
  const kasirFilter = document.getElementById('filterKasirPendapatan')?.value;
  if(kasirFilter && kasirFilter !== 'all') filtered = filtered.filter(t=>t.user === kasirFilter);
  return filtered;
}
function filterPendapatanByPlatform(platform) {
  currentPendapatanPlatform = platform;
  document.querySelectorAll('#pendapatanPage .platform-tab').forEach(tab => { tab.classList.remove('active'); if(tab.getAttribute('data-platform')===platform) tab.classList.add('active'); });
  updatePendapatanSummary();
}
function updatePaymentMethodSummary() {
  let filtered = getFilteredTransactionsByDate();
  const kasirFilter = document.getElementById('filterKasirPendapatan')?.value;
  if (kasirFilter && kasirFilter !== 'all') filtered = filtered.filter(t => t.user === kasirFilter);
  const methodMap = new Map();
  filtered.forEach(t => {
    const method = t.paymentMethod || 'Cash';
    if (!methodMap.has(method)) methodMap.set(method, { total: 0, count: 0 });
    const curr = methodMap.get(method);
    curr.total += t.total;
    curr.count++;
  });
  const container = document.getElementById('paymentMethodSummary');
  if (!container) return;
  if (methodMap.size === 0) { container.innerHTML = '<p style="padding:20px; text-align:center;">Belum ada data transaksi.</p>'; return; }
  const methodIcons = { 'Cash':'💵','QRIS':'📱','Grab':'🚗','Gopay':'💚','ShopeePay':'🛍️','TikTok Pay':'🎵' };
  let html = '';
  for (let [method, data] of methodMap.entries()) {
    const icon = methodIcons[method] || '💳';
    html += `<div class="payment-method-card"><div class="payment-method-icon">${icon}</div><div class="payment-method-name">${method}</div><div class="payment-method-total">${formatRupiah(data.total)}</div><div class="payment-method-count">${data.count} transaksi</div></div>`;
  }
  container.innerHTML = html;
}
function updatePendapatanSummary() {
  let filtered = getFilteredTransactionsByDate();
  const platforms = ['Grabfood','Gofood','Shopeefood','TikTok','Dinein'];
  const summaryDiv = document.getElementById('pendapatanSummaryPlatforms');
  if(summaryDiv) {
    summaryDiv.innerHTML = '';
    platforms.forEach(plat => {
      const platTrans = filtered.filter(t=>t.platform===plat);
      const total = platTrans.reduce((s,t)=>s+t.total,0);
      const profit = platTrans.reduce((s,t)=>s+t.profit,0);
      const count = platTrans.length;
      const card = document.createElement('div');
      card.className = 'platform-summary-card';
      card.setAttribute('data-platform', plat);
      card.onclick = () => filterPendapatanByPlatform(plat);
      card.innerHTML = `<div class="platform-summary-icon">📱</div><div class="platform-summary-name">${plat}</div><div class="platform-summary-total">${formatRupiah(total)}</div><div class="platform-summary-count">${count} trans</div><div style="font-size:11px; color:#10b981;">Profit: ${formatRupiah(profit)}</div>`;
      summaryDiv.appendChild(card);
    });
  }
  let finalFiltered = filtered;
  if(currentPendapatanPlatform !== 'all') finalFiltered = filtered.filter(t=>t.platform === currentPendapatanPlatform);
  const totalSemua = finalFiltered.reduce((s,t)=>s+t.total,0);
  const profitSemua = finalFiltered.reduce((s,t)=>s+t.profit,0);
  const totalSemuaEl = document.getElementById('totalPendapatanSemua'); if(totalSemuaEl) totalSemuaEl.innerHTML = formatRupiah(totalSemua);
  const totalProfitSemuaEl = document.getElementById('totalProfitSemua'); if(totalProfitSemuaEl) totalProfitSemuaEl.innerHTML = `Profit: ${formatRupiah(profitSemua)}`;
  const totalTransSemuaEl = document.getElementById('totalTransaksiSemua'); if(totalTransSemuaEl) totalTransSemuaEl.innerText = finalFiltered.length+' transaksi';
  const container = document.getElementById('pendapatanDetailList');
  if(container) container.innerHTML = finalFiltered.map(t=>`<div class="pendapatan-detail-item"><div><strong>${new Date(t.date).toLocaleString()}</strong> - ${t.platform} (${t.invoiceNumber})</div><div>Total: ${formatRupiah(t.total)} | Profit: ${formatRupiah(t.profit)}</div><div>${t.items.map(i=>`${i.nama} x${i.qty}`).join(', ')}</div><div>Kasir: ${t.user}</div></div>`).join('');
  updatePaymentMethodSummary();
}

// ==================== RIWAYAT & VOID ====================
function displayRiwayat(searchTerm = '') {
  let filtered = [...transactions].reverse();
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(t =>
      t.items.some(item => item.nama.toLowerCase().includes(term)) ||
      t.platform.toLowerCase().includes(term) ||
      t.user.toLowerCase().includes(term) ||
      t.invoiceNumber.toLowerCase().includes(term)
    );
  }
  const kasirFilter = document.getElementById('filterKasirRiwayat')?.value;
  if (kasirFilter && kasirFilter !== 'all') filtered = filtered.filter(t => t.user === kasirFilter);
  const container = document.getElementById('riwayatList');
  if (!container) return;
  if (filtered.length === 0) { container.innerHTML = '<p style="text-align:center; padding:20px;">Tidak ada transaksi yang ditemukan.</p>'; return; }
  container.innerHTML = filtered.map(t => `
    ${!t.voided ? `<button onclick="reprintStruk(${JSON.stringify(t).replace(/'/g, "&#39;")})" style="background:#4361ee; color:white; border:none; border-radius:8px; padding:4px 12px; cursor:pointer;">🖨️ Cetak Ulang</button>` : ''}
    <div class="riwayat-item ${t.voided ? 'voided-transaction' : ''}" style="${t.voided ? 'opacity:0.6; background:#ffe0e0;' : ''}">
      <div>${new Date(t.date).toLocaleString()} - ${t.platform} (${t.invoiceNumber})</div>
      <div>Total: Rp ${t.total.toLocaleString()} | Profit: Rp ${t.profit.toLocaleString()}</div>
      <div>Kasir: ${t.user} | Metode: ${t.paymentMethod}</div>
      <div>Items: ${t.items.map(i => `${i.nama} x${i.qty}`).join(', ')}</div>
      <div>${t.voided ? '<span style="background:#dc2626; color:white; padding:2px 8px; border-radius:12px; font-size:12px;">✓ VOID</span>' : (hasRole(['admin','owner']) ? `<button onclick="voidTransaction(${t.id})" class="void-btn" style="background:#ef4444; color:white; border:none; padding:4px 12px; border-radius:8px; cursor:pointer;">Void</button>` : '')}</div>
    </div>
  `).join('');
}

function voidTransaction(id) {
  if(!hasRole(['admin','owner'])) { alert('Hanya admin/owner yang dapat void!'); return; }
  const trans = transactions.find(t => t.id == id);
  if(!trans || trans.voided) { alert('Transaksi tidak ditemukan atau sudah void'); return; }
  if(confirm(`Void transaksi ${trans.invoiceNumber}? Stok akan dikembalikan.`)) {
    trans.voided = true;
    trans.items.forEach(item => { const menu = menus.find(m => m.id === item.id); if(menu) menu.stok += item.qty; });
    saveMenus(); saveTransactions(); displayRiwayat(); displayRekapDetail(); updatePendapatanSummary(); updateLowStockWarning();
    alert('Transaksi telah divoid');
  }
}

// ==================== PRINT LAPORAN ====================
function printLaporan(period, startDateParam = null, endDateParam = null) {
  if (!hasRole(['kasir', 'admin', 'owner'])) {
    alert('Akses ditolak! Hanya kasir, admin, atau owner yang dapat print laporan.');
    return;
  }
  if (!currentUserObj) {
    alert('Sesi tidak valid. Silakan login ulang.');
    return;
  }
  try {
    let filtered = [];
    const now = new Date();
    let periodText = '', dateRange = '';

    if (startDateParam && endDateParam) {
      const start = new Date(startDateParam);
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59);
      filtered = transactions.filter(t => !t.voided && new Date(t.date) >= start && new Date(t.date) <= end);
      periodText = 'LAPORAN PER TANGGAL';
      dateRange = `${start.toLocaleDateString('id-ID')} - ${end.toLocaleDateString('id-ID')}`;
    } else if (period === 'harian') {
      filtered = transactions.filter(t => !t.voided && new Date(t.date).toDateString() === now.toDateString());
      periodText = 'LAPORAN HARIAN';
      dateRange = now.toLocaleDateString('id-ID');
    } else if (period === 'mingguan') {
      const week = getWeekNumber(now);
      filtered = transactions.filter(t => !t.voided && getWeekNumber(new Date(t.date)) === week);
      periodText = 'LAPORAN MINGGUAN';
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      const end = new Date(now);
      end.setDate(now.getDate() - now.getDay() + 7);
      dateRange = `${start.toLocaleDateString('id-ID')} - ${end.toLocaleDateString('id-ID')}`;
    } else if (period === 'bulanan') {
      filtered = transactions.filter(t => !t.voided && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
      periodText = 'LAPORAN BULANAN';
      dateRange = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } else {
      alert('Periode tidak dikenal');
      return;
    }

    const total = filtered.reduce((s, t) => s + (t.total || 0), 0);
    const profit = filtered.reduce((s, t) => s + (t.profit || 0), 0);

    const htmlContent = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${periodText} - DewePOS</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 100%; max-width: 280px; margin: 0 auto; padding: 8px; background: white; }
          @media print { body { margin: 0; padding: 4px; } @page { size: auto; margin: 5mm; } .no-break { page-break-inside: avoid; } }
          .header { text-align: center; border-bottom: 1px dashed #000; margin-bottom: 8px; padding-bottom: 4px; }
          .header h1 { font-size: 14px; font-weight: bold; letter-spacing: 1px; margin: 0; }
          .header p { margin: 2px 0; font-size: 10px; }
          .info { margin: 6px 0; border-bottom: 1px dotted #aaa; padding-bottom: 4px; }
          .info-row { display: flex; justify-content: space-between; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          th, td { text-align: left; padding: 4px 2px; border-bottom: 1px dotted #ccc; font-size: 10px; }
          th { border-bottom: 1px solid #000; font-weight: bold; }
          .right { text-align: right; }
          .total-row { margin: 8px 0; padding-top: 4px; border-top: 1px solid #000; font-weight: bold; }
          .footer { text-align: center; margin-top: 12px; font-size: 9px; border-top: 1px dashed #000; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
  <h1 style="font-weight:bold; margin-bottom:2px;">${storeInfo.name || 'Toko Saya'}</h1>
  <p style="font-size:10px;">DewePOS Basic</p>
  ${storeInfo.address ? `<p style="font-size:9px;">${storeInfo.address}</p>` : ''}
  ${storeInfo.phone ? `<p style="font-size:9px;">Telp: ${storeInfo.phone}</p>` : ''}
  <p>${periodText}</p><p>${dateRange}</p>
  <p>${now.toLocaleString()}</p>
  <p>Kasir: ${escapeHtml(currentUserObj.username)}</p>
</div>
        <div class="info">
          <div class="info-row"><span>Total Transaksi:</span><span>${filtered.length}</span></div>
          <div class="info-row"><span>Total Pendapatan:</span><span>${formatRupiah(total)}</span></div>
          <div class="info-row"><span>Total Profit:</span><span>${formatRupiah(profit)}</span></div>
        </div>
        <table><thead><tr><th>No</th><th>Invoice</th><th>Tgl/Jam</th><th>Platf</th><th class="right">Total</th></tr></thead><tbody>
          ${filtered.map((t, i) => `<tr><td>${i+1}</td><td>${escapeHtml(t.invoiceNumber?.slice(-12) || '-')}</td><td>${t.date ? new Date(t.date).toLocaleString('id-ID', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</td><td>${escapeHtml(t.platform?.slice(0,6) || '-')}</td><td class="right">${formatRupiah(t.total || 0).replace('Rp', '').trim()}</td></tr>`).join('')}
        </tbody></table>
        <div class="total-row"><div class="info-row"><span>GRAND TOTAL</span><span>${formatRupiah(total)}</span></div></div>
        <div class="footer">Terima Kasih - DewePOS Basic<br>Dicetak: ${now.toLocaleString()}</div>
        <script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 2000); };<\/script>
      </body>
      </html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker aktif. Izinkan pop-up untuk situs ini.');
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } catch (err) {
    console.error(err);
    alert('Terjadi kesalahan saat mencetak laporan: ' + err.message);
  }
}
function showPrintDateFilter() {
  const modal = document.createElement('div');
  modal.id = 'printDateModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `<div class="modal-content" style="max-width:400px"><div class="modal-header"><h3>🖨️ Print Custom Tanggal</h3><button onclick="closePrintDateModal()">&times;</button></div><div style="padding:20px"><label>Dari Tanggal:</label><input type="date" id="printStartDate" style="width:100%;margin-bottom:10px"><label>Sampai Tanggal:</label><input type="date" id="printEndDate" style="width:100%"><button onclick="printWithDateRange()" style="margin-top:15px; width:100%; background:#4361ee; color:white; padding:10px; border:none; border-radius:10px;">Cetak</button></div></div>`;
  document.body.appendChild(modal);
  const today = new Date();
  const minDate = new Date(today); minDate.setMonth(today.getMonth()-6);
  const startInput = document.getElementById('printStartDate'); if(startInput) { startInput.max = today.toISOString().split('T')[0]; startInput.min = minDate.toISOString().split('T')[0]; }
  const endInput = document.getElementById('printEndDate'); if(endInput) { endInput.max = today.toISOString().split('T')[0]; endInput.min = minDate.toISOString().split('T')[0]; endInput.value = today.toISOString().split('T')[0]; }
  if(startInput) startInput.value = new Date(today.setDate(today.getDate()-30)).toISOString().split('T')[0];
}
function closePrintDateModal() { const m = document.getElementById('printDateModal'); if(m) m.remove(); }
function printWithDateRange() {
  const start = document.getElementById('printStartDate')?.value;
  const end = document.getElementById('printEndDate')?.value;
  if(!start || !end) { alert('Pilih tanggal'); return; }
  if(new Date(start) > new Date(end)) { alert('Tanggal mulai harus < tanggal akhir'); return; }
  closePrintDateModal();
  printLaporan('custom', start, end);
}

// ==================== EXPORT EXCEL & PDF ====================
function exportToExcel() {
  let filtered = transactions.filter(t=>!t.voided);
  if(currentRekapFilter === 'harian') filtered = filtered.filter(t=>new Date(t.date).toDateString()===new Date().toDateString());
  else if(currentRekapFilter === 'mingguan') { const week = getWeekNumber(new Date()); filtered = filtered.filter(t=>getWeekNumber(new Date(t.date))===week); }
  else if(currentRekapFilter === 'bulanan') { const now=new Date(); filtered = filtered.filter(t=>new Date(t.date).getMonth()===now.getMonth() && new Date(t.date).getFullYear()===now.getFullYear()); }
  if(currentPlatformFilter !== 'all') filtered = filtered.filter(t=>t.platform === currentPlatformFilter);
  const kasirFilter = document.getElementById('filterKasirRekap')?.value;
  if(kasirFilter && kasirFilter !== 'all') filtered = filtered.filter(t=>t.user === kasirFilter);
  if(filtered.length===0) { alert('Tidak ada data untuk diexport'); return; }
  const excelData = [['No','Invoice','Tanggal','Waktu','Platform','Metode','Kasir','Total','Profit','Items']];
  filtered.forEach((t,i) => {
    excelData.push([i+1, t.invoiceNumber, new Date(t.date).toLocaleDateString('id-ID'), new Date(t.date).toLocaleTimeString('id-ID'), t.platform, t.paymentMethod, t.user, t.total, t.profit, t.items.map(i=>`${i.nama} x${i.qty}`).join('; ')]);
  });
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan');
  XLSX.writeFile(wb, `DewePOS_Laporan_${new Date().toISOString().slice(0,19)}.xlsx`);
  alert('Export Excel berhasil');
}
function exportToPDF() {
  const printWindow = window.open('', '_blank');
  const filtered = transactions.filter(t=>!t.voided);
  printWindow.document.write(`
    <html><head><title>Laporan DewePOS</title><style>body{font-family:Arial;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px}</style></head>
    <body><h1>Laporan Penjualan DewePOS</h1><p>Tanggal cetak: ${new Date().toLocaleString()}</p>
    <table><thead><tr><th>No</th><th>Invoice</th><th>Tanggal</th><th>Platform</th><th>Total</th><th>Profit</th><th>Kasir</th></tr></thead><tbody>
    ${filtered.map((t,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${t.invoiceNumber}</td><td>${new Date(t.date).toLocaleString()}</td><td>${t.platform}</td><td style="text-align:right">${formatRupiah(t.total)}</td><td style="text-align:right">${formatRupiah(t.profit)}</td><td>${t.user}</td></tr>`).join('')}
    </tbody></table></body></html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ==================== BACKUP & RESTORE ====================
function backupData() {
  if(!hasRole('owner')) { alert('Hanya owner yang dapat backup.'); return; }
  const data = { menus, transactions, users, operationalHours, autoSchedule, autoPrint, ppnEnabled, autoDiscountMin, autoDiscountAmount, invoiceCounter };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dewepos_backup_${new Date().toISOString().slice(0,19)}.json`;
  a.click();
}
function restoreData(file) {
  if(!hasRole('owner')) { alert('Hanya owner yang dapat restore.'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if(data.menus) menus = data.menus;
      if(data.transactions) transactions = data.transactions;
      if(data.users) users = data.users;
      if(data.operationalHours) operationalHours = data.operationalHours;
      if(data.autoSchedule !== undefined) autoSchedule = data.autoSchedule;
      if(data.autoPrint !== undefined) autoPrint = data.autoPrint;
      if(data.ppnEnabled !== undefined) ppnEnabled = data.ppnEnabled;
      if(data.autoDiscountMin !== undefined) autoDiscountMin = data.autoDiscountMin;
      if(data.autoDiscountAmount !== undefined) autoDiscountAmount = data.autoDiscountAmount;
      if(data.invoiceCounter) invoiceCounter = data.invoiceCounter;
      saveMenus(); saveTransactions(); saveUsers(); saveSettings();
      location.reload();
    } catch(err) { alert('File tidak valid'); }
  };
  reader.readAsText(file);
}

// ==================== MANAJEMEN USER ====================
function addUser() {
  if (!hasRole(['admin','owner'])) { alert('Hanya admin/owner yang dapat menambah user.'); return; }
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;
  const role = document.getElementById('newRole').value;
  if (!username || !password) { alert('Isi username dan password!'); return; }
  if (password.length < 4) { alert('Password minimal 4 karakter!'); return; }
  if (password !== confirm) { alert('Password dan konfirmasi tidak cocok!'); return; }
  if (users.find(u => u.username === username)) { alert('Username sudah ada!'); return; }
  users.push({ username, password, role });
  saveUsers();
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
  document.getElementById('newRole').value = 'kasir';
  currentUserPage = 1;
  const searchInput = document.getElementById('searchUserInput'); if(searchInput) searchInput.value = '';
  displayUserList();
}
function deleteUser(username) {
  if(!hasRole(['admin','owner'])) { alert('Hanya admin/owner yang dapat menghapus user.'); return; }
  if(username === currentUserObj.username) { alert('Tidak bisa menghapus diri sendiri'); return; }
  users = users.filter(u => u.username !== username);
  saveUsers();
  displayUserList();
}
function editUser(username, currentRole) {
  const editUsername = document.getElementById('editUsername'); if(editUsername) editUsername.value = username;
  const editPassword = document.getElementById('editPassword'); if(editPassword) editPassword.value = '';
  const editRole = document.getElementById('editRole'); if(editRole) editRole.value = currentRole;
  const modal = document.getElementById('editUserModal'); if(modal) modal.style.display = 'block';
}
function saveEditUser() {
  const username = document.getElementById('editUsername')?.value;
  const newPassword = document.getElementById('editPassword')?.value;
  const newRole = document.getElementById('editRole')?.value;
  const user = users.find(u => u.username === username);
  if(user) {
    if(newPassword) user.password = newPassword;
    user.role = newRole;
    saveUsers();
    displayUserList();
    alert('User berhasil diupdate');
  }
  const modal = document.getElementById('editUserModal'); if(modal) modal.style.display = 'none';
}
function displayUserList(searchTerm = '') {
  let filteredUsers = [...users];
  if (searchTerm) {
    filteredUsers = filteredUsers.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  if (currentUserPage > totalPages) currentUserPage = totalPages || 1;
  const start = (currentUserPage - 1) * usersPerPage;
  const paginatedUsers = filteredUsers.slice(start, start + usersPerPage);
  const container = document.getElementById('userList');
  if (container) {
    container.innerHTML = paginatedUsers.map(u => `
      <div style="padding:8px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
        <span>${u.username} - ${u.role}</span>
        <div>
          <button class="edit-user-btn" onclick="editUser('${u.username}','${u.role}')">Edit</button>
          <button onclick="deleteUser('${u.username}')" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:4px 12px; cursor:pointer;">Hapus</button>
        </div>
      </div>
    `).join('');
    if (container.innerHTML === '') container.innerHTML = '<p>Tidak ada user ditemukan.</p>';
  }
  const paginationDiv = document.getElementById('userPagination');
  if (paginationDiv && totalPages > 1) {
    let paginationHtml = '';
    for (let i = 1; i <= totalPages; i++) {
      paginationHtml += `<button class="${i === currentUserPage ? 'active' : ''}" onclick="goToUserPage(${i})">${i}</button>`;
    }
    paginationDiv.innerHTML = paginationHtml;
  } else if (paginationDiv) {
    paginationDiv.innerHTML = '';
  }
}
function goToUserPage(page) {
  currentUserPage = page;
  const searchTerm = document.getElementById('searchUserInput')?.value || '';
  displayUserList(searchTerm);
}
function exportUserToExcel() {
  if (!hasRole(['admin','owner'])) { alert('Hanya admin/owner yang dapat export.'); return; }
  const wsData = [['Username', 'Role']];
  users.forEach(u => { wsData.push([u.username, u.role]); });
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar User');
  XLSX.writeFile(wb, `Daftar_User_${new Date().toISOString().slice(0,19)}.xlsx`);
  alert('Export berhasil!');
}

// ==================== ADMIN MENU DISPLAY ====================
function displayAdminMenus() {
  if(!hasRole(['admin','owner'])) {
    const menuContainer = document.getElementById('menuItems');
    if(menuContainer) menuContainer.innerHTML = '<p>Akses ditolak</p>';
    return;
  }
  const container = document.getElementById('menuItems');
  if(container) container.innerHTML = menus.map(m => `<div class="menu-item" style="margin-bottom:10px;"><h4>${m.nama} (${m.variant})</h4><p>${m.kategori} - ${m.subMenu}</p><p>Harga: Rp ${m.harga.toLocaleString()} | Stok: ${m.stok} | Modal: Rp ${m.modal?.toLocaleString()}</p><button class="edit-btn" onclick='showEditMenu(${JSON.stringify(m).replace(/'/g, "&#39;")})'>Edit</button><button class="del-btn" onclick="deleteMenu(${m.id})">Hapus</button></div>`).join('');
}

// ==================== SHOW PAGE ====================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const el = document.getElementById(page + 'Page');
  if(el) el.style.display = 'block';
  const sidebar = document.getElementById('sidebar');
  if(sidebar) sidebar.classList.remove('active');
  document.querySelectorAll('#sidebar ul li, .shortcut-item').forEach(el => el.classList.remove('active'));
  const activeSidebar = document.querySelector(`#sidebar ul li[data-page="${page}"]`);
  if(activeSidebar) activeSidebar.classList.add('active');
  const activeShortcut = document.querySelector(`.shortcut-item[data-page="${page}"]`);
  if(activeShortcut) activeShortcut.classList.add('active');
  if(page === 'beranda') updateBerandaStats();
  if(page === 'transaksi') { displayCategories(); updateCart(); updateLastSales(); document.getElementById('submenuList').style.display = 'none'; document.getElementById('menuListTransaksi').style.display = 'none'; document.getElementById('searchMenuInput').value = ''; }
  if(page === 'pengaturan') { displayAdminMenus(); document.getElementById('jamBuka').value = operationalHours.open; document.getElementById('jamTutup').value = operationalHours.close; document.getElementById('autoScheduleCheckbox').checked = autoSchedule; document.getElementById('autoPrintCheckbox').checked = autoPrint; document.getElementById('autoDiscountMin').value = autoDiscountMin; document.getElementById('autoDiscountAmount').value = autoDiscountAmount; updateScheduleInfo(); }
  if(page === 'riwayat') displayRiwayat();
  if(page === 'rekap') displayRekapDetail();
  if(page === 'pendapatan') updatePendapatanSummary();
  if(page === 'manajemenUser') displayUserList();
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if(splash) splash.style.display = 'none';
  }, 2000);

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Sidebar overlay
  if (!document.querySelector('.sidebar-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });
  }

  // ==================== MANAJEMEN PLATFORM AKTIF ====================
let activePlatforms = [];

// Daftar semua platform yang tersedia secara sistem
const allAvailablePlatforms = ['Grabfood', 'Gofood', 'Shopeefood', 'TikTok', 'Dinein'];

function loadActivePlatforms() {
  const saved = localStorage.getItem('dewepos_activePlatforms');
  if (saved) {
    activePlatforms = JSON.parse(saved);
  } else {
    // Default: semua platform aktif
    activePlatforms = [...allAvailablePlatforms];
  }
  // Pastikan tidak ada platform usang (filter hanya yang ada di allAvailablePlatforms)
  activePlatforms = activePlatforms.filter(p => allAvailablePlatforms.includes(p));
  if (activePlatforms.length === 0) activePlatforms = [...allAvailablePlatforms]; // fallback
}

function saveActivePlatforms() {
  localStorage.setItem('dewepos_activePlatforms', JSON.stringify(activePlatforms));
  // Update tampilan tombol platform di halaman transaksi jika sedang aktif
  const transaksiPage = document.getElementById('transaksiPage');
  if (transaksiPage && transaksiPage.style.display !== 'none') {
    renderPlatformButtons();
  }
  // Update checklist di halaman pengaturan
  renderPlatformChecklist();
  // Update ringkasan platform di halaman pendapatan
  if (typeof updatePendapatanSummary === 'function') updatePendapatanSummary();
  showPlatformStatusMessage('Pengaturan platform disimpan!');
}

function renderPlatformChecklist() {
  const container = document.getElementById('platformChecklist');
  if (!container) return;
  container.innerHTML = '';
  allAvailablePlatforms.forEach(platform => {
    const isChecked = activePlatforms.includes(platform);
    const div = document.createElement('div');
    div.className = 'platform-checkbox-item';
    div.innerHTML = `
      <input type="checkbox" id="chk_${platform}" value="${platform}" ${isChecked ? 'checked' : ''}>
      <label for="chk_${platform}">${platform}</label>
    `;
    container.appendChild(div);
  });
}

function renderPlatformButtons() {
  // Cari container tombol platform di halaman transaksi
  // Asumsi: di HTML ada elemen dengan id "platformButtonsContainer" atau class ".platform-buttons"
  let container = document.getElementById('platformButtonsContainer');
  if (!container) {
    // Jika tidak ada, coba cari berdasarkan class (fallback)
    container = document.querySelector('.platform-buttons');
  }
  if (!container) {
    // Jika masih tidak ada, buat container baru di dalam .platform-selector atau area yang sesuai
    const parent = document.querySelector('.platform-selector');
    if (parent) {
      container = document.createElement('div');
      container.id = 'platformButtonsContainer';
      container.className = 'platform-buttons';
      parent.insertBefore(container, parent.firstChild);
    } else {
      console.warn('Tidak dapat menemukan wadah tombol platform');
      return;
    }
  }
  container.innerHTML = '';
  if (activePlatforms.length === 0) {
    container.innerHTML = '<p style="color:red;">Tidak ada platform aktif. Silakan aktifkan di Pengaturan.</p>';
    return;
  }
  activePlatforms.forEach(platform => {
    const btn = document.createElement('button');
    btn.className = 'platform-btn';
    if (selectedPlatform === platform) btn.classList.add('active');
    btn.setAttribute('data-platform', platform);
    btn.innerText = platform;
    btn.onclick = (function(p) {
      return function() {
        document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedPlatform = p;
        // Jika metode pembayaran perlu diatur ulang
        setupPaymentOptions();
        hitungTotal();
      };
    })(platform);
    container.appendChild(btn);
  });
  // Jika platform yang dipilih sebelumnya tidak aktif, pilih yang pertama
  if (!activePlatforms.includes(selectedPlatform) && activePlatforms.length > 0) {
    selectedPlatform = activePlatforms[0];
    const firstBtn = container.querySelector('.platform-btn');
    if (firstBtn) firstBtn.classList.add('active');
    setupPaymentOptions();
    hitungTotal();
  }
}

function showPlatformStatusMessage(msg) {
  const msgDiv = document.getElementById('platformStatusMsg');
  if (msgDiv) {
    msgDiv.innerText = msg;
    setTimeout(() => { msgDiv.innerText = ''; }, 2000);
  }
}

// Override fungsi updatePendapatanSummary untuk hanya menampilkan platform aktif (opsional)
// Simpan fungsi asli
const originalUpdatePendapatanSummary = updatePendapatanSummary;
window.updatePendapatanSummary = function() {
  // Panggil asli dulu untuk menghitung total
  originalUpdatePendapatanSummary();
  // Kemudian sembunyikan card platform yang tidak aktif di ringkasan
  setTimeout(() => {
    const summaryDiv = document.getElementById('pendapatanSummaryPlatforms');
    if (summaryDiv) {
      const cards = summaryDiv.querySelectorAll('.platform-summary-card');
      cards.forEach(card => {
        const platformName = card.getAttribute('data-platform');
        if (platformName && !activePlatforms.includes(platformName)) {
          card.style.display = 'none';
        } else if (platformName) {
          card.style.display = 'flex';
        }
      });
    }
  }, 50);
};

// Inisialisasi dan integrasi dengan halaman yang sudah ada
function initPlatformManagement() {
  loadActivePlatforms();
  renderPlatformChecklist();
  // Pasang event listener untuk tombol simpan
  const saveBtn = document.getElementById('saveActivePlatformsBtn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const checkboxes = document.querySelectorAll('#platformChecklist input[type="checkbox"]');
      activePlatforms = [];
      checkboxes.forEach(cb => {
        if (cb.checked) activePlatforms.push(cb.value);
      });
      if (activePlatforms.length === 0) {
        alert('Minimal satu platform harus aktif!');
        return;
      }
      saveActivePlatforms();
    };
  }
  // Override fungsi showPage untuk memastikan tombol platform di-render saat halaman transaksi ditampilkan
  const originalShowPage = window.showPage;
  window.showPage = function(page) {
    originalShowPage(page);
    if (page === 'transaksi') {
      renderPlatformButtons();
    }
    if (page === 'pendapatan') {
      // refresh ringkasan platform untuk menyembunyikan yang tidak aktif
      if (typeof updatePendapatanSummary === 'function') updatePendapatanSummary();
    }
  };
  // Jika halaman transaksi sudah aktif saat inisialisasi, render tombol
  if (document.getElementById('transaksiPage') && document.getElementById('transaksiPage').style.display !== 'none') {
    renderPlatformButtons();
  }
  // Juga panggil saat pendapatan pertama kali
  if (typeof updatePendapatanSummary === 'function') updatePendapatanSummary();
}

// Jalankan init setelah DOMContentLoaded, tapi pastikan tidak bentrok dengan yang sudah ada
document.addEventListener('DOMContentLoaded', function() {
  initPlatformManagement();
});

  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');
  const overlay = document.querySelector('.sidebar-overlay');

  if (menuBtn && sidebar && overlay) {
    const newMenuBtn = menuBtn.cloneNode(true);
    menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
    newMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('active');
      if (sidebar.classList.contains('active')) {
        overlay.classList.add('active');
      } else {
        overlay.classList.remove('active');
      }
    });
  }

  // Event listeners
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.onclick = () => {
      const user = document.getElementById('loginUsername').value;
      const pass = document.getElementById('loginPassword').value;
      if (login(user, pass)) {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        updateStoreToggleButton();
        showPage('beranda');
      } else {
        alert('Login gagal');
      }
    };
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = () => { if (confirm('Logout?')) location.reload(); };

  const toggleBtn = document.getElementById('toggleStoreBtn');
  if (toggleBtn) toggleBtn.onclick = toggleStoreStatus;

  const logoTitle = document.getElementById('logoTitle');
  if (logoTitle) logoTitle.onclick = () => showPage('transaksi');

  const tambahBtn = document.getElementById('tambahMenuBtn');
  if (tambahBtn) tambahBtn.onclick = tambahMenu;

  const simpanJadwal = document.getElementById('simpanJadwalBtn');
  if (simpanJadwal) {
    simpanJadwal.onclick = () => {
      operationalHours.open = document.getElementById('jamBuka').value;
      operationalHours.close = document.getElementById('jamTutup').value;
      localStorage.setItem('dewepos_hours', JSON.stringify(operationalHours));
      alert('Jadwal disimpan');
    };
  }

  const autoScheduleCb = document.getElementById('autoScheduleCheckbox');
  if (autoScheduleCb) autoScheduleCb.onchange = (e) => { autoSchedule = e.target.checked; saveSettings(); updateScheduleInfo(); };
  const autoPrintCb = document.getElementById('autoPrintCheckbox');
  if (autoPrintCb) autoPrintCb.onchange = (e) => { autoPrint = e.target.checked; saveSettings(); };
  const ppnCb = document.getElementById('ppnEnabled');
  if (ppnCb) ppnCb.onchange = (e) => { ppnEnabled = e.target.checked; saveSettings(); hitungTotal(); };
  const autoMinInput = document.getElementById('autoDiscountMin');
  if (autoMinInput) autoMinInput.onchange = (e) => { autoDiscountMin = parseInt(e.target.value) || 0; saveSettings(); hitungTotal(); };
  const autoAmountInput = document.getElementById('autoDiscountAmount');
  if (autoAmountInput) autoAmountInput.onchange = (e) => { autoDiscountAmount = parseInt(e.target.value) || 0; saveSettings(); hitungTotal(); };

  const previewBtn = document.getElementById('previewBayarBtn');
  if (previewBtn) previewBtn.onclick = showPreview;
  const backCartBtn = document.getElementById('backToCartBtn');
  if (backCartBtn) backCartBtn.onclick = closePreview;
  const confirmBtn = document.getElementById('confirmBayarBtn');
  if (confirmBtn) confirmBtn.onclick = processPayment;
  const saveEditBtn = document.getElementById('saveEditMenuBtn');
  if (saveEditBtn) saveEditBtn.onclick = saveEditMenu;
  const undoBtn = document.getElementById('undoCartBtn');
  if (undoBtn) undoBtn.onclick = undoCart;

  const searchInput = document.getElementById('searchMenuInput');
  if (searchInput) searchInput.addEventListener('input', searchMenu);

  const exportExcelBtn = document.getElementById('exportRekapBtn');
  if (exportExcelBtn) exportExcelBtn.onclick = exportToExcel;
  const exportPDFBtn = document.getElementById('exportRekapPDFBtn');
  if (exportPDFBtn) exportPDFBtn.onclick = exportToPDF;

  document.querySelectorAll('.close, .close-preview, .close-edit, .close-edit-user').forEach(btn => {
    btn.onclick = function() { this.closest('.modal').style.display = 'none'; };
  });

  const backupBtn = document.getElementById('backupDataBtn');
  if (backupBtn) backupBtn.onclick = backupData;
  const restoreBtn = document.getElementById('restoreDataBtn');
  if (restoreBtn) restoreBtn.onclick = () => document.getElementById('restoreFileInput').click();
  const restoreFile = document.getElementById('restoreFileInput');
  if (restoreFile) restoreFile.onchange = (e) => { if (e.target.files[0]) restoreData(e.target.files[0]); };

  const addUserBtn = document.getElementById('addUserBtn');
  if (addUserBtn) addUserBtn.onclick = addUser;
  const saveEditUserBtn = document.getElementById('saveEditUserBtn');
  if (saveEditUserBtn) saveEditUserBtn.onclick = saveEditUser;

  const searchRiwayatBtn = document.getElementById('searchRiwayatBtn');
  if (searchRiwayatBtn) searchRiwayatBtn.onclick = () => displayRiwayat(document.getElementById('riwayatSearch').value);
  const resetRiwayatBtn = document.getElementById('resetRiwayatBtn');
  if (resetRiwayatBtn) resetRiwayatBtn.onclick = () => { const rs = document.getElementById('riwayatSearch'); if(rs) rs.value = ''; displayRiwayat(); };

  const applyPendapatan = document.getElementById('applyPendapatanFilter');
  if (applyPendapatan) {
    applyPendapatan.onclick = () => {
      const period = document.getElementById('pendapatanPeriod').value;
      if (period === 'custom') {
        pendapatanStartDate = document.getElementById('pendapatanStartDate').value;
        pendapatanEndDate = document.getElementById('pendapatanEndDate').value;
        if (!pendapatanStartDate || !pendapatanEndDate) { alert('Pilih tanggal'); return; }
        pendapatanDateFilter = 'custom';
      } else {
        pendapatanStartDate = null;
        pendapatanEndDate = null;
        pendapatanDateFilter = period;
      }
      updatePendapatanSummary();
    };
  }

  const resetPendapatan = document.getElementById('resetPendapatanFilter');
  if (resetPendapatan) {
    resetPendapatan.onclick = () => {
      pendapatanDateFilter = 'today';
      pendapatanStartDate = null;
      pendapatanEndDate = null;
      const periodSelect = document.getElementById('pendapatanPeriod');
      if (periodSelect) periodSelect.value = 'today';
      updatePendapatanSummary();
    };
  }

  // Tampilkan info toko read-only (tanpa form edit)
  const storeNameDisplay = document.getElementById('storeNameDisplay');
  const storeAddressDisplay = document.getElementById('storeAddressDisplay');
  const storePhoneDisplay = document.getElementById('storePhoneDisplay');
  if (storeNameDisplay) storeNameDisplay.innerText = storeInfo.name || 'DewePOS Basic';
  if (storeAddressDisplay) storeAddressDisplay.innerText = storeInfo.address || '-';
  if (storePhoneDisplay) storePhoneDisplay.innerText = storeInfo.phone || '-';

  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedPlatform = this.dataset.platform;
    };
  });

  const filterKasirRekap = document.getElementById('filterKasirRekap');
  if (filterKasirRekap) filterKasirRekap.addEventListener('change', () => displayRekapDetail());
  const filterKasirPendapatan = document.getElementById('filterKasirPendapatan');
  if (filterKasirPendapatan) filterKasirPendapatan.addEventListener('change', () => updatePendapatanSummary());
  const filterKasirRiwayat = document.getElementById('filterKasirRiwayat');
  if (filterKasirRiwayat) filterKasirRiwayat.addEventListener('change', () => displayRiwayat(document.getElementById('riwayatSearch')?.value));

  const defaultGrabfood = document.querySelector('.platform-btn[data-platform="Grabfood"]');
  if (defaultGrabfood) defaultGrabfood.classList.add('active');
  else {
    const defaultDinein = document.querySelector('.platform-btn[data-platform="Dinein"]');
    if (defaultDinein) defaultDinein.classList.add('active');
  }

  const kategoriContainer = document.getElementById('kategoriList');
  if (kategoriContainer) {
    kategoriContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('kategori-btn')) {
        const searchMenuInput = document.getElementById('searchMenuInput');
        if (searchMenuInput) { searchMenuInput.value = ''; lastSearchTerm = ''; isSearchActive = false; }
      }
    });
  }

  const closeStrukBtn = document.getElementById('closeStrukBtn');
if (closeStrukBtn) {
  closeStrukBtn.addEventListener('click', () => {
    const strukModal = document.getElementById('strukModal');
    if (strukModal) strukModal.style.display = 'none';
  });
}

  const searchUserInput = document.getElementById('searchUserInput');
  if (searchUserInput) searchUserInput.addEventListener('input', (e) => { currentUserPage = 1; displayUserList(e.target.value); });
  const exportUserBtn = document.getElementById('exportUserExcelBtn');
  if (exportUserBtn) exportUserBtn.onclick = exportUserToExcel;

  document.querySelectorAll('#sidebar ul li, .shortcut-item').forEach(el => {
    el.onclick = (e) => {
      let page = el.dataset.page;
      if (!page && el.getAttribute('data-page')) page = el.getAttribute('data-page');
      if (page) showPage(page);
      else if (el.innerText.includes('Beranda')) showPage('beranda');
      else if (el.innerText.includes('Transaksi')) showPage('transaksi');
      else if (el.innerText.includes('Rekap')) showPage('rekap');
      else if (el.innerText.includes('Pendapatan')) showPage('pendapatan');
      else if (el.innerText.includes('Riwayat')) showPage('riwayat');
      else if (el.innerText.includes('Print')) showPage('print');
      else if (el.innerText.includes('Pengaturan')) showPage('pengaturan');
      else if (el.innerText.includes('Manajemen User')) showPage('manajemenUser');
      else if (el.innerText.includes('Backup')) showPage('backup');
    };
  });

  document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuBtn');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== menuBtn && !menuBtn.contains(e.target)) {
      sidebar.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
    }
  });

  displayUserList();
  showPage('beranda');
});

// Global functions
window.removeFromCart = removeFromCart;
window.deleteMenu = deleteMenu;
window.showEditMenu = showEditMenu;
window.filterRekap = filterRekap;
window.filterRekapByPlatform = filterRekapByPlatform;
window.filterPendapatanByPlatform = filterPendapatanByPlatform;
window.voidTransaction = voidTransaction;
window.printLaporan = printLaporan;
window.showPrintDateFilter = showPrintDateFilter;
window.closePrintDateModal = closePrintDateModal;
window.printWithDateRange = printWithDateRange;
window.toggleVoucherPanel = toggleVoucherPanel;
window.showPage = showPage;
window.editUser = editUser;