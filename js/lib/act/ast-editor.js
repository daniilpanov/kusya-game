export const createGroup = (key) => ({ key, actions: [] });

export const createAction = (name, args = []) => ({ name, args: [...args] });

export function insertGroup(ast, index, group) {
    ast.groups.splice(index, 0, group);
    return group;
}

export function removeGroup(ast, index) {
    return ast.groups.splice(index, 1)[0];
}

export function moveGroup(ast, from, to) {
    if (from === to || from < 0 || from >= ast.groups.length)
        return false;
    const [group] = ast.groups.splice(from, 1);
    ast.groups.splice(to, 0, group);
    return true;
}

export function renameGroupKey(group, newKey) {
    group.key = newKey;
}

export function insertAction(group, index, action) {
    group.actions.splice(index, 0, action);
    return action;
}

export function removeAction(group, index) {
    return group.actions.splice(index, 1)[0];
}

export function moveAction(group, from, to) {
    if (from === to || from < 0 || from >= group.actions.length)
        return false;
    const [action] = group.actions.splice(from, 1);
    group.actions.splice(to, 0, action);
    return true;
}

// Group keys must be non-empty and unique across the scene
export function findGroupKeyError(ast, key, exceptIndex = -1) {
    if (!String(key).trim())
        return 'Пустой ключ группы';

    const duplicate = ast.groups.some((group, i) => i !== exceptIndex && group.key === key);
    if (duplicate)
        return `Группа с ключом "${key}" уже существует`;

    return null;
}
