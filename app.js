(() => {
  'use strict';

  const STORAGE_KEY = 'progressTimelineGenerator.v1';
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

  const els = {
    messageArea: document.getElementById('messageArea'),
    csvFileInput: document.getElementById('csvFileInput'),
    csvFileName: document.getElementById('csvFileName'),
    newProjectButton: document.getElementById('newProjectButton'),
    downloadCsvButton: document.getElementById('downloadCsvButton'),
    downloadSampleButton: document.getElementById('downloadSampleButton'),
    timelineSettings: document.getElementById('timelineSettings'),
    timelineSettingsTemplate: document.getElementById('timelineSettingsTemplate'),
    addTaskButton: document.getElementById('addTaskButton'),
    addDeadlineButton: document.getElementById('addDeadlineButton'),
    taskEditorScroll: document.getElementById('taskEditorScroll'),
    taskEditorBody: document.getElementById('taskEditorBody'),
    deadlineEditorBody: document.getElementById('deadlineEditorBody'),
    timelinePreviews: document.getElementById('timelinePreviews'),
    timelinePreviewTemplate: document.getElementById('timelinePreviewTemplate'),
    showAllWeeks: document.getElementById('showAllWeeks'),
    hideAllWeeks: document.getElementById('hideAllWeeks')
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

  function sanitizeState(input) {
    const base = createBlankState();
    if (!input || typeof input !== 'object') return base;
    const tasks = Array.isArray(input.tasks) ? input.tasks : [];
    const deadlines = Array.isArray(input.deadlines) ? input.deadlines : [];
    const timelines = Array.isArray(input.timelines) && input.timelines.length ? input.timelines : [input];
    const defaultTimeline = base.timelines[0];

    return {
      timelines: timelines.map((timeline) => {
        const displayStartWeek = normalizeSunday(timeline.displayStartWeek) || defaultTimeline.displayStartWeek;
        const displayEndWeek = normalizeSunday(timeline.displayEndWeek) || defaultTimeline.displayEndWeek;
        return {
          title: String(timeline.title || DEFAULT_TITLE).slice(0, 80),
          displayStartWeek,
          displayEndWeek: compareIso(displayStartWeek, displayEndWeek) <= 0 ? displayEndWeek : displayStartWeek,
          showWeekRow: timeline.showWeekRow !== false,
          weekCellWidth: sanitizeWeekCellWidth(timeline.weekCellWidth)
        };
      }),
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
          color: validColor(task.color) ? task.color : DEFAULT_COLOR,
          status: TASK_STATUSES.find(({ value }) => value === task.status)?.value ?? TASK_STATUSES[0].value
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
  }

  function validColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
  }

  function sanitizeWeekCellWidth(value) {
    const width = Number(value);
    return width >= MIN_WEEK_CELL_WIDTH && width <= MAX_WEEK_CELL_WIDTH
      ? Math.round(width * 10) / 10
      : null;
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
    const values = state.timelines.flatMap(({ displayStartWeek, displayEndWeek }) => [displayStartWeek, displayEndWeek]);
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
    const weeks = selectedValue && !options.includes(selectedValue)
      ? [...options, selectedValue].sort(compareIso)
      : options;
    weeks.forEach((week) => {
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
    const cards = state.timelines.map((timeline, index) => {
      const card = els.timelineSettingsTemplate.content.firstElementChild.cloneNode(true);
      card.querySelector('legend').textContent = `線表${index + 1}`;
      const title = card.querySelector('.timeline-title-input');
      const start = card.querySelector('.timeline-start');
      const end = card.querySelector('.timeline-end');
      title.value = timeline.title;
      fillWeekSelect(start, timeline.displayStartWeek, weekOptions);
      fillWeekSelect(end, timeline.displayEndWeek, weekOptions);

      title.addEventListener('input', () => {
        timeline.title = title.value.slice(0, 80);
        persistAndRenderTimeline();
      });
      start.addEventListener('change', () => {
        timeline.displayStartWeek = start.value;
        if (compareIso(start.value, end.value) > 0) {
          timeline.displayEndWeek = start.value;
          fillWeekSelect(end, start.value, weekOptions);
        }
        persistAndRenderTimeline();
      });
      end.addEventListener('change', () => {
        timeline.displayEndWeek = end.value;
        if (compareIso(end.value, start.value) < 0) {
          timeline.displayStartWeek = end.value;
          fillWeekSelect(start, end.value, weekOptions);
        }
        persistAndRenderTimeline();
      });
      card.querySelector('.timeline-add').addEventListener('click', () => {
        state.timelines.push({ ...timeline });
        renderTimelineCards();
        saveLocal();
        els.timelineSettings.lastElementChild.querySelector('.timeline-start').focus();
      });
      const remove = card.querySelector('.timeline-remove');
      remove.hidden = state.timelines.length === 1;
      remove.addEventListener('click', () => {
        state.timelines.splice(index, 1);
        renderTimelineCards();
        saveLocal();
        els.timelineSettings.children[Math.min(index, state.timelines.length - 1)].querySelector('.timeline-add').focus();
      });
      return card;
    });
    els.timelineSettings.replaceChildren(...cards);
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
      cell.colSpan = 9;
      cell.textContent = 'タスクがありません．「＋ タスク追加」から追加してください．';
      cell.className = 'empty-state';
      row.appendChild(cell);
      fragment.appendChild(row);
    }

    state.tasks.forEach((task, index) => {
      const row = document.createElement('tr');
      row.dataset.taskId = task.id;
      const bounds = selectedBounds(task);

      const statusCell = document.createElement('td');
      statusCell.className = 'task-status-cell';
      const statusCheckbox = document.createElement('input');
      statusCheckbox.type = 'checkbox';
      statusCheckbox.className = 'task-status-checkbox';
      let statusIndex = TASK_STATUSES.findIndex(({ value }) => value === task.status);
      const updateStatusCheckbox = () => {
        const { value, label } = TASK_STATUSES[statusIndex];
        statusCheckbox.checked = value === 'completed';
        statusCheckbox.indeterminate = value === 'running';
        statusCheckbox.title = label;
        statusCheckbox.setAttribute('aria-label', `${task.name || 'タスク'} の進捗（${label}）`);
      };
      updateStatusCheckbox();
      statusCheckbox.addEventListener('change', () => {
        statusIndex = (statusIndex + 1) % TASK_STATUSES.length;
        task.status = TASK_STATUSES[statusIndex].value;
        updateStatusCheckbox();
        saveLocal();
      });
      statusCell.appendChild(statusCheckbox);

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
        updateStatusCheckbox();
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
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'icon-button secondary-button task-drag-handle';
      handle.textContent = '⠿';
      handle.title = 'ドラッグして並べ替え';
      handle.setAttribute('aria-label', `${task.name} をドラッグして並べ替え`);
      handle.addEventListener('pointerdown', (event) => startTaskDrag(event, row, index));
      orderCell.appendChild(handle);

      const deleteCell = document.createElement('td');
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'icon-button danger-button';
      deleteButton.textContent = '×';
      deleteButton.title = 'タスクを削除';
      deleteButton.setAttribute('aria-label', 'タスクを削除');
      deleteButton.addEventListener('click', () => {
        if (!window.confirm(`「${task.name || 'このタスク'}」を削除しますか？`)) return;
        state.tasks.splice(index, 1);
        renderTaskEditor();
        persistAndRenderTimeline();
      });
      deleteCell.appendChild(deleteButton);

      row.append(statusCell, categoryCell, nameCell, startCell, endCell, colorCell, countCell, orderCell, deleteCell);
      fragment.appendChild(row);
    });

    els.taskEditorBody.replaceChildren(fragment);
  }

  function moveTask(from, to) {
    if (from === to) return;
    const [item] = state.tasks.splice(from, 1);
    state.tasks.splice(to, 0, item);
    renderTaskEditor();
    persistAndRenderTimeline();
  }

  function startTaskDrag(event, sourceRow, from) {
    if (!event.isPrimary || event.button !== 0 || state.tasks.length < 2) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const scroller = els.taskEditorScroll;
    const header = scroller.querySelector('thead');
    const rows = Array.from(els.taskEditorBody.children).filter((row) => row !== sourceRow);
    const listeners = new AbortController();
    const { signal } = listeners;
    let pointer = event;
    const startX = event.clientX;
    const startY = event.clientY;
    let targetIndex = from;
    let marker = null;
    let frame;

    function updateTarget() {
      const bounds = scroller.getBoundingClientRect();
      const top = bounds.top + header.getBoundingClientRect().height;
      marker?.classList.remove('drop-before', 'drop-after');
      marker = null;
      if (pointer.clientX < bounds.left || pointer.clientX > bounds.right ||
          pointer.clientY < bounds.top || pointer.clientY > bounds.bottom) return;

      const y = Math.max(top, pointer.clientY);
      const next = rows.findIndex((row) => {
        const rect = row.getBoundingClientRect();
        return y < rect.top + rect.height / 2;
      });
      targetIndex = next < 0 ? rows.length : next;
      if (targetIndex === from) return;
      marker = next < 0 ? rows[rows.length - 1] : rows[next];
      marker.classList.add(next < 0 ? 'drop-after' : 'drop-before');
    }

    function autoScroll() {
      const bounds = scroller.getBoundingClientRect();
      if (pointer.clientX >= bounds.left && pointer.clientX <= bounds.right &&
          pointer.clientY >= bounds.top && pointer.clientY <= bounds.bottom) {
        const topEdge = bounds.top + header.getBoundingClientRect().height + 28;
        const bottomEdge = bounds.bottom - 28;
        const scrollTop = scroller.scrollTop;
        if (pointer.clientY < topEdge) scroller.scrollTop -= Math.min(16, (topEdge - pointer.clientY) / 2);
        else if (pointer.clientY > bottomEdge) scroller.scrollTop += Math.min(16, (pointer.clientY - bottomEdge) / 2);
        if (scroller.scrollTop !== scrollTop) updateTarget();
      }
      frame = window.requestAnimationFrame(autoScroll);
    }

    function finish(event) {
      if (event.pointerId !== pointerId) return;
      pointer = event;
      if (frame !== undefined) updateTarget();
      const dropped = event.type === 'pointerup' && marker !== null;
      listeners.abort();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      marker?.classList.remove('drop-before', 'drop-after');
      sourceRow.classList.remove('task-dragging');
      if (dropped) moveTask(from, targetIndex);
    }

    handle.setPointerCapture(pointerId);
    handle.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      pointer = event;
      if (frame === undefined) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < 5) return;
        sourceRow.classList.add('task-dragging');
        frame = window.requestAnimationFrame(autoScroll);
      }
      updateTarget();
    }, { signal });
    handle.addEventListener('pointerup', finish, { signal });
    handle.addEventListener('pointercancel', finish, { signal });
    handle.addEventListener('lostpointercapture', finish, { signal });
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

  function fitText(text, width, fontSize, fontWeight = 400) {
    if (measureTextWidth(text, fontSize, fontWeight) <= width) return text;
    if (measureTextWidth('…', fontSize, fontWeight) > width) return '';
    const characters = [...text];
    while (characters.length && measureTextWidth(`${characters.join('')}…`, fontSize, fontWeight) > width) {
      characters.pop();
    }
    return `${characters.join('')}…`;
  }

  function getSvgMarkup(timeline, availableWidth) {
    const weeks = rangeWeeks(timeline.displayStartWeek, timeline.displayEndWeek);
    if (!weeks.length) return { markup: '', width: 0, height: 0 };
    const compact = !timeline.showWeekRow;
    const autoFit = timeline.weekCellWidth === null;
    const fitWidth = availableWidth || 900;

    // 線表プレビューには，表示区間内に1週以上設定されているタスクだけを表示する．
    // タスク編集欄やCSV上のデータ自体は削除せず，プレビュー上だけを絞り込む．
    const visibleWeekSet = new Set(weeks);
    const visibleTasks = state.tasks.filter((task) =>
      task.weeks.some((week) => visibleWeekSet.has(week))
    );

    // 左側の列幅は表示する文字列に合わせ，週の表示領域を確保する．
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
    const deadlines = visibleDeadlines(weeks);
    const deadlineAreaHeight = deadlines.length ? 24 + deadlines.length * 72 : 18;
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
    deadlines.forEach((deadline, index) => {
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

  let previewCards = [];

  function renderTimelineCards() {
    renderSettings();
    previewCards = state.timelines.map((timeline, index) => {
      const card = els.timelinePreviewTemplate.content.firstElementChild.cloneNode(true);
      const heading = card.querySelector('h3');
      const scroll = card.querySelector('.timeline-scroll');
      const mount = card.querySelector('.timeline-mount');
      const toggle = card.querySelector('.week-row-toggle input');
      const widthSlider = card.querySelector('.week-width-slider');
      const widthValue = card.querySelector('.week-width-value');
      const fitButton = card.querySelector('.fit-week-width');
      const preview = { card, heading, scroll, mount, toggle, timeline, widthSlider, widthValue };
      heading.id = `timeline-heading-${index + 1}`;
      scroll.setAttribute('aria-labelledby', heading.id);
      toggle.setAttribute('aria-label', `線表${index + 1}の週行`);
      toggle.addEventListener('change', () => {
        timeline.showWeekRow = toggle.checked;
        persistAndRenderTimeline();
      });
      widthSlider.min = MIN_WEEK_CELL_WIDTH;
      widthSlider.max = MAX_WEEK_CELL_WIDTH;
      widthSlider.step = 0.1;
      widthSlider.addEventListener('input', () => {
        timeline.weekCellWidth = widthSlider.valueAsNumber;
        renderTimelineCard(preview, index);
        saveLocal();
      });
      fitButton.addEventListener('click', () => {
        timeline.weekCellWidth = null;
        renderTimelineCard(preview, index);
        saveLocal();
      });
      card.querySelector('.download-svg').addEventListener('click', () => downloadSvg(timeline, scroll.clientWidth));
      card.querySelector('.download-png').addEventListener('click', () => downloadPng(timeline, scroll.clientWidth));
      return preview;
    });
    els.timelinePreviews.replaceChildren(...previewCards.map(({ card }) => card));
    renderTimeline();
  }

  function renderTimeline() {
    previewCards.forEach(renderTimelineCard);
  }

  function renderTimelineCard(preview, index) {
    const { heading, scroll, mount, toggle, timeline, widthSlider, widthValue } = preview;
    heading.textContent = `線表${index + 1}`;
    toggle.checked = timeline.showWeekRow;
    const { markup, weekWidth } = getSvgMarkup(timeline, scroll.clientWidth);
    mount.innerHTML = markup || '<div class="empty-state">表示期間を確認してください．</div>';
    if (!weekWidth) return;
    const px = Math.round(weekWidth * 10) / 10;
    widthSlider.value = px;
    const label = timeline.weekCellWidth === null ? `自動（${px} px）` : `${px} px`;
    widthSlider.setAttribute('aria-valuetext', label);
    widthValue.textContent = label;
  }

  function setAllWeekRows(showWeekRow) {
    state.timelines.forEach((timeline) => { timeline.showWeekRow = showWeekRow; });
    persistAndRenderTimeline();
  }

  function persistAndRenderTimeline() {
    saveLocal();
    renderTimeline();
  }

  function renderAll() {
    renderTaskEditor();
    renderDeadlineEditor();
    renderTimelineCards();
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
    const headers = ['record_type', 'order', 'category', 'name', 'start_week', 'end_week', 'weeks', 'date', 'color', 'note', 'status', 'show_week_row', 'week_cell_width'];
    const rows = [headers];
    currentState.timelines.forEach((timeline) => {
      rows.push(['settings', '', '', timeline.title, timeline.displayStartWeek, timeline.displayEndWeek, '', '', '', '', '', timeline.showWeekRow ? '1' : '0', timeline.weekCellWidth]);
    });

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
        '',
        task.status,
        '',
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
        deadline.note,
        '',
        '',
        ''
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

    const imported = { timelines: [], tasks: [], deadlines: [] };
    const defaultTimeline = createBlankState().timelines[0];
    let normalizedCount = 0;

    function get(row, key, fallback = '') {
      const i = idx[key];
      return i === undefined ? fallback : String(row[i] ?? '').trim();
    }

    rows.slice(1).forEach((row, rowIndex) => {
      if (!row.some((cell) => String(cell).trim() !== '')) return;
      const type = hasType ? get(row, 'record_type').toLowerCase() : 'task';

      if (type === 'settings') {
        let start = normalizeSunday(get(row, 'start_week')) || defaultTimeline.displayStartWeek;
        let end = normalizeSunday(get(row, 'end_week')) || defaultTimeline.displayEndWeek;
        if (compareIso(start, end) > 0) [start, end] = [end, start];
        imported.timelines.push({
          title: get(row, 'name'),
          displayStartWeek: start,
          displayEndWeek: end,
          showWeekRow: get(row, 'show_week_row') !== '0',
          weekCellWidth: get(row, 'week_cell_width')
        });
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
        status: get(row, 'status'),
        _order: Number.isFinite(orderValue) && orderValue > 0 ? orderValue : imported.tasks.length + 1
      });
    });

    imported.tasks.sort((a, b) => a._order - b._order);
    imported.tasks.forEach((task) => { delete task._order; });

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

  function fileSafeTitle(timeline) {
    const raw = timeline.title.replace(/[\\/:*?"<>|]/g, '_').replace(/^◎/, '').trim();
    return raw || 'progress_timeline';
  }

  function downloadCsv(currentState = state, filename = `${fileSafeTitle(currentState.timelines[0])}.csv`) {
    const csv = stateToCsv(currentState);
    downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), filename);
  }

  function downloadSvg(timeline, availableWidth) {
    const { markup } = getSvgMarkup(timeline, availableWidth);
    if (!markup) return;
    downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${fileSafeTitle(timeline)}.svg`);
  }

  function downloadPng(timeline, availableWidth) {
    const { markup, width, height } = getSvgMarkup(timeline, availableWidth);
    if (!markup || !width || !height) return;
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `${fileSafeTitle(timeline)}.png`;
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
        downloadBlob(pngBlob, filename);
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      showMessage('PNGの生成に失敗しました．SVG保存を利用してください．', 'error');
    };
    image.src = url;
  }

  function addTask() {
    const defaultWeek = state.timelines[0].displayStartWeek;
    const previousCategory = state.tasks.length ? state.tasks[state.tasks.length - 1].category : '未分類';
    state.tasks.push({
      id: makeId('task'),
      category: previousCategory,
      name: '新しいタスク',
      weeks: [defaultWeek],
      color: DEFAULT_COLOR,
      status: TASK_STATUSES[0].value
    });
    renderTaskEditor();
    persistAndRenderTimeline();
  }

  function addDeadline() {
    const fallback = state.timelines[0].displayEndWeek;
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

  els.addTaskButton.addEventListener('click', addTask);
  els.addDeadlineButton.addEventListener('click', addDeadline);
  els.downloadCsvButton.addEventListener('click', () => downloadCsv());
  els.showAllWeeks.addEventListener('click', () => setAllWeekRows(true));
  els.hideAllWeeks.addEventListener('click', () => setAllWeekRows(false));

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

  els.timelinePreviews.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-task-id][data-week]');
    if (!cell) return;
    toggleTaskWeek(cell.dataset.taskId, cell.dataset.week);
  });

  els.timelinePreviews.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const cell = event.target.closest('[data-task-id][data-week]');
    if (!cell) return;
    event.preventDefault();
    const { taskId, week } = cell.dataset;
    const mount = cell.closest('.timeline-mount');
    toggleTaskWeek(taskId, week);
    const replacement = mount.querySelector(`[data-task-id="${CSS.escape(taskId)}"][data-week="${week}"]`);
    (replacement || mount.parentElement).focus({ preventScroll: true });
  });

  renderAll();
  saveLocal();
  let previewWidth = els.timelinePreviews.clientWidth;
  new ResizeObserver(() => {
    const width = els.timelinePreviews.clientWidth;
    if (previewWidth === width) return;
    previewWidth = width;
    renderTimeline();
  }).observe(els.timelinePreviews);
})();
