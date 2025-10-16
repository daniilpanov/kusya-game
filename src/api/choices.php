<?php
require_once 'db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $db = new Database();
    $pdo = $db->getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleChoice($pdo);
    } else {
        throw new Exception('Method not allowed', 405);
    }

} catch (Exception $e) {
    $code = $e->getCode() ?: 400;
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function handleChoice($pdo) {
    $data = json_decode(file_get_contents('php://input'), true);

    $choiceId = $data['choice_id'] ?? null;
    $gameId = $data['game_id'] ?? null;

    if (!$choiceId || !$gameId) {
        throw new Exception('Choice ID and Game ID are required', 400);
    }

    // Находим информацию о выборе
    $query = "
        SELECT c.*, d.next_scene_id, d.next_dialogue_id
        FROM choices c
        JOIN dialogues d ON c.dialogue_id = d.id
        WHERE c.id = :choice_id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':choice_id', $choiceId, PDO::PARAM_INT);
    $stmt->execute();
    $choice = $stmt->fetch();

    if (!$choice) {
        throw new Exception('Choice not found', 404);
    }

    $response = [
        'success' => true,
        'choice_made' => [
            'choice_id' => $choiceId,
            'choice_text' => $choice['choice_text']
        ]
    ];

    // Определяем что делать после выбора
    if ($choice['next_scene_id']) {
        $response['next_action'] = [
            'type' => 'scene_transition',
            'scene_id' => $choice['next_scene_id']
        ];

        // Получаем информацию о следующей сцене
        $query = "
            SELECT s.scene_external_id, s.background, s.music, s.initial_characters
            FROM scenes s
            WHERE s.scene_external_id = :scene_id AND s.game_id = :game_id
        ";

        $stmt = $pdo->prepare($query);
        $stmt->bindValue(':scene_id', $choice['next_scene_id']);
        $stmt->bindValue(':game_id', $gameId, PDO::PARAM_INT);
        $stmt->execute();
        $nextScene = $stmt->fetch();

        if ($nextScene) {
            $response['next_scene'] = [
                'scene_id' => $nextScene['scene_external_id'],
                'background' => $nextScene['background'],
                'music' => $nextScene['music'],
                'initial_characters' => json_decode($nextScene['initial_characters'], true)
            ];
        }
    }
    elseif ($choice['next_dialogue_id']) {
        $response['next_action'] = [
            'type' => 'continue_dialogue',
            'dialogue_id' => $choice['next_dialogue_id']
        ];
    }
    else {
        throw new Exception('Invalid choice configuration', 500);
    }

    echo json_encode($response);
}
?>