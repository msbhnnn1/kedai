let appState = {};
let activeCart = [];
let appliedDiscount = 0;
let activeVoucherCode = "";

// ================= DAFTAR AKUN / LOGIN CREDENTIALS =================
const USER_ACCOUNTS = {
    "owner": { password: "123", role: "owner" },
    "kasir": { password: "456", role: "kasir" },
    "dapur": { password: "789", role: "dapur" }
};

// ================= LOGIKA LOGIN & LOGOUT =================
function handleLogin() {
    let userInp = document.getElementById('login-username').value.trim().toLowerCase();
    let passInp = document.getElementById('login-password').value;
    let errorEl = document.getElementById('login-error');

    if (USER_ACCOUNTS[userInp] && USER_ACCOUNTS[userInp].password === passInp) {
        let role = USER_ACCOUNTS[userInp].role;
        sessionStorage.setItem('current_role', role);
        errorEl.innerText = "";
        document.getElementById('login-username').value = "";
        document.getElementById('login-password').value = "";
        applyRoleView(role);
    } else {
        errorEl.innerText = "Username atau Password salah!";
    }
}

function handleLogout() {
    sessionStorage.removeItem('current_role');
    document.getElementById('main-header').style.display = "none";
    document.getElementById('main-content').style.display = "none";
    document.getElementById('login-section').classList.add('active');
}

