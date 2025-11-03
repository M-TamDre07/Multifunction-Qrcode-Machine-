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
    
    // ⭐ ELEMEN LOGO (BARU)
    qrInputLogo: document.getElementById('qr-input-logo'),
    logoFileNameDisplay: document.getElementById('logo-file-name-display'),
    
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
    logoFileNameDisplay, barcodeInputText, barcodeFormat, 
    tabButtons, contentAreas, codeTabButtons, generatorContents, subTabButtons, 
    inputContents, scannerFeed 
} = elements;


// Status Global
let qrcodeInstance = null;
let html5QrcodeScanner = null;
let activeInputType = 'text'; 
let activeCodeType = 'qr';    
let imageDataBase64 = null; // Data untuk Gambar di QR Code
let logoDataBase64 = null; // Data Logo di tengah QR Code

// ⬆️ PENINGKATAN MAKSIMAL UKURAN FILE:
const MAX_SIZE_BYTES_QR_DATA = 200 * 1024; // 200 KB (Ditingkatkan dari 50 KB)
const MAX_SIZE_BYTES_LOGO = 500 * 1024;   // 500 KB (Ditingkatkan dari 100 KB)

// =================================================================
// 1. MODUL: GENERATOR (QR & BARCODE)
// =================================================================

const CodeGenerator = (function() {

    function clearOutput(message = 'Kode Anda akan muncul di sini.') {
        // Hapus SEMUA elemen anak, termasuk logo dan canvas/svg
        while (qrCodeOutput.firstChild) {
            qrCodeOutput.removeChild(qrCodeOutput.firstChild);
        }
        
        // Tambahkan kembali pesan placeholder
        const placeholder = document.createElement('p');
        placeholder.textContent = message;
        placeholder.style.textAlign = 'center';
        placeholder.style.color = '#6c757d';
        qrCodeOutput.appendChild(placeholder);
        
        downloadBtn.style.display = 'none';
        downloadBtn.disabled = true;
        qrcodeInstance = null; 
    }

    // --- LOGIKA ASYNC FILE TO BASE64 (Ditingkatkan) ---

    /**
     * Mengonversi berkas menjadi string Base64 dengan validasi ukuran.
     * @param {File} file - Objek file.
     * @param {number} maxSize - Ukuran maksimal (bytes).
     * @param {HTMLElement} displayElement - Elemen untuk menampilkan nama file/status.
     * @param {string} type - 'data' atau 'logo' untuk pesan kesalahan.
     */
    async function fileToBase64(file, maxSize, displayElement, type) {
        return new Promise((resolve, reject) => {
            const typeName = type === 'data' ? 'Gambar Data' : 'Logo';
            if (file.size > maxSize) {
                const maxSizeKB = (maxSize / 1024).toFixed(0);
                alert(`⚠️ Ukuran ${typeName} terlalu besar (${(file.size / 1024).toFixed(1)} KB). Maksimal adalah ${maxSizeKB} KB.`);
                displayElement.textContent = `Batasan ukuran (${maxSizeKB} KB) dilampaui. Pilih file yang lebih kecil.`;
                reject(new Error("File too large"));
                return;
            }

            const reader = new FileReader();
            
            reader.onloadstart = () => {
                displayElement.textContent = `Memproses... ${(file.size / 1024).toFixed(1)} KB.`;
                generateBtn.disabled = true;
            };

            reader.onload = () => {
                const base64String = reader.result;
                displayElement.textContent = `${typeName} Terpilih: ${file.name}`; 
                generateBtn.disabled = false;
                resolve(base64String);
            };

            reader.onerror = (error) => {
                console.error("Gagal membaca file:", error);
                displayElement.textContent = `Gagal memproses ${typeName} (${file.name}).`;
                generateBtn.disabled = false;
                reject(error);
            };

            reader.readAsDataURL(file);
        });
    }

    // --- QR CODE LOGIC (Ditingkatkan) ---

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
        
        // Elemen kontainer untuk QR Code dan Logo
        const qrContainer = document.createElement('div');
        qrContainer.classList.add('qr-code-container'); // Tambahkan class untuk styling/penempatan logo
        qrCodeOutput.appendChild(qrContainer);

        // Elemen Div tempat QR Code akan dirender
        const tempDiv = document.createElement('div');
        qrContainer.appendChild(tempDiv);

        qrcodeInstance = new QRCode(tempDiv, {
            text: dataToEncode, 
            width: size,
            height: size,
            colorDark: color,
            colorLight: "#ffffff",
            // ⭐️ PENTING: Level Error Correction Tinggi (H) agar mudah discan oleh Google Lens, 
            // terutama saat ada logo yang menutupi bagian tengah.
            correctLevel: QRCode.CorrectLevel.H, 
            margin: margin 
        });

        // ⭐️ LOGIKA LOGO BARU
        if (logoDataBase64) {
            // Gunakan setTimeout untuk memastikan canvas sudah dirender sepenuhnya
            setTimeout(() => {
                const logo = document.createElement('img');
                logo.src = logoDataBase64;
                logo.classList.add('qr-logo');
                
                // Hitung ukuran logo (misalnya 25% dari ukuran QR Code)
                const logoSize = size * 0.25; // Sedikit lebih besar
                logo.style.width = `${logoSize}px`;
                logo.style.height = `${logoSize}px`;
                
                // Tambahkan logo ke container
                qrContainer.appendChild(logo);
            }, 100); 
        }

        // Aktivasi Download
        setTimeout(() => {
            downloadBtn.textContent = logoDataBase64 
                ? '⚠️ Unduh QR (Tanpa Logo)'
                : '📥 Unduh QR Code (.png)';
            downloadBtn.style.display = 'block';
            downloadBtn.disabled = false;
        }, 200); // Waktu yang cukup untuk merender
    }

    // --- BARCODE LOGIC (Perbaikan validasi) ---

    function validateBarcodeData(data, format) {
        if (!data) {
            alert("Mohon masukkan data untuk Barcode.");
            return false;
        }
        
        // Perbaikan validasi EAN13: 12 digit input + 1 digit checksum (dihitung oleh JsBarcode)
        if (format === 'EAN13' && !/^\d{12}$/.test(data)) {
            alert("EAN13 membutuhkan tepat 12 digit numerik (digit ke-13 akan dihitung otomatis).");
            return false;
        }

        if (format === 'UPC' && !/^\d{11}$/.test(data)) {
            alert("UPC membutuhkan tepat 11 digit numerik (digit ke-12 akan dihitung otomatis).");
            return false;
        }
        
        // Tambahkan validasi dasar untuk Code128, yang paling umum
        if (format === 'CODE128' && data.length < 1) {
            alert("CODE128 membutuhkan setidaknya 1 karakter.");
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

        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.id = "barcode-svg-output";

        qrCodeOutput.appendChild(svgElement);

        try {
            // Lebar diatur agar sesuai kontainer, dan tinggi disesuaikan
            JsBarcode("#barcode-svg-output", dataToEncode, {
                format: format,
                displayValue: true,
                text: dataToEncode,
                lineColor: color,
                width: 2, // Lebar batang
                height: Math.floor(size / 2), // Tinggi batang
                margin: margin
            });

            downloadBtn.textContent = '📥 Unduh Barcode (.svg)';
            downloadBtn.style.display = 'block';
            downloadBtn.disabled = false;

        } catch (error) {
            console.error("Gagal membuat Barcode:", error);
            clearOutput(`❌ Kesalahan: Format Barcode "${format}" tidak dapat mengolah data yang Anda masukkan. Pastikan data Anda valid.`);
        }
    }

    // --- DOWNLOAD LOGIC (Universal) ---

    function downloadCode() {
        if (activeCodeType === 'qr') {
            const canvas = qrCodeOutput.querySelector('canvas');
            if (canvas) {
                // Peringatan ini harus tetap ada karena logo tidak ikut terunduh dalam PNG ini.
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
            // Logika Barcode SVG sudah baik
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
        clearOutput,
        generateCode,
        downloadCode
    };
})();


// =================================================================
// 2. MODUL: QR CODE SCANNER (INTEGRASI HTML5-QRCODE)
// =================================================================
// (Tidak ada perubahan signifikan pada scanner, logika sudah cukup baik)
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
        stopScanner(false); // Jangan bersihkan output saat restart
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
 * Logika navigasi Tab Utama.
 * @param {string} type - 'generator' atau 'scanner'.
 */
function handleMainTab(type) {
    // Navigasi Tab Utama
    contentAreas.forEach(area => area.style.display = 'none');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    const activeArea = document.getElementById(`${type}-content`);
    if (activeArea) {
        activeArea.style.display = 'block';
    }
    const activeButton = Array.from(tabButtons).find(btn => btn.dataset.tab === type);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Kelola Scanner
    if (type === 'scanner') {
        QRScanner.startScanner();
        CodeGenerator.clearOutput('Beralih ke Pemindai.');
        downloadBtn.style.display = 'none';
    } else {
        QRScanner.stopScanner();
    }
}

/**
 * Logika navigasi Code Type (QR/Barcode) & Sub-Tab Input.
 * @param {string} type - 'qr' atau 'barcode'.
 */
function handleCodeTab(type) {
    activeCodeType = type;

    // Navigasi Code Type
    generatorContents.forEach(content => content.style.display = 'none');
    codeTabButtons.forEach(btn => btn.classList.remove('active'));

    const activeContent = document.getElementById(`${type}-generator-content`);
    if (activeContent) activeContent.style.display = 'block';
    const activeButton = Array.from(codeTabButtons).find(btn => btn.dataset.codeType === type);
    if (activeButton) activeButton.classList.add('active');

    // Tampilkan/Sembunyikan Kontrol Logo (Hanya untuk QR)
    const logoControlSection = document.querySelector('.logo-control-section'); // Asumsi ada class ini di HTML
    if (logoControlSection) {
         logoControlSection.style.display = type === 'qr' ? 'block' : 'none';
    }
    
    // Defaultkan ke 'text' saat beralih ke QR
    if (type === 'qr') {
        handleSubTab('text');
    } else {
        // Bersihkan output saat beralih tipe
        CodeGenerator.clearOutput();
    }
}

/**
 * Logika navigasi Sub-Tab Input (Text/Image).
 * @param {string} type - 'text' atau 'image'.
 */
function handleSubTab(type) {
    activeInputType = type;

    // Navigasi Sub-Tab
    inputContents.forEach(content => content.style.display = 'none');
    subTabButtons.forEach(btn => btn.classList.remove('active'));

    const activeContent = document.getElementById(`qr-${type}-input`);
    if (activeContent) activeContent.style.display = 'block';
    const activeButton = Array.from(subTabButtons).find(btn => btn.dataset.inputType === type);
    if (activeButton) activeButton.classList.add('active');
    
    // Kelola Logo Control: hanya tampil saat input adalah Teks (karena Image Data sudah Base64)
    const logoControlSection = document.querySelector('.logo-control-section'); 
    if (logoControlSection) {
        // Tampilkan logo control di sub-tab text, sembunyikan di sub-tab image
        logoControlSection.style.display = type === 'text' ? 'block' : 'none';
    }
    
    // Clear/Regenerate
    CodeGenerator.clearOutput();
}


/**
 * Menginisialisasi semua event listener setelah DOM dimuat.
 */
function initEventListeners() {
    
    // --- 3.1 Event Listener Generator & Download ---
    generateBtn.addEventListener('click', CodeGenerator.generateCode);
    downloadBtn.addEventListener('click', CodeGenerator.downloadCode);
    
    // ... Event Listener Keyup (sama seperti sebelumnya) ...
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

    // --- 3.2 Logika Input Gambar Data QR (Async) (DITINGKATKAN) ---
    qrInputImage.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                // Gunakan fungsi fileToBase64 yang ditingkatkan
                imageDataBase64 = await CodeGenerator.fileToBase64(file, MAX_SIZE_BYTES_QR_DATA, fileNameDisplay, 'data'); 
                if (imageDataBase64) CodeGenerator.generateQR(); 
            } catch (error) {
                // Reset state
                qrInputImage.value = "";
                imageDataBase64 = null;
                CodeGenerator.clearOutput();
            }
        } else {
            fileNameDisplay.textContent = "Belum ada file dipilih.";
            imageDataBase64 = null;
            CodeGenerator.clearOutput();
        }
    });
    
    // --- LOGIKA INPUT LOGO KUSTOM (Async) (DITINGKATKAN) ---
    qrInputLogo.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                // Gunakan fungsi fileToBase64 yang ditingkatkan
                logoDataBase64 = await CodeGenerator.fileToBase64(file, MAX_SIZE_BYTES_LOGO, logoFileNameDisplay, 'logo'); 
                
                // Jika QR Code sudah ditampilkan, generate ulang untuk menampilkan logo
                const isCodeDisplayed = qrCodeOutput.querySelector('canvas');
                if (isCodeDisplayed) {
                    CodeGenerator.generateQR(); 
                }
            } catch (error) {
                // Reset state
                qrInputLogo.value = "";
                logoDataBase64 = null;
                // Jika kode sedang tampil, generate ulang agar logo hilang
                const isCodeDisplayed = qrCodeOutput.querySelector('canvas');
                if (isCodeDisplayed) {
                    CodeGenerator.generateQR(); 
                }
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

    // --- 3.3 Navigasi Tab Listener ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => handleMainTab(button.dataset.tab));
    });
    codeTabButtons.forEach(button => {
        button.addEventListener('click', () => handleCodeTab(button.dataset.codeType));
    });
    subTabButtons.forEach(button => {
        button.addEventListener('click', () => handleSubTab(button.dataset.inputType));
    });
    
    // 3.4 Event Listener Perubahan Desain
    [qrSizeInput, qrColorInput, qrMarginInput, barcodeFormat].forEach(input => {
        input.addEventListener('change', () => {
            
            // Perbaikan: Tambahkan validasi min/max saat mengubah ukuran/margin
            if (input === qrSizeInput) {
                let size = parseInt(qrSizeInput.value) || 256;
                qrSizeInput.value = Math.max(100, Math.min(500, size));
            }
            if (input === qrMarginInput) {
                let margin = parseInt(qrMarginInput.value) || 4;
                qrMarginInput.value = Math.max(0, Math.min(20, margin));
            }
            
            // Regenerate jika kode sudah ada
            const isCodeDisplayed = qrCodeOutput.querySelector('canvas') || qrCodeOutput.querySelector('svg');

            if (isCodeDisplayed) {
                CodeGenerator.generateCode();
            }
        });
    });

    // Inisiasi awal: Pastikan tab pertama aktif
    handleMainTab('generator'); 
    handleCodeTab('qr');
    handleSubTab('text');
}

// Jalankan inisiasi setelah seluruh DOM dimuat
document.addEventListener('DOMContentLoaded', initEventListeners);
