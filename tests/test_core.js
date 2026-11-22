const assert = require('assert');
const TimelineCore = require('../lib/timeline-core.js');

console.log('Testing timeline-core.js...');

// 1. 日付ユーティリティのテスト
const date = TimelineCore.parseISODate('2026-11-22');
assert.strictEqual(TimelineCore.isoDate(date), '2026-11-22');
assert.strictEqual(TimelineCore.normalizeSunday('2026-11-25'), '2026-11-22'); // 2026-11-25は水曜、日曜は22日

const weeks = TimelineCore.rangeWeeks('2026-11-01', '2026-11-22');
assert.strictEqual(weeks.length, 4);

// 2. 状態サニタイズとサンプルデータのテスト
const sample = TimelineCore.createSampleState();
assert.ok(sample.timelines.length >= 1);
assert.ok(sample.tasks.length >= 1);

// 3. SVG マークアップ生成のテスト
const { markup, width, height } = TimelineCore.getSvgMarkup(
  sample.timelines[0],
  900,
  sample.tasks,
  sample.deadlines
);

assert.ok(markup.startsWith('<svg'));
assert.ok(markup.endsWith('</svg>'));
assert.ok(width > 0);
assert.ok(height > 0);
console.log(`✓ SVG generated successfully: width=${width}, height=${height}, length=${markup.length}`);

// 4. CSV 相互変換のテスト
const csv = TimelineCore.stateToCsv(sample);
assert.ok(csv.includes('#type,title'));
const reconstructed = TimelineCore.csvToState(csv);
assert.strictEqual(reconstructed.timelines[0].title, sample.timelines[0].title);
assert.strictEqual(reconstructed.tasks.length, sample.tasks.length);
console.log('✓ CSV serialization & deserialization passed');

console.log('ALL TESTS PASSED!');
