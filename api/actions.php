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

    // Get scene ID
    foreach ($uriParts as $index => $part) {
        if ($part === 'scenes' && isset($uriParts[$index + 1])) {
            $sceneId = $uriParts[$index + 1];
            break;
        }
    }

    if (!$sceneId)
        throw new Exception('Scene ID is required', 400);

    if ($_SERVER['REQUEST_METHOD'] === 'GET')
        getActionsChain($pdo, $sceneId, $_GET['choice_alias'] ?? null);
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


function getActionsChain($pdo, $scene_id, $choice_alias = null) {
    $query = "
        SELECT id
        FROM scenes s
        WHERE s.scene_external_id = :scene_id
    ";
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $scene_id);
    $stmt->execute();
    $scene_id = (int) $stmt->fetchColumn();

    $start_id = null;
    if ($choice_alias !== null) {
        $query = "
            SELECT id
            FROM actions
            WHERE actions.scene_id = :scene_id AND actions.choice_alias = :choice_alias
        ";
        $stmt = $pdo->prepare($query);
        $stmt->bindValue(':scene_id', $scene_id, PDO::PARAM_INT);
        $stmt->bindValue(':choice_alias', $choice_alias);
        $stmt->execute();
        $start_id = (int) $stmt->fetchColumn();
    }

    /*$query = "
        WITH RECURSIVE get_action_chains (
            SELECT id, parent_id, scene_id, 'action', choice_text, choice_alias, has_choice
            FROM actions
            WHERE scene_id = :scene_id" . ($scene_id ? " AND id = :start_id" : "") . "

            UNION ALL

            SELECT id, parent_id, scene_id, 'action', choice_text, choice_alias, has_choice
            FROM actions
            WHERE scene_id = :scene_id AND
        )

    ";*/
    $query = "
      SELECT id, parent_id, scene_id, `action`, choice_text, choice_alias, has_choice
      FROM actions
      WHERE scene_id = :scene_id
    ";
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $scene_id, PDO::PARAM_INT);
    $stmt->execute();
    $actions = $stmt->fetchAll();

    $needle_actions = [];
    $found_choice = false;
    $found_next_choice = false;
    $choice_variants = [];

    foreach ($actions as $action) {
        if ($start_id !== null) {
            if ($action['id'] === $start_id)
                $start_id = null;
            else
                continue;
        }

        if ($found_next_choice) {
            if (!$action['choice_alias'])
                break;

            $choice_variants[$action['choice_alias']] = $action['choice_text'];
            continue;
        }

        if (!$found_choice && $choice_alias && $action['choice_alias'] !== $choice_alias)
            continue;

        $found_choice = true;
        $action['action'] = json_decode($action['action'], true);
        $needle_actions[] = $action;

        if ($action['has_choice'])
            $found_next_choice = true;
    }

    echo json_encode([
        'success' => true,
        'actions' => $needle_actions,
        'choice' => $choice_variants,
    ]);
}