function applyRoleView(role) {
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('main-header').style.display = "flex";
    document.getElementById('main-content').style.display = "block";
    document.getElementById('user-role-display').innerText = role.toUpperCase();

    document.querySelectorAll('.dashboard-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${role}-section`).classList.add('active');
    
    loadStateFromStorage();
}

function checkCurrentSession() {
    let savedRole = sessionStorage.getItem('current_role');
    if (savedRole) { applyRoleView(savedRole); } else { handleLogout(); }
}


// ================= DATABASE LOKAL (STORAGE) =================
function loadStateFromStorage() {
    let data = localStorage.getItem('web_pos_data');
    if (!data) {
        appState = {
            "menu": [], // SEKARANG KOSONG SECARA DEFAULT, HARUS DIINPUT OWNER
            "orders": [],
            "expenses": [],
            "vouchers": [{"code": "PROMOAWAL", "discount": 5000}],
            "restockRequests": []
        };
        saveStateToStorage();
    } else {
        appState = JSON.parse(data);
    }
    renderAll();
}

function saveStateToStorage() {
    localStorage.setItem('web_pos_data', JSON.stringify(appState));
    renderAll();
}

function formatRp(number) {
    return "Rp " + Number(number).toLocaleString('id-ID');
}

function renderAll() {
    let currentRole = sessionStorage.getItem('current_role');
    if (!currentRole) return;

    if (currentRole === 'owner') renderOwnerDashboard();
    if (currentRole === 'kasir') renderKasirDashboard();
    if (currentRole === 'dapur') renderDapurDashboard();
}

// ================= LOGIKA OWNER =================
function renderOwnerDashboard() {
    let totalRevenue = appState.orders.reduce((sum, o) => sum + o.total, 0);
    let totalExpenses = appState.expenses.reduce((sum, e) => sum + e.amount, 0);
    let approvedRestockCost = appState.restockRequests.filter(r => r.status === 'Approved').reduce((sum, r) => sum + Number(r.cost), 0);
    let grandExpenses = totalExpenses + approvedRestockCost;
    let netProfit = totalRevenue - grandExpenses;
    let portfolioValue = appState.menu.reduce((sum, item) => sum + (item.price * item.stock), 0);

    document.getElementById('owner-revenue').innerText = formatRp(totalRevenue);
    document.getElementById('owner-expenses').innerText = formatRp(grandExpenses);
    document.getElementById('owner-profit').innerText = formatRp(netProfit);
    document.getElementById('owner-portfolio').innerText = formatRp(portfolioValue);

    // Render tabel Manajemen Menu Utama milik Owner
    let menuTableHTML = "";
    appState.menu.forEach(item => {
        menuTableHTML += `
            <tr>
                <td><b>${item.name}</b></td>
                <td>${formatRp(item.price)}</td>
                <td>${item.stock} porsi</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteMenuByOwner(${item.id})">Hapus</button></td>
            </tr>`;
    });
    document.getElementById('owner-menu-table').innerHTML = menuTableHTML || "<tr><td colspan='4' style='text-align:center; color:#aaa;'>Menu kosong. Silakan input menu utama di atas.</td></tr>";

    let approvalHTML = "";
    appState.restockRequests.forEach((req) => {
        approvalHTML += `<tr><td><b>${req.item}</b></td><td>${req.qty}</td><td>${formatRp(req.cost)}</td><td><span class="badge badge-${req.status.toLowerCase()}">${req.status}</span></td><td>${req.status === 'Pending' ? `<button class="btn btn-sm btn-success" onclick="handleApproval(${req.id}, 'Approved')">Setuju</button> <button class="btn btn-sm btn-danger" onclick="handleApproval(${req.id}, 'Rejected')">Tolak</button>` : '-'}</td></tr>`;
    });
    document.getElementById('owner-approval-table').innerHTML = approvalHTML || "<tr><td colspan='5' style='text-align:center;'>Tidak ada pengajuan.</td></tr>";

    // Ditambahkan tombol cetak struk di riwayat transaksi Owner
    let salesHTML = "";
    appState.orders.forEach(order => {
        salesHTML += `
            <tr>
                <td><small>${order.id}<br>${order.time}</small></td>
                <td>${order.items.map(i=>`${i.name}(x${i.qty})`).join(', ')}</td>
                <td>${order.voucher || '-'}</td>
                <td><b>${formatRp(order.total)}</b></td>
                <td><button class="btn btn-sm btn-accent" onclick="reprintReceipt('${order.id}')">🖨️ Cetak Struk</button></td>
            </tr>`;
    });
    document.getElementById('owner-sales-table').innerHTML = salesHTML || "<tr><td colspan='5' style='text-align:center;'>Belum ada penjualan.</td></tr>";

    let vouchHTML = "<b>Voucher Aktif:</b><br>";
    appState.vouchers.forEach(v => { vouchHTML += `<span class="badge badge-approved" style="margin:2px;">${v.code} (${formatRp(v.discount)})</span>`; });
    document.getElementById('active-vouchers-list').innerHTML = vouchHTML;
}

function addMenuByOwner() {
    let name = document.getElementById('owner-menu-name').value.trim();
    let price = Number(document.getElementById('owner-menu-price').value);
    let stock = Number(document.getElementById('owner-menu-stock').value);

    if (name && price > 0 && stock >= 0) {
        let newMenu = { id: Date.now(), name: name, price: price, stock: stock };
        appState.menu.push(newMenu);
        
        document.getElementById('owner-menu-name').value = "";
        document.getElementById('owner-menu-price').value = "";
        document.getElementById('owner-menu-stock').value = "";
        saveStateToStorage();
    } else { alert("Mohon lengkapi data menu dengan benar!"); }
}

function deleteMenuByOwner(id) {
    if(confirm("Apakah Anda yakin ingin menghapus menu ini dari daftar utama?")) {
        appState.menu = appState.menu.filter(m => m.id !== id);
        saveStateToStorage();
    }
}

function handleApproval(id, status) {
    let req = appState.restockRequests.find(r => r.id === id);
    if(req) {
        req.status = status;
        if(status === 'Approved') {
            let match = appState.menu.find(m => m.name.toLowerCase() === req.item.toLowerCase());
            if(match) match.stock += (parseInt(req.qty) || 10);
        }
        saveStateToStorage();
    }
}

function addVoucher() {
    let code = document.getElementById('vouch-code').value.trim().toUpperCase();
    let discount = Number(document.getElementById('vouch-discount').value);
    if(code && discount > 0) { appState.vouchers.push({ code, discount }); saveStateToStorage(); }
}

function addExpense() {
    let note = document.getElementById('exp-note').value.trim();
    let amount = Number(document.getElementById('exp-amount').value);
    if(note && amount > 0) { appState.expenses.push({ id: Date.now(), note, amount }); saveStateToStorage(); }
}


// ================= LOGIKA KASIR =================
function renderKasirDashboard() {
    let menuHTML = "";
    appState.menu.forEach(item => {
        menuHTML += `<div class="pos-item-card" onclick="addItemToCart(${item.id})"><div class="pos-item-name">${item.name}</div><div class="pos-item-price">${formatRp(item.price)}</div><div class="pos-item-stock">Stok: ${item.stock}</div></div>`;
    });
    // Menampilkan pesan jika Owner belum mengisi menu utama
    document.getElementById('pos-menu-grid').innerHTML = menuHTML || "<p style='color:#7f8c8d; padding:20px; text-align:center; grid-column: 1/-1;'>⚠️ Menu utama belum diinput oleh Owner. Silakan hubungi Owner.</p>";

    let cartHTML = ""; let subtotal = 0;
    activeCart.forEach((item, index) => {
        subtotal += (item.price * item.qty);
        cartHTML += `<div class="cart-item"><div><b>${item.name}</b><br>${formatRp(item.price)} x ${item.qty}</div><div class="btn-group-sm"><b>${formatRp(item.price*item.qty)}</b><button class="btn btn-sm btn-danger" onclick="changeQty(${index},-1)">-</button><button class="btn btn-sm btn-success" onclick="changeQty(${index},1)">+</button></div></div>`;
    });
    document.getElementById('cart-container').innerHTML = cartHTML || "<p style='color:#aaa; text-align:center;'>Keranjang kosong.</p>";
    document.getElementById('bill-subtotal').innerText = formatRp(subtotal);
    document.getElementById('bill-total').innerText = formatRp(Math.max(0, subtotal - appliedDiscount));
    document.getElementById('bill-discount').innerText = "- " + formatRp(appliedDiscount);

    let verifyHTML = "";
    appState.restockRequests.forEach(req => {
        verifyHTML += `<tr><td>${req.item}</td><td>${req.qty}</td><td><span class="badge badge-${req.status.toLowerCase()}">${req.status === 'Approved' ? '✅ Terverifikasi' : req.status}</span></td></tr>`;
    });
    document.getElementById('kasir-verification-table').innerHTML = verifyHTML;
}

function addItemToCart(id) {
    let menu = appState.menu.find(m => m.id === id);
    if(menu && menu.stock > 0) {
        let exist = activeCart.find(c => c.menuId === id);
        if(exist) { if(exist.qty < menu.stock) exist.qty++; } else { activeCart.push({ menuId: id, name: menu.name, price: menu.price, qty: 1 }); }
        renderKasirDashboard();
    } else { alert("Stok habis!"); }
}

function addManualItemToCart() {
    let name = document.getElementById('manual-name').value.trim();
    let price = Number(document.getElementById('manual-price').value);
    if(name && price > 0) { activeCart.push({ menuId: null, name: name + " (Manual)", price: price, qty: 1 }); renderKasirDashboard(); }
}

function changeQty(index, delta) {
    activeCart[index].qty += delta;
    if(activeCart[index].qty <= 0) activeCart.splice(index, 1);
    renderKasirDashboard();
}

function applyVoucher() {
    let code = document.getElementById('cart-voucher').value.trim().toUpperCase();
    let v = appState.vouchers.find(v => v.code === code);
    if(v) { appliedDiscount = v.discount; activeVoucherCode = v.code; } else { alert("Voucher salah!"); appliedDiscount = 0; }
    renderKasirDashboard();
}

function checkoutOrder() {
    if(activeCart.length === 0) return;
    let subtotal = activeCart.reduce((sum, i) => sum + (i.price*i.qty), 0);
    let orderId = "INV-" + Date.now().toString().slice(-6);
    let timeString = new Date().toLocaleString('id-ID');

    activeCart.forEach(c => {
        if(c.menuId) { let m = appState.menu.find(menu=>menu.id===c.menuId); if(m) m.stock -= c.qty; }
    });

    let newOrder = { id: orderId, time: timeString, items: [...activeCart], total: Math.max(0, subtotal-appliedDiscount), voucher: activeVoucherCode, status: 'Memasak' };
    appState.orders.push(newOrder);

    activeCart = []; appliedDiscount = 0; activeVoucherCode = "";
    saveStateToStorage();
    
    // Langsung print struk di Kasir
    executePrintProcess(newOrder);
}


// ================= LOGIKA FUNGSI CETAK STRUK BERSAMA =================
function executePrintProcess(order) {
    let recHTML = `
        <div class="receipt-header">
            <h3>KEDAI KITA</h3>
            <p>Struk Belanja Resmi</p>
            <p style="font-size:10px;">${order.time}</p>
            <p style="font-size:10px;">ID: ${order.id}</p>
        </div>
        <div class="receipt-divider"></div>`;
        
    order.items.forEach(i => { 
        recHTML += `<div class="receipt-row"><span>${i.name} x${i.qty}</span><span>${formatRp(i.price*i.qty)}</span></div>`; 
    });
    
    recHTML += `<div class="receipt-divider"></div>`;
    recHTML += `<div class="receipt-row"><b>Total Akhir:</b><b>${formatRp(order.total)}</b></div>`;
    if(order.voucher) { recHTML += `<div class="receipt-row" style="font-size:10px;"><span>Promo: ${order.voucher}</span></div>`; }
    
    document.getElementById('receipt-print-zone').innerHTML = recHTML;
    window.print(); // Membuka jendela print sistem macOS
}

// Fungsi cetak ulang struk khusus yang bisa diakses dari Tabel Riwayat Owner
function reprintReceipt(orderId) {
    let order = appState.orders.find(o => o.id === orderId);
    if(order) { executePrintProcess(order); } else { alert("Data transaksi tidak ditemukan!"); }
}


// ================= LOGIKA DAPUR =================
function renderDapurDashboard() {
    let kitchenHTML = "";
    appState.orders.filter(o => o.status === 'Memasak').forEach(order => {
        kitchenHTML += `<div class="kitchen-order-card"><div class="kitchen-order-header"><span>ID: ${order.id}</span></div><ul>${order.items.map(i=>`<li>🍳 ${i.name} (x${i.qty})</li>`).join('')}</ul><br><button class="btn btn-sm btn-success" onclick="finishCooking('${order.id}')">Selesai Masak</button></div>`;
    });
    document.getElementById('kitchen-orders-container').innerHTML = kitchenHTML || "<p style='color:#aaa;'>Tidak ada antrean masakan.</p>";

    let statusHTML = "";
    appState.restockRequests.forEach(req => {
        statusHTML += `<tr><td>${req.item}</td><td>${req.qty}</td><td><span class="badge badge-${req.status.toLowerCase()}">${req.status}</span></td></tr>`;
    });
    document.getElementById('dapur-status-table').innerHTML = statusHTML;
}

function finishCooking(id) {
    let o = appState.orders.find(order => order.id === id);
    if(o) { o.status = 'Selesai'; saveStateToStorage(); }
}

function submitKitchenRequest() {
    let item = document.getElementById('kitchen-req-item').value.trim();
    let qty = document.getElementById('kitchen-req-qty').value.trim();
    let cost = Number(document.getElementById('kitchen-req-cost').value);
    if(item && qty && cost > 0) { appState.restockRequests.push({ id: Date.now(), item, qty, cost, status: 'Pending' }); saveStateToStorage(); }
}

window.addEventListener('storage', function(e) {
    if (e.key === 'web_pos_data') { loadStateFromStorage(); }
});

checkCurrentSession();