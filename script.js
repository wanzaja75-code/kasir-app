// ============================================
// DATABASE PRODUK
// ============================================
const productDB = {
    "8991234567890": { name: "Indomie Goreng", price: 3500 },
    "8991234567891": { name: "Indomie Kuah", price: 3500 },
    "8991234567892": { name: "Teh Pucuk 350ml", price: 4500 },
    "8991234567893": { name: "Aqua 600ml", price: 3000 },
    "8991234567894": { name: "Roti Tawar", price: 12000 },
    "8991234567895": { name: "Mie Sedap Goreng", price: 3200 },
    "8991234567896": { name: "Mie Sedap Kuah", price: 3200 },
    "8991234567897": { name: "Chitato 68g", price: 8500 },
    "8991234567898": { name: "Pocky Strawberry", price: 9500 },
    "8991234567899": { name: "Pocky Chocolate", price: 9500 },
    "1234567890123": { name: "Coca Cola 1.5L", price: 15000 },
    "9876543210987": { name: "Pepsi 1.5L", price: 14000 },
    "1111111111111": { name: "Sprite 1.5L", price: 14000 },
    "7777777777777": { name: "Fanta 1.5L", price: 14000 },
};

// ============================================
// STATE
// ============================================
let cart = [];
let isScanning = false;
let scanTimeout = null;
let stream = null;

// ============================================
// DOM
// ============================================
const video = document.getElementById('video');
const cameraStatus = document.getElementById('cameraStatus');
const cameraOverlay = document.getElementById('cameraOverlay');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const btnScan = document.getElementById('btnScan');
const barcodeInput = document.getElementById('barcodeInput');
const scanResult = document.getElementById('scanResult');
const cartList = document.getElementById('cartList');
const subtotalEl = document.getElementById('subtotal');
const discountInput = document.getElementById('discountInput');
const discountAmountEl = document.getElementById('discountAmount');
const grandTotalEl = document.getElementById('grandTotal');
const quickProducts = document.getElementById('quickProducts');

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
// CAMERA - MENGGUNAKAN getUserImageData + ZXing
// ============================================
function setStatus(msg, type = '') {
    cameraStatus.textContent = msg;
    cameraStatus.className = 'camera-status';
    if (type) cameraStatus.classList.add(type);
}

function showResult(msg, type = '') {
    scanResult.textContent = msg;
    scanResult.className = 'scan-result show';
    if (type) scanResult.classList.add(type);
    scanResult.style.display = 'block';
    setTimeout(() => { scanResult.style.display = 'none'; }, 3000);
}

function toggleCamera() {
    if (isScanning) {
        stopCamera();
    } else {
        startCamera();
    }
}

async function startCamera() {
    try {
        setStatus('📷 Mengakses kamera...', '');

        // Cek dukungan
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('❌ Browser tidak support kamera', 'error');
            showResult('❌ Browser tidak mendukung akses kamera', 'error');
            return;
        }

        // Mulai stream
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

        // Tampilkan video
        video.classList.add('active');
        cameraPlaceholder.classList.add('hidden');
        cameraOverlay.classList.add('active');

        isScanning = true;
        btnScan.textContent = '⏹️ Berhenti';
        btnScan.classList.add('active');
        setStatus('📷 Kamera aktif - Arahkan ke barcode', 'active');

        // Mulai scan loop
        scanLoop();

        // Auto stop 15 detik
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            if (isScanning) {
                showResult('⏱️ Waktu habis, scan ulang', '');
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
        showResult('❌ ' + msg, 'error');
        stopCamera();
    }
}

function stopCamera() {
    isScanning = false;

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

// ============================================
// SCAN LOOP - Menggunakan Canvas + ZXing
// ============================================
function scanLoop() {
    if (!isScanning) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Dapatkan data gambar
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Gunakan ZXing untuk decode
    try {
        const codeReader = new ZXing.BrowserMultiFormatReader();
        const result = codeReader.decodeFromImage(imageData);

        if (result && result.text) {
            const code = result.text.trim();
            console.log('✅ Barcode detected:', code);

            barcodeInput.value = code;

            // Cek produk
            const product = productDB[code];
            if (product) {
                showResult(`✅ ${product.name} - Rp ${product.price.toLocaleString()}`, 'success');
                if (navigator.vibrate) navigator.vibrate(100);
                stopCamera();
                addItemByBarcode();
                return;
            } else {
                showResult(`⚠️ Kode "${code}" tidak ditemukan`, 'error');
                // Lanjut scan lagi
            }
        }
    } catch (e) {
        // Tidak ada barcode, lanjut scan
    }

    // Lanjut scan lagi
    requestAnimationFrame(scanLoop);
}

// ============================================
// LOAD ZXING
// ============================================
function loadZXing(callback) {
    if (typeof ZXing !== 'undefined') {
        callback();
        return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@zxing/browser@latest/umd/index.min.js';
    script.onload = callback;
    script.onerror = () => {
        setStatus('❌ Gagal load library scanner', 'error');
        showResult('❌ Gagal load scanner. Coba refresh.', 'error');
    };
    document.head.appendChild(script);
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

    showResult(`✅ ${product.name} ditambahkan!`, 'success');
}

function removeItem(id) {
    cart = cart.filter(item => item.id !== id);
    renderCart();
    updateTotals();
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
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Yakin kosongkan keranjang?')) {
        cart = [];
        renderCart();
        updateTotals();
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
// PRINT
// ============================================
function printReceipt() {
    if (cart.length === 0) {
        alert('Belum ada barang!');
        return;
    }

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

// Load ZXing di background
loadZXing(() => {
    console.log('✅ ZXing loaded');
    setStatus('📷 Siap scan - Klik "Mulai Kamera"', '');
});

console.log('📦 Produk:', Object.keys(productDB).length);
