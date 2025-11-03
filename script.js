// =================================================================
// 0. DEKLARASI VARIABEL UTAMA & IMPORT GLOBAL
// =================================================================

// Gunakan destructuring untuk mendapatkan referensi elemen yang bersih
const elements = {
    // Tombol Utama
    generateBtn: document.getElementById('generate-btn'),
    downloadBtn: document.getElementById('download-btn'),
    qrCodeOutput: document.getElementById('qr-code-output'),
    
    // Kontrol Desain
    qrSizeInput: document.getElementById('qr-size'),
    qrColorInput: document.getElementById('qr-color'),
    qrMarginInput: document.getElementById('qr-margin'),
    
    // Input QR Code Data (Teks/Gambar)
    qrInputText: document.getElementById('qr-input-text'),
    qrInputImage: document.getElementById('qr-input-image'),
    fileNameDisplay: document.getElementById('file-name-display'),
    
    // ⭐ ELEMEN BARU: Input Logo
    qrInputLogo: document.getElementById('qr-input-logo'),
    logoFileNameDisplay: document.getElementById('logo-file-name-display'),
    logoControlSection: document.querySelector('.control-section:nth-child(2)'), // Bagian Kontrol Spasi & Logo
    
    // Input Barcode
    barcodeInputText: document.getElementById('barcode-input-text'),
    barcodeFormat: document.getElementById('barcode-format'),

    // Navigasi
    tabButtons: document.querySelectorAll('.tab-button'),
    contentAreas: document.querySelectorAll('.content-area'),
    codeTabButtons: document.querySelectorAll('.code-tab-button'),
    generatorContents: document.querySelectorAll('.code-generator-content'),
    subTabButtons: document.querySelectorAll('.sub-tab-button'),
    inputContents: document.querySelectorAll('.input-content'),
    
    // Scanner
    scannerFeed: document.getElementById('scanner-feed'),
};

const { 
    generateBtn, downloadBtn, qrCodeOutput, qrSizeInput, qrColorInput, 
    qrMarginInput, qrInputText, qrInputImage, fileNameDisplay, qrInputLogo, 
    logoFileNameDisplay, logoControlSection, barcodeInputText, barcodeFormat, 
    tabButtons, contentAreas, codeTabButtons, generatorContents, subTabButtons, 
    inputContents, scannerFeed 
} = elements;


// Status Global
let qrcodeInstance = null;
let html5QrcodeScanner = null;
let activeInputType = 'text'; 
let activeCodeType = 'qr';    
let imageDataBase64 = null; // Data untuk Gambar di QR Code
let logoDataBase64 = null; // ⭐ Data Logo di tengah QR Code (BARU)
const MAX_SIZE_BYTES_QR_DATA = 50 * 1024; // 50 KB
const MAX_SIZE_BYTES_LOGO = 100 * 1024; // ⭐ 100 KB untuk Logo (BARU)

// =================================================================
// 1. MODUL: GENERATOR (QR & BARCODE)
// =================================================================

