// ============================================
// DATA PRODUK (simulasi database)
// ============================================
const productDB = {
    "8991234567890": { name: "Indomie Goreng", price: 3500 },
    "8991234567891": { name: "Indomie Kuah", price: 3500 },
    "8991234567892": { name: "Teh Pucuk 350ml", price: 4500 },
    "8991234567893": { name: "Aqua 600ml", price: 3000 },
    "8991234567894": { name: "Roti Tawar Sari Roti", price: 12000 },
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
let quaggaInitialized = false;

// ============================================
// DOM REFERENCES
// ============================================
const videoEl = document.getElementById('scanner');
const canvasEl = document.getElementById('canvas');
const scanBox = document.getElementById('scanBox');
const scanOverlay = document.getElementById('scanOverlay');
const scanPlaceholder = document.getElementById('scanPlaceholder');
const cameraStatus = document.getElementById('cameraStatus');
const scanResult = document.getElementById('scanResult');
const barcodeInput = document.getElementById('barcodeInput');
const cartListEl = document.getElementById('cartList');
const subtotalEl = document.getElementById('subtotal');
const discountInput = document.getElementById('discountInput');
const discountAmountEl = document.getElementById('discountAmount');
const grandTotalEl = document.getElementById('grandTotal');
const btnScan = document.getElementById('btnScan');

// ============================================
// DATE & TIME
// ============================================
function updateDateTime() {
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('datetime').textContent = now.toLocaleDateString('id-ID', opts);
}
updateDateTime();
setInterval(updateDateTime, 30000);

// ============================================
// LOAD QUAGGA
// ============================================
function loadQuagga(callback) {
    if (typeof Quagga !== 'undefined') {
        callback();
        return;
    }
    
    setCameraStatus('⏳ Memuat library scanner...', '');
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
    script.onload = () => {
        quaggaInitialized = true;
        callback();
    };
    script.onerror = () => {
        setCameraStatus('❌ Gagal memuat scanner. Coba refresh halaman.', 'error');
        alert('Gagal load library scanner. Pastikan koneksi internet aktif.');
    };
    document.head.appendChild(script);
}

// ============================================
// CAMERA STATUS
// ============================================
function setCameraStatus(message, type = '') {
    cameraStatus.textContent = message;
    cameraStatus.className = 'camera-status';
    if (type) cameraStatus.classList.add(type);
}

// ============================================
// SCANNER TOGGLE
// ============================================
function toggleScanner() {
    if (scannerActive) {
        stopScanner();
    } else {
        startScanner();
    }
}

function startScanner() {
    loadQuagga(() => {
        // Reset video
        videoEl.style.display = 'block';
        videoEl.classList.add('active');
        scanPlaceholder.classList.add('hidden');
        scanOverlay.classList.add('active');
        scanResult.className = 'scan-result';
        scanResult.style.display = 'none';

        setCameraStatus('📷 Mengakses kamera...', '');

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoEl,
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
                setCameraStatus('❌ Gagal akses kamera: ' + (err.message || 'Unknown error'), 'error');
                showScanResult('❌ Gagal mengakses kamera. Pastikan izin kamera diberikan.', 'error');
                stopScanner();
                return;
            }

            Quagga.start();
            scannerActive = true;
            btnScan.textContent = '⏹️ Berhenti';
            btnScan.classList.add('active');
            setCameraStatus('📷 Kamera aktif - Arahkan ke barcode', 'active');

            // Auto-stop setelah 15 detik
            if (scanTimeout) clearTimeout(scanTimeout);
            scanTimeout = setTimeout(() => {
                if (scannerActive) {
                    showScanResult('⏱️ Waktu scan habis. Silakan scan ulang.', '');
                    stopScanner();
                }
            }, 15000);
        });

        Quagga.onDetected((data) => {
            const code = data.codeResult.code;
            if (code) {
                console.log('Barcode terdeteksi:', code);
                barcodeInput.value = code;
                
                // Cek produk
                const product = productDB[code];
                if (product) {
                    showScanResult(`✅ ${product.name} - Rp ${product.price.toLocaleString()}`, '');
                } else {
                    showScanResult(`⚠️ Kode "${code}" tidak ditemukan di database`, 'error');
                }
                
                // Getar (vibrate) jika support
                if (navigator.vibrate) navigator.vibrate(100);
                
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
    
    videoEl.style.display = 'none';
    videoEl.classList.remove('active');
    scanOverlay.classList.remove('active');
    scanPlaceholder.classList.remove('hidden');
    btnScan.textContent = '📷 Mulai Kamera';
    btnScan.classList.remove('active');
    
    if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
    }
    
    setCameraStatus('📷 Kamera dimatikan', '');
}

// ============================================
// SHOW SCAN RESULT
// ============================================
function showScanResult(message, type = '') {
    scanResult.textContent = message;
    scanResult.className = 'scan-result show';
    if (type === 'error') scanResult.classList.add('error');
    scanResult.style.display = 'block';
}

// ============================================
// CART OPERATIONS
// ============================================
function addItemByBarcode() {
    const code = barcodeInput.value.trim();
    if (!code) {
        alert('Masukkan kode barcode terlebih dahulu!');
        return;
    }

    const product = productDB[code];
    if (!product) {
        alert(`❌ Produk dengan kode "${code}" tidak ditemukan!`);
        showScanResult(`❌ Kode "${code}" tidak ditemukan`, 'error');
        barcodeInput.value = '';
        barcodeInput.focus();
        return;
    }

    // Cek apakah sudah ada di cart
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
    
    // Sembunyikan hasil scan
    setTimeout(() => {
        scanResult.style.display = 'none';
    }, 2000);
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
    if (confirm('Yakin ingin mengosongkan keranjang?')) {
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
        cartListEl.innerHTML = `<div class="empty-cart">🛒 Belum ada barang</div>`;
        return;
    }

    cartListEl.innerHTML = cart.map(item => `
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
// TOTALS & DISCOUNT
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
// PRINT RECEIPT
// ============================================
function printReceipt() {
    if (cart.length === 0) {
        alert('Belum ada barang untuk dicetak!');
        return;
    }
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountPercent = parseFloat(discountInput.value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const grandTotal = subtotal - discountAmount;
    
    let receiptHTML = `
        <div id="receiptPrint" style="font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto;">
            <h2 style="text-align: center;">🧾 STRUK BELANJA</h2>
            <p style="text-align: center; font-size: 12px;">${dateStr}</p>
            <hr style="border: 1px dashed #333; margin: 10px 0;" />
            <div style="font-size: 14px;">
    `;
    
    cart.forEach(item => {
        receiptHTML += `
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                <span>${item.name} x${item.qty}</span>
                <span>Rp ${(item.price * item.qty).toLocaleString()}</span>
            </div>
        `;
    });
    
    receiptHTML += `
            <hr style="border: 1px dashed #333; margin: 10px 0;" />
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>Subtotal</span>
                <span>Rp ${subtotal.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
                <span>Diskon (${discountPercent}%)</span>
                <span>-Rp ${Math.round(discountAmount).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 8px;">
                <span>TOTAL</span>
                <span>Rp ${Math.round(grandTotal).toLocaleString()}</span>
            </div>
            <hr style="border: 1px dashed #333; margin: 10px 0;" />
            <p style="text-align: center; font-size: 11px; color: #666;">Terima kasih telah berbelanja! 🙏</p>
        </div>
    `;
    
    // Buat iframe untuk print
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
            <head><title>Struk Belanja</title></head>
            <body style="margin:0; background:white;">${receiptHTML}</body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// ============================================
// KEYBOARD SHORTCUT
// ============================================
barcodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addItemByBarcode();
    }
});

// ============================================
// CEK DUKUNGAN KAMERA
// ============================================
function checkCameraSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus('⚠️ Browser tidak mendukung akses kamera. Gunakan input manual.', 'error');
        btnScan.disabled = true;
        btnScan.style.opacity = '0.5';
        return false;
    }
    return true;
}

// ============================================
// INIT
// ============================================
renderCart();
updateTotals();
checkCameraSupport();

console.log('📦 Produk tersedia:', Object.keys(productDB).length);
console.log('📷 Scan barcode atau ketik manual');
