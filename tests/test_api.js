const assert = require('assert');
const timelineHandler = require('../api/timeline.js');

console.log('Testing api/timeline.js...');

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

// 1. GET /api/timeline (SVG)
{
  const req = {
    method: 'GET',
    headers: {},
    query: { title: 'テスト線表', format: 'svg' }
  };
  const res = createMockRes();
  timelineHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.headers['content-type'].includes('image/svg+xml'));
  assert.ok(typeof res.body === 'string' && res.body.includes('<svg'));
  assert.ok(res.body.includes('テスト線表'));
  console.log('✓ GET /api/timeline (SVG) passed');
}

// 2. GET /api/timeline (JSON)
{
  const req = {
    method: 'GET',
    headers: {},
    query: { title: 'JSON線表', format: 'json' }
  };
  const res = createMockRes();
  timelineHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.headers['content-type'].includes('application/json'));
  assert.strictEqual(res.body.title, 'JSON線表');
  assert.ok(res.body.svg.startsWith('<svg'));
  console.log('✓ GET /api/timeline (JSON) passed');
}

// 3. POST /api/timeline (JSON body)
{
  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      timelines: [{ title: 'POST線表', displayStartWeek: '2026-10-04', displayEndWeek: '2026-11-29', showWeekRow: true }],
      tasks: [{ name: 'タスクA', category: '開発', weeks: ['2026-10-11', '2026-10-18'], color: '#4f7ec7' }]
    },
    query: { format: 'svg' }
  };
  const res = createMockRes();
  timelineHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.headers['content-type'].includes('image/svg+xml'));
  assert.ok(res.body.includes('POST線表'));
  assert.ok(res.body.includes('タスクA'));
  console.log('✓ POST /api/timeline passed');
}

console.log('ALL API TESTS PASSED!');
