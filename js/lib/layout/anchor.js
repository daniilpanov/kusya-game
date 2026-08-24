// Pure sprite anchor math shared by the game runtime and editor previews.
// Coordinates are normalized anchors: x 0=left edge, 1=right edge, 0.5=center;
// y 0=bottom edge, 1=top edge, 0.5=middle. The sprite element is pinned to the
// opposite side of its anchor (anchor 0.2 → left offset, anchor 0.8 → right offset).

const CENTER_EPSILON = 0.01;

const clamp01 = value => {
    const n = Number(value);
    if (Number.isNaN(n))
        return null; // let callers report invalid input instead of silently moving
    return Math.min(1, Math.max(0, n));
};

export function computeAnchorStyles(x, y, viewport) {
    const vx = clamp01(x);
    const vy = clamp01(y);
    if (vx === null || vy === null)
        return null;

    const styles = {};

    if (Math.abs(vx - 0.5) < CENTER_EPSILON) {
        styles.left = '0px';
        styles.right = '0px';
    } else if (vx < 0.5) {
        styles.left = `${viewport.width * vx}px`;
        styles.right = '';
    } else {
        styles.left = '';
        styles.right = `${viewport.width * (1 - vx)}px`;
    }

    if (Math.abs(vy - 0.5) < CENTER_EPSILON) {
        styles.top = '0px';
        styles.bottom = '0px';
    } else if (vy < 0.5) {
        styles.top = '';
        styles.bottom = `${viewport.height * vy}px`;
    } else {
        styles.bottom = '';
        styles.top = `${viewport.height * (1 - vy)}px`;
    }

    return styles;
}
