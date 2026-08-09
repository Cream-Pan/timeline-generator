(() => {
  'use strict';

  const STORAGE_KEY = 'progressTimelineGenerator.v1';
  const DEFAULT_COLOR = '#4f7ec7';
  const DEADLINE_COLOR = '#3f78c5';
  const MS_PER_DAY = 86400000;

  const els = {
    messageArea: document.getElementById('messageArea'),
    csvFileInput: document.getElementById('csvFileInput'),
    csvFileName: document.getElementById('csvFileName'),
    newProjectButton: document.getElementById('newProjectButton'),
    downloadCsvButton: document.getElementById('downloadCsvButton'),
    downloadSampleButton: document.getElementById('downloadSampleButton'),
    titleInput: document.getElementById('titleInput'),
    displayStartSelect: document.getElementById('displayStartSelect'),
    displayEndSelect: document.getElementById('displayEndSelect'),
    addTaskButton: document.getElementById('addTaskButton'),
    addDeadlineButton: document.getElementById('addDeadlineButton'),
    taskEditorBody: document.getElementById('taskEditorBody'),
    deadlineEditorBody: document.getElementById('deadlineEditorBody'),
    timelineMount: document.getElementById('timelineMount'),
    downloadPngButton: document.getElementById('downloadPngButton'),
    downloadSvgButton: document.getElementById('downloadSvgButton')
  };

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}-${window.crypto.randomUUID()}`;
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

  function selectedBounds(task) {
    const weeks = sortUniqueWeeks(task.weeks);
    if (!weeks.length) return { start: '', end: '' };
    return { start: weeks[0], end: weeks[weeks.length - 1] };
  }

  function createSampleState() {
    return {
      title: '◎線表',
      displayStartWeek: '2026-07-05',
      displayEndWeek: '2027-03-28',
      tasks: [
        { id: makeId('task'), category: '卒業研究', name: 'ハード改良', weeks: ['2026-07-05'], color: '#4f7ec7' },
        { id: makeId('task'), category: '卒業研究', name: '実験設計検討', weeks: ['2026-07-05', '2026-07-12'], color: '#4f7ec7' },
        { id: makeId('task'), category: '卒業研究', name: '性能評価実験', weeks: ['2026-07-19', '2026-07-26'], color: '#4f7ec7' },
        { id: makeId('task'), category: '卒業研究', name: '実験解析', weeks: ['2026-07-26', '2026-09-13'], color: '#4f7ec7' },
        { id: makeId('task'), category: '卒業研究', name: '環境評価実験', weeks: ['2026-08-09', '2026-08-16'], color: '#4f7ec7' },
        { id: makeId('task'), category: '卒業研究', name: '環境評価実装', weeks: ['2026-09-13', '2026-09-20'], color: '#4f7ec7' },
        { id: makeId('task'), category: '卒業研究', name: '可視化App開発', weeks: ['2026-07-05', '2026-07-12', '2026-07-19', '2026-07-26', '2026-08-02'], color: '#4f7ec7' },
        { id: makeId('task'), category: '卒業研究', name: '原稿執筆', weeks: ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'], color: '#5f8f3e' },
        { id: makeId('task'), category: 'その他', name: '関連研究調査', weeks: [], color: '#9b7ab7' },
        { id: makeId('task'), category: 'その他', name: '輪講', weeks: [], color: '#9b7ab7' }
      ],
      deadlines: [
        { id: makeId('deadline'), name: 'IMWUT 提出締切', date: '2026-11-01', color: DEADLINE_COLOR, note: '提出：11月1日' }
      ]
    };
  }

  function createBlankState() {
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const start = sundayOf(utcToday);
    const end = addDays(start, 7 * 26);
    return {
      title: '◎線表',
      displayStartWeek: isoDate(start),
      displayEndWeek: isoDate(end),
      tasks: [],
      deadlines: []
    };
  }

  function sanitizeState(input) {
    const base = createBlankState();
    if (!input || typeof input !== 'object') return base;
    const tasks = Array.isArray(input.tasks) ? input.tasks : [];
    const deadlines = Array.isArray(input.deadlines) ? input.deadlines : [];

    const sanitized = {
      title: String(input.title || base.title).slice(0, 80),
      displayStartWeek: normalizeSunday(input.displayStartWeek) || base.displayStartWeek,
      displayEndWeek: normalizeSunday(input.displayEndWeek) || base.displayEndWeek,
      tasks: tasks.slice(0, 200).map((task) => {
        let weeks = sortUniqueWeeks(task.weeks);
        if (!weeks.length && task.startWeek && task.endWeek) {
          const start = normalizeSunday(task.startWeek);
          const end = normalizeSunday(task.endWeek);
          if (start && end && compareIso(start, end) <= 0) weeks = rangeWeeks(start, end);
        }
        return {
          id: String(task.id || makeId('task')),
          category: String(task.category || '未分類').slice(0, 50),
          name: String(task.name || '新しいタスク').slice(0, 100),
          weeks,
          color: validColor(task.color) ? task.color : DEFAULT_COLOR
        };
      }),
      deadlines: deadlines.slice(0, 30).map((deadline) => ({
        id: String(deadline.id || makeId('deadline')),
        name: String(deadline.name || '締切').slice(0, 100),
        date: parseISODate(deadline.date) ? deadline.date : '',
        color: validColor(deadline.color) ? deadline.color : DEADLINE_COLOR,
        note: String(deadline.note || '').slice(0, 120)
      }))
    };

    if (compareIso(sanitized.displayStartWeek, sanitized.displayEndWeek) > 0) {
      sanitized.displayEndWeek = sanitized.displayStartWeek;
    }
    return sanitized;
  }

  function validColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
  }

  function loadStoredState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeState(JSON.parse(raw));
    } catch (error) {
      console.warn('localStorage の読み込みに失敗しました。', error);
    }
    return createSampleState();
  }

  let state = loadStoredState();

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showMessage('ブラウザ内の自動保存に失敗しました．CSV保存を利用してください．', 'warning');
    }
  }

  function showMessage(text, type = '') {
    els.messageArea.textContent = text;
    els.messageArea.className = `message-area${type ? ` ${type}` : ''}`;
    if (text) {
      window.clearTimeout(showMessage.timer);
      showMessage.timer = window.setTimeout(() => {
        if (els.messageArea.textContent === text) {
          els.messageArea.textContent = '';
          els.messageArea.className = 'message-area';
        }
      }, 5200);
    }
  }

  function collectDateBounds() {
    const values = [state.displayStartWeek, state.displayEndWeek];
    state.tasks.forEach((task) => values.push(...task.weeks));
    state.deadlines.forEach((deadline) => {
      if (deadline.date) values.push(normalizeSunday(deadline.date));
    });

    const dates = values.map(parseISODate).filter(Boolean);
    const now = new Date();
    const currentYear = now.getFullYear();
    let minYear = currentYear - 4;
    let maxYear = currentYear + 6;
    dates.forEach((d) => {
      minYear = Math.min(minYear, d.getUTCFullYear() - 2);
      maxYear = Math.max(maxYear, d.getUTCFullYear() + 2);
    });
    minYear = Math.max(2000, minYear);
    maxYear = Math.min(2100, maxYear);
    return { minYear, maxYear };
  }

  function buildWeekOptionList() {
    const { minYear, maxYear } = collectDateBounds();
    const jan1 = new Date(Date.UTC(minYear, 0, 1));
    const start = sundayOf(jan1);
    const endDate = new Date(Date.UTC(maxYear, 11, 31));
    const end = sundayOf(endDate);
    return rangeWeeks(isoDate(start), isoDate(end));
  }

  function fillWeekSelect(select, selectedValue, options, blankLabel = null) {
    const fragment = document.createDocumentFragment();
    if (blankLabel !== null) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = blankLabel;
      fragment.appendChild(emptyOption);
    }
    options.forEach((week) => {
      const option = document.createElement('option');
      option.value = week;
      option.textContent = formatWeekLabel(week, true);
      if (week === selectedValue) option.selected = true;
      fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
  }

  function renderSettings() {
    const weekOptions = buildWeekOptionList();
    els.titleInput.value = state.title;
    fillWeekSelect(els.displayStartSelect, state.displayStartWeek, weekOptions);
    fillWeekSelect(els.displayEndSelect, state.displayEndWeek, weekOptions);
  }

  function taskRangeToWeeks(task, start, end) {
    if (!start || !end || compareIso(start, end) > 0) return;
    task.weeks = rangeWeeks(start, end);
  }

  function renderTaskEditor() {
    const weekOptions = buildWeekOptionList();
    const fragment = document.createDocumentFragment();

    if (!state.tasks.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.textContent = 'タスクがありません．「＋ タスク追加」から追加してください．';
      cell.className = 'empty-state';
      row.appendChild(cell);
      fragment.appendChild(row);
    }

    state.tasks.forEach((task, index) => {
      const row = document.createElement('tr');
      row.dataset.taskId = task.id;
      const bounds = selectedBounds(task);

      const categoryCell = document.createElement('td');
      const categoryInput = document.createElement('input');
      categoryInput.className = 'editor-input';
      categoryInput.value = task.category;
      categoryInput.maxLength = 50;
      categoryInput.setAttribute('aria-label', `${task.name} の大区分`);
      categoryInput.addEventListener('input', () => {
        task.category = categoryInput.value;
        persistAndRenderTimeline();
      });
      categoryCell.appendChild(categoryInput);

      const nameCell = document.createElement('td');
      const nameInput = document.createElement('input');
      nameInput.className = 'editor-input';
      nameInput.value = task.name;
      nameInput.maxLength = 100;
      nameInput.setAttribute('aria-label', 'タスク名');
      nameInput.addEventListener('input', () => {
        task.name = nameInput.value;
        persistAndRenderTimeline();
      });
      nameCell.appendChild(nameInput);

      const startCell = document.createElement('td');
      const startSelect = document.createElement('select');
      startSelect.className = 'editor-select';
      fillWeekSelect(startSelect, bounds.start, weekOptions, '未設定');
      startSelect.setAttribute('aria-label', `${task.name} の開始週`);
      startCell.appendChild(startSelect);

      const endCell = document.createElement('td');
      const endSelect = document.createElement('select');
      endSelect.className = 'editor-select';
      fillWeekSelect(endSelect, bounds.end, weekOptions, '未設定');
      endSelect.setAttribute('aria-label', `${task.name} の終了週`);
      endCell.appendChild(endSelect);

      const applyRange = (source) => {
        let start = startSelect.value;
        let end = endSelect.value;
        if (!start && !end) {
          task.weeks = [];
        } else {
          if (!start) start = end;
          if (!end) end = start;
          if (compareIso(start, end) > 0) {
            if (source === 'start') end = start;
            else start = end;
          }
          taskRangeToWeeks(task, start, end);
        }
        renderTaskEditor();
        persistAndRenderTimeline();
      };
      startSelect.addEventListener('change', () => applyRange('start'));
      endSelect.addEventListener('change', () => applyRange('end'));

      const colorCell = document.createElement('td');
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'editor-input';
      colorInput.value = task.color;
      colorInput.setAttribute('aria-label', `${task.name} の色`);
      colorInput.addEventListener('input', () => {
        task.color = colorInput.value;
        persistAndRenderTimeline();
      });
      colorCell.appendChild(colorInput);

      const countCell = document.createElement('td');
      const countBadge = document.createElement('span');
      countBadge.textContent = `${task.weeks.length} 週`;
      countBadge.className = 'week-count-badge';
      countCell.appendChild(countBadge);

      const orderCell = document.createElement('td');
      const orderWrap = document.createElement('div');
      orderWrap.className = 'order-buttons';
      const upButton = document.createElement('button');
      upButton.type = 'button';
      upButton.className = 'icon-button secondary-button';
      upButton.textContent = '↑';
      upButton.title = '上へ移動';
      upButton.disabled = index === 0;
      upButton.addEventListener('click', () => moveTask(index, index - 1));
      const downButton = document.createElement('button');
      downButton.type = 'button';
      downButton.className = 'icon-button secondary-button';
      downButton.textContent = '↓';
      downButton.title = '下へ移動';
      downButton.disabled = index === state.tasks.length - 1;
      downButton.addEventListener('click', () => moveTask(index, index + 1));
      orderWrap.append(upButton, downButton);
      orderCell.appendChild(orderWrap);

      const deleteCell = document.createElement('td');
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'icon-button danger-button';
      deleteButton.textContent = '削除';
      deleteButton.addEventListener('click', () => {
        if (!window.confirm(`「${task.name || 'このタスク'}」を削除しますか？`)) return;
        state.tasks.splice(index, 1);
        renderAll();
        saveLocal();
      });
      deleteCell.appendChild(deleteButton);

      row.append(categoryCell, nameCell, startCell, endCell, colorCell, countCell, orderCell, deleteCell);
      fragment.appendChild(row);
    });

    els.taskEditorBody.replaceChildren(fragment);
  }

  function moveTask(from, to) {
    if (to < 0 || to >= state.tasks.length) return;
    const [item] = state.tasks.splice(from, 1);
    state.tasks.splice(to, 0, item);
    renderTaskEditor();
    persistAndRenderTimeline();
  }

  function renderDeadlineEditor() {
    const fragment = document.createDocumentFragment();

    if (!state.deadlines.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = '締切がありません．必要な場合は「＋ 締切追加」から追加してください．';
      cell.className = 'empty-state';
      row.appendChild(cell);
      fragment.appendChild(row);
    }

    state.deadlines.forEach((deadline, index) => {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      const nameInput = document.createElement('input');
      nameInput.className = 'editor-input';
      nameInput.value = deadline.name;
      nameInput.maxLength = 100;
      nameInput.addEventListener('input', () => {
        deadline.name = nameInput.value;
        persistAndRenderTimeline();
      });
      nameCell.appendChild(nameInput);

      const dateCell = document.createElement('td');
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'editor-input';
      dateInput.value = deadline.date;
      dateInput.addEventListener('change', () => {
        deadline.date = parseISODate(dateInput.value) ? dateInput.value : '';
        persistAndRenderTimeline();
      });
      dateCell.appendChild(dateInput);

      const colorCell = document.createElement('td');
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'editor-input';
      colorInput.value = deadline.color;
      colorInput.addEventListener('input', () => {
        deadline.color = colorInput.value;
        persistAndRenderTimeline();
      });
      colorCell.appendChild(colorInput);

      const noteCell = document.createElement('td');
      const noteInput = document.createElement('input');
      noteInput.className = 'editor-input';
      noteInput.value = deadline.note;
      noteInput.maxLength = 120;
      noteInput.placeholder = '例：提出：11月1日';
      noteInput.addEventListener('input', () => {
        deadline.note = noteInput.value;
        persistAndRenderTimeline();
      });
      noteCell.appendChild(noteInput);

      const deleteCell = document.createElement('td');
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'icon-button danger-button';
      deleteButton.textContent = '削除';
      deleteButton.addEventListener('click', () => {
        if (!window.confirm(`「${deadline.name || 'この締切'}」を削除しますか？`)) return;
        state.deadlines.splice(index, 1);
        renderAll();
        saveLocal();
      });
      deleteCell.appendChild(deleteButton);

      row.append(nameCell, dateCell, colorCell, noteCell, deleteCell);
      fragment.appendChild(row);
    });

    els.deadlineEditorBody.replaceChildren(fragment);
  }

  function escapeXml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function groupedSpans(weeks, keyFn) {
    const spans = [];
    let current = null;
    weeks.forEach((week, index) => {
      const key = keyFn(week);
      if (!current || current.key !== key) {
        current = { key, start: index, count: 1 };
        spans.push(current);
      } else {
        current.count += 1;
      }
    });
    return spans;
  }

  function categorySpans(tasks) {
    const spans = [];
    let current = null;
    tasks.forEach((task, index) => {
      const key = task.category || '未分類';
      if (!current || current.key !== key) {
        current = { key, start: index, count: 1 };
        spans.push(current);
      } else {
        current.count += 1;
      }
    });
    return spans;
  }

  function visibleDeadlines(weeks) {
    if (!weeks.length) return [];
    const start = parseISODate(weeks[0]);
    const end = addDays(parseISODate(weeks[weeks.length - 1]), 6);
    return state.deadlines.filter((deadline) => {
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

  // SVGの列幅を内容に合わせてできるだけコンパクトにする．
  // CanvasのmeasureTextを使うことで，日本語・英数字が混在するタスク名でも
  // 固定幅より余白を抑えつつ，文字が収まる幅を計算できる．
  function measureTextWidth(text, fontSize = 14, fontWeight = 400) {
    const value = String(text || '');
    try {
      if (!measureTextWidth.canvas) {
        measureTextWidth.canvas = document.createElement('canvas');
        measureTextWidth.context = measureTextWidth.canvas.getContext('2d');
      }
      const ctx = measureTextWidth.context;
      if (ctx) {
        ctx.font = `${fontWeight} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
        return ctx.measureText(value).width;
      }
    } catch (error) {
      // Canvasが利用できない場合は，下の概算値へフォールバックする．
    }
    return [...value].reduce((width, char) => width + (/^[\x00-\x7F]$/.test(char) ? fontSize * 0.56 : fontSize), 0);
  }

  function fitColumnWidth(values, options = {}) {
    const {
      fontSize = 14,
      fontWeight = 400,
      padding = 22,
      minWidth = 48,
      maxWidth = 260
    } = options;
    const widest = (values || []).reduce(
      (max, value) => Math.max(max, measureTextWidth(value, fontSize, fontWeight)),
      0
    );
    return Math.ceil(Math.max(minWidth, Math.min(maxWidth, widest + padding)));
  }

  function getSvgMarkup() {
    const weeks = rangeWeeks(state.displayStartWeek, state.displayEndWeek);
    if (!weeks.length) return { markup: '', width: 0, height: 0 };

    // 線表プレビューには，表示区間内に1週以上設定されているタスクだけを表示する．
    // タスク編集欄やCSV上のデータ自体は削除せず，プレビュー上だけを絞り込む．
    const visibleWeekSet = new Set(weeks);
    const visibleTasks = state.tasks.filter((task) =>
      task.weeks.some((week) => visibleWeekSet.has(week))
    );

    // 固定幅ではなく，現在表示している文字列に合わせて列幅を決める．
    // 週列は「12/27~」程度が収まる最小限の幅にすることで，長期間表示時の横幅を抑える．
    const categoryWidth = fitColumnWidth(
      visibleTasks.map((task) => task.category || '未分類'),
      { fontSize: 15, fontWeight: 600, padding: 16, minWidth: 64, maxWidth: 145 }
    );
    const taskWidth = fitColumnWidth(
      visibleTasks.map((task) => task.name || '名称未設定'),
      { fontSize: 14, fontWeight: 400, padding: 16, minWidth: 84, maxWidth: 230 }
    );
    const weekWidth = fitColumnWidth(
      weeks.map((week) => formatWeekLabel(week, false)),
      { fontSize: 12.5, fontWeight: 400, padding: 6, minWidth: 42, maxWidth: 50 }
    );
    const leftWidth = categoryWidth + taskWidth;
    const titleHeight = 48;
    const headerRowHeight = 36;
    const headerHeight = headerRowHeight * 3;
    const taskRowHeight = 44;
    const tableTop = titleHeight;
    const taskTop = tableTop + headerHeight;
    const tableBottom = taskTop + visibleTasks.length * taskRowHeight;
    const deadlines = visibleDeadlines(weeks);
    const deadlineAreaHeight = deadlines.length ? 24 + deadlines.length * 72 : 18;
    const width = leftWidth + weeks.length * weekWidth;
    const height = tableBottom + deadlineAreaHeight;

    const yearSpans = groupedSpans(weeks, (week) => String(parseISODate(week).getUTCFullYear()));
    const monthSpans = groupedSpans(weeks, (week) => {
      const d = parseISODate(week);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    });
    const catSpans = categorySpans(visibleTasks);

    const lines = [];
    const textBase = 'font-family="Segoe UI, system-ui, sans-serif" fill="#333"';
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(state.title || '進捗線表')}">`);
    lines.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
    lines.push(`<text x="4" y="31" ${textBase} font-size="24" font-weight="700">${escapeXml(state.title || '◎線表')}</text>`);

    // 左側ヘッダ
    ['年', '月', '週'].forEach((label, row) => {
      const y = tableTop + row * headerRowHeight;
      lines.push(`<rect x="0" y="${y}" width="${categoryWidth}" height="${headerRowHeight}" fill="#f2f2f2" stroke="#555" stroke-width="1"/>`);
      lines.push(`<rect x="${categoryWidth}" y="${y}" width="${taskWidth}" height="${headerRowHeight}" fill="#f2f2f2" stroke="#555" stroke-width="1"/>`);
      lines.push(`<text x="8" y="${y + headerRowHeight / 2 + 1}" ${textBase} font-size="16" dominant-baseline="middle">${label}</text>`);
    });

    yearSpans.forEach((span) => {
      const x = leftWidth + span.start * weekWidth;
      const w = span.count * weekWidth;
      lines.push(`<rect x="${x}" y="${tableTop}" width="${w}" height="${headerRowHeight}" fill="#f2f2f2" stroke="#555" stroke-width="1"/>`);
      lines.push(`<text x="${x + w / 2}" y="${tableTop + headerRowHeight / 2 + 1}" ${textBase} font-size="16" text-anchor="middle" dominant-baseline="middle">${escapeXml(span.key)} 年</text>`);
    });

    monthSpans.forEach((span) => {
      const x = leftWidth + span.start * weekWidth;
      const w = span.count * weekWidth;
      const [, month] = span.key.split('-');
      const y = tableTop + headerRowHeight;
      lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${headerRowHeight}" fill="#f6f6f6" stroke="#555" stroke-width="1"/>`);
      lines.push(`<text x="${x + w / 2}" y="${y + headerRowHeight / 2 + 1}" ${textBase} font-size="15" text-anchor="middle" dominant-baseline="middle">${Number(month)} 月</text>`);
    });

    weeks.forEach((week, index) => {
      const x = leftWidth + index * weekWidth;
      const y = tableTop + headerRowHeight * 2;
      lines.push(`<rect x="${x}" y="${y}" width="${weekWidth}" height="${headerRowHeight}" fill="#fafafa" stroke="#555" stroke-width="1"/>`);
      lines.push(`<text x="${x + weekWidth / 2}" y="${y + headerRowHeight / 2 + 1}" ${textBase} font-size="12.5" text-anchor="middle" dominant-baseline="middle">${escapeXml(formatWeekLabel(week, false))}</text>`);
    });

    // 大区分セル
    catSpans.forEach((span, spanIndex) => {
      const y = taskTop + span.start * taskRowHeight;
      const h = span.count * taskRowHeight;
      const fill = spanIndex % 2 === 0 ? '#fbfbfb' : '#f7f7f7';
      lines.push(`<rect x="0" y="${y}" width="${categoryWidth}" height="${h}" fill="${fill}" stroke="#555" stroke-width="1"/>`);
      lines.push(`<text x="8" y="${y + 16}" ${textBase} font-size="15" font-weight="600" dominant-baseline="hanging">${escapeXml(span.key)}</text>`);
    });

    visibleTasks.forEach((task, taskIndex) => {
      const y = taskTop + taskIndex * taskRowHeight;
      lines.push(`<rect x="${categoryWidth}" y="${y}" width="${taskWidth}" height="${taskRowHeight}" fill="#ffffff" stroke="#555" stroke-width="1"/>`);
      lines.push(`<text x="${categoryWidth + 8}" y="${y + taskRowHeight / 2 + 1}" ${textBase} font-size="14" dominant-baseline="middle">${escapeXml(task.name || '名称未設定')}</text>`);

      const selected = new Set(task.weeks);
      weeks.forEach((week, weekIndex) => {
        const x = leftWidth + weekIndex * weekWidth;
        lines.push(`<g class="timeline-week-cell" data-task-id="${escapeXml(task.id)}" data-week="${week}" tabindex="0" role="button" aria-label="${escapeXml(task.name)} ${escapeXml(formatWeekLabel(week, true))} の選択を切り替える">`);
        lines.push(`<rect class="week-hitbox" x="${x}" y="${y}" width="${weekWidth}" height="${taskRowHeight}" fill="#ffffff" stroke="#777" stroke-width="0.8"/>`);
        if (selected.has(week)) {
          lines.push(`<rect x="${x + 2}" y="${y + 5}" width="${weekWidth - 4}" height="${taskRowHeight - 10}" rx="4" fill="${escapeXml(task.color)}" opacity="0.92" pointer-events="none"/>`);
        }
        lines.push('</g>');
      });
    });

    // 締切線と吹き出し
    deadlines.forEach((deadline, index) => {
      const x = deadlineX(deadline.date, weeks, leftWidth, weekWidth);
      const boxWidth = 236;
      const boxHeight = 58;
      const boxY = tableBottom + 18 + index * 72;
      const boxX = Math.max(leftWidth + 4, Math.min(width - boxWidth - 4, x - boxWidth / 2));
      const color = validColor(deadline.color) ? deadline.color : DEADLINE_COLOR;
      lines.push(`<line x1="${x}" y1="${tableTop}" x2="${x}" y2="${boxY}" stroke="${color}" stroke-width="4"/>`);
      lines.push(`<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="2" fill="#ffffff" stroke="${color}" stroke-width="3"/>`);
      lines.push(`<text x="${boxX + 14}" y="${boxY + 20}" ${textBase} font-size="14" font-weight="700">${escapeXml(deadline.name || '締切')}</text>`);
      const sub = deadline.note || `日付：${formatDateLabel(deadline.date)}`;
      lines.push(`<text x="${boxX + 14}" y="${boxY + 42}" ${textBase} font-size="13">${escapeXml(sub)}</text>`);
    });

    lines.push('</svg>');
    return { markup: lines.join(''), width, height };
  }

  function renderTimeline() {
    const { markup } = getSvgMarkup();
    if (!markup) {
      els.timelineMount.innerHTML = '<div class="empty-state">表示期間を確認してください．</div>';
      return;
    }
    els.timelineMount.innerHTML = markup;
  }

  function persistAndRenderTimeline() {
    saveLocal();
    renderTimeline();
  }

  function renderAll() {
    renderSettings();
    renderTaskEditor();
    renderDeadlineEditor();
    renderTimeline();
  }

  function toggleTaskWeek(taskId, week) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const selected = new Set(task.weeks);
    if (selected.has(week)) selected.delete(week);
    else selected.add(week);
    task.weeks = sortUniqueWeeks([...selected]);
    saveLocal();
    renderTaskEditor();
    renderTimeline();
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function stateToCsv(currentState) {
    const headers = ['record_type', 'order', 'category', 'name', 'start_week', 'end_week', 'weeks', 'date', 'color', 'note'];
    const rows = [headers];
    rows.push(['settings', '', '', currentState.title, currentState.displayStartWeek, currentState.displayEndWeek, '', '', '', '']);

    currentState.tasks.forEach((task, index) => {
      const bounds = selectedBounds(task);
      rows.push([
        'task',
        index + 1,
        task.category,
        task.name,
        bounds.start,
        bounds.end,
        sortUniqueWeeks(task.weeks).join(';'),
        '',
        task.color,
        ''
      ]);
    });

    currentState.deadlines.forEach((deadline, index) => {
      rows.push([
        'deadline',
        index + 1,
        '',
        deadline.name,
        '',
        '',
        '',
        deadline.date,
        deadline.color,
        deadline.note
      ]);
    });

    return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (quoted) {
        if (ch === '"') {
          if (source[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }

    row.push(field.replace(/\r$/, ''));
    if (row.some((cell) => cell !== '') || rows.length === 0) rows.push(row);
    return rows;
  }

  function csvToState(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('CSVにデータ行がありません．');
    const headers = rows[0].map((h) => h.trim());
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
    const hasType = Object.prototype.hasOwnProperty.call(idx, 'record_type');

    const imported = createBlankState();
    imported.tasks = [];
    imported.deadlines = [];
    let normalizedCount = 0;

    function get(row, key, fallback = '') {
      const i = idx[key];
      return i === undefined ? fallback : String(row[i] ?? '').trim();
    }

    rows.slice(1).forEach((row, rowIndex) => {
      if (!row.some((cell) => String(cell).trim() !== '')) return;
      const type = hasType ? get(row, 'record_type').toLowerCase() : 'task';

      if (type === 'settings') {
        imported.title = get(row, 'name') || imported.title;
        const startRaw = get(row, 'start_week');
        const endRaw = get(row, 'end_week');
        if (startRaw) imported.displayStartWeek = normalizeSunday(startRaw) || imported.displayStartWeek;
        if (endRaw) imported.displayEndWeek = normalizeSunday(endRaw) || imported.displayEndWeek;
        return;
      }

      if (type === 'deadline') {
        const date = get(row, 'date');
        imported.deadlines.push({
          id: makeId('deadline'),
          name: get(row, 'name') || '締切',
          date: parseISODate(date) ? date : '',
          color: validColor(get(row, 'color')) ? get(row, 'color') : DEADLINE_COLOR,
          note: get(row, 'note')
        });
        return;
      }

      if (type !== 'task') return;
      const category = get(row, 'category') || '未分類';
      const name = get(row, 'name') || get(row, 'task') || `タスク ${rowIndex + 1}`;
      let weeks = [];
      const weeksRaw = get(row, 'weeks');
      if (weeksRaw) {
        weeks = weeksRaw.split(/[;|]/).map((value) => {
          const normalized = normalizeSunday(value.trim());
          if (normalized && normalized !== value.trim()) normalizedCount += 1;
          return normalized;
        }).filter(Boolean);
      } else {
        const startRaw = get(row, 'start_week') || get(row, 'start_date');
        const endRaw = get(row, 'end_week') || get(row, 'end_date');
        if (startRaw && endRaw) {
          const start = normalizeSunday(startRaw);
          const end = normalizeSunday(endRaw);
          if (start && end) {
            if (start !== startRaw) normalizedCount += 1;
            if (end !== endRaw) normalizedCount += 1;
            weeks = rangeWeeks(compareIso(start, end) <= 0 ? start : end, compareIso(start, end) <= 0 ? end : start);
          }
        }
      }

      const orderValue = Number(get(row, 'order'));
      imported.tasks.push({
        id: makeId('task'),
        category,
        name,
        weeks: sortUniqueWeeks(weeks),
        color: validColor(get(row, 'color')) ? get(row, 'color') : DEFAULT_COLOR,
        _order: Number.isFinite(orderValue) && orderValue > 0 ? orderValue : imported.tasks.length + 1
      });
    });

    imported.tasks.sort((a, b) => a._order - b._order);
    imported.tasks.forEach((task) => { delete task._order; });

    if (compareIso(imported.displayStartWeek, imported.displayEndWeek) > 0) {
      [imported.displayStartWeek, imported.displayEndWeek] = [imported.displayEndWeek, imported.displayStartWeek];
    }

    return { state: sanitizeState(imported), normalizedCount };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fileSafeTitle() {
    const raw = state.title.replace(/[\\/:*?"<>|]/g, '_').replace(/^◎/, '').trim();
    return raw || 'progress_timeline';
  }

  function downloadCsv(currentState = state, filename = `${fileSafeTitle()}.csv`) {
    const csv = stateToCsv(currentState);
    downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), filename);
  }

  function downloadSvg() {
    const { markup } = getSvgMarkup();
    if (!markup) return;
    downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${fileSafeTitle()}.svg`);
  }

  function downloadPng() {
    const { markup, width, height } = getSvgMarkup();
    if (!markup || !width || !height) return;
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (!pngBlob) {
          showMessage('PNGの生成に失敗しました．SVG保存を利用してください．', 'error');
          return;
        }
        downloadBlob(pngBlob, `${fileSafeTitle()}.png`);
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      showMessage('PNGの生成に失敗しました．SVG保存を利用してください．', 'error');
    };
    image.src = url;
  }

  function addTask() {
    const defaultWeek = state.displayStartWeek;
    const previousCategory = state.tasks.length ? state.tasks[state.tasks.length - 1].category : '卒業研究';
    state.tasks.push({
      id: makeId('task'),
      category: previousCategory,
      name: '新しいタスク',
      weeks: [defaultWeek],
      color: DEFAULT_COLOR
    });
    renderTaskEditor();
    persistAndRenderTimeline();
  }

  function addDeadline() {
    const fallback = state.displayEndWeek;
    state.deadlines.push({
      id: makeId('deadline'),
      name: '新しい締切',
      date: fallback,
      color: DEADLINE_COLOR,
      note: ''
    });
    renderDeadlineEditor();
    persistAndRenderTimeline();
  }

  els.titleInput.addEventListener('input', () => {
    state.title = els.titleInput.value.slice(0, 80);
    persistAndRenderTimeline();
  });

  els.displayStartSelect.addEventListener('change', () => {
    const next = els.displayStartSelect.value;
    state.displayStartWeek = next;
    if (compareIso(state.displayEndWeek, next) < 0) state.displayEndWeek = next;
    renderSettings();
    persistAndRenderTimeline();
  });

  els.displayEndSelect.addEventListener('change', () => {
    const next = els.displayEndSelect.value;
    state.displayEndWeek = next;
    if (compareIso(state.displayStartWeek, next) > 0) state.displayStartWeek = next;
    renderSettings();
    persistAndRenderTimeline();
  });

  els.addTaskButton.addEventListener('click', addTask);
  els.addDeadlineButton.addEventListener('click', addDeadline);
  els.downloadCsvButton.addEventListener('click', () => downloadCsv());
  els.downloadSvgButton.addEventListener('click', downloadSvg);
  els.downloadPngButton.addEventListener('click', downloadPng);

  els.downloadSampleButton.addEventListener('click', () => {
    downloadCsv(createSampleState(), 'sample_schedule.csv');
  });

  els.newProjectButton.addEventListener('click', () => {
    if (!window.confirm('現在の編集内容を新規状態に置き換えますか？必要であれば先にCSV保存してください．')) return;
    state = createBlankState();
    els.csvFileInput.value = '';
    els.csvFileName.textContent = '未選択';
    renderAll();
    saveLocal();
    showMessage('新しい線表を作成しました．');
  });

  els.csvFileInput.addEventListener('change', async () => {
    const file = els.csvFileInput.files && els.csvFileInput.files[0];
    if (!file) return;
    els.csvFileName.textContent = file.name;
    try {
      const text = await file.text();
      const result = csvToState(text);
      state = result.state;
      renderAll();
      saveLocal();
      if (result.normalizedCount > 0) {
        showMessage(`CSVを読み込みました．日曜以外の日付 ${result.normalizedCount} 件は，その週の日曜日へ自動補正しました．`, 'warning');
      } else {
        showMessage('CSVを読み込みました．');
      }
    } catch (error) {
      console.error(error);
      showMessage(`CSVを読み込めませんでした：${error.message}`, 'error');
    }
  });

  els.timelineMount.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-task-id][data-week]');
    if (!cell) return;
    toggleTaskWeek(cell.dataset.taskId, cell.dataset.week);
  });

  els.timelineMount.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const cell = event.target.closest('[data-task-id][data-week]');
    if (!cell) return;
    event.preventDefault();
    toggleTaskWeek(cell.dataset.taskId, cell.dataset.week);
  });

  renderAll();
  saveLocal();
})();
