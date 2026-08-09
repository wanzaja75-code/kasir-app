// ============================================
// DATABASE PRODUK
// ============================================
const productDB = {
    "8991234567890": { name: "Indomie Goreng", price: 3500, category: "Makanan" },
    "8991234567892": { name: "Teh Pucuk 350ml", price: 4500, category: "Minuman" },
    "8991234567897": { name: "Chitato 68g", price: 8500, category: "Snack" },
    // Tambah category di semua produk
};

// ============================================
// STATE
// ============================================
let cart = [];
let scannerActive = false;
let scanTimeout = null;
let stream = null;
let history = JSON.parse(localStorage.getItem('kasirHistory') || '[]');

// ============================================
// DOM
// ============================================
const video = document.getElementById('video');
const cameraStatus = document.getElementById('cameraStatus');
const cameraOverlay = document.getElementById('cameraOverlay');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const btnScan = document.getElementById('btnScan');
const barcodeInput = document.getElementById('barcodeInput');
const cartList = document.getElementById('cartList');
const subtotalEl = document.getElementById('subtotal');
const discountInput = document.getElementById('discountInput');
const discountAmountEl = document.getElementById('discountAmount');
const grandTotalEl = document.getElementById('grandTotal');
const quickProducts = document.getElementById('quickProducts');
const fileInput = document.getElementById('fileInput');

// ============================================
// DATE TIME
// ============================================
function updateDateTime() {
    const now = new Date();
    document.getElementById('datetime').textContent =
        now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
        ' pukul ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
updateDateTime();
setInterval(updateDateTime, 30000);

// ============================================
// QUICK PRODUCTS
// ============================================
function renderQuickProducts() {
    const entries = Object.entries(productDB).slice(0, 8);
    quickProducts.innerHTML = entries.map(([code, p]) =>
        `<button onclick="quickAdd('${code}')">${p.name}</button>`
    ).join('');
}

function quickAdd(code) {
    barcodeInput.value = code;
    addItemByBarcode();
}
renderQuickProducts();

// ============================================
// SWITCH METHOD
// ============================================
function switchMethod(method) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchMethod('${method}')"]`).classList.add('active');

    document.querySelectorAll('.method-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`method${method.charAt(0).toUpperCase() + method.slice(1)}`).classList.add('active');

    if (method !== 'camera' && scannerActive) {
        stopCamera();
    }

    setStatus('📷 Mode: ' + (method === 'manual' ? 'Manual Input' : method === 'upload' ? 'Upload Foto' : 'Kamera Live'), '');
}

// ============================================
// UPLOAD SCAN
// ============================================
fileInput.addEventListener('change', function(e) {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            try {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    const barcode = code.data;
                    console.log('✅ Barcode detected from image:', barcode);
                    document.getElementById('barcodeInput').value = barcode;
                    showUploadResult(`✅ Barcode terdeteksi: ${barcode}`, 'success');
                    setTimeout(() => {
                        addItemByBarcode();
                    }, 500);
                } else {
                    showUploadResult('❌ Tidak ada barcode terdeteksi di gambar', 'error');
                }
            } catch (err) {
                showUploadResult('❌ Gagal membaca gambar: ' + err.message, 'error');
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    this.value = '';
});

function showUploadResult(msg, type = '') {
    const el = document.getElementById('uploadResult');
    el.textContent = msg;
    el.className = 'scan-result show';
    if (type) el.classList.add(type);
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ============================================
// CAMERA
// ============================================
function setStatus(msg, type = '') {
    cameraStatus.textContent = msg;
    cameraStatus.className = 'camera-status';
    if (type) cameraStatus.classList.add(type);
}

function showResult(msg, type = '') {
    const el = document.getElementById('uploadResult') || document.getElementById('scanResult');
    if (!el) return;
    el.textContent = msg;
    el.className = 'scan-result show';
    if (type) el.classList.add(type);
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function toggleCamera() {
    if (scannerActive) {
        stopCamera();
    } else {
        startCamera();
    }
}

async function startCamera() {
    try {
        setStatus('📷 Mengakses kamera...', '');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('❌ Browser tidak support kamera', 'error');
            return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        video.classList.add('active');
        cameraPlaceholder.classList.add('hidden');
        cameraOverlay.classList.add('active');

        scannerActive = true;
        btnScan.textContent = '⏹️ Berhenti';
        btnScan.classList.add('active');
        setStatus('📷 Kamera aktif - Arahkan ke barcode', 'active');

        scanLoop();

        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            if (scannerActive) {
                setStatus('⏱️ Waktu habis, scan ulang', '');
                stopCamera();
            }
        }, 15000);

    } catch (err) {
        console.error('Camera error:', err);
        let msg = 'Gagal akses kamera: ';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg += 'Izin kamera ditolak. Izinkan di browser.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg += 'Tidak ada kamera ditemukan.';
        } else {
            msg += err.message || 'Unknown error';
        }
        setStatus('❌ ' + msg, 'error');
        stopCamera();
    }
}

