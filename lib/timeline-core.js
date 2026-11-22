(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global.TimelineCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const DEFAULT_COLOR = '#4f7ec7';
  const DEADLINE_COLOR = '#3f78c5';
  const MS_PER_DAY = 86400000;
  const DEFAULT_TITLE = '◎線表';
  const MIN_WEEK_CELL_WIDTH = 0.1;
  const MAX_WEEK_CELL_WIDTH = 50;
  const TASK_STATUSES = [
    { value: 'not_started', label: '未着手' },
    { value: 'running', label: '実行中' },
    { value: 'completed', label: '完了' }
  ];

  function makeId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function parseISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d
    ) return null;
    return date;
  }

  function isoDate(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(dateOrIso, days) {
    const date = typeof dateOrIso === 'string' ? parseISODate(dateOrIso) : dateOrIso;
    const copy = new Date(date.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  function sundayOf(dateOrIso) {
    const date = typeof dateOrIso === 'string' ? parseISODate(dateOrIso) : dateOrIso;
    if (!date) return null;
    return addDays(date, -date.getUTCDay());
  }

  function normalizeSunday(value) {
    const date = parseISODate(value);
    if (!date) return null;
    return isoDate(sundayOf(date));
  }

  function compareIso(a, b) {
    return String(a).localeCompare(String(b));
  }

  function formatWeekLabel(iso, withYear = true) {
    const d = parseISODate(iso);
    if (!d) return '';
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return withYear ? `${y}/${m}/${day}～` : `${m}/${day}~`;
  }

  function formatDateLabel(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  }

  function rangeWeeks(startIso, endIso) {
    const start = parseISODate(startIso);
    const end = parseISODate(endIso);
    if (!start || !end || start > end) return [];
    const result = [];
    for (let cursor = new Date(start.getTime()); cursor <= end; cursor = addDays(cursor, 7)) {
      result.push(isoDate(cursor));
      if (result.length > 700) break;
    }
    return result;
  }

  function sortUniqueWeeks(weeks) {
    return [...new Set((weeks || []).map(normalizeSunday).filter(Boolean))].sort(compareIso);
  }

  function validColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
  }

  function sanitizeWeekCellWidth(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(MIN_WEEK_CELL_WIDTH, Math.min(MAX_WEEK_CELL_WIDTH, num));
  }

  function createBlankState() {
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const start = sundayOf(utcToday);
    const end = addDays(start, 7 * 26);
    return {
      timelines: [{
        title: DEFAULT_TITLE,
        displayStartWeek: isoDate(start),
        displayEndWeek: isoDate(end),
        showWeekRow: true,
        weekCellWidth: null
      }],
      tasks: [],
      deadlines: []
    };
  }

  function createSampleState() {
    const sample = createBlankState();
    const { displayStartWeek, displayEndWeek } = sample.timelines[0];
    const weeks = rangeWeeks(displayStartWeek, displayEndWeek);
    const names = ['関連研究調査', 'デバイス実装', '実験', '解析', '執筆'];
    sample.tasks = names.map((name, index) => ({
      id: makeId('task'),
      category: '研究',
      name,
      weeks: weeks.slice(index * 2, index * 2 + 2),
      color: DEFAULT_COLOR,
      status: TASK_STATUSES[0].value
    }));
    return sample;
  }

  function sanitizeState(input) {
    const base = createBlankState();
    if (!input || typeof input !== 'object') return base;

    const timelines = Array.isArray(input.timelines) && input.timelines.length
      ? input.timelines.map((item, index) => {
          const start = normalizeSunday(item.displayStartWeek) || base.timelines[0].displayStartWeek;
          const end = normalizeSunday(item.displayEndWeek) || base.timelines[0].displayEndWeek;
          const validRange = compareIso(start, end) <= 0;
          return {
            title: String(item.title || (index === 0 ? DEFAULT_TITLE : `◎線表${index + 1}`)).trim() || DEFAULT_TITLE,
            displayStartWeek: validRange ? start : end,
            displayEndWeek: validRange ? end : start,
            showWeekRow: item.showWeekRow !== false,
            weekCellWidth: sanitizeWeekCellWidth(item.weekCellWidth)
          };
        })
      : base.timelines;

    const tasks = Array.isArray(input.tasks)
      ? input.tasks.map((task) => {
          const statusValue = String(task.status || '').trim();
          const validStatus = TASK_STATUSES.some((item) => item.value === statusValue)
            ? statusValue
            : TASK_STATUSES[0].value;
          return {
            id: String(task.id || makeId('task')),
            category: String(task.category || '').trim(),
            name: String(task.name || '').trim(),
            weeks: sortUniqueWeeks(task.weeks),
            color: validColor(task.color) ? task.color : DEFAULT_COLOR,
            status: validStatus
          };
        })
      : [];

    const deadlines = Array.isArray(input.deadlines)
      ? input.deadlines
          .map((item) => {
            const date = parseISODate(item.date);
            if (!date) return null;
            return {
              id: String(item.id || makeId('deadline')),
              date: isoDate(date),
              name: String(item.name || '').trim() || '締切',
              note: String(item.note || '').trim(),
              color: validColor(item.color) ? item.color : DEADLINE_COLOR
            };
          })
          .filter(Boolean)
      : [];

    return { timelines, tasks, deadlines };
  }

  function escapeXml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function groupedSpans(weeks, keyFn) {
    const spans = [];
    weeks.forEach((week, index) => {
      const key = keyFn(week);
      const last = spans[spans.length - 1];
      if (last && last.key === key) {
        last.count += 1;
      } else {
        spans.push({ key, start: index, count: 1 });
      }
    });
    return spans;
  }

  function categorySpans(tasks) {
    const spans = [];
    tasks.forEach((task, index) => {
      const key = task.category || '未分類';
      const last = spans[spans.length - 1];
      if (last && last.key === key) {
        last.count += 1;
      } else {
        spans.push({ key, start: index, count: 1 });
      }
    });
    return spans;
  }

  function visibleDeadlines(weeks, deadlinesList = []) {
    if (!weeks.length) return [];
    const start = parseISODate(weeks[0]);
    const end = addDays(parseISODate(weeks[weeks.length - 1]), 6);
    return deadlinesList.filter((deadline) => {
      const d = parseISODate(deadline.date);
      return d && d >= start && d <= end;
    });
  }

  function deadlineX(deadlineDate, weeks, leftWidth, weekWidth) {
    const d = parseISODate(deadlineDate);
    const displayStart = parseISODate(weeks[0]);
    const dayDiff = Math.floor((d - displayStart) / MS_PER_DAY);
    return leftWidth + (dayDiff / 7) * weekWidth;
  }

  function measureTextWidth(text, fontSize = 14, fontWeight = 400) {
    const value = String(text || '');
    try {
      if (typeof document !== 'undefined') {
        if (!measureTextWidth.canvas) {
          measureTextWidth.canvas = document.createElement('canvas');
          measureTextWidth.context = measureTextWidth.canvas.getContext('2d');
        }
        const ctx = measureTextWidth.context;
        if (ctx) {
          ctx.font = `${fontWeight} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
          return ctx.measureText(value).width;
        }
      }
    } catch (error) {
      // フォールバック
    }
    return [...value].reduce((width, char) => width + (/^[\x00-\x7F]$/.test(char) ? fontSize * 0.56 : fontSize), 0);
  }

  function fitColumnWidth(values, options = {}) {
    const {
      fontSize = 14,
      fontWeight = 400,
      padding = 22,
      minWidth = 60,
      maxWidth = 260
    } = options;
    const maxContent = values.reduce((max, val) => {
      return Math.max(max, measureTextWidth(val, fontSize, fontWeight));
    }, 0);
    return Math.max(minWidth, Math.min(maxWidth, Math.ceil(maxContent + padding)));
  }

  function fitText(text, width, fontSize, fontWeight = 400) {
    const str = String(text || '');
    if (!width || width <= 0) return '';
    if (measureTextWidth(str, fontSize, fontWeight) <= width) return str;
    const characters = [...str];
    while (characters.length && measureTextWidth(`${characters.join('')}…`, fontSize, fontWeight) > width) {
      characters.pop();
    }
    return `${characters.join('')}…`;
  }

  function getSvgMarkup(timeline, availableWidth, tasks = [], deadlines = []) {
    const weeks = rangeWeeks(timeline.displayStartWeek, timeline.displayEndWeek);
    if (!weeks.length) return { markup: '', width: 0, height: 0, weekWidth: 0 };
    const compact = !timeline.showWeekRow;
    const autoFit = timeline.weekCellWidth === null;
    const fitWidth = availableWidth || 900;

    const visibleWeekSet = new Set(weeks);
    const visibleTasks = tasks.filter((task) =>
      task.weeks && task.weeks.some((week) => visibleWeekSet.has(week))
    );

    const naturalCategoryWidth = fitColumnWidth(
      visibleTasks.map((task) => task.category || '未分類'),
      { fontSize: 15, fontWeight: 600, padding: 16, minWidth: 64, maxWidth: 145 }
    );
    const naturalTaskWidth = fitColumnWidth(
      visibleTasks.map((task) => task.name || '名称未設定'),
      { fontSize: 14, fontWeight: 400, padding: 16, minWidth: 84, maxWidth: 230 }
    );
    const categoryWidth = Math.min(naturalCategoryWidth, Math.floor(fitWidth * 0.23));
    const taskWidth = Math.min(naturalTaskWidth, Math.floor(fitWidth * 0.37));
    const leftWidth = categoryWidth + taskWidth;
    const weekWidth = timeline.weekCellWidth ?? (fitWidth - leftWidth) / weeks.length;
    const weekStrokeWidth = Math.min(0.8, weekWidth * 0.3);
    const titleHeight = 48;
    const headerRowHeight = 36;
    const headerLabels = compact ? ['年', '月'] : ['年', '月', '週'];
    const headerHeight = headerRowHeight * headerLabels.length;
    const taskRowHeight = 44;
    const tableTop = titleHeight;
    const taskTop = tableTop + headerHeight;
    const tableBottom = taskTop + visibleTasks.length * taskRowHeight;
    const activeDeadlines = visibleDeadlines(weeks, deadlines);
    const deadlineAreaHeight = activeDeadlines.length ? 24 + activeDeadlines.length * 72 : 18;
    const width = autoFit ? fitWidth : leftWidth + weeks.length * weekWidth;
    const height = tableBottom + deadlineAreaHeight;

    const yearSpans = groupedSpans(weeks, (week) => String(parseISODate(week).getUTCFullYear()));
    const monthSpans = groupedSpans(weeks, (week) => {
      const d = parseISODate(week);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    });
    const catSpans = categorySpans(visibleTasks);

    const lines = [];
    const textBase = 'font-family="Segoe UI, system-ui, sans-serif" fill="#333"';
    const title = timeline.title || DEFAULT_TITLE;
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="group" aria-label="${escapeXml(title)}">`);
    lines.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
    lines.push(`<text x="4" y="31" ${textBase} font-size="24" font-weight="700">${escapeXml(fitText(title, width - 8, 24, 700))}</text>`);

    // 左側ヘッダ
    headerLabels.forEach((label, row) => {
      const y = tableTop + row * headerRowHeight;
      lines.push(`<rect x="0" y="${y}" width="${categoryWidth}" height="${headerRowHeight}" fill="#f2f2f2" stroke="#555" stroke-width="1"/>`);
      lines.push(`<rect x="${categoryWidth}" y="${y}" width="${taskWidth}" height="${headerRowHeight}" fill="#f2f2f2" stroke="#555" stroke-width="1"/>`);
      lines.push(`<text x="8" y="${y + headerRowHeight / 2 + 1}" ${textBase} font-size="16" dominant-baseline="middle">${label}</text>`);
    });

    yearSpans.forEach((span) => {
      const x = leftWidth + span.start * weekWidth;
      const w = span.count * weekWidth;
      lines.push(`<rect x="${x}" y="${tableTop}" width="${w}" height="${headerRowHeight}" fill="#f2f2f2" stroke="#555" stroke-width="1"/>`);
      const label = `${span.key} 年`;
      const text = measureTextWidth(label, 16) + 4 > w ? span.key : label;
      if (measureTextWidth(text, 16) + 4 <= w) {
        lines.push(`<text x="${x + w / 2}" y="${tableTop + headerRowHeight / 2 + 1}" ${textBase} font-size="16" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>`);
      }
    });

    monthSpans.forEach((span) => {
      const x = leftWidth + span.start * weekWidth;
      const w = span.count * weekWidth;
      const [, month] = span.key.split('-');
      const y = tableTop + headerRowHeight;
      lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${headerRowHeight}" fill="#f6f6f6" stroke="#555" stroke-width="1"/>`);
      const label = `${Number(month)} 月`;
      const text = measureTextWidth(label, 15) + 4 > w ? String(Number(month)) : label;
      if (measureTextWidth(text, 15) + 4 <= w) {
        lines.push(`<text x="${x + w / 2}" y="${y + headerRowHeight / 2 + 1}" ${textBase} font-size="15" text-anchor="middle" dominant-baseline="middle">${text}</text>`);
      }
    });

    if (!compact) {
      const y = tableTop + headerRowHeight * 2;
      const labels = [];
      let nextLabelLeft = leftWidth + 3;
      weeks.forEach((week, index) => {
        const x = leftWidth + index * weekWidth;
        const center = x + weekWidth / 2;
        const label = formatWeekLabel(week, false);
        const halfLabelWidth = measureTextWidth(label, 12.5) / 2;
        lines.push(`<rect x="${x}" y="${y}" width="${weekWidth}" height="${headerRowHeight}" fill="#fafafa" stroke="#555" stroke-width="${weekStrokeWidth}"><title>${escapeXml(formatWeekLabel(week))}</title></rect>`);
        if (center - halfLabelWidth < nextLabelLeft || center + halfLabelWidth > width - 3) return;
        labels.push(`<text class="week-date-label" x="${center}" y="${y + headerRowHeight / 2 + 1}" ${textBase} font-size="12.5" text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="#fafafa" stroke-width="3" pointer-events="none">${escapeXml(label)}</text>`);
        nextLabelLeft = center + halfLabelWidth + 6;
      });
      lines.push(...labels);
    }

    // 大区分セル
    catSpans.forEach((span, spanIndex) => {
      const y = taskTop + span.start * taskRowHeight;
      const h = span.count * taskRowHeight;
      const fill = spanIndex % 2 === 0 ? '#fbfbfb' : '#f7f7f7';
      lines.push(`<rect x="0" y="${y}" width="${categoryWidth}" height="${h}" fill="${fill}" stroke="#555" stroke-width="1"/>`);
      const label = fitText(span.key, categoryWidth - 16, 15, 600);
      lines.push(`<text x="8" y="${y + 16}" ${textBase} font-size="15" font-weight="600" dominant-baseline="hanging">${escapeXml(label)}</text>`);
    });

    visibleTasks.forEach((task, taskIndex) => {
      const y = taskTop + taskIndex * taskRowHeight;
      lines.push(`<rect x="${categoryWidth}" y="${y}" width="${taskWidth}" height="${taskRowHeight}" fill="#ffffff" stroke="#555" stroke-width="1"/>`);
      const name = task.name || '名称未設定';
      const label = fitText(name, taskWidth - 16, 14);
      lines.push(`<text x="${categoryWidth + 8}" y="${y + taskRowHeight / 2 + 1}" ${textBase} font-size="14" dominant-baseline="middle">${escapeXml(label)}</text>`);
      if (compact) {
        lines.push(`<rect x="${leftWidth}" y="${y}" width="${width - leftWidth}" height="${taskRowHeight}" fill="#ffffff" stroke="#777" stroke-width="0.8"/>`);
      }

      const selected = new Set(task.weeks);
      const inset = compact ? 0 : Math.min(2, weekWidth * 0.2);
      const hitboxStyle = compact ? 'fill="transparent"' : `fill="#ffffff" stroke="#777" stroke-width="${weekStrokeWidth}"`;
      weeks.forEach((week, weekIndex) => {
        const x = leftWidth + weekIndex * weekWidth;
        lines.push(`<g class="timeline-week-cell" data-task-id="${escapeXml(task.id)}" data-week="${week}" tabindex="0" role="button" aria-label="${escapeXml(task.name)} ${escapeXml(formatWeekLabel(week, true))} の選択を切り替える">`);
        lines.push(`<rect class="week-hitbox" x="${x}" y="${y}" width="${weekWidth}" height="${taskRowHeight}" ${hitboxStyle}/>`);
        if (selected.has(week)) {
          lines.push(`<rect x="${x + inset}" y="${y + 5}" width="${weekWidth - inset * 2}" height="${taskRowHeight - 10}" rx="${compact ? 0 : 4}" fill="${escapeXml(task.color)}" opacity="0.92" pointer-events="none"/>`);
        }
        lines.push('</g>');
      });
    });

    if (compact) {
      const monthStarts = new Set(monthSpans.map(({ start }) => start));
      const weekBoundaries = [];
      const monthBoundaries = [];
      for (let index = 1; index < weeks.length; index += 1) {
        const x = leftWidth + index * weekWidth;
        if (monthStarts.has(index)) monthBoundaries.push(`M${x} ${taskTop}V${tableBottom}`);
        else weekBoundaries.push(`M${x} ${taskTop - 5}V${tableBottom}`);
      }
      lines.push(`<path class="week-boundaries" d="${weekBoundaries.join(' ')}" fill="none" stroke="#6d788b" stroke-width="${Math.min(0.65, weekWidth * 0.3)}" pointer-events="none"/>`);
      lines.push(`<path class="month-boundaries" d="${monthBoundaries.join(' ')}" fill="none" stroke="#586576" stroke-width="${Math.min(1, weekWidth * 0.6)}" pointer-events="none"/>`);
    }

    // 締切線と吹き出し
    activeDeadlines.forEach((deadline, index) => {
      const x = deadlineX(deadline.date, weeks, leftWidth, weekWidth);
      const boxWidth = Math.min(236, Math.max(1, width - 8));
      const boxHeight = 58;
      const boxY = tableBottom + 18 + index * 72;
      const boxX = Math.max(Math.min(leftWidth + 4, width - boxWidth - 4), Math.min(width - boxWidth - 4, x - boxWidth / 2));
      const color = validColor(deadline.color) ? deadline.color : DEADLINE_COLOR;
      lines.push(`<line x1="${x}" y1="${tableTop}" x2="${x}" y2="${boxY}" stroke="${color}" stroke-width="${compact ? 1.5 : 4}" pointer-events="none"/>`);
      lines.push(`<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="2" fill="#ffffff" stroke="${color}" stroke-width="3"/>`);
      lines.push(`<text x="${boxX + 14}" y="${boxY + 20}" ${textBase} font-size="14" font-weight="700">${escapeXml(fitText(deadline.name || '締切', boxWidth - 28, 14, 700))}</text>`);
      const sub = deadline.note || `日付：${formatDateLabel(deadline.date)}`;
      lines.push(`<text x="${boxX + 14}" y="${boxY + 42}" ${textBase} font-size="13">${escapeXml(fitText(sub, boxWidth - 28, 13))}</text>`);
    });

    lines.push('</svg>');
    return { markup: lines.join(''), width, height, weekWidth };
  }

  function csvEscape(value) {
    const str = String(value ?? '');
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function stateToCsv(currentState) {
    const lines = [];
    lines.push(['#type', 'title', 'display_start_week', 'display_end_week', 'show_week_row', 'week_cell_width'].map(csvEscape).join(','));
    currentState.timelines.forEach((timeline) => {
      lines.push([
        'timeline',
        timeline.title,
        timeline.displayStartWeek,
        timeline.displayEndWeek,
        timeline.showWeekRow ? 'true' : 'false',
        timeline.weekCellWidth ?? ''
      ].map(csvEscape).join(','));
    });

    lines.push(['#type', 'category', 'name', 'weeks', 'color', 'status'].map(csvEscape).join(','));
    currentState.tasks.forEach((task) => {
      lines.push([
        'task',
        task.category,
        task.name,
        task.weeks.join(';'),
        task.color,
        task.status || TASK_STATUSES[0].value
      ].map(csvEscape).join(','));
    });

    lines.push(['#type', 'date', 'name', 'note', 'color'].map(csvEscape).join(','));
    currentState.deadlines.forEach((deadline) => {
      lines.push([
        'deadline',
        deadline.date,
        deadline.name,
        deadline.note,
        deadline.color
      ].map(csvEscape).join(','));
    });

    return lines.join('\r\n');
  }

  function parseCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;
    while (i < text.length) {
      const char = text[i];
      if (insideQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            currentField += '"';
            i += 1;
          } else {
            insideQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (text[i + 1] === '\n') i += 1;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
      i += 1;
    }
    if (currentField.length || currentRow.length) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }
    return rows;
  }

  function csvToState(text) {
    const rows = parseCsv(text);
    const parsedState = { timelines: [], tasks: [], deadlines: [] };
    let currentHeaders = null;

    function get(row, key, fallback = '') {
      if (!currentHeaders) return fallback;
      const idx = currentHeaders.indexOf(key);
      return idx >= 0 && idx < row.length ? row[idx] : fallback;
    }

    rows.forEach((row) => {
      if (!row || !row.length || !row.some((cell) => String(cell).trim())) return;
      const first = String(row[0]).trim();
      if (first.startsWith('#')) {
        currentHeaders = row.map((cell) => String(cell).trim().replace(/^#/, ''));
        return;
      }
      if (first === 'timeline') {
        parsedState.timelines.push({
          title: get(row, 'title'),
          displayStartWeek: get(row, 'display_start_week'),
          displayEndWeek: get(row, 'display_end_week'),
          showWeekRow: get(row, 'show_week_row', 'true') === 'true',
          weekCellWidth: sanitizeWeekCellWidth(get(row, 'week_cell_width', ''))
        });
      } else if (first === 'task') {
        const weeks = get(row, 'weeks', '')
          .split(';')
          .map((w) => w.trim())
          .filter(Boolean);
        parsedState.tasks.push({
          id: makeId('task'),
          category: get(row, 'category'),
          name: get(row, 'name'),
          weeks,
          color: get(row, 'color'),
          status: get(row, 'status', TASK_STATUSES[0].value)
        });
      } else if (first === 'deadline') {
        parsedState.deadlines.push({
          id: makeId('deadline'),
          date: get(row, 'date'),
          name: get(row, 'name'),
          note: get(row, 'note'),
          color: get(row, 'color')
        });
      }
    });

    return sanitizeState(parsedState);
  }

  return {
    DEFAULT_COLOR,
    DEADLINE_COLOR,
    DEFAULT_TITLE,
    TASK_STATUSES,
    makeId,
    parseISODate,
    isoDate,
    addDays,
    sundayOf,
    normalizeSunday,
    compareIso,
    formatWeekLabel,
    formatDateLabel,
    rangeWeeks,
    sortUniqueWeeks,
    validColor,
    sanitizeWeekCellWidth,
    createBlankState,
    createSampleState,
    sanitizeState,
    escapeXml,
    getSvgMarkup,
    csvEscape,
    stateToCsv,
    parseCsv,
    csvToState
  };
});
