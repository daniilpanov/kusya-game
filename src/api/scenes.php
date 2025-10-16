<?php
require_once 'db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

    if (!$sceneId) {
        throw new Exception('Scene ID is required', 400);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (end($uriParts) === 'dialogues') {
            // GET /api/scenes/{id}/dialogues - получить диалоги сцены
            getSceneDialogues($pdo, $sceneId);
        } else {
            // GET /api/scenes/{id} - получить сцену
            getScene($pdo, $sceneId);
        }
    } else {
        throw new Exception('Method not allowed', 405);
    }

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
        SELECT s.scene_external_id, s.background, s.music, s.initial_characters
        FROM scenes s
        WHERE s.scene_external_id = :scene_id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $sceneId);
    $stmt->execute();
    $scene = $stmt->fetch();

    if (!$scene) {
        throw new Exception('Scene not found', 404);
    }

    echo json_encode([
        'success' => true,
        'scene' => [
            'scene_id' => $scene['scene_external_id'],
            'background' => $scene['background'],
            'music' => $scene['music'],
            'initial_characters' => json_decode($scene['initial_characters'], true)
        ]
    ]);
}

function getSceneDialogues($pdo, $sceneId) {
    $dialogueId = $_GET['start_from'] ?? null;

    if ($dialogueId) {
        // Начинаем с определенного диалога
        getDialoguesFromId($pdo, $dialogueId);
    } else {
        // Начинаем с начала сцены
        getSceneInitialDialogues($pdo, $sceneId);
    }
}

function getSceneInitialDialogues($pdo, $sceneId) {
    $query = "
        SELECT d.*
        FROM dialogues d
        JOIN scenes s ON d.scene_id = s.id
        WHERE s.scene_external_id = :scene_id
        ORDER BY d.dialogue_order ASC
        LIMIT 10
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $sceneId);
    $stmt->execute();
    $dialogues = $stmt->fetchAll();

    $formattedDialogues = [];
    foreach ($dialogues as $dialogue) {
        $formattedDialogues[] = formatDialogue($dialogue);
    }

    echo json_encode([
        'success' => true,
        'dialogues' => $formattedDialogues,
        'has_more' => count($dialogues) === 10
    ]);
}

function getDialoguesFromId($pdo, $dialogueId) {
    $query = "
        SELECT d.*
        FROM dialogues d
        WHERE d.id = :dialogue_id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':dialogue_id', $dialogueId, PDO::PARAM_INT);
    $stmt->execute();
    $startDialogue = $stmt->fetch();

    if (!$startDialogue) {
        throw new Exception('Dialogue not found', 404);
    }

    // Получаем цепочку диалогов
    $dialogues = [];
    $current = $startDialogue;

    while ($current && !$current['is_choice'] && !$current['next_scene_id']) {
        $dialogues[] = formatDialogue($current);

        if ($current['next_dialogue_id']) {
            $query = "SELECT * FROM dialogues WHERE id = :next_id";
            $stmt = $pdo->prepare($query);
            $stmt->bindValue(':next_id', $current['next_dialogue_id'], PDO::PARAM_INT);
            $stmt->execute();
            $current = $stmt->fetch();
        } else {
            $current = null;
        }
    }

    $response = [
        'success' => true,
        'dialogues' => $dialogues
    ];

    // Если текущий диалог - выбор, добавляем варианты
    if ($current && $current['is_choice']) {
        $response['next_action'] = [
            'type' => 'choice',
            'choice_dialogue_id' => $current['id']
        ];
    }
    // Если переход на сцену
    elseif ($current && $current['next_scene_id']) {
        $response['next_action'] = [
            'type' => 'scene_transition',
            'next_scene_id' => $current['next_scene_id']
        ];
    }

    echo json_encode($response);
}

function formatDialogue($dialogue) {
    return [
        'id' => $dialogue['id'],
        'character_id' => $dialogue['character_id'],
        'text' => $dialogue['text'],
        'character_changes' => $dialogue['character_changes'] ?
            json_decode($dialogue['character_changes'], true) : []
    ];
}