const CodeGenerator = (function() {

    function clearOutput(message = 'Kode Anda akan muncul di sini.') {
        // Hapus SEMUA elemen anak, termasuk logo
        while (qrCodeOutput.firstChild) {
            qrCodeOutput.removeChild(qrCodeOutput.firstChild);
        }
        
        // Tambahkan kembali pesan placeholder
        const placeholder = document.createElement('p');
        placeholder.textContent = message;
        qrCodeOutput.appendChild(placeholder);
        
        downloadBtn.style.display = 'none';
        downloadBtn.disabled = true;
        qrcodeInstance = null; 
    }

    // --- QR CODE LOGIC ---

    /**
     * ⭐ BARU: Mengonversi berkas logo menjadi string Base64 dengan validasi.
     */
    async function fileToBase64Logo(file) {
        return new Promise((resolve, reject) => {
            if (file.size > MAX_SIZE_BYTES_LOGO) {
                alert(`⚠️ Ukuran logo terlalu besar (${(file.size / 1024).toFixed(1)} KB). Maksimal adalah 100 KB.`);
                qrInputLogo.value = ""; 
                logoFileNameDisplay.textContent = "Batasan ukuran dilampaui. Pilih file yang lebih kecil.";
                logoDataBase64 = null;
                reject(new Error("File too large"));
                return;
            }

            const reader = new FileReader();
            
            reader.onloadstart = () => {
                logoFileNameDisplay.textContent = `Memproses... ${(file.size / 1024).toFixed(1)} KB.`;
                generateBtn.disabled = true;
            };

            reader.onload = () => {
                logoDataBase64 = reader.result;
                logoFileNameDisplay.textContent = `Logo Terpilih: ${file.name}`; 
                generateBtn.disabled = false;
                resolve(reader.result);
            };

            reader.onerror = (error) => {
                console.error("Gagal membaca file:", error);
                logoDataBase64 = null;
                logoFileNameDisplay.textContent = "Gagal memproses file.";
                generateBtn.disabled = false;
                reject(error);
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Mengonversi berkas gambar data QR menjadi string Base64 dengan validasi (Tetap).
     */
    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (file.size > MAX_SIZE_BYTES_QR_DATA) {
                alert(`⚠️ Ukuran file terlalu besar (${(file.size / 1024).toFixed(1)} KB). Maksimal adalah 50 KB.`);
                qrInputImage.value = ""; 
                fileNameDisplay.textContent = "Batasan ukuran dilampaui. Pilih file yang lebih kecil.";
                imageDataBase64 = null;
                reject(new Error("File too large"));
                return;
            }

            const reader = new FileReader();
            
            reader.onloadstart = () => {
                fileNameDisplay.textContent = `Memproses... ${(file.size / 1024).toFixed(1)} KB.`;
                generateBtn.disabled = true;
            };

            reader.onload = () => {
                imageDataBase64 = reader.result;
                fileNameDisplay.textContent = `File Terpilih: ${file.name}`; 
                generateBtn.disabled = false;
                resolve(reader.result);
            };

            reader.onerror = (error) => {
                console.error("Gagal membaca file:", error);
                imageDataBase64 = null;
                fileNameDisplay.textContent = "Gagal memproses file.";
                generateBtn.disabled = false;
                reject(error);
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Fungsi utama untuk menghasilkan QR Code.
     */
    function generateQR() {
        let dataToEncode = activeInputType === 'text' 
            ? qrInputText.value.trim() 
            : imageDataBase64;

        if (!dataToEncode) {
            alert("Mohon masukkan Teks/URL atau pilih Gambar untuk QR Code.");
            clearOutput();
            return;
        }

        // Ambil & Validasi Desain
        const size = Math.max(100, Math.min(500, parseInt(qrSizeInput.value) || 256));
        qrSizeInput.value = size; 
        const margin = Math.max(0, Math.min(20, parseInt(qrMarginInput.value) || 4));
        qrMarginInput.value = margin;
        const color = qrColorInput.value;

        // Buat QR Code
        clearOutput('Sedang membuat QR Code...');
        
        const loadingMessage = qrCodeOutput.querySelector('p');
        if (loadingMessage) {
            qrCodeOutput.removeChild(loadingMessage);
        }

        const tempDiv = document.createElement('div');
        qrCodeOutput.appendChild(tempDiv);

        qrcodeInstance = new QRCode(tempDiv, {
            text: dataToEncode, 
            width: size,
            height: size,
            colorDark: color,
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H, // ⭐ Level Error Correction Tinggi untuk Logo
            margin: margin 
        });

        // ⭐ LOGIKA LOGO BARU
        if (logoDataBase64) {
            // Gunakan setTimeout untuk memastikan canvas sudah dirender sepenuhnya
            setTimeout(() => {
                const canvas = qrCodeOutput.querySelector('canvas');
                if (canvas) {
                    const logo = document.createElement('img');
                    logo.src = logoDataBase64;
                    logo.classList.add('qr-logo');
                    
                    // Hitung ukuran logo (misalnya 20% dari ukuran QR Code)
                    const logoSize = size * 0.20; 
                    logo.style.width = `${logoSize}px`;
                    logo.style.height = `${logoSize}px`;
                    
                    // Tambahkan logo ke container output utama
                    qrCodeOutput.appendChild(logo);
                }
            }, 100); 
        }

        // Aktivasi Download
        setTimeout(() => {
            // Beri peringatan jika ada logo karena download canvas tidak menyertakan logo.
            downloadBtn.textContent = logoDataBase64 
                ? '⚠️ Unduh QR (Tanpa Logo)'
                : '📥 Unduh QR Code (.png)';
            downloadBtn.style.display = 'block';
            downloadBtn.disabled = false;
        }, 150); 
        
        // --- 💡 Peningkatan AI (Contoh Analisis) ---
        // Di sini kita bisa memanggil fungsi analisis untuk data dan desain.
        // analyzeQRCodeQuality(dataToEncode, size, margin, color, logoDataBase64);
    }

    // --- BARCODE LOGIC (Tetap sama) ---

    function validateBarcodeData(data, format) {
        if (!data) return false;
        
        if (format === 'EAN13' && !/^\d{12}$/.test(data)) {
            alert("EAN13 membutuhkan tepat 12 digit numerik.");
            return false;
        }

        if (format === 'UPC' && !/^\d{11}$/.test(data)) {
            alert("UPC membutuhkan tepat 11 digit numerik.");
            return false;
        }

        return true;
    }

    function generateBarcode() {
        const dataToEncode = barcodeInputText.value.trim();
        const format = barcodeFormat.value;

        if (!validateBarcodeData(dataToEncode, format)) {
            clearOutput();
            return;
        }

        const size = parseInt(qrSizeInput.value) || 256;
        const color = qrColorInput.value;
        const margin = parseInt(qrMarginInput.value) || 4;

        clearOutput('Sedang membuat Barcode...');

        const loadingMessage = qrCodeOutput.querySelector('p');
        if (loadingMessage) {
            qrCodeOutput.removeChild(loadingMessage);
        }

        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.id = "barcode-svg-output";

        qrCodeOutput.appendChild(svgElement);

        try {
            JsBarcode("#barcode-svg-output", dataToEncode, {
                format: format,
                displayValue: true,
                text: dataToEncode,
                lineColor: color,
                width: 2, 
                height: Math.floor(size / 2), 
                margin: margin
            });

            downloadBtn.textContent = '📥 Unduh Barcode (.svg)';
            downloadBtn.style.display = 'block';
            downloadBtn.disabled = false;

        } catch (error) {
            console.error("Gagal membuat Barcode:", error);
            clearOutput(`❌ Kesalahan: Format Barcode "${format}" tidak dapat mengolah data yang Anda masukkan.`);
        }
    }

    // --- DOWNLOAD LOGIC (Universal) ---

    function downloadCode() {
        if (activeCodeType === 'qr') {
            const canvas = qrCodeOutput.querySelector('canvas');
            if (canvas) {
                // Catatan: Jika ada logo, logo tidak akan ikut terunduh dalam PNG ini.
                if(logoDataBase64) {
                    alert("Perhatian: Karena keterbatasan, logo di tengah tidak akan ikut terunduh. Unduhan ini hanya berisi QR Code murni.");
                }
                
                const imageURL = canvas.toDataURL("image/png"); 
                const link = document.createElement('a');
                link.href = imageURL;
                const timestamp = new Date().getTime();
                link.download = `QR_Code_${timestamp}.png`; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert("Kesalahan Unduh: QR Code Canvas tidak ditemukan.");
            }
        } else if (activeCodeType === 'barcode') {
            const svg = qrCodeOutput.querySelector('svg');
            if (svg) {
                const svgString = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
                const URL = window.URL || window.webkitURL || window;
                const blobURL = URL.createObjectURL(svgBlob);

                const link = document.createElement('a');
                link.href = blobURL;
                const timestamp = new Date().getTime();
                link.download = `Barcode_${barcodeFormat.value}_${timestamp}.svg`; 
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobURL);
            } else {
                alert("Kesalahan Unduh: Barcode SVG tidak ditemukan.");
            }
        }
    }

    function generateCode() {
        if (activeCodeType === 'qr') {
            generateQR();
        } else if (activeCodeType === 'barcode') {
            generateBarcode();
        }
    }

    return {
        fileToBase64,
        fileToBase64Logo, // ⭐ Export fungsi baru
        clearOutput,
        generateQR,
        generateBarcode,
        generateCode,
        downloadCode
    };
})();


// =================================================================
// 2. MODUL: QR CODE SCANNER (INTEGRASI HTML5-QRCODE)
// =================================================================

const QRScanner = (function() {
    
    let isScanning = false;
    
    // Konfigurasi default scanner
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        disableFlip: false, 
    };

    function onScanSuccess(decodedText) {
        console.log(`Pindai Sukses: ${decodedText}`);
        stopScanner(false);
        
        // --- 💡 Peningkatan AI (Contoh: Analisis Konten) ---
        // Di sini bisa ditambahkan logika untuk menganalisis data
        // const analysisResult = analyzeScannedData(decodedText); 
        // ... tampilkan hasil analisis ...

        // Beri Feedback Visual
        scannerFeed.innerHTML = `
            <div style="padding: 15px; background: #e6ffe6; border: 1px solid #28a745; border-radius: 8px;">
                <p style="color: #28a745; font-weight: bold; margin-bottom: 10px;">✅ Pindai Sukses!</p>
                <p style="word-wrap: break-word; color: #343a40; font-weight: 500;">**Data:** ${decodedText}</p>
                <button onclick="QRScanner.restartScanner()" class="sub-button" style="margin-top: 15px; padding: 10px 15px; font-size: 1em; width: auto;">Pindai Lagi</button>
            </div>
        `;
    }

    function onScanFailure(errorMessage) {
        // Log saja
        // console.warn(`Scan error: ${errorMessage}`);
    }
    
    function startScanner() {
        if (isScanning) return;

        if (!html5QrcodeScanner) {
            html5QrcodeScanner = new Html5Qrcode('scanner-feed'); 
        }

        scannerFeed.innerHTML = '<p style="text-align: center; color: #007bff; padding-top: 50px;">Memuat kamera... Mohon izinkan akses.</p>';

        html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).then(() => {
            isScanning = true;
            console.log("Scanner berhasil dimulai.");
        }).catch((err) => {
            isScanning = false;
            console.error("Gagal memulai scanner:", err);
            scannerFeed.innerHTML = `
                <div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin-top: 20px;">
                    <p style="color: #856404; font-weight: 500;">❌ Gagal mengakses kamera. Pastikan Anda memberikan izin dan menggunakan HTTPS. Error: ${err.name}</p>
                </div>
            `;
        });
    }

    function stopScanner(clear = true) {
        if (!isScanning) return;
        
        if (html5QrcodeScanner && html5QrcodeScanner.getState() !== 2) { 
            html5QrcodeScanner.stop().then(() => {
                isScanning = false;
                console.log("Pemindaian berhasil dihentikan.");
                if (clear) scannerFeed.innerHTML = '<p style="text-align: center; color: #6c757d; padding-top: 50px;">Pemindaian dihentikan.</p>';
            }).catch((err) => {
                console.error("Gagal menghentikan pemindaian:", err);
                isScanning = false;
            });
        }
    }
    
    function restartScanner() {
        stopScanner(true); 
        startScanner();
    }

    return {
        startScanner,
        stopScanner,
        restartScanner
    };

})();


// =================================================================
// 3. LOGIKA INITIATION (Event Listeners Global & Navigasi)
// =================================================================

/**
 * Menginisialisasi semua event listener setelah DOM dimuat.
 */
function initEventListeners() {
    
    // --- 3.1 Event Listener Generator ---
    generateBtn.addEventListener('click', CodeGenerator.generateCode);
    downloadBtn.addEventListener('click', CodeGenerator.downloadCode);
    
    // Trigger generate saat 'Enter' di input text yang aktif
    qrInputText.addEventListener('keyup', (event) => {
        if (activeCodeType === 'qr' && activeInputType === 'text' && event.key === 'Enter') {
            CodeGenerator.generateCode();
        }
    });
    barcodeInputText.addEventListener('keyup', (event) => {
        if (activeCodeType === 'barcode' && event.key === 'Enter') {
            CodeGenerator.generateCode();
        }
    });

    // --- 3.2 Logika Input Gambar Data QR (Async) (Tetap) ---
    qrInputImage.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                await CodeGenerator.fileToBase64(file); 
                if (imageDataBase64) CodeGenerator.generateQR(); 
            } catch (error) {
                CodeGenerator.clearOutput();
            }
        } else {
            fileNameDisplay.textContent = "Belum ada file dipilih.";
            imageDataBase64 = null;
            CodeGenerator.clearOutput();
        }
    });
    
    // ⭐ LOGIKA BARU: Input Logo Kustom (Async) ---
    qrInputLogo.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                await CodeGenerator.fileToBase64Logo(file); 
                // Jika QR Code sudah ditampilkan, generate ulang untuk menampilkan logo
                const isCodeDisplayed = qrCodeOutput.querySelector('canvas');
                if (isCodeDisplayed) {
                    CodeGenerator.generateQR(); 
                }
            } catch (error) {
                 logoFileNameDisplay.textContent = "Gagal memproses logo.";
            }
        } else {
            // Jika logo dihapus/dibatalkan
            logoFileNameDisplay.textContent = "Belum ada logo dipilih.";
            logoDataBase64 = null;
            // Jika kode sedang tampil, generate ulang agar logo hilang
            const isCodeDisplayed = qrCodeOutput.querySelector('canvas');
            if (isCodeDisplayed) {
                CodeGenerator.generateQR(); 
            }
        }
    });
    // End Logika Input Logo Kustom ---

    // --- 3.3 Navigasi Tab Utama (Generator/Scanner) (Tetap) ---
    tabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const targetTab = event.currentTarget.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            contentAreas.forEach(area => area.classList.remove('active'));

            document.getElementById(targetTab).classList.add('active');
            event.currentTarget.classList.add('active');

            if (targetTab === 'generator') {
                QRScanner.stopScanner(); 
                CodeGenerator.clearOutput();
            } else if (targetTab === 'scanner') {
                CodeGenerator.clearOutput();
                QRScanner.startScanner(); 
            }
        });
    });

    // --- 3.4 Navigasi Tab Jenis Kode (QR/Barcode) ---
    codeTabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const targetCode = event.currentTarget.dataset.codeType;
            activeCodeType = targetCode;

            codeTabButtons.forEach(btn => btn.classList.remove('active'));
            event.currentTarget.classList.add('active');

            generatorContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`generator-${targetCode}`).classList.add('active');
            
            // ⭐ LOGIKA TAMBAHAN: Atur visibilitas input logo berdasarkan jenis kode
            if (targetCode === 'qr') {
                logoControlSection.style.display = 'block'; // Tampilkan saat QR Code
            } else {
                logoControlSection.style.display = 'none'; // Sembunyikan saat Barcode
            }

            CodeGenerator.clearOutput();
            
            if (targetCode === 'qr') qrInputText.focus();
            else barcodeInputText.focus();
        });
    });

    // --- 3.5 Navigasi Sub-Tab QR (Teks/Gambar) (Tetap) ---
    subTabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const targetInput = event.currentTarget.dataset.input; 
            activeInputType = targetInput;

            subTabButtons.forEach(btn => btn.classList.remove('active'));
            event.currentTarget.classList.add('active');

            inputContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`input-${targetInput}`).classList.add('active');

            CodeGenerator.clearOutput();
            if (targetInput === 'text') qrInputText.focus();
        });
    });
    
    // --- 3.6 Logika Kontrol Desain (Membuat kode reaktif) (Tambahkan logo check) ---
    const designInputs = [qrColorInput, qrSizeInput, qrMarginInput, barcodeFormat, barcodeInputText];
    designInputs.forEach(input => {
        input.addEventListener('change', () => {
            // Validasi ukuran dan margin
            if (input === qrSizeInput) {
                let size = parseInt(qrSizeInput.value) || 256;
                qrSizeInput.value = Math.max(100, Math.min(500, size));
            }
            if (input === qrMarginInput) {
                let margin = parseInt(qrMarginInput.value) || 4;
                qrMarginInput.value = Math.max(0, Math.min(20, margin));
            }
            
            // Regenerate jika kode sudah ada (dengan pengecekan yang lebih baik)
            const isCodeDisplayed = qrCodeOutput.querySelector('canvas') || qrCodeOutput.querySelector('svg');

            if (isCodeDisplayed) {
                CodeGenerator.generateCode();
            }
        });
    });
}

// Jalankan inisiasi setelah seluruh DOM dimuat
document.addEventListener('DOMContentLoaded', initEventListeners);
