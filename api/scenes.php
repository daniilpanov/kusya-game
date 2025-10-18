<?php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $db = new Database();
    $pdo = $db->getConnection();

    $requestUri = $_SERVER['REQUEST_URI'];
    $uriParts = explode('/', $requestUri);
    $sceneId = null;

    // Извлекаем ID сцены из URL
    foreach ($uriParts as $index => $part) {
        if ($part === 'scenes' && isset($uriParts[$index + 1])) {
            $sceneId = $uriParts[$index + 1];
            break;
        }
    }

    if (!$sceneId)
        throw new Exception('Scene ID is required', 400);

    if ($_SERVER['REQUEST_METHOD'] === 'GET')
        getScene($pdo, $sceneId);
    else
        throw new Exception('Method not allowed', 405);

} catch (Exception $e) {
    $code = $e->getCode() ?: 400;
    http_response_code((int) $code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getScene($pdo, $sceneId) {
    $query = "
        SELECT scene_external_id, background, music, initial_characters 
        FROM scenes 
        WHERE scene_external_id = :scene_id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $sceneId);
    $stmt->execute();
    $scene = $stmt->fetch();

    if (!$scene)
        throw new Exception('Scene not found', 404);

    echo json_encode([
        'success' => true,
        'scene' => [
            'scene_id' => $scene['scene_external_id'],
            'background' => $scene['background'],
            'music' => $scene['music'],
            'initial_characters' => json_decode($scene['initial_characters'], true)
        ],
    ]);
}
