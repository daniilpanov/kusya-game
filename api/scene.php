<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST')
        throw new Exception('Method not allowed', 405);

    // /api/games/<gameId>/scenes/<sceneFile>
    $uriParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    if (count($uriParts) < 5 || $uriParts[0] !== 'api' || $uriParts[1] !== 'games' || $uriParts[3] !== 'scenes')
        throw new Exception('Not found', 404);

    saveScene($uriParts[2], $uriParts[4]);

} catch (Exception $e) {
    $code = $e->getCode() ?: 400;
    http_response_code((int) $code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function saveScene($gameId, $sceneFile) {
    // Dev-only endpoint: no auth, overwrite of existing scene files only.
    $gameId = basename($gameId);
    $sceneFile = basename($sceneFile);

    if (!$gameId || !$sceneFile || !preg_match('/^[A-Za-z0-9_-]+$/', $gameId))
        throw new Exception('Invalid game id', 400);

    if (!preg_match('/^[A-Za-z0-9._-]+\.act$/', $sceneFile))
        throw new Exception('Invalid scene file name', 400);

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload) || !isset($payload['content']) || !is_string($payload['content']))
        throw new Exception('Body must be JSON: {"content": "<act text>"}', 400);

    $scenesDir = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR . 'games' . DIRECTORY_SEPARATOR . $gameId . DIRECTORY_SEPARATOR . 'scenes');
    $targetPath = $scenesDir ? realpath($scenesDir . DIRECTORY_SEPARATOR . $sceneFile) : false;

    // Only existing scene files may be overwritten; realpath keeps the path inside the game scenes dir
    if (!$scenesDir || !$targetPath || strpos($targetPath, $scenesDir . DIRECTORY_SEPARATOR) !== 0)
        throw new Exception("Scene file not found in game \"$gameId\"", 404);

    // Atomic write: tmp file in the same dir + rename; keep a one-shot backup
    $tmpPath = $targetPath . '.tmp';
    if (file_put_contents($tmpPath, $payload['content']) === false)
        throw new Exception('Failed to write temp file', 500);

    copy($targetPath, $targetPath . '.bak');
    if (!rename($tmpPath, $targetPath)) {
        unlink($tmpPath);
        throw new Exception('Failed to replace scene file', 500);
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'saved' => [
            'game' => $gameId,
            'file' => $sceneFile,
            'bytes' => strlen($payload['content']),
            'backup' => $sceneFile . '.bak',
        ],
    ]);
}
