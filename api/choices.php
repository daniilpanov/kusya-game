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

    if ($choice['next_scene_id']) {
        $response['next_action'] = [
            'type' => 'scene_transition',
            'scene_id' => $choice['next_scene_id']
        ];
    }
    elseif ($choice['next_dialogue_id']) {
        $response['next_action'] = [
            'type' => 'continue_dialogue',
            'dialogue_id' => $choice['next_dialogue_id']
        ];
    }
    else {
        $response['next_action'] = [
            'type' => 'game_end'
        ];
    }

    echo json_encode($response);
}
