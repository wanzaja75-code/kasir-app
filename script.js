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
};

// ============================================
// STATE
// ============================================
let cart = [];
let scannerActive = false;
let scanTimeout = null;

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
// LOAD QUAGGA
// ============================================
function loadQuagga(callback) {
    if (typeof Quagga !== 'undefined') {
        callback();
        return;
    }

    setStatus('⏳ Memuat scanner...', '');

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/zxing/0.1.0/index.min.js';
    script.onload = () => {
        console.log('✅ Quagga loaded');
        callback();
    };
    script.onerror = () => {
        setStatus('❌ Gagal load scanner. Coba refresh.', 'error');
        showResult('❌ Gagal load scanner. Coba refresh.', 'error');
    };
    document.head.appendChild(script);
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
    scanResult.textContent = msg;
    scanResult.className = 'scan-result show';
    if (type) scanResult.classList.add(type);
    scanResult.style.display = 'block';
    setTimeout(() => { scanResult.style.display = 'none'; }, 3000);
}

function toggleCamera() {
    if (scannerActive) {
        stopScanner();
    } else {
        startScanner();
    }
}

function startScanner() {
    loadQuagga(() => {
        // Reset video
        video.style.display = 'block';
        video.classList.add('active');
        cameraPlaceholder.classList.add('hidden');
        cameraOverlay.classList.add('active');

        setStatus('📷 Mengakses kamera...', '');

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: video,
                constraints: {
                    facingMode: "environment",
                    width: { min: 640 },
                    height: { min: 480 },
                }
            },
            decoder: {
                readers: [
                    "ean_reader",
                    "ean_8_reader",
                    "code_128_reader",
                    "code_39_reader",
                    "upc_reader",
                    "upc_e_reader"
                ]
            },
            locate: true,
            numOfWorkers: 2,
        }, (err) => {
            if (err) {
                console.error('Quagga init error:', err);
                let msg = 'Gagal akses kamera: ';
                if (err.message && err.message.includes('Permission')) {
                    msg += 'Izin kamera ditolak.';
                } else {
                    msg += err.message || 'Unknown error';
                }
                setStatus('❌ ' + msg, 'error');
                showResult('❌ ' + msg, 'error');
                stopScanner();
                return;
            }

            Quagga.start();
            scannerActive = true;
            btnScan.textContent = '⏹️ Berhenti';
            btnScan.classList.add('active');
            setStatus('📷 Kamera aktif - Arahkan ke barcode', 'active');

            // Auto-stop setelah 15 detik
            if (scanTimeout) clearTimeout(scanTimeout);
            scanTimeout = setTimeout(() => {
                if (scannerActive) {
                    showResult('⏱️ Waktu scan habis', '');
                    stopScanner();
                }
            }, 15000);
        });

        Quagga.onDetected((data) => {
            const code = data.codeResult.code;
            if (code) {
                console.log('✅ Barcode detected:', code);
                barcodeInput.value = code;

                const product = productDB[code];
                if (product) {
                    showResult(`✅ ${product.name} - Rp ${product.price.toLocaleString()}`, 'success');
                    if (navigator.vibrate) navigator.vibrate(100);
                } else {
                    showResult(`⚠️ Kode "${code}" tidak ditemukan`, 'error');
                }

                stopScanner();
                addItemByBarcode();
            }
        });
    });
}

function stopScanner() {
    if (scannerActive) {
        try {
            Quagga.stop();
        } catch (e) {
            console.warn('Quagga stop error:', e);
        }
        scannerActive = false;
    }

    video.style.display = 'none';
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

console.log('📦 Produk:', Object.keys(productDB).length);
console.log('📷 Klik "Mulai Kamera" untuk scan');
