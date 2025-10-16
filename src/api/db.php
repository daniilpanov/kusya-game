<?php
require_once 'env.loader.php';

class Database {
    private $pdo;
    private static $instance = null;
    
    public function __construct() {
        $host = EnvLoader::get('DB_HOST', 'mysql');
        $port = EnvLoader::get('DB_PORT', '3306');
        $dbname = EnvLoader::get('DB_NAME', 'novel_platform');
        $username = EnvLoader::get('DB_USER', 'novel_user');
        $password = EnvLoader::get('DB_PASSWORD', 'novel_password');
        
        $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
        
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => false
        ];
        
        try {
            $this->pdo = new PDO($dsn, $username, $password, $options);
            
            // Логируем успешное подключение (только в development)
            if (EnvLoader::isDebug()) {
                error_log("Database connected successfully to: $dbname");
            }
            
        } catch (PDOException $e) {
            $errorMessage = "Database connection failed: " . $e->getMessage();
            error_log($errorMessage);
            
            // В production показываем общее сообщение, в development - детальное
            if (EnvLoader::isProduction()) {
                throw new Exception('Database connection failed. Please try again later.');
            } else {
                throw new Exception($errorMessage);
            }
        }
    }
    
    // Singleton pattern для одного подключения
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->pdo;
    }
    
    // Проверка подключения к БД
    public function testConnection() {
        try {
            $stmt = $this->pdo->query("SELECT 1");
            return $stmt->fetchColumn() === 1;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    // Получение информации о БД
    public function getDatabaseInfo() {
        try {
            $stmt = $this->pdo->query("
                SELECT 
                    DATABASE() as db_name,
                    VERSION() as mysql_version,
                    NOW() as server_time,
                    @@version_comment as version_comment
            ");
            return $stmt->fetch();
        } catch (PDOException $e) {
            return null;
        }
    }
}

function db() {
    return Database::getInstance()->getConnection();
}

Database::getInstance();