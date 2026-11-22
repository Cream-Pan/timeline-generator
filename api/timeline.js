const TimelineCore = require('../lib/timeline-core.js');

module.exports = function handler(req, res) {
  // CORS ヘッダーを設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let state;
    const format = (req.query && req.query.format) || 'svg';

    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json') || typeof req.body === 'object') {
        state = TimelineCore.sanitizeState(req.body);
      } else if (typeof req.body === 'string') {
        state = TimelineCore.csvToState(req.body);
      } else {
        state = TimelineCore.createSampleState();
      }
    } else {
      // GET リクエストの場合: クエリパラメータから構築
      const query = req.query || {};

      if (query.csv) {
        state = TimelineCore.csvToState(query.csv);
      } else {
        const base = TimelineCore.createSampleState();
        const timeline = base.timelines[0];

        if (query.title) {
          timeline.title = String(query.title).trim();
        }
        if (query.start) {
          const s = TimelineCore.normalizeSunday(query.start);
          if (s) timeline.displayStartWeek = s;
        }
        if (query.end) {
          const e = TimelineCore.normalizeSunday(query.end);
          if (e) timeline.displayEndWeek = e;
        }
        if (query.show_week_row !== undefined) {
          timeline.showWeekRow = query.show_week_row === 'true' || query.show_week_row === '1';
        }
        if (query.width) {
          timeline.weekCellWidth = TimelineCore.sanitizeWeekCellWidth(query.width);
        }

        // tasks がクエリにある場合: 例 tasks=タスク1:2026-10-11,2026-10-18;タスク2:2026-11-01
        if (query.tasks) {
          try {
            const rawTasks = typeof query.tasks === 'string' ? JSON.parse(query.tasks) : query.tasks;
            if (Array.isArray(rawTasks)) {
              base.tasks = rawTasks;
            }
          } catch (e) {
            // JSONでなければセミコロン/カンマ区切り簡易フォーマットをパース
            const taskItems = String(query.tasks).split(';');
            base.tasks = taskItems.map((item, idx) => {
              const [nameAndCat, weeksStr, color] = item.split(':');
              const parts = (nameAndCat || '').split('/');
              const category = parts.length > 1 ? parts[0] : 'タスク';
              const name = parts.length > 1 ? parts[1] : parts[0];
              const weeks = (weeksStr || '').split(',').map((w) => TimelineCore.normalizeSunday(w.trim())).filter(Boolean);
              return {
                id: TimelineCore.makeId('task'),
                category,
                name: name || `タスク${idx + 1}`,
                weeks,
                color: TimelineCore.validColor(color) ? color : TimelineCore.DEFAULT_COLOR,
                status: 'running'
              };
            });
          }
        }

        state = TimelineCore.sanitizeState(base);
      }
    }

    const timeline = state.timelines[0];
    const availableWidth = req.query && req.query.canvas_width ? Number(req.query.canvas_width) : null;
    const { markup, width, height } = TimelineCore.getSvgMarkup(
      timeline,
      availableWidth,
      state.tasks,
      state.deadlines
    );

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        title: timeline.title,
        width,
        height,
        tasksCount: state.tasks.length,
        deadlinesCount: state.deadlines.length,
        svg: markup
      });
    }

    // デフォルトは SVG 画像を直接返す
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    // キャッシュ制御: CDNでキャッシュしつつ適度に更新
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(markup);

  } catch (error) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      error: 'Failed to generate timeline',
      message: error.message
    });
  }
};