function stopCamera() {
    scannerActive = false;

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    video.srcObject = null;
    video.classList.remove('active');
    cameraOverlay.classList.remove('active');
    cameraPlaceholder.classList.remove('hidden');

    btnScan.textContent = '📷 Mulai Kamera';
    btnScan.classList.remove('active');

    if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
    }

    setStatus('📷 Kamera dimatikan', '');
}

function scanLoop() {
    if (!scannerActive) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
            const barcode = code.data.trim();
            console.log('✅ Barcode detected:', barcode);

            document.getElementById('barcodeInput').value = barcode;

            const product = productDB[barcode];
            if (product) {
                setStatus(`✅ ${product.name} - Rp ${product.price.toLocaleString()}`, 'success');
                if (navigator.vibrate) navigator.vibrate(100);
            } else {
                setStatus(`⚠️ Kode "${barcode}" tidak ditemukan`, 'error');
            }

            stopCamera();
            addItemByBarcode();
            return;
        }
    } catch (e) {}

    requestAnimationFrame(scanLoop);
}

// ============================================
// TAMBAH PRODUK BARU
// ============================================
function addNewProduct() {
    const code = document.getElementById('newBarcode').value.trim();
    const name = document.getElementById('newName').value.trim();
    const price = parseInt(document.getElementById('newPrice').value);

    if (!code || !name || isNaN(price) || price <= 0) {
        showResult('⚠️ Isi semua data dengan benar!', 'error');
        return;
    }

    if (productDB[code]) {
        showResult(`⚠️ Kode "${code}" sudah ada!`, 'error');
        return;
    }

    productDB[code] = { name, price };
    showResult(`✅ "${name}" berhasil ditambahkan!`, 'success');

    document.getElementById('newBarcode').value = '';
    document.getElementById('newName').value = '';
    document.getElementById('newPrice').value = '';

    renderQuickProducts();
    saveData();

    console.log('📦 Produk baru:', code, name, price);
}

// ============================================
// CART OPERATIONS
// ============================================
function addItemByBarcode() {
    const code = barcodeInput.value.trim();
    if (!code) {
        showResult('⚠️ Masukkan kode barcode', 'error');
        return;
    }

    const product = productDB[code];
    if (!product) {
        showResult(`❌ Kode "${code}" tidak ditemukan`, 'error');
        barcodeInput.value = '';
        barcodeInput.focus();
        return;
    }

    const existing = cart.find(item => item.barcode === code);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({
            id: Date.now() + Math.random() * 1000,
            barcode: code,
            name: product.name,
            price: product.price,
            qty: 1
        });
    }

    barcodeInput.value = '';
    barcodeInput.focus();
    renderCart();
    updateTotals();
    saveData();

    showResult(`✅ ${product.name} ditambahkan!`, 'success');
}

function removeItem(id) {
    cart = cart.filter(item => item.id !== id);
    renderCart();
    updateTotals();
    saveData();
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
        removeItem(id);
        return;
    }
    item.qty = newQty;
    renderCart();
    updateTotals();
    saveData();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Yakin kosongkan keranjang?')) {
        cart = [];
        renderCart();
        updateTotals();
        saveData();
    }
}

