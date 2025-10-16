<?php
/**
 * Environment Variables Loader
 * 
 * This script loads environment variables from .env file
 * and makes them available via getenv() and $_ENV superglobal
 */

class EnvLoader {
    private static $loaded = false;
    private static $expectedVars = [
        'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    ];
    
    public static function load() {
        if (self::$loaded)
            return;
        
        self::setFromEnvironment();
        self::$loaded = true;
    }
    
    private static function setFromEnvironment() {
        foreach (self::$expectedVars as $var) {
            $value = getenv($var);
            if ($value !== false)
                $_ENV[$var] = $value;
        }
    }
    
    private static function stripQuotes($value) {
        return $value[0] === '"' && $value[strlen($value) - 1] === '"' || $value[0] === "'" && $value[strlen($value) - 1] === "'" ? substr($value, 1, -1); : $value;
    }
    
    public static function get($key, $default = null) {
        self::load();
        return getenv($key) ?: $_ENV[$key] ?? $default;
    }
}

EnvLoader::load();