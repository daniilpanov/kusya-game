<?php
// Router for the PHP built-in dev server (mirrors the .htaccess rewrite rules):
//   php -S localhost:8080 router.php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('#^/api/games/?$#', $uri) || preg_match('#^/api/games/[^/]+/?$#', $uri))
    require __DIR__ . '/api/games.php';
elseif (preg_match('#^/api/games/([^/]+)/scenes/([^/]+)/?$#', $uri))
    require __DIR__ . '/api/scene.php';
else
    return false; // serve the requested static file as-is
