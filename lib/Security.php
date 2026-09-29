<?php
/**
 * Security Helper - Fungsi keamanan untuk Xmans Chatbot
 * 
 * Berisi: Rate Limiter, CSRF Token, Input Sanitizer, Security Headers
 */

class Security
{
    private static string $rateLimitDir = __DIR__ . '/../storage/rate_limits';

    /**
     * Terapkan HTTP security headers
     */
    public static function applySecurityHeaders(string $allowedOrigins = '*'): void
    {
        // Hanya izinkan origin yang dikonfigurasi
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = array_map('trim', explode(',', $allowedOrigins));

        if (in_array($origin, $allowed, true)) {
            header("Access-Control-Allow-Origin: {$origin}");
        } elseif (in_array('*', $allowed, true)) {
            header('Access-Control-Allow-Origin: *');
        }

        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header("Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data:; font-src 'self' https://cdnjs.cloudflare.com;");
    }

    /**
     * Rate Limiter berbasis file (tanpa database/Redis)
     * 
     * @param int $maxRequests Maksimal request
     * @param int $windowSeconds Jendela waktu dalam detik
     * @return bool true jika masih diizinkan, false jika rate limit terlampaui
     */
    public static function checkRateLimit(int $maxRequests = 20, int $windowSeconds = 60): bool
    {
        if (!is_dir(self::$rateLimitDir)) {
            mkdir(self::$rateLimitDir, 0755, true);
        }

        $ip = self::getClientIp();
        $hash = md5($ip);
        $file = self::$rateLimitDir . "/{$hash}.json";

        $now = time();
        $data = ['requests' => [], 'blocked_until' => 0];

        if (file_exists($file)) {
            $content = file_get_contents($file);
            $data = json_decode($content, true) ?: $data;
        }

        // Cek apakah IP sedang diblokir
        if ($data['blocked_until'] > $now) {
            return false;
        }

        // Bersihkan request yang sudah expired
        $data['requests'] = array_filter($data['requests'], function ($timestamp) use ($now, $windowSeconds) {
            return ($now - $timestamp) < $windowSeconds;
        });

        // Cek apakah melebihi batas
        if (count($data['requests']) >= $maxRequests) {
            // Blokir selama 1 menit tambahan jika terus-terusan spam
            $data['blocked_until'] = $now + $windowSeconds;
            file_put_contents($file, json_encode($data), LOCK_EX);
            return false;
        }

        // Tambahkan request baru
        $data['requests'][] = $now;
        file_put_contents($file, json_encode($data), LOCK_EX);

        return true;
    }

    /**
     * Dapatkan informasi sisa rate limit
     */
    public static function getRateLimitInfo(int $maxRequests = 20, int $windowSeconds = 60): array
    {
        $ip = self::getClientIp();
        $hash = md5($ip);
        $file = self::$rateLimitDir . "/{$hash}.json";

        $now = time();
        $data = ['requests' => [], 'blocked_until' => 0];

        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true) ?: $data;
        }

        $recentRequests = array_filter($data['requests'], function ($ts) use ($now, $windowSeconds) {
            return ($now - $ts) < $windowSeconds;
        });

        return [
            'remaining' => max(0, $maxRequests - count($recentRequests)),
            'limit'     => $maxRequests,
            'reset'     => $windowSeconds
        ];
    }

    /**
     * Generate CSRF token dan simpan ke session
     */
    public static function generateCsrfToken(): string
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;
        $_SESSION['csrf_token_time'] = time();

        return $token;
    }

    /**
     * Validasi CSRF token
     * 
     * @param string $token Token dari request
     * @param int $maxAge Masa berlaku token dalam detik (default: 1 jam)
     */
    public static function validateCsrfToken(string $token, int $maxAge = 3600): bool
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (empty($_SESSION['csrf_token']) || empty($token)) {
            return false;
        }

        // Cek apakah token expired
        $tokenTime = $_SESSION['csrf_token_time'] ?? 0;
        if ((time() - $tokenTime) > $maxAge) {
            unset($_SESSION['csrf_token'], $_SESSION['csrf_token_time']);
            return false;
        }

        return hash_equals($_SESSION['csrf_token'], $token);
    }

    /**
     * Sanitasi input string
     */
    public static function sanitizeInput(string $input): string
    {
        $input = trim($input);
        $input = stripslashes($input);
        // Tidak menggunakan htmlspecialchars karena kita butuh Markdown
        // Tapi pastikan tidak ada null bytes
        $input = str_replace("\0", '', $input);
        return $input;
    }

    /**
     * Validasi format API Key Gemini
     */
    public static function isValidApiKeyFormat(string $key): bool
    {
        $key = trim($key);
        // API Key Gemini biasanya dimulai dengan AIzaSy atau format tertentu
        // Minimal 20 karakter, hanya alfanumerik dan beberapa karakter khusus
        return strlen($key) >= 20 && preg_match('/^[A-Za-z0-9._\-]+$/', $key);
    }

    /**
     * Dapatkan IP klien dengan mempertimbangkan proxy
     */
    private static function getClientIp(): string
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',  // Cloudflare
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR'
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = $_SERVER[$header];
                // Ambil IP pertama jika ada beberapa (X-Forwarded-For)
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return '0.0.0.0';
    }

    /**
     * Bersihkan file rate limit yang sudah expired (panggil berkala/cron)
     */
    public static function cleanupRateLimitFiles(int $maxAge = 3600): void
    {
        if (!is_dir(self::$rateLimitDir)) return;

        $files = glob(self::$rateLimitDir . '/*.json');
        $now = time();

        foreach ($files as $file) {
            if (($now - filemtime($file)) > $maxAge) {
                @unlink($file);
            }
        }
    }
}
