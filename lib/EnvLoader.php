<?php
/**
 * EnvLoader - Parser .env sederhana untuk PHP (tanpa library eksternal)
 * 
 * Membaca file .env dan mengisi $_ENV serta putenv().
 * Mendukung komentar (#), string tanpa quote, dan baris kosong.
 */

class EnvLoader
{
    /**
     * Muat file .env ke environment PHP
     * 
     * @param string $path Path ke file .env
     * @throws RuntimeException Jika file tidak ditemukan
     */
    public static function load(string $path): void
    {
        if (!file_exists($path)) {
            throw new RuntimeException("File .env tidak ditemukan: {$path}");
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            $line = trim($line);

            // Lewati komentar dan baris kosong
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            // Parse KEY=VALUE
            $eqPos = strpos($line, '=');
            if ($eqPos === false) {
                continue;
            }

            $key   = trim(substr($line, 0, $eqPos));
            $value = trim(substr($line, $eqPos + 1));

            // Hapus kutip di sekitar value jika ada
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            // Set ke environment
            $_ENV[$key] = $value;
            putenv("{$key}={$value}");
        }
    }

    /**
     * Ambil nilai environment variable dengan default fallback
     * 
     * @param string $key Nama variabel
     * @param mixed $default Nilai default jika tidak ditemukan
     * @return mixed
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        return $_ENV[$key] ?? getenv($key) ?: $default;
    }

    /**
     * Ambil nilai environment sebagai boolean
     */
    public static function getBool(string $key, bool $default = false): bool
    {
        $value = self::get($key);
        if ($value === null) return $default;
        return in_array(strtolower((string)$value), ['true', '1', 'yes', 'on'], true);
    }

    /**
     * Ambil nilai environment sebagai integer
     */
    public static function getInt(string $key, int $default = 0): int
    {
        $value = self::get($key);
        return $value !== null ? (int)$value : $default;
    }
}
