# 🤖 Xmans - Asisten AI Cerdas & Ramah

Aplikasi chatbot modern, interaktif, dan ramah pengguna (*user-friendly*) yang ditenagai oleh **Google Gemini API** (`gemini-3.7-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`).

---

## ✨ Fitur Unggulan

- 🎨 **Tampilan Elegan & Ramah (*Friendly UI*)**:
  - Desain modern Glassmorphism dengan warna yang nyaman di mata.
  - Pilihan **Dark Mode (Tema Gelap)** dan **Light Mode (Tema Terang)**.
  - Kartu rekomendasi topik interaktif di layar sambutan (*Welcome Screen*).
  - Tampilan responsif (sangat nyaman dibuka di Laptop, Tablet, maupun HP/Smartphone).

- 🧠 **Didukung Google Gemini Model Mutakhir**:
  - `gemini-3.7-flash` (Rekomendasi default: cepat, responsif, dan cerdas).
  - `gemini-2.5-flash` & `gemini-2.5-pro`.
  - Multimodal: **Mendukung unggah foto/gambar** untuk dianalisis oleh AI.

- 🎤 **Fitur Suara & Audio**:
  - **Speech-to-Text (Input Suara)**: Tekan ikon mikrofon untuk berbicara langsung tanpa mengetik.
  - **Text-to-Speech (Membaca Suara)**: Tekan tombol "Baca" pada pesan bot untuk mendengarkan jawabannya.

- 💬 **Manajemen Multi-Chat & Penyimpanan Riwayat**:
  - Percakapan tersimpan rapi di browser (LocalStorage).
  - Dukungan membuat obrolan baru (*New Chat*), berpindah topik percakapan, dan menghapus riwayat.
  - Fitur **Export Percakapan** ke file Markdown (`.md`).

- 📝 **Markdown & Code Syntax Highlighting**:
  - Format teks rapi (tabel, daftar, kutipan, tebal, miring).
  - Blok kode pemrograman dengan tombol **Salin Kode** dalam satu klik.

---

## 🚀 Cara Menjalankan Aplikasi

### Opsi 1: Menggunakan XAMPP (Apache)
1. Buka aplikasi **XAMPP Control Panel**.
2. Klik tombol **Start** pada modul **Apache**.
3. Buka browser (Chrome / Edge / Firefox) dan akses:
   ```
   http://localhost/chatboot
   ```

### Opsi 2: Menggunakan PHP Built-in Server
1. Buka Terminal / Command Prompt / PowerShell di folder ini (`c:\xampp\htdocs\chatboot`).
2. Jalankan perintah:
   ```bash
   php -S localhost:8000
   ```
3. Buka browser dan akses `http://localhost:8000`.

---

## 🔑 Cara Mendapatkan & Mengatur Gemini API Key

1. Buka [Google AI Studio (API Keys)](https://aistudio.google.com/app/apikey).
2. Masuk dengan akun Google Anda dan klik **"Create API Key"**.
3. Salin API Key yang diberikan (diawali dengan `AIzaSy...`).
4. Pada aplikasi Chatbot:
   - Klik ikon **Pengaturan (⚙️)** di pojok kanan atas.
   - Tempelkan API Key pada kolom **Gemini API Key**.
   - Klik tombol **"Uji Koneksi"** untuk memastikan API Key aktif, lalu klik **"Simpan Pengaturan"**.

> 💡 *Opsional*: Anda juga dapat memasukkan API Key secara permanen di file `config.php` dengan menyalin `config.example.php` menjadi `config.php`.
