<?php
/**
 * Konfigurasi Chatbot Gemini AI
 * 
 * Anda dapat memasukkan GEMINI_API_KEY di sini jika ingin menggunakan API key dari sisi server.
 * Atau biarkan kosong jika ingin memasukkan API Key langsung melalui antarmuka web (UI Settings).
 * Dapatkan API Key gratis di: https://aistudio.google.com/app/apikey
 */

return [
    'gemini_api_key' => '', // Masukkan API Key Anda di sini jika diinginkan
    'default_model'  => 'gemini-3.7-flash', // Model rekomendasi: gemini-3.7-flash, gemini-2.5-flash, gemini-2.5-pro
    'system_prompt'  => 'Kamu adalah asisten AI yang ramah, sopan, cerdas, dan selalu siap membantu dalam bahasa Indonesia dengan penjelasan yang jelas dan mudah dipahami.'
];
