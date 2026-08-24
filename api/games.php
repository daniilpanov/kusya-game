<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET')
        throw new Exception('Method not allowed', 405);

    $requestUri = $_SERVER['REQUEST_URI'];
    $uriParts = explode('/', $requestUri);
    $countUriParts = count($uriParts);
    if ($countUriParts && !$uriParts[0]) {
        array_shift($uriParts);
        --$countUriParts;
    }

    if ($countUriParts < 2 || $uriParts[0] !== 'api' || $uriParts[1] !== 'games' || $countUriParts > 2 && $uriParts[2])
        throw new Exception('Not found', 404);

    getGamesList();

} catch (Exception $e) {
    $code = $e->getCode() ?: 400;
    http_response_code((int) $code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getGamesList() {
    $rootGamesUri = '/resources/games/';
    // Absolute path from __DIR__: must not depend on the process CWD
    // (php -S runs from the repo root, Apache may run from anywhere)
    $rootGamesPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR . 'games' . DIRECTORY_SEPARATOR;
    $gameIds = scandir($rootGamesPath);
    $games = [];
    foreach ($gameIds as $gameId) {
        if ($gameId === '.' || $gameId === '..')
            continue;

        $infoFilename = $rootGamesPath . $gameId . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'info.json';

        if (file_exists($infoFilename))
            $games[] = json_decode(file_get_contents($infoFilename), true)
                    + ['resource' => $rootGamesUri . $gameId, 'descriptor' => $rootGamesUri . $gameId . '/config/descriptor.toml'];
    }

    echo json_encode([
        'success' => true,
        'games' => $games,
    ]);
}
