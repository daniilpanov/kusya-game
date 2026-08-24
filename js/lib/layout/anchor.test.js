import { strict as assert } from 'assert';
import { computeAnchorStyles } from '#/lib/layout/anchor.js';

// Resolution matrix: every supported test resolution must produce
// consistent anchor geometry across the interesting positions.
const RESOLUTIONS = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '390x844 (portrait)', width: 390, height: 844 },
];

for (const viewport of RESOLUTIONS) {
    // center snaps to full-stretch on any screen
    assert.deepEqual(
        computeAnchorStyles(0.5, 0.5, viewport),
        { left: '0px', right: '0px', top: '0px', bottom: '0px' },
        `${viewport.name}: center`,
    );

    // left-bottom quarter: offsets from left/bottom edges
    const quarter = computeAnchorStyles(0.25, 0.25, viewport);
    assert.equal(quarter.left, `${viewport.width * 0.25}px`, `${viewport.name}: left`);
    assert.equal(quarter.right, '', `${viewport.name}: left clears right`);
    assert.equal(quarter.bottom, `${viewport.height * 0.25}px`, `${viewport.name}: bottom`);
    assert.equal(quarter.top, '', `${viewport.name}: bottom clears top`);

    // right-top quarter mirrors
    const mirrored = computeAnchorStyles(0.75, 0.75, viewport);
    assert.equal(mirrored.right, `${viewport.width * 0.25}px`, `${viewport.name}: right`);
    assert.equal(mirrored.left, '', `${viewport.name}: right clears left`);
    assert.equal(mirrored.top, `${viewport.height * 0.25}px`, `${viewport.name}: top`);
    assert.equal(mirrored.bottom, '', `${viewport.name}: top clears bottom`);

    // near-center values snap like the runtime epsilon requires
    const snapped = computeAnchorStyles(0.5 + 0.005, 0.5 - 0.005, viewport);
    assert.deepEqual(snapped, { left: '0px', right: '0px', top: '0px', bottom: '0px' });

    // clamping keeps sprites on screen at extremes
    assert.equal(computeAnchorStyles(1, 0, viewport).right, '0px');
    assert.equal(computeAnchorStyles(0, 1, viewport).left, '0px');
}

{
    // invalid input is reported, not silently coerced to an edge
    assert.equal(computeAnchorStyles('oops', 0.5, RESOLUTIONS[0]), null);
    assert.equal(computeAnchorStyles(0.5, NaN, RESOLUTIONS[0]), null);

    // numeric strings from .act args are accepted
    const fromString = computeAnchorStyles('0.25', '0.75', RESOLUTIONS[2]);
    assert.equal(fromString.left, `${1024 * 0.25}px`);
    assert.equal(fromString.top, `${768 * 0.25}px`);
}

console.log('All anchor tests passed!');