// ============================================
// RENDER CART
// ============================================
function renderCart() {
    if (cart.length === 0) {
        cartList.innerHTML = `<div class="empty-cart">🛒 Belum ada barang</div>`;
        return;
    }

    cartList.innerHTML = cart.map(item => `
        <div class="cart-item">
            <span class="item-name">${item.name}</span>
            <span class="item-price">Rp ${item.price.toLocaleString()}</span>
            <div class="item-qty">
                <button onclick="changeQty(${item.id}, -1)">−</button>
                <span>${item.qty}</span>
                <button onclick="changeQty(${item.id}, 1)">+</button>
            </div>
            <span class="item-total">Rp ${(item.price * item.qty).toLocaleString()}</span>
            <button class="btn-remove" onclick="removeItem(${item.id})">✕</button>
        </div>
    `).join('');
}

// ============================================
// TOTALS
// ============================================
function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    subtotalEl.textContent = `Rp ${subtotal.toLocaleString()}`;

    const discountPercent = parseFloat(discountInput.value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    discountAmountEl.textContent = `Rp ${Math.round(discountAmount).toLocaleString()}`;

    const grandTotal = subtotal - discountAmount;
    grandTotalEl.textContent = `Rp ${Math.round(grandTotal).toLocaleString()}`;
}

discountInput.addEventListener('input', updateTotals);

