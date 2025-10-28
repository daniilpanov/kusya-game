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

    $needle_actions = [];
    $query = "
        SELECT id, parent_id, scene_id, `action`, choice_text, choice_alias, has_choice
        FROM actions
        WHERE actions.scene_id = :scene_id AND 
    " . ($choice_alias ? "actions.choice_alias = :choice_alias" : "actions.choice_alias IS NULL");
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $scene_id, PDO::PARAM_INT);
    if ($choice_alias)
        $stmt->bindValue(':choice_alias', $choice_alias);
    $stmt->execute();

    $first_action = $stmt->fetch();
    $first_action['action'] = json_decode($first_action['action'], true);
    $parent_id = $first_action['id'];
    $needle_actions[] = $first_action;

    $query = "
        SELECT id, parent_id, scene_id, `action`, choice_text, choice_alias, has_choice
        FROM actions
        WHERE actions.scene_id = :scene_id AND actions.id != :parent_id
    ";
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $scene_id, PDO::PARAM_INT);
    $stmt->bindValue(':parent_id', $parent_id, PDO::PARAM_INT);
    $stmt->execute();
    $actions = $stmt->fetchAll();

    $count_actions = 0;
    $all_actions = count($actions);

    while ($count_actions < $all_actions) {
        $key = null;
        $found = false;

        foreach ($actions as $key => $action) {
            if ($parent_id !== $action['parent_id'])
                continue;

            $action['action'] = json_decode($action['action'], true);
            $needle_actions[] = $action;
            ++$count_actions;
            $found = true;
            $parent_id = $action['id'];

            if ($action['has_choice'])
                break(2);

            break;
        }

        if (!$found)
            break;

        unset($actions[$key]);
    }

    $last_action = $needle_actions[count($needle_actions) - 1];

    if (!$last_action['has_choice']) {
        echo json_encode([
            'success' => true,
            'actions' => $needle_actions,
        ]);

        return;
    }

    $query = "
            SELECT choice_alias, choice_text
            FROM actions
            WHERE actions.scene_id = :scene_id AND actions.parent_id = :parent_id
        ";
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':scene_id', $scene_id, PDO::PARAM_INT);
    $stmt->bindValue(':parent_id', $last_action['id'], PDO::PARAM_INT);
    $stmt->execute();
    $choices_actions = $stmt->fetchAll();

    $choice_variants = [];

    foreach ($choices_actions as $choices_action)
        $choice_variants[$choices_action['choice_alias']] = $choices_action['choice_text'];

    echo json_encode([
        'success' => true,
        'actions' => $needle_actions,
        'choice' => $choice_variants,
    ]);
}