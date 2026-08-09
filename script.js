function kasirApp() {
    return {
        // ===== STATE =====
        darkMode: localStorage.getItem('theme') === 'dark',
        datetime: '',
        
        // Method dengan icon Font Awesome
        methods: [
            { id: 'manual', icon: 'fa-keyboard', label: 'Manual' },
            { id: 'upload', icon: 'fa-upload', label: 'Upload' },
            { id: 'camera', icon: 'fa-camera', label: 'Kamera' }
        ],
        activeMethod: 'manual',
        
        // Status
        status: { icon: 'fa-info-circle', message: 'Pilih metode scan di bawah', type: 'info' },
        
        // Input
        barcodeInput: '',
        searchQuery: '',
        
        // Categories dengan icon Font Awesome
        categories: [
            { id: 'all', icon: 'fa-boxes', label: 'Semua' },
            { id: 'Makanan', icon: 'fa-utensils', label: 'Makanan' },
            { id: 'Minuman', icon: 'fa-mug-saucer', label: 'Minuman' },
            { id: 'Snack', icon: 'fa-cookie-bite', label: 'Snack' },
            { id: 'Rokok', icon: 'fa-smoking', label: 'Rokok' },
            { id: 'Lainnya', icon: 'fa-box', label: 'Lainnya' }
        ],
        activeCategory: 'all',
        
        // Products
        productDB: {
            "8991234567890": { name: "Indomie Goreng", price: 3500, category: "Makanan" },
            "8991234567891": { name: "Indomie Kuah", price: 3500, category: "Makanan" },
            "8991234567892": { name: "Teh Pucuk 350ml", price: 4500, category: "Minuman" },
            "8991234567893": { name: "Aqua 600ml", price: 3000, category: "Minuman" },
            "8991234567894": { name: "Roti Tawar", price: 12000, category: "Makanan" },
            "8991234567895": { name: "Mie Sedap Goreng", price: 3200, category: "Makanan" },
            "8991234567896": { name: "Mie Sedap Kuah", price: 3200, category: "Makanan" },
            "8991234567897": { name: "Chitato 68g", price: 8500, category: "Snack" },
            "8991234567898": { name: "Pocky Strawberry", price: 9500, category: "Snack" },
            "8991234567899": { name: "Pocky Chocolate", price: 9500, category: "Snack" },
            "1234567890123": { name: "Coca Cola 1.5L", price: 15000, category: "Minuman" },
            "9876543210987": { name: "Pepsi 1.5L", price: 14000, category: "Minuman" },
            "1111111111111": { name: "Sprite 1.5L", price: 14000, category: "Minuman" },
            "7777777777777": { name: "Fanta 1.5L", price: 14000, category: "Minuman" },
            "8888888888888": { name: "Marlboro Red", price: 28000, category: "Rokok" },
            "9999999999999": { name: "Sampoerna Mild", price: 26000, category: "Rokok" },
        },
        
        // Cart
        cart: [],
        
        // Discount & Payment
        discount: 0,
        payment: 0,
        
        // New Product
        newProduct: { barcode: '', name: '', category: 'Makanan', price: '' },
        
        // Upload
        uploadResult: { message: '', type: '' },
        
        // Camera
        cameraActive: false,
        cameraStream: null,
        scanTimeout: null,
        
        // History
        history: JSON.parse(localStorage.getItem('kasirHistory') || '[]'),
        
        // ===== COMPUTED =====
        get subtotal() {
            return this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        },
        get discountAmount() {
            return (this.subtotal * (parseFloat(this.discount) || 0)) / 100;
        },
        get grandTotal() {
            return this.subtotal - this.discountAmount;
        },
        get change() {
            return (parseFloat(this.payment) || 0) - this.grandTotal;
        },
        get filteredProducts() {
            let products = Object.entries(this.productDB).map(([code, p]) => ({ code, ...p }));
            if (this.activeCategory !== 'all') {
                products = products.filter(p => p.category === this.activeCategory);
            }
            if (this.searchQuery.trim()) {
                const q = this.searchQuery.toLowerCase().trim();
                products = products.filter(p => 
                    p.name.toLowerCase().includes(q) || p.code.includes(q)
                );
            }
            return products.slice(0, 12);
        },
        
        // ===== METHODS (sama seperti sebelumnya) =====
        init() {
            this.updateDateTime();
            setInterval(() => this.updateDateTime(), 30000);
            this.loadData();
            if (this.darkMode) {
                document.documentElement.classList.add('dark');
            }
        },
        
        updateDateTime() {
            const now = new Date();
            this.datetime = now.toLocaleDateString('id-ID', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }) + ' pukul ' + now.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        },
        
        toggleTheme() {
            this.darkMode = !this.darkMode;
            localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark');
        },
        
        setStatus(icon, message, type = 'info') {
            this.status = { icon, message, type };
        },
        
        switchMethod(method) {
            this.activeMethod = method;
            if (method !== 'camera' && this.cameraActive) {
                this.stopCamera();
            }
            this.setStatus('fa-info-circle', 'Mode: ' + (method === 'manual' ? 'Manual Input' : method === 'upload' ? 'Upload Foto' : 'Kamera Live'), 'info');
        },
        
        // ===== PRODUCTS =====
        quickAdd(code) {
            this.barcodeInput = code;
            this.addItem();
        },
        
        addItem() {
            const code = this.barcodeInput.trim();
            if (!code) {
                this.setStatus('fa-exclamation-circle', 'Masukkan kode barcode', 'error');
                return;
            }
            
            const product = this.productDB[code];
            if (!product) {
                this.setStatus('fa-exclamation-circle', `Kode "${code}" tidak ditemukan`, 'error');
                this.barcodeInput = '';
                return;
            }
            
            const existing = this.cart.find(item => item.barcode === code);
            if (existing) {
                existing.qty += 1;
            } else {
                this.cart.push({
                    id: Date.now() + Math.random() * 1000,
                    barcode: code,
                    name: product.name,
                    price: product.price,
                    qty: 1
                });
            }
            
            this.barcodeInput = '';
            this.setStatus('fa-check-circle', `${product.name} ditambahkan!`, 'success');
            this.saveData();
        },
        
        removeItem(id) {
            this.cart = this.cart.filter(item => item.id !== id);
            this.saveData();
        },
        
        changeQty(id, delta) {
            const item = this.cart.find(i => i.id === id);
            if (!item) return;
            const newQty = item.qty + delta;
            if (newQty <= 0) {
                this.removeItem(id);
                return;
            }
            item.qty = newQty;
            this.saveData();
        },
        
        clearCart() {
            if (this.cart.length === 0) return;
            if (confirm('Yakin kosongkan keranjang?')) {
                this.cart = [];
                this.saveData();
            }
        },
        
        addNewProduct() {
            const { barcode, name, category, price } = this.newProduct;
            if (!barcode || !name || !price || isNaN(price) || price <= 0) {
                this.setStatus('fa-exclamation-circle', 'Isi semua data dengan benar!', 'error');
                return;
            }
            if (this.productDB[barcode]) {
                this.setStatus('fa-exclamation-circle', `Kode "${barcode}" sudah ada!`, 'error');
                return;
            }
            this.productDB[barcode] = { name, price: parseInt(price), category };
            this.newProduct = { barcode: '', name: '', category: 'Makanan', price: '' };
            this.setStatus('fa-check-circle', `"${name}" berhasil ditambahkan!`, 'success');
            this.saveData();
        },
        
        searchProduct() {},
        
        filterCategory(category) {
            this.activeCategory = category;
        },
        
        // ===== UPLOAD =====
        handleUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
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
                            this.barcodeInput = code.data;
                            this.uploadResult = { message: `✅ Barcode: ${code.data}`, type: 'success' };
                            setTimeout(() => this.addItem(), 300);
                        } else {
                            this.uploadResult = { message: '❌ Tidak ada barcode terdeteksi', type: 'error' };
                        }
                    } catch (err) {
                        this.uploadResult = { message: '❌ Gagal membaca gambar', type: 'error' };
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        },
        
        // ===== CAMERA =====
        async toggleCamera() {
            if (this.cameraActive) {
                this.stopCamera();
            } else {
                await this.startCamera();
            }
        },
        
        async startCamera() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    this.setStatus('fa-exclamation-circle', 'Browser tidak support kamera', 'error');
                    return;
                }
                
                this.setStatus('fa-camera', 'Mengakses kamera...', 'info');
                
                this.cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                
                const video = document.getElementById('video');
                video.srcObject = this.cameraStream;
                await video.play();
                
                this.cameraActive = true;
                this.setStatus('fa-camera', 'Kamera aktif - Arahkan ke barcode', 'active');
                
                this.scanLoop();
                
                this.scanTimeout = setTimeout(() => {
                    if (this.cameraActive) {
                        this.setStatus('fa-clock', 'Waktu habis, scan ulang', 'info');
                        this.stopCamera();
                    }
                }, 15000);
                
            } catch (err) {
                let msg = 'Gagal akses kamera: ';
                if (err.name === 'NotAllowedError') msg += 'Izin ditolak.';
                else if (err.name === 'NotFoundError') msg += 'Tidak ada kamera.';
                else msg += err.message;
                this.setStatus('fa-exclamation-circle', msg, 'error');
                this.stopCamera();
            }
        },
        
        stopCamera() {
            this.cameraActive = false;
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(t => t.stop());
                this.cameraStream = null;
            }
            const video = document.getElementById('video');
            video.srcObject = null;
            if (this.scanTimeout) {
                clearTimeout(this.scanTimeout);
                this.scanTimeout = null;
            }
            this.setStatus('fa-camera', 'Kamera dimatikan', 'info');
        },
        
        scanLoop() {
            if (!this.cameraActive) return;
            
            const video = document.getElementById('video');
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
                    this.barcodeInput = barcode;
                    const product = this.productDB[barcode];
                    if (product) {
                        this.setStatus('fa-check-circle', `${product.name} - Rp ${product.price.toLocaleString()}`, 'success');
                        if (navigator.vibrate) navigator.vibrate(100);
                    } else {
                        this.setStatus('fa-exclamation-circle', `Kode "${barcode}" tidak ditemukan`, 'error');
                    }
                    this.stopCamera();
                    setTimeout(() => this.addItem(), 300);
                    return;
                }
            } catch (e) {}
            
            requestAnimationFrame(() => this.scanLoop());
        },
        
        // ===== FORMAT =====
        formatNumber(num) {
            return Math.round(num || 0).toLocaleString();
        },
        
        // ===== SAVE & LOAD =====
        saveData() {
            const data = { cart: this.cart, products: this.productDB, timestamp: new Date().toISOString() };
            localStorage.setItem('kasirData', JSON.stringify(data));
            this.setStatus('fa-check-circle', 'Data tersimpan!', 'success');
        },
        
        loadData() {
            const saved = localStorage.getItem('kasirData');
            if (!saved) {
                this.setStatus('fa-info-circle', 'Tidak ada data tersimpan', 'info');
                return;
            }
            try {
                const data = JSON.parse(saved);
                if (data.cart) this.cart = data.cart;
                if (data.products) Object.assign(this.productDB, data.products);
                this.setStatus('fa-check-circle', 'Data berhasil dimuat!', 'success');
            } catch (e) {
                this.setStatus('fa-exclamation-circle', 'Gagal memuat data', 'error');
            }
        },
        
        // ===== HISTORY =====
        viewHistory() {
            if (this.history.length === 0) {
                alert('📭 Belum ada riwayat transaksi');
                return;
            }
            let msg = '📊 RIWAYAT TRANSAKSI\n' + '='.repeat(40) + '\n\n';
            this.history.slice(-10).reverse().forEach((t, i) => {
                const date = new Date(t.date).toLocaleString('id-ID');
                msg += `${i+1}. ${date}\n   Total: Rp ${Math.round(t.total).toLocaleString()}\n   Items: ${t.items.length}\n\n`;
            });
            msg += '='.repeat(40) + '\nTotal Transaksi: ' + this.history.length;
            alert(msg);
        },
        
        saveTransaction() {
            if (this.cart.length === 0) return;
            this.history.push({
                id: Date.now(),
                date: new Date().toISOString(),
                items: JSON.parse(JSON.stringify(this.cart)),
                subtotal: this.subtotal,
                discount: parseFloat(this.discount) || 0,
                discountAmount: this.discountAmount,
                total: this.grandTotal
            });
            localStorage.setItem('kasirHistory', JSON.stringify(this.history));
        },
        
        // ===== EXPORT =====
        exportExcel() {
            if (this.history.length === 0) {
                alert('📭 Belum ada data transaksi!');
                return;
            }
            let csv = 'No,Tanggal,Item,Total\n';
            this.history.forEach((t, i) => {
                const date = new Date(t.date).toLocaleString('id-ID');
                t.items.forEach(item => {
                    csv += `${i+1},${date},${item.name} x${item.qty},Rp ${(item.price * item.qty).toLocaleString()}\n`;
                });
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Laporan_Transaksi_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            this.setStatus('fa-check-circle', 'Export Excel berhasil!', 'success');
        },
        
        // ===== PRINT =====
        printReceipt() {
            if (this.cart.length === 0) {
                alert('Belum ada barang!');
                return;
            }
            
            this.saveTransaction();
            
            const now = new Date();
            const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            
            let html = `
                <div id="receiptPrint" style="font-family: 'Inter', monospace; padding: 24px; max-width: 340px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
                    <div style="text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 12px;">
                        <h2 style="font-size: 20px; font-weight: 700; color: #0f2a44;">🧾 STRUK BELANJA</h2>
                        <p style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${dateStr} ${timeStr}</p>
                    </div>
                    <div style="padding: 12px 0;">
            `;
            
            this.cart.forEach(item => {
                html += `
                    <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px;">
                        <span>${item.name} x${item.qty}</span>
                        <span style="font-weight: 600;">Rp ${(item.price * item.qty).toLocaleString()}</span>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    <div style="border-top: 2px dashed #e2e8f0; padding-top: 10px;">
                        <div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span>Subtotal</span>
                            <span>Rp ${this.subtotal.toLocaleString()}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8;">
                            <span>Diskon (${this.discount}%)</span>
                            <span>-Rp ${Math.round(this.discountAmount).toLocaleString()}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700; color: #0f2a44; margin-top: 6px; padding-top: 6px; border-top: 2px solid #e2e8f0;">
                            <span>TOTAL</span>
                            <span>Rp ${Math.round(this.grandTotal).toLocaleString()}</span>
                        </div>
                        ${this.payment > 0 ? `
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>Uang Bayar</span>
                            <span>Rp ${Number(this.payment).toLocaleString()}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #22a65a;">
                            <span>Kembalian</span>
                            <span>Rp ${this.change >= 0 ? this.change.toLocaleString() : '0'}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 12px; padding-top: 12px; border-top: 2px dashed #e2e8f0;">
                        Terima kasih 🙏
                    </div>
                </div>
            `;
            
            const win = window.open('', '_blank', 'width=400,height=600');
            win.document.write(`<html><head><title>Struk</title></head><body style="margin:0; background:#f1f5f9; display:flex; align-items:center; justify-content:center; min-height:100vh;">${html}</body></html>`);
            win.document.close();
            setTimeout(() => win.print(), 500);
        }
    }
}
