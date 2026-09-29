<?php
/**
 * Backend Proxy API untuk Xmans Gemini AI Chatbot
 * Dilengkapi dengan:
 * - Smart Auto-Fallback & Retry saat model sedang mengalami High Demand / Overloaded.
 * - Rate Limiting per IP
 * - CSRF Protection
 * - Security Headers
 * - Input Validation & Sanitization
 */

// Muat konfigurasi dan library keamanan
$config = [];
if (file_exists(__DIR__ . '/../config.php')) {
    $config = require __DIR__ . '/../config.php';
}
require_once __DIR__ . '/../lib/Security.php';

// ============================================================
// Security Headers
// ============================================================
$allowedOrigins = $config['allowed_origins'] ?? '*';
Security::applySecurityHeaders($allowedOrigins);

header('Content-Type: application/json; charset=utf-8');

// ============================================================
// Preflight CORS
// ============================================================
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================================
// Hanya izinkan POST
// ============================================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metode HTTP tidak diizinkan. Gunakan POST.']);
    exit;
}

// ============================================================
// Rate Limiting
// ============================================================
$rateLimitMax    = $config['rate_limit_requests'] ?? 20;
$rateLimitWindow = $config['rate_limit_window'] ?? 60;

if (!Security::checkRateLimit($rateLimitMax, $rateLimitWindow)) {
    http_response_code(429);
    $info = Security::getRateLimitInfo($rateLimitMax, $rateLimitWindow);
    echo json_encode([
        'error'   => 'Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba lagi.',
        'code'    => 429,
        'retry_after' => $info['reset']
    ]);
    exit;
}

// Tambahkan rate limit headers
$rateLimitInfo = Security::getRateLimitInfo($rateLimitMax, $rateLimitWindow);
header("X-RateLimit-Limit: {$rateLimitInfo['limit']}");
header("X-RateLimit-Remaining: {$rateLimitInfo['remaining']}");

// ============================================================
// Parse & Validasi Input
// ============================================================
$rawInput = file_get_contents('php://input');

// Cek ukuran payload (maks 2MB untuk mencegah abuse)
if (strlen($rawInput) > 2 * 1024 * 1024) {
    http_response_code(413);
    echo json_encode(['error' => 'Ukuran payload terlalu besar. Maksimal 2MB.']);
    exit;
}

$inputData = json_decode($rawInput, true);

if (!$inputData) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload JSON tidak valid.']);
    exit;
}

// ============================================================
// Tentukan API Key (server .env priority > client input)
// ============================================================
$serverApiKey = !empty($config['gemini_api_key']) ? trim($config['gemini_api_key']) : '';
$clientApiKey = !empty($inputData['apiKey']) ? trim($inputData['apiKey']) : '';

// Prioritas: server .env > client input
$apiKey = $serverApiKey ?: $clientApiKey;

if (empty($apiKey)) {
    http_response_code(400);
    echo json_encode([
        'error'   => 'API Key Gemini belum diatur!',
        'details' => 'Silakan masukkan API Key di menu Pengaturan (ikon gerigi) pada antarmuka web, atau di file .env pada server.'
    ]);
    exit;
}

// Validasi format API key
if (!Security::isValidApiKeyFormat($apiKey)) {
    http_response_code(400);
    echo json_encode(['error' => 'Format API Key tidak valid.']);
    exit;
}

// ============================================================
// Validasi & Sanitasi Data Chat
// ============================================================
$primaryModel = !empty($inputData['model']) ? Security::sanitizeInput($inputData['model']) : ($config['default_model'] ?? 'gemini-3.7-flash');

// Whitelist model yang diperbolehkan
$allowedModels = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'];
if (!in_array($primaryModel, $allowedModels, true)) {
    $primaryModel = 'gemini-3.7-flash';
}

$contents = $inputData['contents'] ?? [];
if (empty($contents) || !is_array($contents)) {
    http_response_code(400);
    echo json_encode(['error' => 'Pesan percakapan tidak boleh kosong.']);
    exit;
}

// Batasi jumlah pesan dalam satu request (mencegah abuse)
$maxMessages = 50;
if (count($contents) > $maxMessages) {
    $contents = array_slice($contents, -$maxMessages);
}

