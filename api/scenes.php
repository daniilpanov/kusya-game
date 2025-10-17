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
        $startFrom = $_GET['start_from'] ?? null;

        // Если запрос с start_from - возвращаем диалоги
        if ($startFrom) {
            getDialoguesFromId($pdo, $startFrom);
        }
        // Если нет start_from - возвращаем данные сцены и диалоги
        else {
            getSceneWithDialogues($pdo, $sceneId);
        }
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

function getSceneWithDialogues($pdo, $sceneId) {
    // Получаем данные сцены
    $query = "
        SELECT scene_external_id, background, music, initial_characters 
        FROM scenes 
        WHERE scene_external_id = :scene_id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $sceneId);
    $stmt->execute();
    $scene = $stmt->fetch();

    if (!$scene) {
        throw new Exception('Scene not found', 404);
    }

    // Получаем диалоги сцены
    $query = "
        SELECT d.* 
        FROM dialogues d
        JOIN scenes s ON d.scene_id = s.id
        WHERE s.scene_external_id = :scene_id 
        ORDER BY d.dialogue_order ASC
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $sceneId);
    $stmt->execute();
    $allDialogues = $stmt->fetchAll();

    $dialogues = [];
    $choiceDialogue = null;

    foreach ($allDialogues as $dialogue) {
        if ($dialogue['is_choice']) {
            $choiceDialogue = $dialogue;
            break;
        }
        $dialogues[] = formatDialogue($dialogue);
    }

    $response = [
        'success' => true,
        'scene' => [
            'scene_id' => $scene['scene_external_id'],
            'background' => $scene['background'],
            'music' => $scene['music'],
            'initial_characters' => json_decode($scene['initial_characters'], true)
        ],
        'dialogues' => $dialogues
    ];

    if ($choiceDialogue) {
        $response['choice_dialogue'] = [
            'id' => $choiceDialogue['id'],
            'text' => $choiceDialogue['text']
        ];

        $choices = getChoicesForDialogue($pdo, $choiceDialogue['id']);
        $response['choice_dialogue']['choices'] = $choices;
    }

    echo json_encode($response);
}

function getDialoguesFromId($pdo, $dialogueId) {
    $query = "
        SELECT d1.* 
        FROM dialogues d1
        WHERE d1.id = :dialogue_id
        UNION ALL
        SELECT d2.* 
        FROM dialogues d2
        WHERE d2.id > :dialogue_id 
        AND d2.scene_id = (SELECT scene_id FROM dialogues WHERE id = :dialogue_id)
        ORDER BY dialogue_order ASC
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':dialogue_id', $dialogueId, PDO::PARAM_INT);
    $stmt->execute();
    $allDialogues = $stmt->fetchAll();

    $dialogues = [];
    $choiceDialogue = null;

    foreach ($allDialogues as $dialogue) {
        if ($dialogue['is_choice']) {
            $choiceDialogue = $dialogue;
            break;
        }
        $dialogues[] = formatDialogue($dialogue);
    }

    $response = [
        'success' => true,
        'dialogues' => $dialogues
    ];

    if ($choiceDialogue) {
        $response['choice_dialogue'] = [
            'id' => $choiceDialogue['id'],
            'text' => $choiceDialogue['text']
        ];

        $choices = getChoicesForDialogue($pdo, $choiceDialogue['id']);
        $response['choice_dialogue']['choices'] = $choices;
    }

    echo json_encode($response);
}

function getChoicesForDialogue($pdo, $dialogueId) {
    $query = "
        SELECT c.id, c.choice_text, c.next_dialogue_id, c.next_scene_id
        FROM choices c
        WHERE c.dialogue_id = :dialogue_id
        ORDER BY c.id
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':dialogue_id', $dialogueId, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
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
