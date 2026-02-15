<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET,POST,OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$path = str_replace('/index.php', '', $path);

if ($path === '/health') {
    echo json_encode(['status' => 'ok']);
    exit;
}

if ($path === '/recipes' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    listRecipes();
    exit;
}

if ($path === '/recipes' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    createRecipe();
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);

function listRecipes(): void
{
    $stmt = db()->query('SELECT id, raw_text, updated_at FROM recipes ORDER BY updated_at DESC');
    $rows = $stmt->fetchAll();

    echo json_encode(['data' => $rows]);
}

function createRecipe(): void
{
    $rawInput = file_get_contents('php://input') ?: '{}';
    $payload = json_decode($rawInput, true);

    if (!is_array($payload) || empty(trim((string) ($payload['rawText'] ?? '')))) {
        http_response_code(422);
        echo json_encode(['error' => 'Pole rawText je povinné.']);
        return;
    }

    $rawText = trim((string) $payload['rawText']);

    $stmt = db()->prepare('INSERT INTO recipes (raw_text) VALUES (:raw_text)');
    $stmt->execute([
        'raw_text' => $rawText,
    ]);

    $id = (int) db()->lastInsertId();

    http_response_code(201);
    echo json_encode([
        'data' => [
            'id' => $id,
            'raw_text' => $rawText,
        ],
    ]);
}