$systemInstructionText = !empty($inputData['systemInstruction']) 
    ? Security::sanitizeInput($inputData['systemInstruction']) 
    : ($config['system_prompt'] ?? '');

// Batasi panjang system instruction (maks 2000 karakter)
if (strlen($systemInstructionText) > 2000) {
    $systemInstructionText = substr($systemInstructionText, 0, 2000);
}

$temperature = isset($inputData['temperature']) ? floatval($inputData['temperature']) : ($config['default_temperature'] ?? 0.7);
$temperature = max(0.0, min(1.0, $temperature)); // Clamp antara 0.0 - 1.0

$maxOutputTokens = $config['max_output_tokens'] ?? 4096;

// ============================================================
// Siapkan Payload untuk Gemini REST API
// ============================================================
$payload = [
    'contents' => $contents,
    'generationConfig' => [
        'temperature'    => $temperature,
        'maxOutputTokens' => $maxOutputTokens
    ]
];

if (!empty($systemInstructionText)) {
    $payload['systemInstruction'] = [
        'parts' => [
            ['text' => $systemInstructionText]
        ]
    ];
}

// ============================================================
// Model Fallback Chain
// ============================================================
$modelChain = [$primaryModel];
$fallbackCandidates = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'];
foreach ($fallbackCandidates as $fc) {
    if (!in_array($fc, $modelChain)) {
        $modelChain[] = $fc;
    }
}

// ============================================================
// Fungsi Pemanggil Gemini API
// ============================================================
function executeGeminiCall($model, $apiKey, $payload, $verifySsl = false) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-goog-api-key: ' . $apiKey
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 40);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

    // SSL Verification
    if ($verifySsl) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    } else {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }

    // Cegah redirect abuse
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    return [
        'httpCode' => $httpCode,
        'response' => $response,
        'error'    => $curlError
    ];
}

// ============================================================
// Eksekusi dengan Fallback Chain
// ============================================================
$verifySsl = $config['curl_verify_ssl'] ?? false;
$lastError = null;
$lastHttpCode = 500;
$successfulReply = null;
$usedModel = $primaryModel;

foreach ($modelChain as $currentModel) {
    $res = executeGeminiCall($currentModel, $apiKey, $payload, $verifySsl);

    if ($res['error']) {
        $lastError = 'Koneksi jaringan gagal: ' . $res['error'];
        continue;
    }

    $result = json_decode($res['response'], true);
    $httpCode = $res['httpCode'];

    // Sukses
    if ($httpCode === 200 && !empty($result['candidates'][0]['content']['parts'])) {
        $replyText = '';
        foreach ($result['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['text'])) {
                $replyText .= $part['text'];
            }
        }

        if (!empty(trim($replyText))) {
            $successfulReply = $replyText;
            $usedModel = $currentModel;
            break;
        }
    }

    // Error handling
    $errMsg = $result['error']['message'] ?? '';
    $lastError = $errMsg ?: "Gagal mendapatkan respon dari {$currentModel}";
    $lastHttpCode = $httpCode;

    // Cek apakah error karena High Demand (503 / 429) atau Overloaded
    $isTemporaryBusy = (
        $httpCode === 503 || 
        $httpCode === 429 || 
        stripos($errMsg, 'high demand') !== false || 
        stripos($errMsg, 'overloaded') !== false || 
        stripos($errMsg, 'RESOURCE_EXHAUSTED') !== false || 
        stripos($errMsg, 'UNAVAILABLE') !== false
    );

    if ($isTemporaryBusy) {
        usleep(400000); // 400ms delay sebelum fallback
        continue;
    } elseif ($httpCode === 400 && stripos($errMsg, 'API_KEY_INVALID') !== false) {
        break; // API Key tidak valid, hentikan
    }
}

// ============================================================
// Response
// ============================================================
if ($successfulReply !== null) {
    echo json_encode([
        'success'      => true,
        'reply'        => $successfulReply,
        'model'        => $usedModel,
        'fallbackUsed' => ($usedModel !== $primaryModel)
    ]);
    exit;
}

// Semua model gagal
http_response_code($lastHttpCode ?: 500);
echo json_encode([
    'error' => $lastError ?: 'Server AI sedang dalam beban tinggi. Silakan ulangi beberapa saat lagi.',
    'code'  => $lastHttpCode
]);
