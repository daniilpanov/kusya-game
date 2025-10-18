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
    $gameId = null;

    // Game ID detection
    foreach ($uriParts as $index => $part) {
        if ($part === 'games' && isset($uriParts[$index + 1]) && is_numeric($uriParts[$index + 1])) {
            $gameId = $uriParts[$index + 1];
            break;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($gameId) {
            // GET /api/games/{id}/play
            if (end($uriParts) === 'play')
                getStartScene($pdo, $gameId);
            // GET /api/games/{id} - game info
            else
                getGameInfo($pdo, $gameId);
        }
        // GET /api/games
        else
            getGamesList($pdo);
    }
    else throw new Exception('Method not allowed', 405);

} catch (Exception $e) {
    $code = $e->getCode() ?: 400;
    http_response_code((int) $code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getGamesList($pdo) {
    $query = "
        SELECT g.id, g.title, g.start_scene_id,
               COUNT(DISTINCT s.id) as scene_count,
               COUNT(DISTINCT d.id) as dialogue_count
        FROM games g
        LEFT JOIN scenes s ON g.id = s.game_id
        LEFT JOIN actions d ON s.id = d.scene_id
        GROUP BY g.id
        ORDER BY g.created_at DESC
    ";

    $stmt = $pdo->prepare($query);
    $stmt->execute();
    $games = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'games' => $games
    ]);
}

function getGameInfo($pdo, $gameId) {
    $query = "
        SELECT g.*,
               COUNT(DISTINCT s.id) as scene_count,
               COUNT(DISTINCT d.id) as dialogue_count
        FROM games g
        LEFT JOIN scenes s ON g.id = s.game_id
        LEFT JOIN actions d ON s.id = d.scene_id
        WHERE g.id = :game_id
        GROUP BY g.id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':game_id', $gameId, PDO::PARAM_INT);
    $stmt->execute();
    $game = $stmt->fetch();

    if (!$game) {
        throw new Exception('Game not found', 404);
    }

    echo json_encode([
        'success' => true,
        'game' => $game
    ]);
}

function getStartScene($pdo, $gameId) {
    $query = "
        SELECT g.start_scene_id
        FROM games g
        WHERE g.id = :game_id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':game_id', $gameId, PDO::PARAM_INT);
    $stmt->execute();
    $game = $stmt->fetch();

    if (!$game)
        throw new Exception('Game not found', 404);

    $query = "
        SELECT s.scene_external_id, s.background, s.music, s.initial_characters
        FROM scenes s
        WHERE s.scene_external_id = :scene_id AND s.game_id = :game_id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $game['start_scene_id']);
    $stmt->bindValue(':game_id', $gameId, PDO::PARAM_INT);
    $stmt->execute();
    $scene = $stmt->fetch();

    if (!$scene)
        throw new Exception('Start scene not found', 404);

    $query = "
        SELECT d.*
        FROM actions d
        JOIN scenes s ON d.scene_id = s.id
        WHERE s.scene_external_id = :scene_id
        AND d.parent_id = NULL
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $game['start_scene_id']);
    $stmt->execute();
    $firstDialogue = $stmt->fetch();

    $response = [
        'success' => true,
        'scene' => [
            'scene_id' => $scene['scene_external_id'],
            'background' => $scene['background'],
            'music' => $scene['music'],
            'initial_characters' => json_decode($scene['initial_characters'], true)
        ]
    ];

    if ($firstDialogue)
        $response['first_dialogue_id'] = $firstDialogue['id'];

    echo json_encode($response);
}