// ============================================
// SAVE & LOAD DATA
// ============================================
function saveData() {
    const data = {
        cart: cart,
        products: productDB,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('kasirData', JSON.stringify(data));
    console.log('💾 Data tersimpan');
}

function loadData() {
    const saved = localStorage.getItem('kasirData');
    if (!saved) {
        showResult('📭 Tidak ada data tersimpan', '');
        return;
    }

    try {
        const data = JSON.parse(saved);
        if (data.cart) {
            cart = data.cart;
            renderCart();
            updateTotals();
        }
        if (data.products) {
            Object.assign(productDB, data.products);
            renderQuickProducts();
        }
        showResult('📂 Data berhasil dimuat!', 'success');
        console.log('📂 Data dimuat:', new Date(data.timestamp).toLocaleString());
    } catch (e) {
        console.error('Gagal load data:', e);
        showResult('❌ Gagal memuat data', 'error');
    }
}

// ============================================
// RIWAYAT TRANSAKSI
// ============================================
function saveTransaction() {
    if (cart.length === 0) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountPercent = parseFloat(discountInput.value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const grandTotal = subtotal - discountAmount;

    const transaction = {
        id: Date.now(),
        date: new Date().toISOString(),
        items: JSON.parse(JSON.stringify(cart)),
        subtotal: subtotal,
        discount: discountPercent,
        discountAmount: discountAmount,
        total: grandTotal
    };

    history.push(transaction);
    localStorage.setItem('kasirHistory', JSON.stringify(history));

    console.log('📊 Transaksi tersimpan:', transaction);
}

function viewHistory() {
    if (history.length === 0) {
        alert('📭 Belum ada riwayat transaksi');
        return;
    }

    let msg = '📊 RIWAYAT TRANSAKSI\n';
    msg += '='.repeat(40) + '\n\n';

    history.slice(-10).reverse().forEach((t, i) => {
        const date = new Date(t.date).toLocaleString('id-ID');
        msg += `${i+1}. ${date}\n`;
        msg += `   Total: Rp ${Math.round(t.total).toLocaleString()}\n`;
        msg += `   Items: ${t.items.length}\n\n`;
    });

    msg += '='.repeat(40) + '\n';
    msg += `Total Transaksi: ${history.length}`;

    alert(msg);
}

// ============================================
// PRINT
// ============================================
function printReceipt() {
    if (cart.length === 0) {
        alert('Belum ada barang!');
        return;
    }

    // Simpan transaksi sebelum print
    saveTransaction();

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountPercent = parseFloat(discountInput.value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const grandTotal = subtotal - discountAmount;

    let html = `
        <div id="receiptPrint" style="font-family: monospace; padding: 20px; max-width: 320px; margin: 0 auto; background: white;">
            <h2 style="text-align: center; font-size: 18px;">🧾 STRUK BELANJA</h2>
            <p style="text-align: center; font-size: 11px; color: #666;">${dateStr} ${timeStr}</p>
            <hr style="border: 1px dashed #999; margin: 8px 0;" />
    `;

    cart.forEach(item => {
        html += `
            <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px;">
                <span>${item.name} x${item.qty}</span>
                <span>Rp ${(item.price * item.qty).toLocaleString()}</span>
            </div>
        `;
    });

    html += `
            <hr style="border: 1px dashed #999; margin: 8px 0;" />
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                <span>Subtotal</span>
                <span>Rp ${subtotal.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
                <span>Diskon (${discountPercent}%)</span>
                <span>-Rp ${Math.round(discountAmount).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 20px; margin-top: 6px;">
                <span>TOTAL</span>
                <span>Rp ${Math.round(grandTotal).toLocaleString()}</span>
            </div>
            <hr style="border: 1px dashed #999; margin: 8px 0;" />
            <p style="text-align: center; font-size: 11px; color: #999;">Terima kasih 🙏</p>
        </div>
    `;

    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(`<html><head><title>Struk</title></head><body style="margin:0;">${html}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
}

// ============================================
// KEYBOARD
// ============================================
barcodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addItemByBarcode();
    }
});

// ============================================
// INIT
// ============================================
renderCart();
updateTotals();
loadData();

console.log('📦 Produk:', Object.keys(productDB).length);
console.log('📷 Pilih metode: Manual | Upload Foto | Kamera');
console.log('📊 Riwayat transaksi:', history.length);

// ============================================
// EXPORT EXCEL
// ============================================
function exportExcel() {
    if (history.length === 0) {
        alert('📭 Belum ada data transaksi!');
        return;
    }

    // Buat data CSV
    let csv = 'No,Tanggal,Item,Total\n';
    history.forEach((t, i) => {
        const date = new Date(t.date).toLocaleString('id-ID');
        t.items.forEach(item => {
            csv += `${i+1},${date},${item.name} x${item.qty},Rp ${(item.price * item.qty).toLocaleString()}\n`;
        });
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Transaksi_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// FILTER KATEGORI
// ============================================
let currentCategory = 'all';

function filterCategory(category) {
    currentCategory = category;
    
    // Update tombol aktif
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#1e293b';
    });
    event.target.style.background = '#1a6d8a';
    event.target.style.color = 'white';
    
    renderQuickProducts(category);
}

function renderQuickProducts(category = 'all') {
    let entries = Object.entries(productDB);
    if (category !== 'all') {
        entries = entries.filter(([code, p]) => p.category === category);
    }
    entries = entries.slice(0, 8);
    quickProducts.innerHTML = entries.map(([code, p]) =>
        `<button onclick="quickAdd('${code}')">${p.name}</button>`
    ).join('');
}

// ============================================
// PEMBAYARAN & KEMBALIAN
// ============================================
document.getElementById('paymentInput')?.addEventListener('input', function() {
    const total = parseInt(grandTotalEl.textContent.replace(/[^0-9]/g, '')) || 0;
    const payment = parseInt(this.value) || 0;
    const change = payment - total;
    document.getElementById('changeAmount').textContent = change >= 0 ? `Rp ${change.toLocaleString()}` : '❌ Kurang';
    document.getElementById('changeAmount').style.color = change >= 0 ? '#28a745' : '#dc3545';
});

// Update di function updateTotals():
function updateTotals() {
    // ... kode existing ...
    
    // Trigger ulang payment
    const paymentInput = document.getElementById('paymentInput');
    if (paymentInput) {
        const event = new Event('input');
        paymentInput.dispatchEvent(event);
    }
}

// ============================================
// SEARCH PRODUK
// ============================================
function searchProduct() {
    const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!keyword) {
        renderQuickProducts(currentCategory || 'all');
        return;
    }
    
    const entries = Object.entries(productDB).filter(([code, p]) => 
        p.name.toLowerCase().includes(keyword) || code.includes(keyword)
    );
    
    quickProducts.innerHTML = entries.slice(0, 10).map(([code, p]) =>
        `<button onclick="quickAdd('${code}')">${p.name}</button>`
    ).join('');
}

// ============================================
// DARK MODE
// ============================================
function toggleTheme() {
    document.body.classList.toggle('dark');
    const btn = event.target;
    btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    
    // Simpan preferensi
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

// Load theme saat startup
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
            }
