// ============================================
// DATA PRODUK (simulasi database)
// ============================================
const productDB = {
    // Kode: { nama, harga }
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
    // Tambahkan produk lain sesuai kebutuhan
};

// ============================================
// STATE
// ============================================
let cart = []; // [{ id, barcode, name, price, qty }]
let currentScanner = null;
let scanTimeout = null;

// ============================================
// DOM REFERENCES
// ============================================
const videoEl = document.getElementById('scanner');
const canvasEl = document.getElementById('canvas');
const barcodeInput = document.getElementById('barcodeInput');
const cartListEl = document.getElementById('cartList');
const subtotalEl = document.getElementById('subtotal');
const discountInput = document.getElementById('discountInput');
const discountAmountEl = document.getElementById('discountAmount');
const grandTotalEl = document.getElementById('grandTotal');

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
// SCANNER (menggunakan QuaggaJS via CDN)
// ============================================
function loadQuagga(callback) {
    if (typeof Quagga !== 'undefined') {
        callback();
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
    script.onload = callback;
    script.onerror = () => alert('Gagal load Quagga. Pastikan koneksi internet aktif.');
    document.head.appendChild(script);
}

function startScanner() {
    loadQuagga(() => {
        if (currentScanner) {
            stopScanner();
        }

        // Reset video
        videoEl.style.display = 'block';

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoEl,
                constraints: {
                    facingMode: "environment",
                    aspectRatio: { min: 1, max: 2 }
                }
            },
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader", "upc_e_reader"]
            },
            locate: true,
            numOfWorkers: 2,
        }, (err) => {
            if (err) {
                alert('Gagal mengakses kamera: ' + err);
                return;
            }
            Quagga.start();
            currentScanner = true;
            document.querySelector('.scan-overlay').style.display = 'flex';
            
            // Auto-stop setelah 10 detik
            if (scanTimeout) clearTimeout(scanTimeout);
            scanTimeout = setTimeout(() => {
                if (currentScanner) stopScanner();
            }, 15000);
        });

        Quagga.onDetected((data) => {
            const code = data.codeResult.code;
            if (code) {
                barcodeInput.value = code;
                stopScanner();
                addItemByBarcode();
            }
        });
    });
}

function stopScanner() {
    if (currentScanner) {
        Quagga.stop();
        currentScanner = null;
        videoEl.style.display = 'none';
        document.querySelector('.scan-overlay').style.display = 'none';
        if (scanTimeout) {
            clearTimeout(scanTimeout);
            scanTimeout = null;
        }
    }
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

// Event listener untuk diskon
discountInput.addEventListener('input', updateTotals);

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
// INIT
// ============================================
renderCart();
updateTotals();

// Tampilkan produk contoh di konsol
console.log('📦 Produk tersedia:', Object.keys(productDB).length);