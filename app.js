/* ========== 修正部分裝置 safe-area-inset-top 過大問題 ========== */
(function() {
    var test = document.createElement('div');
    test.style.cssText = 'position:absolute;top:0;left:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;';
    document.body.appendChild(test);
    var padTop = parseFloat(getComputedStyle(test).paddingTop) || 0;
    document.body.removeChild(test);
    // 超過 32px 就限制到 32px（避免小米等機型回報過大值）
    if (padTop > 32) {
        document.documentElement.style.setProperty('--safe-top', '32px');
    }
})();
/* ========== Capacitor StatusBar 初始化（讓 App 全螢幕） ========== */
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
    try {
        window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: true });
        window.Capacitor.Plugins.StatusBar.setStyle({ style: 'LIGHT' });
    } catch (e) { console.warn('StatusBar 設定失敗：', e); }
}

/* ============================================================
   1. 顏色調色盤（12 色）
   ============================================================ */
/* 12 個預設色（初始值；實際色板存在 AppData.palette，使用者可編輯/刪除） */
const DEFAULT_PALETTE = [
    '#1a73e8', '#33b679', '#0b8043', '#f6bf26',
    '#f4511e', '#d50000', '#8e24aa', '#7986cb',
    '#616161', '#3f51b5', '#009688', '#e67c73'
];
const DEFAULT_COLOR = DEFAULT_PALETTE[0];

function hexToRgba(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#') hex = DEFAULT_COLOR;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/* 把 rgb(255, 0, 0) 或 #ff0000 轉成 #ff0000 */
function rgbToHex(color) {
    if (!color) return null;
    if (color.charAt(0) === '#') return color;
    const m = color.match(/\d+/g);
    if (!m || m.length < 3) return null;
    return '#' + m.slice(0, 3).map(function (x) {
        return ('0' + parseInt(x, 10).toString(16)).slice(-2);
    }).join('');
}

/* ============================================================
   自訂顏色管理
   ============================================================ */
function getPalette() {
    if (!Array.isArray(AppData.palette)) AppData.palette = DEFAULT_PALETTE.slice();
    return AppData.palette;
}

function getAllColors() {
    return getPalette().concat(AppData.customColors || []);
}

function addCustomColor(color) {
    if (!color) return;
    if (getPalette().indexOf(color) !== -1) return;  // 已是預設色
    if (!AppData.customColors) AppData.customColors = [];
    if (AppData.customColors.indexOf(color) !== -1) return;  // 已存在
    AppData.customColors.push(color);
    saveData();
}

/* 長按 / 右鍵刪除顏色（預設色 + 自訂色都支援） */
let colorLongPressTimer = null;
let colorLongPressTriggered = false;

/* 移除色板上的顏色（預設色與自訂色都支援） */
function removeColorFromPalette(color) {
    if (!color) return false;
    let removed = false;
    if (!AppData.palette) AppData.palette = DEFAULT_PALETTE.slice();
    let idx = AppData.palette.indexOf(color);
    if (idx !== -1) {
        AppData.palette.splice(idx, 1);
        removed = true;
    }
    if (!AppData.customColors) AppData.customColors = [];
    idx = AppData.customColors.indexOf(color);
    if (idx !== -1) {
        AppData.customColors.splice(idx, 1);
        removed = true;
    }
    if (removed) saveData();
    return removed;
}

/* 長按 / 右鍵 → 詢問是否移除該顏色 */
function handleRemoveColor(color) {
    if (!color) return;
    const isPreset = getPalette().indexOf(color) !== -1;
    const isCustom = (AppData.customColors || []).indexOf(color) !== -1;
    if (!isPreset && !isCustom) return;

    const label = isPreset ? '預設顏色' : '自訂顏色';
    const msg = '要從色板移除這個' + label + '嗎？\n\n' + color +
                '\n\n（已套用到模板 / 行程的顏色不會改變）';

    if (confirm(msg)) {
        removeColorFromPalette(color);

        // 關閉所有色板
        document.querySelectorAll('.color-picker.open').forEach(function (p) {
            p.classList.remove('open');
        });

        // 重繪模板 / 自訂日程色板
        if (typeof renderTplColorGrid === 'function') renderTplColorGrid();
        if (typeof renderCustomColorGrid === 'function') renderCustomColorGrid();
    }
}

/* 恢復預設色板（只還原 12 個預設色，自訂色保留） */
function restoreDefaultPalette() {
    if (!confirm('要恢復成預設的 12 色色板嗎？\n\n（自訂顏色不會被刪除，只是把預設色板還原）')) return;
    AppData.palette = DEFAULT_PALETTE.slice();
    saveData();
    if (typeof renderTplColorGrid === 'function') renderTplColorGrid();
    if (typeof renderCustomColorGrid === 'function') renderCustomColorGrid();
    alert('✅ 已恢復預設色板');
}

/* ============================================================
   顏色長按刪除（使用 touch + mouse 事件，比 pointer 更可靠）
   ============================================================ */
function setupColorLongPress() {
    function isColorOption(el) {
        if (!el.classList) return false;
        if (!el.classList.contains('color-option')) return false;
        if (el.classList.contains('color-custom')) return false;  // 🎨 不觸發長按
        return !!el.dataset.color;
    }

    function startLongPress(el) {
        if (!isColorOption(el)) return;
        colorLongPressTriggered = false;
        const color = el.dataset.color;

        colorLongPressTimer = setTimeout(function () {
            colorLongPressTimer = null;
            colorLongPressTriggered = true;
            handleRemoveColor(color);
        }, 700);   // 700ms 長按
    }

    function cancelLongPress() {
        if (colorLongPressTimer) {
            clearTimeout(colorLongPressTimer);
            colorLongPressTimer = null;
        }
    }

    /* ----- 手機：touch 事件 ----- */
    document.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        startLongPress(e.target);
    }, { passive: true });

    document.addEventListener('touchmove', function () {
        cancelLongPress();
    }, { passive: true });

    document.addEventListener('touchend', function () {
        cancelLongPress();
        setTimeout(function () { colorLongPressTriggered = false; }, 200);
    }, { passive: true });

    document.addEventListener('touchcancel', function () {
        cancelLongPress();
        colorLongPressTriggered = false;
    }, { passive: true });

    /* ----- 電腦：mouse 事件 ----- */
    document.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;   // 只接受左鍵
        startLongPress(e.target);
    });

    document.addEventListener('mouseup', function () {
        cancelLongPress();
        setTimeout(function () { colorLongPressTriggered = false; }, 200);
    });

    /* ----- 電腦右鍵（更快的刪除方式） ----- */
    document.addEventListener('contextmenu', function (e) {
        if (!isColorOption(e.target)) return;
        e.preventDefault();
        handleRemoveColor(e.target.dataset.color);
    });
}

/* 全域取色器狀態 */
let colorPickerTarget = null;

/* 開啟系統取色器 */
function openColorPicker(target, initialColor) {
    const input = document.getElementById('globalColorPicker');
    if (!input) return;
    input.value = (initialColor && /^#[0-9a-fA-F]{6}$/.test(initialColor)) ? initialColor : DEFAULT_COLOR;
    colorPickerTarget = target;
    try {
        input.click();
    } catch (err) {
        // 若無法開啟系統取色器，用 prompt 作為備援
        const v = prompt('請輸入顏色（hex 格式，例如 #ff0000）', input.value);
        if (v && /^#?[0-9a-fA-F]{6}$/.test(v.trim())) {
            const c = v.trim().charAt(0) === '#' ? v.trim() : ('#' + v.trim());
            applyPickedColor(c);
        } else {
            colorPickerTarget = null;
        }
    }
}

/* 套用取色器選到的顏色 */
function applyPickedColor(color) {
    const target = colorPickerTarget;
    colorPickerTarget = null;
    if (!target || !color) return;

    // 自動把新顏色存進自訂色板（若還不是預設色或已存在的話）
    addCustomColor(color);

    if (target.type === 'tpl') {
        selectedTplColor = color;
        renderTplColorGrid();
    } else if (target.type === 'custom') {
        selectedCustomColor = color;
        renderCustomColorGrid();
    } else if (target.type === 'schedule') {
        applyScheduleColor(target.role, target.id, color);
    }
}

/* 套用顏色到行程/模板的色板 */
function applyScheduleColor(role, id, color) {
    if (role === 'symbol-color') {
        if (AppData.symbols[id]) {
            AppData.symbols[id].color = color;
            saveData();
            renderEditSymbolChips();
            renderQuickSymbols();
            renderTemplateList();
        }
    } else if (role === 'schedule-color') {
        // 先找暫存列表
        let item = AppData.staging.find(function (s) { return s.id === id; });
        if (item) {
            item.color = color;
            saveData();
            renderQuickTable();
            return;
        }
        // 再找已加入日曆
        item = AppData.schedules.find(function (s) { return s.id === id; });
        if (item) {
            item.color = color;
            saveData();
            renderCalendar();
            renderDayPanel();
            renderQuickTable();
        }
    }
}

function makeColorPickerHtml(role, targetId, currentColor) {
    const color = currentColor || DEFAULT_COLOR;
    let dots = '';
    // 預設色（可長按 / 右鍵刪除）
    getPalette().forEach(function (c) {
        dots += '<span class="color-option" data-color="' + c + '" style="background:' + c + '" title="長按可刪除"></span>';
    });
    // 自訂色（可長按 / 右鍵刪除）
    (AppData.customColors || []).forEach(function (c) {
        dots += '<span class="color-option" data-color="' + c + '" style="background:' + c + '" title="長按可刪除"></span>';
    });
    // 🎨 新增自訂顏色
    dots += '<span class="color-option color-custom" data-custom="1" title="新增自訂顏色">🎨</span>';

    const extraAttrs = role === 'symbol-color'
        ? ' data-code="' + escapeHtml(targetId) + '"'
        : ' data-id="' + escapeHtml(targetId) + '"';
    return '<div class="color-picker" data-role="' + role + '"' + extraAttrs + '>' +
        '<span class="color-dot" style="background:' + color + ';"></span>' +
        '<div class="color-panel">' + dots + '</div>' +
    '</div>';
}

function positionColorPanel(picker) {
    const panel = picker.querySelector('.color-panel');
    if (!panel) return;
    panel.style.left = ''; panel.style.right = '';
    panel.style.visibility = 'hidden'; panel.style.display = 'grid';
    const pickerRect = picker.getBoundingClientRect();
    const panelW = panel.offsetWidth || 152;
    const winW = window.innerWidth;
    if (pickerRect.left + panelW > winW - 8) {
        panel.style.left = 'auto'; panel.style.right = '-4px';
    } else {
        panel.style.left = '-4px'; panel.style.right = 'auto';
    }
    panel.style.visibility = ''; panel.style.display = '';
}

/* ============================================================
   2. 資料存檔
   ============================================================ */
const STORAGE_KEY = 'ShiftAppData_v3';
const AppData = {
    symbols: {}, schedules: [], dayNotes: {}, staging: [],
    templateOrder: [], customColors: [],
    palette: DEFAULT_PALETTE.slice()
};
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            if (p.symbols && typeof p.symbols === 'object') AppData.symbols = p.symbols;
            if (Array.isArray(p.schedules)) AppData.schedules = p.schedules;
            if (p.dayNotes) AppData.dayNotes = p.dayNotes;
            if (Array.isArray(p.staging)) AppData.staging = p.staging;
            if (Array.isArray(p.templateOrder)) AppData.templateOrder = p.templateOrder;
            if (Array.isArray(p.customColors)) AppData.customColors = p.customColors;
            // 舊版沒有 palette 欄位 → 保持預設色板
            if (Array.isArray(p.palette)) AppData.palette = p.palette;
        }
    } catch (e) { console.warn('讀取存檔失敗：', e); }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(AppData)); }

/* ============================================================
   3. 共用小工具
   ============================================================ */
function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function dateToStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayStr() { return dateToStr(new Date()); }
function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return dateToStr(d);
}
function timeToMinutes(t) {
    if (!t) return 0;
    const p = t.split(':');
    return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0);
}
function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDateForGoogle(dateStr) {
    if (!dateStr) return '';
    const p = dateStr.split('-');
    return p.length === 3 ? p[1] + '/' + p[2] + '/' + p[0] : dateStr;
}
function getDateRange(startDate, endDate) {
    let a = startDate, b = endDate;
    if (a > b) { const t = a; a = b; b = t; }
    const result = [];
    let cur = a;
    while (cur <= b) { result.push(cur); cur = addDays(cur, 1); }
    return result;
}

/* ============================================================
   4. 行程操作
   ============================================================ */
function getSchedulesByDate(dateStr) {
    return AppData.schedules
        .filter(function (s) { return s.date === dateStr; })
        .sort(function (a, b) {
            if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        });
}
function addSchedule(entry) {
    const item = Object.assign({
        id: uid('sch'), date: todayStr(), subject: '',
        startTime: '', endTime: '', allDay: false, note: '',
        symbol: '', color: DEFAULT_COLOR
    }, entry);
    if (!item.color) item.color = DEFAULT_COLOR;
    AppData.schedules.push(item);
    saveData();
    return item;
}
function removeSchedule(id) {
    AppData.schedules = AppData.schedules.filter(function (s) { return s.id !== id; });
    saveData();
}

/* ============================================================
   5. CSV 匯出
   ============================================================ */
function exportSchedulesToCSV(startDate, endDate) {
    let data = AppData.schedules;
    if (startDate && endDate) {
        data = data.filter(function (s) {
            return s.date >= startDate && s.date <= endDate;
        });
    }
    if (!data.length) {
        alert('沒有行程可以匯出！');
        return;
    }
    const headers = ['Subject','Start Date','Start Time','End Date','End Time','All Day Event','Description','Location','Private'];
    const rows = [headers.join(',')];
    data.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (item) {
        const d = formatDateForGoogle(item.date);
        rows.push([
            '"' + String(item.subject).replace(/"/g, '""') + '"',
            '"' + d + '"',
            '"' + (item.allDay ? '' : item.startTime) + '"',
            '"' + d + '"',
            '"' + (item.allDay ? '' : item.endTime) + '"',
            '"' + (item.allDay ? 'TRUE' : 'FALSE') + '"',
            '"' + String(item.note || '').replace(/"/g, '""') + '"',
            '""', '"FALSE"'
        ].join(','));
    });
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let filename = '排班表_' + todayStr() + '.csv';
    if (startDate && endDate) filename = '排班表_' + startDate + '_至_' + endDate + '.csv';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ============================================================
   6. 顏色選擇器事件
   ============================================================ */
document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('color-dot')) {
        const picker = e.target.closest('.color-picker');
        document.querySelectorAll('.color-picker.open').forEach(function (p) { if (p !== picker) p.classList.remove('open'); });
        picker.classList.toggle('open');
        if (picker.classList.contains('open')) { positionColorPanel(picker); }
        e.stopPropagation(); return;
    }
    if (e.target.classList && e.target.classList.contains('color-option')) {
        if (colorLongPressTriggered) return;
        // 只處理行程卡片的小色板（模板編輯面板的色板有自己的點擊處理）
        const picker = e.target.closest('.color-picker');
        if (!picker) return;
        const newColor = e.target.dataset.color;
        const role = picker.dataset.role;
        if (role === 'symbol-color') {
            const code = picker.dataset.code;
            if (AppData.symbols[code]) {
                AppData.symbols[code].color = newColor; saveData();
                picker.querySelector('.color-dot').style.background = newColor;
                renderEditSymbolChips(); renderQuickSymbols();
            }
        } else if (role === 'schedule-color') {
            const id = picker.dataset.id;
            // 先找暫存列表
            let item = AppData.staging.find(function (s) { return s.id === id; });
            if (item) {
                item.color = newColor;
                saveData();
                picker.querySelector('.color-dot').style.background = newColor;
                return;   // 暫存的還沒加入日曆，不需重繪日曆
            }
            // 再找已加入日曆的行程
            item = AppData.schedules.find(function (s) { return s.id === id; });
            if (item) {
                item.color = newColor;
                saveData();
                picker.querySelector('.color-dot').style.background = newColor;
                renderCalendar();
                renderDayPanel();
            }
        }
        picker.classList.remove('open'); e.stopPropagation(); return;
    }
    document.querySelectorAll('.color-picker.open').forEach(function (p) { p.classList.remove('open'); });
});

/* ============================================================
   7. 排班日曆视图
   ============================================================ */
let viewYear = 0, viewMonth = 0, selectedDate = '';
let editMode = 'normal';
let selectedSymbolForAdd = null;
let selectedSymbolForDelete = null;
const calDrag = { active: false, startDate: null, currentDate: null, startX: 0, startY: 0, dragging: false };
/* 日曆左右滑動用的狀態 */
const calSwipeState = { tracking: false, startX: 0, startY: 0, startTime: 0, pointerId: null };
let calSwiped = false;

function renderCalendar() {
    const label = document.getElementById('monthLabel');
    if (!label) return;
    label.textContent = viewYear + ' 年 ' + (viewMonth + 1) + ' 月';

    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';

    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
        const dayNumber = i - startWeekday + 1;
        let cellDate, isOtherMonth = false;

        if (dayNumber < 1) {
            cellDate = dateToStr(new Date(viewYear, viewMonth - 1, prevMonthDays + dayNumber));
            isOtherMonth = true;
        } else if (dayNumber > daysInMonth) {
            cellDate = dateToStr(new Date(viewYear, viewMonth + 1, dayNumber - daysInMonth));
            isOtherMonth = true;
        } else {
            cellDate = dateToStr(new Date(viewYear, viewMonth, dayNumber));
        }

        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        if (isOtherMonth) cell.classList.add('other-month');
        if (cellDate === todayStr()) cell.classList.add('today');
        if (cellDate === selectedDate && editMode === 'normal') cell.classList.add('selected');
        cell.dataset.date = cellDate;

        const daySchedules = getSchedulesByDate(cellDate);
        const dayNote = AppData.dayNotes[cellDate] || '';

        let chipsHtml = '';
        daySchedules.forEach(function (s) {
            const color = s.color || DEFAULT_COLOR;
            if (s.allDay) {
                chipsHtml += '<div class="cal-chip-allday" style="background:' + color + ';">' + escapeHtml(s.subject) + '</div>';
            } else {
                chipsHtml += '<div class="cal-chip-timed" style="border-left-color:' + color + ';">' + escapeHtml(s.subject) + '</div>';
            }
        });

        let noteHtml = '';
        if (dayNote) {
            noteHtml = '<div class="cal-day-note">📝 ' + escapeHtml(dayNote) + '</div>';
        }

        cell.innerHTML =
            '<div class="cal-date">' + Number(cellDate.slice(8, 10)) + '</div>' +
            '<div class="cal-events">' + chipsHtml + '</div>' +
            noteHtml;

        cell.addEventListener('click', (function (d) {
            return function () {
                if (calSwiped) return;        // ← 剛滑動完，不開啟面板
                if (editMode !== 'normal') return;
                selectedDate = d;
                const parts = d.split('-');
                viewYear = Number(parts[0]);
                viewMonth = Number(parts[1]) - 1;
                renderCalendar();
                renderDayPanel();
                openDayPanel();
            };
        })(cellDate));

        grid.appendChild(cell);
    }

    // 等瀏覽器排版完成後，動態計算備註可顯示的行數
    requestAnimationFrame(adjustDayNotes);
}

/* 動態計算每個格子的備註能顯示幾行，超出的行用「…」代替 */
function adjustDayNotes() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;

    grid.querySelectorAll('.cal-cell').forEach(function (cell) {
        const noteEl = cell.querySelector('.cal-day-note');
        if (!noteEl) return;

        noteEl.style.display = 'block';
        noteEl.style.webkitLineClamp = 'unset';
        noteEl.style.overflow = 'visible';
        noteEl.style.maxHeight = 'none';

        const naturalH = noteEl.scrollHeight;

        const cellH = cell.clientHeight;
        const dateEl = cell.querySelector('.cal-date');
        const eventsEl = cell.querySelector('.cal-events');

        const dateH = dateEl ? dateEl.offsetHeight : 0;
        const eventsH = eventsEl ? eventsEl.offsetHeight : 0;

        const cellStyle = getComputedStyle(cell);
        const padTop = parseFloat(cellStyle.paddingTop) || 0;
        const padBottom = parseFloat(cellStyle.paddingBottom) || 0;
        const gap = parseFloat(cellStyle.rowGap || cellStyle.gap || '1') || 1;

        const childCount = cell.children.length;
        const totalGaps = Math.max(0, childCount - 1) * gap;

        const used = padTop + padBottom + dateH + eventsH + totalGaps;
        const remain = cellH - used;

        const noteStyle = getComputedStyle(noteEl);
        const fs = parseFloat(noteStyle.fontSize) || 11;
        let lh = parseFloat(noteStyle.lineHeight);
        if (isNaN(lh) || lh <= 0) lh = fs * 1.3;

        const neededLines = Math.ceil(naturalH / lh);
        const availLines = Math.floor(remain / lh);

        if (availLines < 1) {
            noteEl.style.display = 'none';
            return;
        }

        const showLines = Math.max(1, Math.min(neededLines, availLines));

        noteEl.style.display = '-webkit-box';
        noteEl.style.webkitBoxOrient = 'vertical';
        noteEl.style.webkitLineClamp = String(showLines);
        noteEl.style.overflow = 'hidden';
    });
}

function layoutTimedEvents(timed) {
    const events = timed.map(function (s) {
        const start = timeToMinutes(s.startTime);
        let end = timeToMinutes(s.endTime);
        if (end <= start) end = start + 60;
        return {
            scheduleId: s.id,
            customized: !!s.customized,
            start: start, end: end,
            startTime: s.startTime, endTime: s.endTime,
            subject: s.subject,
            note: s.note || '',
            color: s.color || DEFAULT_COLOR,
            col: 0, totalCols: 1
        };
    });
    events.sort(function (a, b) { return a.start - b.start || a.end - b.end; });

    const clusters = [];
    let currentCluster = [], clusterEnd = -1;
    events.forEach(function (ev) {
        if (currentCluster.length === 0) { currentCluster = [ev]; clusterEnd = ev.end; }
        else if (ev.start < clusterEnd) { currentCluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.end); }
        else { clusters.push(currentCluster); currentCluster = [ev]; clusterEnd = ev.end; }
    });
    if (currentCluster.length) clusters.push(currentCluster);

    clusters.forEach(function (cluster) {
        const colEndTimes = [];
        cluster.forEach(function (ev) {
            let col = -1;
            for (let i = 0; i < colEndTimes.length; i++) { if (colEndTimes[i] <= ev.start) { col = i; break; } }
            if (col === -1) { col = colEndTimes.length; colEndTimes.push(0); }
            colEndTimes[col] = ev.end; ev.col = col;
        });
        cluster.forEach(function (ev) { ev.totalCols = colEndTimes.length; });
    });
    return events;
}

function buildTimelineHtml(list) {
    const HOUR_H = 48, totalH = HOUR_H * 24;
    const timed = list.filter(function (s) { return !s.allDay; });
    const allDay = list.filter(function (s) { return s.allDay; });

    let hoursHtml = '';
    for (let h = 0; h <= 24; h++) {
        hoursHtml += '<div class="tl-hour" style="top:' + (h * HOUR_H) + 'px;"><span>' + String(h).padStart(2, '0') + ':00</span></div>';
    }

    const laidOut = layoutTimedEvents(timed);
    let blocksHtml = '';
    laidOut.forEach(function (ev) {
        const top = ev.start / 60 * HOUR_H;
        const height = Math.max((ev.end - ev.start) / 60 * HOUR_H, 22);
        const cols = ev.totalCols, colIdx = ev.col;
        const widthCalc = 'calc((100% - 16px) / ' + cols + ')';
        const leftCalc  = 'calc(8px + (100% - 16px) / ' + cols + ' * ' + colIdx + ')';

        let noteHtml = '';
        if (ev.note) { noteHtml = '<span class="tl-event-note">📝 ' + escapeHtml(ev.note) + '</span>'; }

        blocksHtml += '<div class="tl-event" ' +
            'data-schedule-id="' + escapeHtml(ev.scheduleId) + '" ' +
            'data-customized="' + (ev.customized ? '1' : '0') + '" ' +
            'style="top:' + top + 'px; height:' + height + 'px; width:' + widthCalc + '; left:' + leftCalc + '; background:' + hexToRgba(ev.color, 0.15) + '; border-left-color:' + ev.color + '; cursor: pointer;">' +
            '<strong style="color:' + ev.color + ';">' + escapeHtml(ev.subject) + '</strong>' +
            '<span>' + ev.startTime + ' – ' + ev.endTime + '</span>' + noteHtml + '</div>';
    });

    let allDayHtml = '';
    if (allDay.length) {
        allDayHtml = '<div class="tl-allday">' + allDay.map(function (s) {
            const color = s.color || DEFAULT_COLOR;
            return '<span class="cal-chip-allday" style="background:' + color + ';">' + escapeHtml(s.subject) + '</span>';
        }).join('') + '</div>';
    }

    return allDayHtml + '<div class="timeline" style="height:' + totalH + 'px;">' + hoursHtml + blocksHtml + '</div>';
}

function buildScheduleCardHtml(s) {
    const color = s.color || DEFAULT_COLOR;
    const customizedMark = s.customized ? ' <span style="font-size:10px; opacity:0.6;">✏️</span>' : '';
    return '<div class="sch-card" data-schedule-id="' + escapeHtml(s.id) + '">' +
        '<div class="sch-color">' + makeColorPickerHtml('schedule-color', s.id, color) + '</div>' +
        '<div class="sch-main"><div class="sch-subject">' + escapeHtml(s.subject) + customizedMark + '</div>' +
        '<div class="sch-time">' + (s.allDay ? '整天' : s.startTime + ' – ' + s.endTime) + '</div></div>' +
        '<button class="btn-icon danger" data-del="' + s.id + '" title="刪除">✕</button>' +
        '<textarea class="desc-input sch-note" data-note="' + s.id + '" placeholder="加入備註...">' + escapeHtml(s.note || '') + '</textarea></div>';
}

function renderDayPanel() {
    const title = document.getElementById('dayTitle');
    const body = document.getElementById('dayPanelBody');
    if (!selectedDate) {
        title.textContent = '請點選日期';
        body.innerHTML = '<p class="hint">點選日曆上的任何一天，這裡會顯示當天的時間軸與備註。</p>';
        return;
    }
    const d = new Date(selectedDate + 'T00:00:00');
    const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
    title.textContent = selectedDate + '（星期' + weekNames[d.getDay()] + '）';

    const list = getSchedulesByDate(selectedDate);
    const dayNote = AppData.dayNotes[selectedDate] || '';

    let listHtml = list.length === 0
        ? '<p class="hint">這天還沒有排班。可以切換到「➕ 快速新增」模式來加入班別。</p>'
        : buildTimelineHtml(list);

    body.innerHTML =
        '<div class="day-note-box"><label>📝 本日備註</label>' +
        '<textarea id="dayNoteInput" class="desc-input" placeholder="例如：今天要交報告…">' + escapeHtml(dayNote) + '</textarea></div>' +
        '<div class="timeline-wrap">' + listHtml + '</div>' +
        '<div class="day-list">' + list.map(buildScheduleCardHtml).join('') + '</div>';

    const noteInput = document.getElementById('dayNoteInput');
    if (noteInput) {
        // 自動依內容行數調整高度
        const autoResize = function () {
            noteInput.style.height = 'auto';
            noteInput.style.height = Math.max(60, noteInput.scrollHeight) + 'px';
        };
        // 一開啟面板就先調整一次（載入既有備註）
        autoResize();
        noteInput.addEventListener('input', function () {
            AppData.dayNotes[selectedDate] = noteInput.value;
            saveData();
            updateCalendarDayNote(selectedDate);
            autoResize();   // 每次輸入都重新計算
        });
    }
    // 點時間軸事件 → 打開編輯
    body.querySelectorAll('.tl-event[data-schedule-id]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            openCustomEditor({ scheduleId: el.dataset.scheduleId });
        });
    });
    // 點排班卡片的 ✕ 刪除按鈕 → 刪除該筆排班
    body.querySelectorAll('[data-del]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();   // 避免觸發卡片點擊（打開編輯）
            if (!confirm('確定要刪除這筆排班嗎？')) return;
            removeSchedule(btn.dataset.del);
            renderCalendar();
            renderDayPanel();
        });
    });
    body.querySelectorAll('[data-note]').forEach(function (ta) {
        ta.addEventListener('input', function () {
            const item = AppData.schedules.find(function (x) { return x.id === ta.dataset.note; });
            if (item) { item.note = ta.value; saveData(); updateTimelineNote(item.id, ta.value); }
        });
    });
    // 點排班卡片（除了備註框、刪除按鈕、顏色圓點）→ 打開編輯
    body.querySelectorAll('.sch-card[data-schedule-id]').forEach(function (card) {
        card.addEventListener('click', function (e) {
            // 排除：備註框、刪除按鈕、顏色選擇器
            if (e.target.closest('.sch-note')) return;
            if (e.target.closest('[data-del]')) return;
            if (e.target.closest('.color-picker')) return;
            // 避免拖選文字時誤觸
            const sel = window.getSelection && window.getSelection();
            if (sel && sel.toString().length > 0) return;
            openCustomEditor({ scheduleId: card.dataset.scheduleId });
        });
    });
    const wrap = body.querySelector('.timeline-wrap');
    if (wrap && list.length) {
        const firstTimed = list.filter(function (s) { return !s.allDay; })[0];
        if (firstTimed) wrap.scrollTop = Math.max(0, timeToMinutes(firstTimed.startTime) / 60 * 48 - 60);
    }
}

function updateCalendarDayNote(dateStr) {
    const cell = document.querySelector('.cal-cell[data-date="' + dateStr + '"]');
    if (!cell) return;
    const dayNote = AppData.dayNotes[dateStr] || '';
    let noteEl = cell.querySelector('.cal-day-note');
    if (dayNote) {
        if (!noteEl) {
            noteEl = document.createElement('div');
            noteEl.className = 'cal-day-note';
            cell.appendChild(noteEl);
        }
        noteEl.textContent = '📝 ' + dayNote;
        // 重新計算行數
        requestAnimationFrame(adjustDayNotes);
    } else if (noteEl) { noteEl.remove(); }
}

function updateTimelineNote(scheduleId, note) {
    clearTimeout(window._timelineNoteTimer);
    window._timelineNoteTimer = setTimeout(function () {
        const activeEl = document.activeElement;
        const isNoteTextarea = activeEl && activeEl.dataset && activeEl.dataset.note === scheduleId;
        const selStart = isNoteTextarea ? activeEl.selectionStart : 0;
        const selEnd = isNoteTextarea ? activeEl.selectionEnd : 0;
        renderDayPanel();
        if (isNoteTextarea) {
            const ta = document.querySelector('[data-note="' + scheduleId + '"]');
            if (ta) { ta.focus(); try { ta.setSelectionRange(selStart, selEnd); } catch (e) {} }
        }
    }, 500);
}

function applySymbolToDate(symbol, date) {
    const sym = String(symbol || '').trim().toUpperCase();
    const info = AppData.symbols[sym];
    if (info) {
        addSchedule({ symbol: sym, subject: info.subject, date: date, startTime: info.allDay ? '' : info.start, endTime: info.allDay ? '' : info.end, allDay: !!info.allDay, color: info.color || DEFAULT_COLOR });
        return true;
    } else {
        addSchedule({ symbol: sym, subject: sym, date: date, startTime: '', endTime: '', allDay: true, color: DEFAULT_COLOR });
        return false;
    }
}

/* ============================================================
   8. 編輯模式邏輯
   ============================================================ */
function setEditMode(mode) {
    editMode = mode;

    // --- 更新 FAB 主按鈕與選項狀態 ---
    const fabMenu = document.getElementById('fabMenu');
    const fabIcon = document.getElementById('fabIcon');
    if (fabMenu && fabIcon) {
        fabMenu.classList.remove('mode-add', 'mode-delete', 'mode-normal');
        fabMenu.classList.add('mode-' + mode);
        if (mode === 'add') fabIcon.textContent = '➕';
        else if (mode === 'delete') fabIcon.textContent = '➖';
        else fabIcon.textContent = '✏️';
    }
    document.querySelectorAll('.fab-option').forEach(function (b) {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    // --- 顯示 / 隱藏模式相關 UI ---
    const symbolBar = document.getElementById('editSymbolBar');
    const symbolBarLabel = document.getElementById('editSymbolBarLabel');
    const hintBar = document.getElementById('editHint');
    const grid = document.getElementById('calGrid');

    if (mode === 'add') {
        selectedSymbolForDelete = null;
        symbolBar.style.display = 'flex';
        symbolBarLabel.textContent = '選擇模板：';
        hintBar.style.display = 'block';
        hintBar.textContent = '💡 點上方模板選中後，在日期上「單擊」加入一天，「按住拖拽」加入連續多天。';
        if (grid) grid.style.touchAction = 'none';
        renderEditSymbolChips();
    } else if (mode === 'delete') {
        selectedSymbolForAdd = null;
        symbolBar.style.display = 'flex';
        symbolBarLabel.textContent = '選擇要刪除的模板（不選=刪除全部）';
        hintBar.style.display = 'block';
        hintBar.textContent = '💡 選擇模板 → 只刪除該模板；未選擇 → 刪除當天全部日程，刪除前會先彈出確認。';
        if (grid) grid.style.touchAction = 'none';
        renderEditSymbolChips();
    } else {
        symbolBar.style.display = 'none';
        hintBar.style.display = 'none';
        if (grid) grid.style.touchAction = 'auto';
    }
    calDrag.active = false;
    clearDragPreview();
    renderCalendar();
    renderDayPanel();
}
function renderEditSymbolChips() {
    const wrap = document.getElementById('editSymbolChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    const keys = Object.keys(AppData.symbols).sort();
    if (!keys.length) {
        wrap.innerHTML = '<span style="color:#8a5a00; font-size:13px;">还没有任何模板，请先到「🧩 自訂模板」新增。</span>';
        return;
    }
    const isDeleteMode = (editMode === 'delete');
    const currentSelected = isDeleteMode ? selectedSymbolForDelete : selectedSymbolForAdd;

    keys.forEach(function (code) {
        const s = AppData.symbols[code];
        const color = s.color || DEFAULT_COLOR;
        const chip = document.createElement('span');
        chip.className = 'symbol-chip';
        if (currentSelected === code) {
            chip.classList.add(isDeleteMode ? 'delete-selected' : 'selected');
        }
        chip.style.background = hexToRgba(color, 0.15);
        chip.style.color = color;
        chip.style.borderLeftColor = color;
        chip.textContent = code;
        chip.title = s.subject + ' · ' + (s.allDay ? '整天' : (s.start + '–' + s.end));
        chip.addEventListener('click', function () {
            if (editMode === 'delete') {
                selectedSymbolForDelete = (selectedSymbolForDelete === code) ? null : code;
            } else {
                selectedSymbolForAdd = (selectedSymbolForAdd === code) ? null : code;
            }
            renderEditSymbolChips();
        });
        wrap.appendChild(chip);
    });
}

function updateDragPreview() {
    clearDragPreview();
    if (!calDrag.startDate || !calDrag.currentDate) return;
    const range = getDateRange(calDrag.startDate, calDrag.currentDate);
    const cls = (editMode === 'add') ? 'drag-preview-add' : 'drag-preview-delete';
    range.forEach(function (d) {
        const cell = document.querySelector('.cal-cell[data-date="' + d + '"]');
        if (cell) cell.classList.add(cls);
    });
}
function clearDragPreview() {
    document.querySelectorAll('.cal-cell.drag-preview-add, .cal-cell.drag-preview-delete').forEach(function (c) {
        c.classList.remove('drag-preview-add', 'drag-preview-delete');
    });
}

function quickAddToDates(symbol, dates) {
    const info = AppData.symbols[symbol];
    if (!info) { alert('所選模板已不存在'); return; }
    const color = info.color || DEFAULT_COLOR;
    dates.forEach(function (date) {
        const exists = AppData.schedules.some(function (s) { return s.date === date && s.symbol === symbol; });
        if (exists) return;
        addSchedule({ symbol: symbol, subject: info.subject, date: date, startTime: info.allDay ? '' : info.start, endTime: info.allDay ? '' : info.end, allDay: !!info.allDay, color: color });
    });
    saveData();
}

function quickDeleteDates(symbol, dates) {
    const before = AppData.schedules.length;
    if (symbol) {
        // 只刪除「該日期範圍內」且「symbol 相同」的排班
        // 但跳過已自訂的（customized === true）
        AppData.schedules = AppData.schedules.filter(function (s) {
            if (s.customized) return true;
            return !(dates.indexOf(s.date) !== -1 && s.symbol === symbol);
        });
    } else {
        // 未指定模板：刪除範圍內所有排班
        // 但跳過已自訂的（customized === true）
        AppData.schedules = AppData.schedules.filter(function (s) {
            if (s.customized) return true;
            return dates.indexOf(s.date) === -1;
        });
    }
    if (AppData.schedules.length !== before) saveData();
}

/* ============================================================
   9. 日曆 pointer 事件
   ============================================================ */
function initCalendarPointerEvents() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;

    // ---------- 阻止編輯模式下原生長按 / 選字 ----------
    grid.addEventListener('selectstart', function (e) {
        if (editMode !== 'normal') e.preventDefault();
    });
    grid.addEventListener('dragstart', function (e) {
        if (editMode !== 'normal') e.preventDefault();
    });
    grid.addEventListener('contextmenu', function (e) {
        if (editMode !== 'normal') e.preventDefault();
    });

    // ---------- pointerdown：在格子上 ----------
    grid.addEventListener('pointerdown', function (e) {
        if (editMode === 'normal') return;
        if (e.target.closest && e.target.closest('.color-picker')) return;
        const cell = e.target.closest('.cal-cell');
        if (!cell || !cell.dataset.date) return;
        if (editMode === 'add' && !selectedSymbolForAdd) { alert('請先在上方選擇一個模板'); return; }

        e.preventDefault();
        calDrag.active = true;
        calDrag.dragging = false;
        calDrag.startDate = cell.dataset.date;
        calDrag.currentDate = cell.dataset.date;
        calDrag.startX = e.clientX;
        calDrag.startY = e.clientY;

        updateDragPreview();
        try { grid.setPointerCapture(e.pointerId); } catch (err) {}
    });

    // ---------- pointermove：在 window 上（避免被原生事件攔截） ----------
    window.addEventListener('pointermove', function (e) {
        if (!calDrag.active) return;
        if (!calDrag.dragging) {
            const dx = Math.abs(e.clientX - calDrag.startX);
            const dy = Math.abs(e.clientY - calDrag.startY);
            if (dx < 8 && dy < 8) return;
            calDrag.dragging = true;
        }
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cell = el && el.closest ? el.closest('.cal-cell') : null;
        if (cell && cell.dataset.date) {
            if (cell.dataset.date !== calDrag.currentDate) {
                calDrag.currentDate = cell.dataset.date;
                updateDragPreview();
            }
        }
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // ---------- pointerup / pointercancel：在 window 上 ----------
    function finishDrag(e) {
        if (!calDrag.active) return;

        const startDate = calDrag.startDate;
        const endDate = calDrag.currentDate;
        const dates = getDateRange(startDate, endDate);

        calDrag.active = false;
        calDrag.dragging = false;
        clearDragPreview();

        if (editMode === 'add') {
            quickAddToDates(selectedSymbolForAdd, dates);
        } else if (editMode === 'delete') {
            if (selectedSymbolForDelete) {
                // 只刪除選中模板，不需確認
                quickDeleteDates(selectedSymbolForDelete, dates);
            } else {
                // 刪除全部：先彈出確認
                let rangeText;
                if (dates.length === 1) {
                    rangeText = startDate;
                } else {
                    rangeText = startDate + ' ～ ' + endDate + '（共 ' + dates.length + ' 天）';
                }
                if (!confirm('确定要刪除 ' + rangeText + ' 的全部排班吗？')) {
                    return;
                }
                quickDeleteDates(null, dates);
            }
        }

        renderCalendar();
        if (selectedDate) renderDayPanel();
    }

    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
}
/* ============================================================
   10. 模板列表 & 模板編輯面板
   ============================================================ */
let editingTplCode = null;
let selectedTplColor = DEFAULT_COLOR;
let justDragged = false;
let selectedCustomColor = DEFAULT_COLOR;
let editingCustomId = null;   // 目前編輯中的日程 ID（null = 新增模式）

/* 取得模板的自訂排序（若無則初始化為目前 key 的順序） */
function getOrderedCodes() {
    const allCodes = Object.keys(AppData.symbols);
    if (!AppData.templateOrder || !Array.isArray(AppData.templateOrder)) {
        AppData.templateOrder = allCodes.slice();
    }
    // 移除已刪除的
    AppData.templateOrder = AppData.templateOrder.filter(function (c) {
        return !!AppData.symbols[c];
    });
    // 加入新增的（放在最後）
    allCodes.forEach(function (c) {
        if (AppData.templateOrder.indexOf(c) === -1) {
            AppData.templateOrder.push(c);
        }
    });
    return AppData.templateOrder;
}

function renderTemplateList() {
    const wrap = document.getElementById('tplList');
    if (!wrap) return;
    wrap.innerHTML = '';

    const keys = getOrderedCodes();
    if (!keys.length) {
        wrap.innerHTML = '<div class="empty-state">' +
            '还没有任何模板，点右上角「＋ 新增模板」建立第一个吧！<br>' +
            '例如：名稱「早班」、简称 A1、09:00 – 18:30' +
            '</div>';
        return;
    }

    keys.forEach(function (code) {
        const s = AppData.symbols[code];
        if (!s) return;
        const color = s.color || DEFAULT_COLOR;
        const timeStr = s.allDay ? '整天' : (s.start + ' – ' + s.end);
        const subject = s.subject || code;
        const showCode = (code !== subject && !/^NEW\d*$/.test(code));

        const item = document.createElement('div');
        item.className = 'tpl-item';
        item.dataset.code = code;
        item.innerHTML =
            '<span class="tpl-item-dot" style="background:' + color + ';"></span>' +
            '<div class="tpl-item-main">' +
                '<div class="tpl-item-name">' + escapeHtml(subject) + '</div>' +
                '<div class="tpl-item-meta">' +
                    (showCode ? escapeHtml(code) + ' · ' : '') + escapeHtml(timeStr) +
                '</div>' +
            '</div>' +
            '<button class="tpl-item-edit" aria-label="编辑">✏️</button>';

        item.addEventListener('click', function () {
            if (justDragged) return;
            openTplEditor(code);
        });
        wrap.appendChild(item);
    });
}

function openTplEditor(code) {
    editingTplCode = code || null;
    const title = document.getElementById('tplEditorTitle');
    const codeInput = document.getElementById('tplCodeInput');
    const subjectInput = document.getElementById('tplSubjectInput');
    const startInput = document.getElementById('tplStartInput');
    const endInput = document.getElementById('tplEndInput');
    const allDayInput = document.getElementById('tplAllDayInput');
    const deleteBtn = document.getElementById('deleteTplBtn');

    if (code) {
        const s = AppData.symbols[code];
        if (!s) return;
        title.textContent = '编辑模板';
        codeInput.value = code;
        subjectInput.value = s.subject || '';
        startInput.value = s.start || '';
        endInput.value = s.end || '';
        allDayInput.checked = !!s.allDay;
        deleteBtn.style.display = 'inline-block';
        selectedTplColor = s.color || DEFAULT_COLOR;
    } else {
        title.textContent = '新增模板';
        codeInput.value = '';
        subjectInput.value = '';
        startInput.value = '09:00';
        endInput.value = '18:00';
        allDayInput.checked = false;
        deleteBtn.style.display = 'none';
        selectedTplColor = DEFAULT_COLOR;
    }

    renderTplColorGrid();
    updateTplTimeDisabled();

    document.getElementById('tplEditor').classList.add('open');
    document.getElementById('tplEditorOverlay').classList.add('show');

    setTimeout(function () { subjectInput.focus(); }, 300);
}

function closeTplEditor() {
    document.getElementById('tplEditor').classList.remove('open');
    document.getElementById('tplEditorOverlay').classList.remove('show');
    editingTplCode = null;
}

function renderTplColorGrid() {
    const grid = document.getElementById('tplColorGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // 預設色（可長按 / 右鍵刪除）
    getPalette().forEach(function (c) {
        const dot = document.createElement('span');
        dot.className = 'color-option' + (c === selectedTplColor ? ' selected' : '');
        dot.style.background = c;
        dot.dataset.color = c;
        dot.title = '長按可刪除';
        dot.addEventListener('click', function () {
            if (colorLongPressTriggered) return;
            selectedTplColor = c;
            renderTplColorGrid();
        });
        grid.appendChild(dot);
    });

    // 自訂色（可長按 / 右鍵刪除）
    (AppData.customColors || []).forEach(function (c) {
        const dot = document.createElement('span');
        dot.className = 'color-option' + (c === selectedTplColor ? ' selected' : '');
        dot.style.background = c;
        dot.dataset.color = c;
        dot.title = '長按可刪除';
        dot.addEventListener('click', function () {
            if (colorLongPressTriggered) return;
            selectedTplColor = c;
            renderTplColorGrid();
        });
        grid.appendChild(dot);
    });

    // 🎨 新增自訂顏色
    const custom = document.createElement('span');
    custom.className = 'color-option color-custom';
    custom.textContent = '🎨';
    custom.title = '新增自訂顏色';
    custom.addEventListener('click', function () {
        openColorPicker({ type: 'tpl' }, selectedTplColor);
    });
    grid.appendChild(custom);
}

function renderCustomColorGrid() {
    const grid = document.getElementById('customColorGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // 預設色（可長按 / 右鍵刪除）
    getPalette().forEach(function (c) {
        const dot = document.createElement('span');
        dot.className = 'color-option' + (c === selectedCustomColor ? ' selected' : '');
        dot.style.background = c;
        dot.dataset.color = c;
        dot.title = '長按可刪除';
        dot.addEventListener('click', function () {
            if (colorLongPressTriggered) return;
            selectedCustomColor = c;
            renderCustomColorGrid();
        });
        grid.appendChild(dot);
    });

    // 自訂色（可長按 / 右鍵刪除）
    (AppData.customColors || []).forEach(function (c) {
        const dot = document.createElement('span');
        dot.className = 'color-option' + (c === selectedCustomColor ? ' selected' : '');
        dot.style.background = c;
        dot.dataset.color = c;
        dot.title = '長按可刪除';
        dot.addEventListener('click', function () {
            if (colorLongPressTriggered) return;
            selectedCustomColor = c;
            renderCustomColorGrid();
        });
        grid.appendChild(dot);
    });

    // 🎨 新增自訂顏色
    const custom = document.createElement('span');
    custom.className = 'color-option color-custom';
    custom.textContent = '🎨';
    custom.title = '新增自訂顏色';
    custom.addEventListener('click', function () {
        openColorPicker({ type: 'custom' }, selectedCustomColor);
    });
    grid.appendChild(custom);
}

function updateTplTimeDisabled() {
    const allDay = document.getElementById('tplAllDayInput').checked;
    document.getElementById('tplStartInput').disabled = allDay;
    document.getElementById('tplEndInput').disabled = allDay;
}

function saveTplEditor() {
    const codeInput = document.getElementById('tplCodeInput').value.trim().toUpperCase();
    const subject = document.getElementById('tplSubjectInput').value.trim();
    const start = document.getElementById('tplStartInput').value;
    const end = document.getElementById('tplEndInput').value;
    const allDay = document.getElementById('tplAllDayInput').checked;

    if (!subject && !codeInput) {
        alert('请至少填写「名稱」或「简称」');
        return;
    }
    const finalSubject = subject || codeInput;
    let finalCode = codeInput || subject;

    let oldCode = null;  // 用來同步更新日曆上已加入的日程
    let newCode = null;

    if (editingTplCode) {
        // 編輯既有模板
        if (finalCode !== editingTplCode && AppData.symbols[finalCode]) {
            alert('這個簡稱已經存在了，請換一個');
            return;
        }
        const s = AppData.symbols[editingTplCode];
        oldCode = editingTplCode;
        newCode = finalCode;

        s.subject = finalSubject;
        s.start = allDay ? '' : start;
        s.end = allDay ? '' : end;
        s.allDay = allDay;
        s.color = selectedTplColor;

        if (finalCode !== editingTplCode) {
            delete AppData.symbols[editingTplCode];
            AppData.symbols[finalCode] = s;
            if (selectedSymbolForAdd === editingTplCode) selectedSymbolForAdd = finalCode;
            if (selectedSymbolForDelete === editingTplCode) selectedSymbolForDelete = finalCode;
        }
    } else {
        // 新增模板
        let finalCode2 = finalCode;
        let n = 1;
        while (AppData.symbols[finalCode2]) {
            n++;
            finalCode2 = finalCode + ' (' + n + ')';
        }
        AppData.symbols[finalCode2] = {
            subject: finalSubject,
            start: allDay ? '' : start,
            end: allDay ? '' : end,
            allDay: allDay,
            color: selectedTplColor
        };
    }

    // ===== 同步更新日曆上已加入的相同模板日程 =====
    if (oldCode && newCode) {
        syncSchedulesWithTemplate(oldCode, newCode, {
            subject: finalSubject,
            start: allDay ? '' : start,
            end: allDay ? '' : end,
            allDay: allDay,
            color: selectedTplColor
        });
    }

    saveData();
    closeTplEditor();
    renderTemplateList();
    renderQuickSymbols();
    if (editMode === 'add') renderEditSymbolChips();
    if (editMode === 'delete') renderEditSymbolChips();
    renderCalendar();
    if (selectedDate) renderDayPanel();
    renderQuickTable();
}

/* 把舊簡稱的日程更新為新簡稱，並套用模板的最新欄位 */
function syncSchedulesWithTemplate(oldCode, newCode, tplInfo) {
    AppData.schedules.forEach(function (s) {
        // 跳過已自訂的日程：使用者的手動修改優先
        if (s.customized) return;
        if (s.symbol === oldCode) {
            s.symbol = newCode;
            s.subject = tplInfo.subject;
            s.color = tplInfo.color;
            s.allDay = tplInfo.allDay;
            s.startTime = tplInfo.allDay ? '' : tplInfo.start;
            s.endTime = tplInfo.allDay ? '' : tplInfo.end;
        }
    });
}

function deleteTplEditor() {
    if (!editingTplCode) return;
    if (!confirm('确定要刪除模板「' + editingTplCode + '」吗？\n\n已加入日曆的排班不会被刪除，但会保留原本的名稱。')) return;
    delete AppData.symbols[editingTplCode];
    if (selectedSymbolForAdd === editingTplCode) selectedSymbolForAdd = null;
    if (selectedSymbolForDelete === editingTplCode) selectedSymbolForDelete = null;
    saveData();
    closeTplEditor();
    renderTemplateList();
    renderQuickSymbols();
    if (editMode === 'add') renderEditSymbolChips();
    if (editMode === 'delete') renderEditSymbolChips();
}

/* ============================================================
   10b. 自訂日程編輯器
   ============================================================ */

/* ============================================================
   10c. 模板長按拖拽排序
   ============================================================ */
function initTemplateDrag() {
    const wrap = document.getElementById('tplList');
    if (!wrap) return;

    // 清除可能殘留的 touch-action（避免頁面卡住）
    document.body.style.touchAction = '';
    wrap.style.touchAction = '';

    let timer = null;
    let active = false;
    let code = null;
    let itemEl = null;
    let ghostEl = null;
    let startX = 0;
    let startY = 0;
    let offsetY = 0;
    let order = [];
    let scrollParent = null;
    let autoScrollRAF = null;
    let currentClientY = 0;

    /* ----- 找到可滾動的祖先容器 ----- */
    function findScrollParent(el) {
        let p = el.parentElement;
        while (p) {
            const s = getComputedStyle(p);
            if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) {
                return p;
            }
            p = p.parentElement;
        }
        return document.documentElement;
    }

    /* ----- 自動滾動 ----- */
    function stopAutoScroll() {
        if (autoScrollRAF) {
            cancelAnimationFrame(autoScrollRAF);
            autoScrollRAF = null;
        }
    }

    function autoScrollStep() {
        if (!active || !scrollParent) {
            autoScrollRAF = null;
            return;
        }
        const rect = scrollParent.getBoundingClientRect();
        const EDGE = 60;   // 距離邊緣 60px 內開始滾動
        const SPEED = 10;  // 每幀滾動像素
        let delta = 0;

        if (currentClientY < rect.top + EDGE) {
            delta = -SPEED;
        } else if (currentClientY > rect.bottom - EDGE) {
            delta = SPEED;
        }

        if (delta !== 0) {
            const before = scrollParent.scrollTop;
            scrollParent.scrollTop += delta;
            // 若滾動真的發生，重新計算排序
            if (scrollParent.scrollTop !== before) {
                updateDragOrder(currentClientY);
            }
        }
        autoScrollRAF = requestAnimationFrame(autoScrollStep);
    }

    function startAutoScroll() {
        if (!autoScrollRAF) {
            scrollParent = findScrollParent(wrap);
            autoScrollRAF = requestAnimationFrame(autoScrollStep);
        }
    }

    function resetState() {
        if (timer) { clearTimeout(timer); timer = null; }
        active = false;
        code = null;
        itemEl = null;
        ghostEl = null;
        startX = 0;
        startY = 0;
        offsetY = 0;
        order = [];
        currentClientY = 0;
        stopAutoScroll();
    }

    function beginDrag() {
        if (!itemEl) return;
        active = true;
        timer = null;

        // 禁止頁面與列表滾動
        document.body.style.touchAction = 'none';
        wrap.style.touchAction = 'none';

        const rect = itemEl.getBoundingClientRect();
        itemEl.classList.add('dragging-source');

        const ghost = itemEl.cloneNode(true);
        ghost.classList.add('tpl-ghost');
        ghost.classList.remove('dragging-source');
        ghost.style.left = rect.left + 'px';
        ghost.style.top = rect.top + 'px';
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        document.body.appendChild(ghost);
        ghostEl = ghost;

        order = getOrderedCodes().slice();

        startAutoScroll();

        if (navigator.vibrate) {
            try { navigator.vibrate(30); } catch (err) {}
        }
    }

    function updateDragOrder(clientY) {
        const items = Array.from(wrap.querySelectorAll('.tpl-item:not(.dragging-source)'));
        let targetIndex = items.length;
        for (let i = 0; i < items.length; i++) {
            const r = items[i].getBoundingClientRect();
            if (clientY < r.top + r.height / 2) {
                targetIndex = i;
                break;
            }
        }
        const dragIdx = order.indexOf(code);
        if (dragIdx === -1) return;
        const newOrder = order.slice();
        newOrder.splice(dragIdx, 1);
        newOrder.splice(targetIndex, 0, code);
        if (newOrder.join(',') !== order.join(',')) {
            order = newOrder;
            const map = {};
            wrap.querySelectorAll('.tpl-item').forEach(function (el) {
                if (el.dataset.code) map[el.dataset.code] = el;
            });
            order.forEach(function (c) {
                if (map[c]) wrap.appendChild(map[c]);
            });
        }
    }

    function moveGhostTo(clientY) {
        currentClientY = clientY;
        if (!ghostEl) return;
        const y = clientY - offsetY;
        ghostEl.style.top = y + 'px';
    }

    function finishDrag(e) {
        if (timer) { clearTimeout(timer); timer = null; }

        if (active) {
            if (itemEl) itemEl.classList.remove('dragging-source');
            if (ghostEl) ghostEl.remove();
            if (order && order.length) {
                AppData.templateOrder = order.slice();
                saveData();
                renderQuickSymbols();
            }
            justDragged = true;
            setTimeout(function () { justDragged = false; }, 150);
        }

        // 無論如何都恢復滾動
        document.body.style.touchAction = '';
        wrap.style.touchAction = '';

        resetState();
    }

    /* ============================================================
       Touch 事件（手機）
       ============================================================ */
    wrap.addEventListener('touchstart', function (e) {
        if (e.target.closest('.tpl-item-edit')) return;
        const item = e.target.closest('.tpl-item');
        if (!item || !item.dataset.code) return;
        if (e.touches.length !== 1) return;

        resetState();
        code = item.dataset.code;
        itemEl = item;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        const rect = item.getBoundingClientRect();
        offsetY = e.touches[0].clientY - rect.top;

        timer = setTimeout(beginDrag, 300);
    }, { passive: true });

    // 輕量滑動偵測（未進入拖拽時）
    wrap.addEventListener('touchmove', function (e) {
        if (active) return;
        if (!itemEl) return;
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dy = Math.abs(touch.clientY - startY);
        const dx = Math.abs(touch.clientX - startX);
        if (dy > 8 || dx > 8) {
            if (timer) { clearTimeout(timer); timer = null; }
            itemEl = null;
            code = null;
        }
    }, { passive: true });

    // 拖拽中（阻止滾動）
    wrap.addEventListener('touchmove', function (e) {
        if (!active) return;
        if (!itemEl) return;
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        if (e.cancelable) e.preventDefault();
        moveGhostTo(touch.clientY);
        updateDragOrder(touch.clientY);
    }, { passive: false });

    wrap.addEventListener('touchend', finishDrag, { passive: true });
    wrap.addEventListener('touchcancel', finishDrag, { passive: true });

    /* ============================================================
       Mouse 事件（電腦）
       ============================================================ */
    wrap.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;  // 只接受左鍵
        if (e.target.closest('.tpl-item-edit')) return;
        const item = e.target.closest('.tpl-item');
        if (!item || !item.dataset.code) return;

        resetState();
        code = item.dataset.code;
        itemEl = item;
        startX = e.clientX;
        startY = e.clientY;
        const rect = item.getBoundingClientRect();
        offsetY = e.clientY - rect.top;

        timer = setTimeout(beginDrag, 300);

        // 防止拖拽時選中文字
        e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
        if (active) {
            e.preventDefault();
            moveGhostTo(e.clientY);
            updateDragOrder(e.clientY);
            return;
        }
        if (!itemEl) return;
        const dy = Math.abs(e.clientY - startY);
        const dx = Math.abs(e.clientX - startX);
        if (dy > 8 || dx > 8) {
            if (timer) { clearTimeout(timer); timer = null; }
            itemEl = null;
            code = null;
        }
    });

    window.addEventListener('mouseup', function (e) {
        finishDrag(e);
    });
}

/* ============================================================
   10d. 年月選擇器
   ============================================================ */
let ymYear = 0;

function openYmPicker() {
    ymYear = viewYear;
    renderYmMonths();
    document.getElementById('ymPicker').classList.add('open');
    document.getElementById('ymPickerOverlay').classList.add('show');
}

function closeYmPicker() {
    document.getElementById('ymPicker').classList.remove('open');
    document.getElementById('ymPickerOverlay').classList.remove('show');
}

function renderYmMonths() {
    document.getElementById('ymYearLabel').textContent = ymYear + ' 年';
    const wrap = document.getElementById('ymMonths');
    wrap.innerHTML = '';
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                        '7月', '8月', '9月', '10月', '11月', '12月'];
    monthNames.forEach(function (name, idx) {
        const btn = document.createElement('button');
        btn.className = 'ym-month-btn';
        btn.textContent = name;
        if (ymYear === viewYear && idx === viewMonth) {
            btn.classList.add('current');
        }
        btn.addEventListener('click', function () {
            viewYear = ymYear;
            viewMonth = idx;
            closeYmPicker();
            renderCalendar();
            renderDayPanel();
        });
        wrap.appendChild(btn);
    });
}

/* ============================================================
   10f. 月份切換平移動畫
   ============================================================ */
let monthAnimating = false;

function animateMonthChange(direction) {
    // direction: 'next' = 下個月（從右側滑入）；'prev' = 上個月（從左側滑入）
    if (monthAnimating) return;

    const grid = document.getElementById('calGrid');
    if (!grid) return;
    const wrapper = grid.parentElement;
    if (!wrapper) return;

    monthAnimating = true;

    const slideDistance = wrapper.offsetWidth || window.innerWidth;

    // 1. 克隆舊日曆
    const oldGrid = grid.cloneNode(true);
    oldGrid.removeAttribute('id');
    oldGrid.style.position = 'absolute';
    oldGrid.style.inset = '0';
    oldGrid.style.transition = 'none';
    oldGrid.style.transform = 'translateX(0)';
    oldGrid.style.pointerEvents = 'none';
    oldGrid.style.zIndex = '2';
    wrapper.appendChild(oldGrid);

    // 2. 更新月份 + 渲染新日曆
    if (direction === 'next') {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    } else {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    }
    renderCalendar();
    renderDayPanel();

    // 3. 新日曆先放在螢幕外
    const startX = direction === 'next' ? slideDistance : -slideDistance;
    grid.style.transition = 'none';
    grid.style.transform = 'translateX(' + startX + 'px)';

    // 強制回流
    void grid.offsetWidth;

    // 4. 開始動畫
    const duration = 280;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    grid.style.transition = 'transform ' + duration + 'ms ' + easing;
    oldGrid.style.transition = 'transform ' + duration + 'ms ' + easing;

    requestAnimationFrame(function () {
        grid.style.transform = 'translateX(0)';
        oldGrid.style.transform = 'translateX(' + (-startX) + 'px)';
    });

    // 5. 動畫結束後清理
    setTimeout(function () {
        if (oldGrid.parentNode) oldGrid.remove();
        grid.style.transition = '';
        grid.style.transform = '';
        monthAnimating = false;
    }, duration + 60);
}

/* ============================================================
   10e. 日曆左右滑動切換月份
   ============================================================ */
function initCalendarSwipe() {
    const wrap = document.getElementById('calGridWrap') || document.getElementById('calGrid');
    if (!wrap) return;

    let startX = 0, startY = 0, startTime = 0;
    let tracking = false;
    let decided = false;   // 是否已判斷出手勢意圖

    wrap.addEventListener('touchstart', function (e) {
        if (editMode !== 'normal') return;
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
        tracking = true;
        decided = false;
    }, { passive: true });

    wrap.addEventListener('touchmove', function (e) {
        if (!tracking) return;
        if (e.touches.length !== 1) return;

        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        if (!decided) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            decided = true;
        }

        // 水平位移大於垂直 → 阻止滾動，讓滑動生效
        if (Math.abs(dx) > Math.abs(dy)) {
            if (e.cancelable) e.preventDefault();
        } else {
            // 垂直手勢 → 放棄本次追蹤，讓瀏覽器正常滾動
            tracking = false;
        }
    }, { passive: false });

    wrap.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        if (e.changedTouches.length !== 1) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const dt = Date.now() - startTime;

        if (dt > 800) return;
        if (Math.abs(dx) < 40) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

        calSwiped = true;
        setTimeout(function () { calSwiped = false; }, 120);

        if (dx < 0) {
            animateMonthChange('next');
        } else {
            animateMonthChange('prev');
        }
    }, { passive: true });

    wrap.addEventListener('touchcancel', function () {
        tracking = false;
    }, { passive: true });
}

function openCustomEditor(prefill) {
    prefill = prefill || {};
    const deleteBtn = document.getElementById('deleteCustomBtn');

    // 判斷是編輯模式還是新增模式
    if (prefill.scheduleId) {
        const item = AppData.schedules.find(function (s) { return s.id === prefill.scheduleId; });
        if (!item) { alert('找不到这筆排班'); return; }
        editingCustomId = item.id;
        document.getElementById('customEditorTitle').textContent = '编辑日程';
        document.getElementById('customDateInput').value = item.date;
        document.getElementById('customSubjectInput').value = item.subject || '';
        document.getElementById('customStartInput').value = item.startTime || '09:00';
        document.getElementById('customEndInput').value = item.endTime || '18:00';
        document.getElementById('customAllDayInput').checked = !!item.allDay;
        document.getElementById('customNoteInput').value = item.note || '';
        selectedCustomColor = item.color || DEFAULT_COLOR;
        deleteBtn.style.display = 'inline-block';
    } else {
        editingCustomId = null;
        document.getElementById('customEditorTitle').textContent = '新增日程';
        document.getElementById('customDateInput').value = prefill.date || selectedDate || todayStr();
        document.getElementById('customSubjectInput').value = prefill.subject || '';
        document.getElementById('customStartInput').value = prefill.startTime || '09:00';
        document.getElementById('customEndInput').value = prefill.endTime || '18:00';
        document.getElementById('customAllDayInput').checked = !!prefill.allDay;
        document.getElementById('customNoteInput').value = prefill.note || '';
        selectedCustomColor = prefill.color || DEFAULT_COLOR;
        deleteBtn.style.display = 'none';
    }

    renderCustomColorGrid();
    updateCustomTimeDisabled();

    document.getElementById('customEditor').classList.add('open');
    document.getElementById('customEditorOverlay').classList.add('show');
    setTimeout(function () { document.getElementById('customSubjectInput').focus(); }, 300);
}

function closeCustomEditor() {
    document.getElementById('customEditor').classList.remove('open');
    document.getElementById('customEditorOverlay').classList.remove('show');
    editingCustomId = null;
}


function updateCustomTimeDisabled() {
    const allDay = document.getElementById('customAllDayInput').checked;
    document.getElementById('customStartInput').disabled = allDay;
    document.getElementById('customEndInput').disabled = allDay;
}

function saveCustomSchedule() {
    const date = document.getElementById('customDateInput').value;
    const subject = document.getElementById('customSubjectInput').value.trim();
    const start = document.getElementById('customStartInput').value;
    const end = document.getElementById('customEndInput').value;
    const allDay = document.getElementById('customAllDayInput').checked;
    const note = document.getElementById('customNoteInput').value;

    if (!date) { alert('請選擇日期'); return; }
    if (!subject) { alert('请输入名稱'); return; }

    if (editingCustomId) {
        // 編輯既有日程
        const item = AppData.schedules.find(function (s) { return s.id === editingCustomId; });
        if (!item) { alert('找不到这筆排班'); closeCustomEditor(); return; }
        item.date = date;
        item.subject = subject;
        item.startTime = allDay ? '' : start;
        item.endTime = allDay ? '' : end;
        item.allDay = allDay;
        item.note = note;
        item.color = selectedCustomColor;
        item.customized = true;   // ← 標記為已自訂
        saveData();
    } else {
        // 新增日程
        addSchedule({
            symbol: '',
            subject: subject,
            date: date,
            startTime: allDay ? '' : start,
            endTime: allDay ? '' : end,
            allDay: allDay,
            note: note,
            color: selectedCustomColor,
            customized: true      // ← 從頭就是自訂的
        });
    }

    closeCustomEditor();
    renderCalendar();
    if (selectedDate) renderDayPanel();
    renderQuickTable();
}

/* 刪除目前編輯中的日程 */
function deleteCustomSchedule() {
    if (!editingCustomId) return;
    if (!confirm('确定要刪除这筆日程吗？')) return;
    removeSchedule(editingCustomId);
    closeCustomEditor();
    renderCalendar();
    if (selectedDate) renderDayPanel();
    renderQuickTable();
}

/* ============================================================
   11. 快捷排班
   ============================================================ */
function renderQuickSymbols() {
    const grid = document.getElementById('quickSymbolGrid');
    const emptyHint = document.getElementById('quickSymbolEmptyHint');
    if (!grid) return;
    grid.innerHTML = '';
    const keys = getOrderedCodes();
    if (!keys.length) { emptyHint.style.display = 'block'; return; }
    emptyHint.style.display = 'none';
    keys.forEach(function (code) {
        const s = AppData.symbols[code];
        const color = s.color || DEFAULT_COLOR;
        const btn = document.createElement('button');
        btn.className = 'quick-symbol-btn';
        btn.style.borderLeftColor = color; btn.style.color = color;
        btn.style.borderTopColor = hexToRgba(color, 0.3);
        btn.style.borderRightColor = hexToRgba(color, 0.3);
        btn.style.borderBottomColor = hexToRgba(color, 0.3);
        const timeStr = s.allDay ? '整天' : (s.start + '–' + s.end);
        btn.innerHTML = escapeHtml(code) + '<small>' + escapeHtml(s.subject) + ' · ' + timeStr + '</small>';
        btn.addEventListener('click', function () { applySymbolToQuick(code); });
        grid.appendChild(btn);
    });
}

function applySymbolToQuick(code) {
    const startDateInput = document.getElementById('startDate');
    const startDate = startDateInput.value;
    if (!startDate) { alert('請先在頁面上方選擇起始日期'); return; }
    const s = AppData.symbols[code];
    if (!s) return;
    // 加入暫存列表（不直接寫入日曆）
    AppData.staging.push({
        id: uid('stg'),
        symbol: code,
        subject: s.subject,
        date: startDate,
        startTime: s.allDay ? '' : s.start,
        endTime: s.allDay ? '' : s.end,
        allDay: !!s.allDay,
        note: '',
        color: s.color || DEFAULT_COLOR
    });
    saveData();
    renderQuickTable();
    startDateInput.value = addDays(startDate, 1);
}

function renderQuickTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    document.getElementById('rowCount').innerText = AppData.staging.length;
    const dateCounts = {};
    AppData.staging.forEach(function (s) { dateCounts[s.date] = (dateCounts[s.date] || 0) + 1; });
    const sorted = AppData.staging.slice().sort(function (a, b) {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
    sorted.forEach(function (item) {
        const tr = document.createElement('tr');
        tr.id = 'row-' + item.id;
        if (dateCounts[item.date] > 1) tr.classList.add('row-duplicate');
        const color = item.color || DEFAULT_COLOR;
        tr.innerHTML =
            '<td style="text-align:center;">' + makeColorPickerHtml('schedule-color', item.id, color) + '</td>' +
            '<td><strong style="text-transform:uppercase; word-break:break-all;">' + escapeHtml(item.symbol || '') + '</strong></td>' +
            '<td>' + escapeHtml(item.subject) + '</td>' +
            '<td><input type="date" class="table-input" data-role="date" value="' + item.date + '"></td>' +
            '<td><button class="btn-danger" style="padding:4px 8px; font-size:11px;" data-role="del">✕</button></td>';

        tr.querySelector('[data-role="date"]').addEventListener('change', function () {
            if (!this.value) return;
            item.date = this.value;
            saveData(); renderQuickTable(); highlightAndScrollToId(item.id);
        });
        tr.querySelector('[data-role="del"]').addEventListener('click', function () {
            AppData.staging = AppData.staging.filter(function (s) { return s.id !== item.id; });
            saveData();
            renderQuickTable();
        });
        tbody.appendChild(tr);
    });
}

function highlightAndScrollToId(id) {
    setTimeout(function () {
        const tr = document.getElementById('row-' + id);
        if (!tr) return;
        tr.classList.add('row-target-highlight');
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
}

function processBatch() {
    const startDateVal = document.getElementById('startDate').value;
    const rawSymbols = document.getElementById('batchSymbols').value.trim();
    if (!startDateVal) return alert('请选择起始日期！');
    if (!rawSymbols) return alert('请输入至少一个簡稱！');
    const symbols = rawSymbols.toUpperCase().split(/[\s,+/]+/).filter(Boolean);
    let currDate = startDateVal, lastId = null;
    symbols.forEach(function (sym) {
        const before = AppData.schedules.length;
        applySymbolToDate(sym, currDate);
        if (AppData.schedules.length > before) { lastId = AppData.schedules[AppData.schedules.length - 1].id; }
        currDate = addDays(currDate, 1);
    });
    renderQuickTable();
    if (lastId) highlightAndScrollToId(lastId);
    document.getElementById('batchSymbols').value = '';
    document.getElementById('startDate').value = currDate;
}

/* ============================================================
   11b. 備份 / 還原
   ============================================================ */

function renderBackupView() {
    // 若日期欄位為空，預設填入本月範圍
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const firstDay = y + '-' + String(m + 1).padStart(2, '0') + '-01';
    const lastDate = new Date(y, m + 1, 0);
    const lastDay = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(lastDate.getDate()).padStart(2, '0');

    const bs = document.getElementById('backupStartDate');
    const be = document.getElementById('backupEndDate');
    const cs = document.getElementById('csvStartDate');
    const ce = document.getElementById('csvEndDate');
    const is_ = document.getElementById('icsStartDate');
    const ie = document.getElementById('icsEndDate');
    if (bs && !bs.value) bs.value = firstDay;
    if (be && !be.value) be.value = lastDay;
    if (cs && !cs.value) cs.value = firstDay;
    if (ce && !ce.value) ce.value = lastDay;
    if (is_ && !is_.value) is_.value = firstDay;
    if (ie && !ie.value) ie.value = lastDay;
}

function downloadJsonFile(obj, filename) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function filterDayNotesByRange(start, end) {
    const result = {};
    Object.keys(AppData.dayNotes).forEach(function (k) {
        if (k >= start && k <= end) result[k] = AppData.dayNotes[k];
    });
    return result;
}

function backupRange() {
    const start = document.getElementById('backupStartDate').value;
    const end = document.getElementById('backupEndDate').value;
    if (!start || !end) { alert('请选择開始和結束日期'); return; }
    if (start > end) { alert('開始日期不能晚于結束日期'); return; }

    const schedulesInRange = AppData.schedules.filter(function (s) {
        return s.date >= start && s.date <= end;
    });

    const backup = {
        version: 1,
        appName: '排班表',
        exportDate: new Date().toISOString(),
        type: 'range',
        range: { start: start, end: end },
        symbols: AppData.symbols,
        templateOrder: AppData.templateOrder || [],
        schedules: schedulesInRange,
        dayNotes: filterDayNotesByRange(start, end),
        staging: AppData.staging || []
    };

    downloadJsonFile(backup, '排班表备份_' + start + '_至_' + end + '.json');
    alert('✅ 已备份 ' + schedulesInRange.length + ' 筆行程（' + start + ' ~ ' + end + '）');
}

function backupAll() {
    const backup = {
        version: 1,
        appName: '排班表',
        exportDate: new Date().toISOString(),
        type: 'all',
        symbols: AppData.symbols,
        templateOrder: AppData.templateOrder || [],
        schedules: AppData.schedules,
        dayNotes: AppData.dayNotes,
        staging: AppData.staging || []
    };

    downloadJsonFile(backup, '排班表备份_全部_' + todayStr() + '.json');
    alert('✅ 已备份全部 ' + AppData.schedules.length + ' 筆行程');
}

/* ----- 還原 ----- */
let pendingRestoreData = null;

function chooseBackupFile() {
    document.getElementById('restoreFileInput').click();
}

function handleBackupFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.symbols || !Array.isArray(data.schedules)) {
                alert('這個檔案不是有效的備份檔');
                return;
            }
            pendingRestoreData = data;
            const rangeText = data.range ? ('范围：' + data.range.start + ' ~ ' + data.range.end)
                                         : (data.type === 'all' ? '全部日程' : '');
            const dateText = data.exportDate ? data.exportDate.slice(0, 10) : '未知';
            document.getElementById('restoreFileName').innerHTML =
                '📄 ' + escapeHtml(file.name) + '<br>' +
                '备份日期：' + dateText + '<br>' +
                (rangeText ? '内容：' + escapeHtml(rangeText) : '');
            document.getElementById('restoreBtn').style.display = 'inline-block';
        } catch (err) {
            alert('讀取失敗：' + err.message);
            pendingRestoreData = null;
            document.getElementById('restoreFileName').textContent = '';
            document.getElementById('restoreBtn').style.display = 'none';
        }
    };
    reader.readAsText(file);
}

/* 產生行程的比對 key：所有欄位都相同才算「完全相同」 */
function scheduleKey(s) {
    return [
        s.date || '',
        s.symbol || '',
        s.subject || '',
        s.startTime || '',
        s.endTime || '',
        s.allDay ? '1' : '0',
        s.color || '',
        s.note || '',
        s.customized ? '1' : '0'
    ].join('||');
}

/* ============================================================
   CSV 還原
   ============================================================ */

/* 把 MM/DD/YYYY 轉成 YYYY-MM-DD */
function csvDateToISO(csvDate) {
    if (!csvDate) return '';
    const parts = csvDate.trim().split('/');
    if (parts.length !== 3) return csvDate;
    const mm = parts[0].padStart(2, '0');
    const dd = parts[1].padStart(2, '0');
    const yyyy = parts[2];
    return yyyy + '-' + mm + '-' + dd;
}

/* 簡易 CSV parser（支援雙引號、逗號、雙引號轉義） */
function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
    }
    result.push(cur);
    return result;
}

/* 依名稱在現有模板中找對應的 symbol code */
function findSymbolBySubject(subject) {
    if (!subject) return null;
    const keys = Object.keys(AppData.symbols);
    for (let i = 0; i < keys.length; i++) {
        if (AppData.symbols[keys[i]].subject === subject) return keys[i];
    }
    return null;
}

/* 解析 CSV 檔，轉成行程陣列 */
function parseCSVToSchedules(text) {
    // 移除 BOM
    text = text.replace(/^\uFEFF/, '');
    // 統一換行
    const lines = text.split(/\r\n|\r|\n/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length < 2) throw new Error('CSV 档案是空的或格式错误');

    const header = parseCSVLine(lines[0]).map(function (h) { return h.trim(); });
    const col = {};
    header.forEach(function (name, idx) { col[name] = idx; });

    // 檢查必要欄位
    if (col['Subject'] === undefined || col['Start Date'] === undefined) {
        throw new Error('CSV 缺少必要欄位（Subject / Start Date）');
    }

    const schedules = [];
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length < header.length) continue;

        const subject = (fields[col['Subject']] || '').trim();
        if (!subject) continue;

        const startDateISO = csvDateToISO(fields[col['Start Date']]);
        const endDateISO = col['End Date'] !== undefined ? csvDateToISO(fields[col['End Date']]) : startDateISO;
        const allDayRaw = col['All Day Event'] !== undefined ? (fields[col['All Day Event']] || '').trim().toUpperCase() : '';
        const allDay = (allDayRaw === 'TRUE');

        const startTime = allDay ? '' : (fields[col['Start Time']] || '').trim();
        const endTime = allDay ? '' : (fields[col['End Time']] || '').trim();
        const note = col['Description'] !== undefined ? (fields[col['Description']] || '') : '';

        // 嘗試找對應的 symbol
        const symbol = findSymbolBySubject(subject);
        const color = (symbol && AppData.symbols[symbol] && AppData.symbols[symbol].color)
            ? AppData.symbols[symbol].color
            : DEFAULT_COLOR;

        schedules.push({
            id: uid('sch'),
            date: startDateISO,
            symbol: symbol || '',
            subject: subject,
            startTime: startTime,
            endTime: endTime,
            allDay: allDay,
            note: note,
            color: color,
            customized: !symbol   // 若找不到對應模板，就標記為自訂
        });
    }

    return schedules;
}

/* 讀取 CSV 檔案 */
let pendingCsvSchedules = null;

function chooseCsvFile() {
    document.getElementById('csvRestoreInput').click();
}

function handleCsvFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const schedules = parseCSVToSchedules(ev.target.result);
            if (!schedules.length) {
                alert('CSV 裡沒有任何行程');
                return;
            }
            pendingCsvSchedules = schedules;
            document.getElementById('csvRestoreFileName').innerHTML =
                '📄 ' + escapeHtml(file.name) + '<br>' +
                '解析到 <b>' + schedules.length + '</b> 筆行程';
            document.getElementById('csvRestoreBtn').style.display = 'inline-block';
        } catch (err) {
            alert('讀取失敗：' + err.message);
            pendingCsvSchedules = null;
            document.getElementById('csvRestoreFileName').textContent = '';
            document.getElementById('csvRestoreBtn').style.display = 'none';
        }
    };
    reader.readAsText(file, 'UTF-8');
}

/* 合併 CSV 行程（去重） */
function restoreFromCSV() {
    if (!pendingCsvSchedules) return;

    if (!confirm('確定要把這 ' + pendingCsvSchedules.length + ' 筆行程加入现有资料吗？\n\n' +
                 '· 完全相同的行程 → 跳過\n' +
                 '· 有任何不同的行程 → 加入')) return;

    const existingKeys = {};
    AppData.schedules.forEach(function (s) {
        existingKeys[scheduleKey(s)] = true;
    });

    let added = 0;
    let skipped = 0;
    pendingCsvSchedules.forEach(function (s) {
        const k = scheduleKey(s);
        if (existingKeys[k]) {
            skipped++;
        } else {
            AppData.schedules.push(s);
            existingKeys[k] = true;
            added++;
        }
    });

    saveData();
    pendingCsvSchedules = null;
    document.getElementById('csvRestoreFileName').innerHTML =
        '✅ 還原完成：新增 ' + added + ' 筆，跳過 ' + skipped + ' 筆';
    document.getElementById('csvRestoreBtn').style.display = 'none';
    document.getElementById('csvRestoreInput').value = '';

    renderCalendar();
    if (selectedDate) renderDayPanel();
    renderQuickTable();

    alert('✅ CSV 還原完成！\n\n新增 ' + added + ' 筆，跳過 ' + skipped + ' 筆');
}

/* ============================================================
   ICS 還原（iCalendar 格式）
   ============================================================ */

/* 解析 ICS 日期：YYYYMMDD 或 YYYYMMDDTHHMMSS 或 YYYYMMDDTHHMMSSZ */
function parseIcsDate(value) {
    if (!value) return null;
    const s = value.trim();

    // 日期部分：YYYYMMDD
    const dateMatch = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dateMatch) return null;

    // 時間部分：T HHMMSS 後面可能有 Z（UTC）
    const timeMatch = s.match(/T(\d{2})(\d{2})(\d{2})(Z?)/);

    // 沒時間 → 全日活動
    if (!timeMatch) {
        return {
            date: dateMatch[1] + '-' + dateMatch[2] + '-' + dateMatch[3],
            time: '',
            allDay: true
        };
    }

    const isUTC = timeMatch[4] === 'Z';
    const hh = timeMatch[1];
    const mm = timeMatch[2];
    const ss = timeMatch[3];

    if (isUTC) {
        // UTC → 本地時區轉換
        const utcDate = new Date(Date.UTC(
            parseInt(dateMatch[1], 10),
            parseInt(dateMatch[2], 10) - 1,
            parseInt(dateMatch[3], 10),
            parseInt(hh, 10),
            parseInt(mm, 10),
            parseInt(ss, 10)
        ));
        const y = utcDate.getFullYear();
        const mo = String(utcDate.getMonth() + 1).padStart(2, '0');
        const d = String(utcDate.getDate()).padStart(2, '0');
        const h = String(utcDate.getHours()).padStart(2, '0');
        const mi = String(utcDate.getMinutes()).padStart(2, '0');
        return {
            date: y + '-' + mo + '-' + d,
            time: h + ':' + mi,
            allDay: false
        };
    }

    // 無 Z（本地時間或 TZID 指定時間）→ 直接用
    return {
        date: dateMatch[1] + '-' + dateMatch[2] + '-' + dateMatch[3],
        time: hh + ':' + mm,
        allDay: false
    };
}

/* 解析 ICS 檔案內容成行程陣列 */
function parseIcsToSchedules(text) {
    // 展開折行的行（ICS 用 " " 開頭續行）
    const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
            lines[lines.length - 1] += line.substring(1);
        } else {
            lines.push(line);
        }
    }

    const schedules = [];
    let current = null;
    let inEvent = false;

    function unescapeIcsText(s) {
        if (!s) return '';
        return s
            .replace(/\\n/gi, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\');
    }

    lines.forEach(function (line) {
        if (!line) return;
        if (line === 'BEGIN:VEVENT') {
            current = {};
            inEvent = true;
            return;
        }
        if (line === 'END:VEVENT') {
            if (current && current.summary && current.dtstart) {
                const start = parseIcsDate(current.dtstart);
                if (start) {
                    // 全日活動：Google 的 DTEND 是「隔天」，所以不用
                    // 非全日：用 DTEND 或預設 +1 小時
                    let endTime = '';
                    if (!start.allDay && current.dtend) {
                        const endParsed = parseIcsDate(current.dtend);
                        if (endParsed) endTime = endParsed.time;
                    }
                    const symbol = findSymbolBySubject(current.summary);
                    const color = (symbol && AppData.symbols[symbol] && AppData.symbols[symbol].color)
                        ? AppData.symbols[symbol].color
                        : DEFAULT_COLOR;
                    schedules.push({
                        id: uid('sch'),
                        date: start.date,
                        symbol: symbol || '',
                        subject: current.summary,
                        startTime: start.allDay ? '' : start.time,
                        endTime: endTime,
                        allDay: start.allDay,
                        note: current.description || '',
                        color: color,
                        customized: !symbol
                    });
                }
            }
            current = null;
            inEvent = false;
            return;
        }
        if (!inEvent || !current) return;

        // 解析 KEY:VALUE 或 KEY;PARAM=VALUE:VALUE
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) return;
        const keyPart = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);
        const keyName = keyPart.split(';')[0].toUpperCase();

        if (keyName === 'SUMMARY') current.summary = unescapeIcsText(value);
        else if (keyName === 'DTSTART') current.dtstart = value;
        else if (keyName === 'DTEND') current.dtend = value;
        else if (keyName === 'DESCRIPTION') current.description = unescapeIcsText(value);
        else if (keyName === 'LOCATION') current.location = unescapeIcsText(value);
    });

    return schedules;
}

/* 讀取 ICS 檔案 */
let pendingIcsSchedules = null;

function chooseIcsFile() {
    document.getElementById('icsRestoreInput').click();
}

function handleIcsFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const schedules = parseIcsToSchedules(ev.target.result);
            if (!schedules.length) {
                alert('ICS 裡沒有解析到任何行程');
                return;
            }
            pendingIcsSchedules = schedules;
            document.getElementById('icsRestoreFileName').innerHTML =
                '📄 ' + escapeHtml(file.name) + '<br>' +
                '解析到 <b>' + schedules.length + '</b> 筆行程';
            document.getElementById('icsRestoreBtn').style.display = 'inline-block';
        } catch (err) {
            alert('讀取失敗：' + err.message);
            pendingIcsSchedules = null;
            document.getElementById('icsRestoreFileName').textContent = '';
            document.getElementById('icsRestoreBtn').style.display = 'none';
        }
    };
    reader.readAsText(file, 'UTF-8');
}

/* 合併 ICS 行程（去重） */
function restoreFromIcs() {
    if (!pendingIcsSchedules) return;

    if (!confirm('確定要把這 ' + pendingIcsSchedules.length + ' 筆行程加入现有资料吗？\n\n' +
                 '· 完全相同的行程 → 跳過\n' +
                 '· 有任何不同的行程 → 加入')) return;

    const existingKeys = {};
    AppData.schedules.forEach(function (s) {
        existingKeys[scheduleKey(s)] = true;
    });

    let added = 0;
    let skipped = 0;
    pendingIcsSchedules.forEach(function (s) {
        const k = scheduleKey(s);
        if (existingKeys[k]) {
            skipped++;
        } else {
            AppData.schedules.push(s);
            existingKeys[k] = true;
            added++;
        }
    });

    saveData();
    pendingIcsSchedules = null;
    document.getElementById('icsRestoreFileName').innerHTML =
        '✅ 還原完成：新增 ' + added + ' 筆，跳過 ' + skipped + ' 筆';
    document.getElementById('icsRestoreBtn').style.display = 'none';
    document.getElementById('icsRestoreInput').value = '';

    renderCalendar();
    if (selectedDate) renderDayPanel();
    renderQuickTable();

    alert('✅ ICS 還原完成！\n\n新增 ' + added + ' 筆，跳過 ' + skipped + ' 筆');
}

/* 把行程轉成 ICS 格式並下載 */
function exportSchedulesToICS(startDate, endDate) {
    let data = AppData.schedules;
    if (startDate && endDate) {
        data = data.filter(function (s) {
            return s.date >= startDate && s.date <= endDate;
        });
    }
    if (!data.length) {
        alert('没有行程可以匯出！');
        return;
    }

    function icsDate(dateStr, timeStr) {
        // 2026-09-18 → 20260918 或 20260918T090000
        const p = dateStr.split('-');
        const base = p[0] + p[1] + p[2];
        if (!timeStr) return base;
        const t = timeStr.split(':');
        return base + 'T' + t[0].padStart(2, '0') + t[1].padStart(2, '0') + '00';
    }

    function escapeIcs(s) {
        return String(s || '')
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }

    function addDaysISO(dateStr, days) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + dd;
    }

    const now = new Date();
    const stamp = now.getUTCFullYear() +
        String(now.getUTCMonth() + 1).padStart(2, '0') +
        String(now.getUTCDate()).padStart(2, '0') + 'T' +
        String(now.getUTCHours()).padStart(2, '0') +
        String(now.getUTCMinutes()).padStart(2, '0') +
        String(now.getUTCSeconds()).padStart(2, '0') + 'Z';

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ShiftApp//排班表//ZH-TW',
        'CALSCALE:GREGORIAN'
    ];

    data.forEach(function (item) {
        lines.push('BEGIN:VEVENT');
        lines.push('UID:' + item.id + '@shiftapp');
        lines.push('DTSTAMP:' + stamp);
        if (item.allDay) {
            // 全日：DTSTART 是當天，DTEND 是隔天（ICS 規範）
            lines.push('DTSTART;VALUE=DATE:' + icsDate(item.date, ''));
            lines.push('DTEND;VALUE=DATE:' + icsDate(addDaysISO(item.date, 1), ''));
        } else {
            lines.push('DTSTART:' + icsDate(item.date, item.startTime || '09:00'));
            lines.push('DTEND:' + icsDate(item.date, item.endTime || '18:00'));
        }
        lines.push('SUMMARY:' + escapeIcs(item.subject));
        if (item.note) {
            lines.push('DESCRIPTION:' + escapeIcs(item.note));
        }
        lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    const ics = lines.join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let filename = '排班表_' + todayStr() + '.ics';
    if (startDate && endDate) filename = '排班表_' + startDate + '_至_' + endDate + '.ics';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function restoreBackup() {
    if (!pendingRestoreData) return;

    const data = pendingRestoreData;

    if (!confirm('⚠️ 合併還原会把备份档的内容加入现有资料。\n\n' +
                 '· 完全相同的行程 → 跳過（不重複）\n' +
                 '· 有任何不同的行程 → 加入\n' +
                 '· 现有资料不会被刪除\n\n' +
                 '确定要继续吗？')) return;

    let addedSchedules = 0;
    let skippedSchedules = 0;
    let addedSymbols = 0;
    let updatedSymbols = 0;
    let updatedNotes = 0;

    /* ===== 1. 合併模板（symbols）===== */
    const backupSymbols = data.symbols || {};
    Object.keys(backupSymbols).forEach(function (code) {
        if (AppData.symbols[code]) {
            // 已存在 → 用備份的覆蓋
            AppData.symbols[code] = backupSymbols[code];
            updatedSymbols++;
        } else {
            // 不存在 → 加入
            AppData.symbols[code] = backupSymbols[code];
            addedSymbols++;
        }
    });

    /* ===== 2. 合併模板排序 ===== */
    if (Array.isArray(data.templateOrder)) {
        // 以備份排序為主，把現有但備份沒有的放最後
        const merged = data.templateOrder.slice();
        Object.keys(AppData.symbols).forEach(function (code) {
            if (merged.indexOf(code) === -1) merged.push(code);
        });
        AppData.templateOrder = merged;
    }

    /* ===== 3. 合併行程（去重）===== */
    // 建立現有行程的 key 集合
    const existingKeys = {};
    AppData.schedules.forEach(function (s) {
        existingKeys[scheduleKey(s)] = true;
    });

    // 遍歷備份的行程
    const backupSchedules = Array.isArray(data.schedules) ? data.schedules : [];
    backupSchedules.forEach(function (s) {
        const k = scheduleKey(s);
        if (existingKeys[k]) {
            // 完全相同 → 跳過
            skippedSchedules++;
        } else {
            // 不同 → 加入（用新的 id 避免衝突）
            AppData.schedules.push(Object.assign({}, s, { id: uid('sch') }));
            existingKeys[k] = true;
            addedSchedules++;
        }
    });

    /* ===== 4. 合併每日備註 ===== */
    const backupNotes = data.dayNotes || {};
    Object.keys(backupNotes).forEach(function (dateStr) {
        // 備份有該日期的備註 → 覆蓋
        AppData.dayNotes[dateStr] = backupNotes[dateStr];
        updatedNotes++;
    });

    /* ===== 5. 暫存列表：不還原（保留現有的）===== */

    saveData();

    pendingRestoreData = null;
    document.getElementById('restoreFileName').innerHTML =
        '✅ 合併還原完成<br>' +
        '<span style="font-size:12px;">' +
        '行程：新增 ' + addedSchedules + ' 筆，跳過 ' + skippedSchedules + ' 筆<br>' +
        '模板：新增 ' + addedSymbols + ' 个，更新 ' + updatedSymbols + ' 个<br>' +
        '备注：更新 ' + updatedNotes + ' 天' +
        '</span>';
    document.getElementById('restoreBtn').style.display = 'none';
    document.getElementById('restoreFileInput').value = '';

    // 重新渲染所有相關畫面
    renderCalendar();
    if (selectedDate) renderDayPanel();
    renderTemplateList();
    renderQuickSymbols();
    renderQuickTable();
    if (editMode === 'add' || editMode === 'delete') renderEditSymbolChips();

    alert('✅ 合併還原完成！\n\n' +
          '行程：新增 ' + addedSchedules + ' 筆，跳過 ' + skippedSchedules + ' 筆\n' +
          '模板：新增 ' + addedSymbols + ' 个，更新 ' + updatedSymbols + ' 个\n' +
          '备注：更新 ' + updatedNotes + ' 天');
}

/* ============================================================
   12. 側邊抽屜 & 彈出面板控制
   ============================================================ */
function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('show'); }
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('show'); }
function openDayPanel() { document.getElementById('dayPanel').classList.add('open'); document.getElementById('dayPanelOverlay').classList.add('show'); }
function closeDayPanel() { document.getElementById('dayPanel').classList.remove('open'); document.getElementById('dayPanelOverlay').classList.remove('show'); }

/* ============================================================
   13. 啟動
   ============================================================ */
function switchView(viewName) {
    const validViews = ['calendar', 'template', 'quick', 'backup'];
    if (validViews.indexOf(viewName) === -1) viewName = 'calendar';
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');
    document.querySelectorAll('.drawer-nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.view === viewName); });
    closeDayPanel();
    closeTplEditor();

    // 只在日曆頁顯示 FAB
    const fabMenu = document.getElementById('fabMenu');
    if (fabMenu) {
        if (viewName === 'calendar') {
            fabMenu.style.display = '';
        } else {
            fabMenu.style.display = 'none';
            fabMenu.classList.remove('open');
        }
    }

    // 清除殘留的 touch-action
    document.body.style.touchAction = '';
    const tplListEl = document.getElementById('tplList');
    if (tplListEl) tplListEl.style.touchAction = '';

    // 依頁面切換背景與渲染
    if (viewName === 'calendar') {
        document.body.style.background = '#fff';
        renderCalendar();
        renderDayPanel();
    } else {
        document.body.style.background = '';
        if (viewName === 'template') renderTemplateList();
        else if (viewName === 'quick') { renderQuickSymbols(); renderQuickTable(); }
        else if (viewName === 'backup') renderBackupView();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // ========== Android 返回鍵處理 ==========
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.addListener('backButton', function (data) {
            // 1. 優先關閉最上層的彈出面板
            const ymPicker = document.getElementById('ymPicker');
            if (ymPicker && ymPicker.classList.contains('open')) {
                closeYmPicker();
                return;
            }
            const customEditor = document.getElementById('customEditor');
            if (customEditor && customEditor.classList.contains('open')) {
                closeCustomEditor();
                return;
            }
            const tplEditor = document.getElementById('tplEditor');
            if (tplEditor && tplEditor.classList.contains('open')) {
                closeTplEditor();
                return;
            }
            const dayPanel = document.getElementById('dayPanel');
            if (dayPanel && dayPanel.classList.contains('open')) {
                closeDayPanel();
                return;
            }
            const drawer = document.getElementById('drawer');
            if (drawer && drawer.classList.contains('open')) {
                closeDrawer();
                return;
            }

            // 2. 如果不在日曆頁，切回日曆頁
            const calendarView = document.getElementById('view-calendar');
            if (!calendarView || !calendarView.classList.contains('active')) {
                location.hash = '#calendar';
                return;
            }

            // 3. 如果在編輯模式（快速新增 / 快速刪除）→ 切回瀏覽模式
            if (editMode !== 'normal') {
                setEditMode('normal');
                return;
            }

            // 4. 已經在日曆頁、瀏覽模式、沒有彈窗 → 顯示確認或直接退出
            if (confirm('確定要退出 App 嗎？')) {
                window.Capacitor.Plugins.App.exitApp();
            }
        });
    }

    // 全域取色器變更
    document.getElementById('globalColorPicker').addEventListener('change', function () {
        applyPickedColor(this.value);
    });

    loadData();
    setupColorLongPress();
    document.getElementById('menuBtn').addEventListener('click', openDrawer);
    document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    document.querySelectorAll('.drawer-nav a').forEach(function (a) {
        a.addEventListener('click', function (e) {
            e.preventDefault();
            const v = a.dataset.view;
            if (location.hash === '#' + v) { switchView(v); } else { location.hash = '#' + v; }
            closeDrawer();
        });
    });
    document.getElementById('closeDayPanel').addEventListener('click', closeDayPanel);
    document.getElementById('dayPanelOverlay').addEventListener('click', closeDayPanel);
    document.getElementById('closeTplEditor').addEventListener('click', closeTplEditor);
    document.getElementById('tplEditorOverlay').addEventListener('click', closeTplEditor);
    document.getElementById('cancelTplBtn').addEventListener('click', closeTplEditor);
    document.getElementById('saveTplBtn').addEventListener('click', saveTplEditor);
    document.getElementById('deleteTplBtn').addEventListener('click', deleteTplEditor);
    document.getElementById('tplAllDayInput').addEventListener('change', updateTplTimeDisabled);
    document.getElementById('addSymbolBtn').addEventListener('click', function () { openTplEditor(null); });
    initTemplateDrag();
    document.getElementById('openCustomEditorFromDay').addEventListener('click', function () {
        openCustomEditor({ date: selectedDate });
    });
    document.getElementById('closeCustomEditor').addEventListener('click', closeCustomEditor);
    document.getElementById('customEditorOverlay').addEventListener('click', closeCustomEditor);
    document.getElementById('cancelCustomBtn').addEventListener('click', closeCustomEditor);
    document.getElementById('saveCustomBtn').addEventListener('click', saveCustomSchedule);
    document.getElementById('deleteCustomBtn').addEventListener('click', deleteCustomSchedule);
    document.getElementById('customAllDayInput').addEventListener('change', updateCustomTimeDisabled);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeDrawer();
            closeDayPanel();
            closeTplEditor();
            closeCustomEditor();
            closeYmPicker();
        }
    });
    window.addEventListener('hashchange', function () { switchView(location.hash.replace('#', '') || 'calendar'); });

    const now = new Date();
    viewYear = now.getFullYear(); viewMonth = now.getMonth(); selectedDate = todayStr();

    document.getElementById('prevMonth').addEventListener('click', function () {
        viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', function () {
        viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCalendar();
    });
    document.getElementById('todayBtn').addEventListener('click', function () {
        const t = new Date(); viewYear = t.getFullYear(); viewMonth = t.getMonth();
        selectedDate = todayStr(); renderCalendar(); renderDayPanel();
    });

    // FAB 主按鈕：開 / 關選單
    document.getElementById('fabMain').addEventListener('click', function (e) {
        e.stopPropagation();
        document.getElementById('fabMenu').classList.toggle('open');
    });

    // FAB 選項：切換模式後自動關閉選單
    document.querySelectorAll('.fab-option').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setEditMode(btn.dataset.mode);
            document.getElementById('fabMenu').classList.remove('open');
        });
    });

    // 自訂色按鈕（行程色板）
    document.addEventListener('click', function (e) {
        if (e.target.classList && e.target.classList.contains('color-custom')) {
            const picker = e.target.closest('.color-picker');
            if (!picker) return;   // 模板色板的 🎨 有自己的處理器
            e.stopPropagation();
            const role = picker.dataset.role;
            const dot = picker.querySelector('.color-dot');
            const currentColor = rgbToHex(dot.style.background) || DEFAULT_COLOR;
            picker.classList.remove('open');
            openColorPicker({
                type: 'schedule',
                role: role,
                id: role === 'symbol-color' ? picker.dataset.code : picker.dataset.id
            }, currentColor);
        }
    });

    // 點 FAB 以外的地方 → 關閉選單
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.fab-menu')) {
            const fm = document.getElementById('fabMenu');
            if (fm) fm.classList.remove('open');
        }
    });

    // 初始化 FAB 為瀏覽模式
    setEditMode('normal');

    initCalendarPointerEvents();

    initCalendarSwipe();

    // 點月標題 → 開年月選擇器
    document.getElementById('monthLabel').addEventListener('click', openYmPicker);
    document.getElementById('closeYmPicker').addEventListener('click', closeYmPicker);
    document.getElementById('ymPickerOverlay').addEventListener('click', closeYmPicker);
    document.getElementById('ymPrevYear').addEventListener('click', function () {
        ymYear--; renderYmMonths();
    });
    document.getElementById('ymNextYear').addEventListener('click', function () {
        ymYear++; renderYmMonths();
    });
    document.getElementById('ymTodayBtn').addEventListener('click', function () {
        const t = new Date();
        viewYear = t.getFullYear();
        viewMonth = t.getMonth();
        selectedDate = todayStr();
        closeYmPicker();
        renderCalendar();
        renderDayPanel();
    });

    const startDateInput = document.getElementById('startDate');
    if (startDateInput) startDateInput.value = todayStr();

    // ===== 備份頁事件 =====
    document.getElementById('backupRangeBtn').addEventListener('click', backupRange);
    document.getElementById('backupAllBtn').addEventListener('click', backupAll);

    document.getElementById('csvRangeBtn').addEventListener('click', function () {
        const s = document.getElementById('csvStartDate').value;
        const e = document.getElementById('csvEndDate').value;
        if (!s || !e) { alert('请选择開始和結束日期'); return; }
        if (s > e) { alert('開始日期不能晚于結束日期'); return; }
        exportSchedulesToCSV(s, e);
    });
    document.getElementById('csvAllBtn').addEventListener('click', function () {
        exportSchedulesToCSV();
    });

    // 恢復預設色板
    document.getElementById('restorePaletteBtn').addEventListener('click', restoreDefaultPalette);
    // 清除所有已加入日程
    document.getElementById('wipeSchedulesBtn').addEventListener('click', function () {
        const count = AppData.schedules.length;
        if (!count) {
            alert('目前没有任何已加入的日程');
            return;
        }
        if (!confirm('⚠️ 確定要清除所有已加入的日程嗎？\n\n共 ' + count + ' 筆\n\n' +
                     '· 模板、備註、待加入列表都會保留\n' +
                     '· 此操作無法復原')) return;
        if (!confirm('再次確認：真的要清除全部 ' + count + ' 筆日程嗎？')) return;

        AppData.schedules = [];
        saveData();

        renderCalendar();
        if (selectedDate) renderDayPanel();
        renderQuickTable();

        alert('✅ 已清除 ' + count + ' 筆日程');
    });
    document.getElementById('chooseIcsBtn').addEventListener('click', chooseIcsFile);
    document.getElementById('icsRestoreInput').addEventListener('change', handleIcsFileSelect);
    document.getElementById('icsRestoreBtn').addEventListener('click', restoreFromIcs);

    document.getElementById('icsRangeBtn').addEventListener('click', function () {
        const s = document.getElementById('icsStartDate').value;
        const e = document.getElementById('icsEndDate').value;
        if (!s || !e) { alert('请选择開始和結束日期'); return; }
        if (s > e) { alert('開始日期不能晚于結束日期'); return; }
        exportSchedulesToICS(s, e);
    });
    document.getElementById('icsAllBtn').addEventListener('click', function () {
        exportSchedulesToICS();
    });
    document.getElementById('restoreFileInput').addEventListener('change', handleBackupFileSelect);
    document.getElementById('restoreBtn').addEventListener('click', restoreBackup);

    // 清空暫存列表
    document.getElementById('clearTableBtn').addEventListener('click', function () {
        if (!AppData.staging.length) return;
        if (confirm('確定要清空待加入的行程嗎？')) {
            AppData.staging = [];
            saveData();
            renderQuickTable();
        }
    });

    // 把暫存列表加入日曆
    document.getElementById('commitBtn').addEventListener('click', function () {
        if (!AppData.staging.length) {
            alert('列表是空的，沒有行程可以加入');
            return;
        }
        const count = AppData.staging.length;
        AppData.staging.forEach(function (item) {
            // 複製一份，並給新的 id（避免與舊資料衝突）
            AppData.schedules.push({
                id: uid('sch'),
                symbol: item.symbol || '',
                subject: item.subject,
                date: item.date,
                startTime: item.startTime || '',
                endTime: item.endTime || '',
                allDay: !!item.allDay,
                note: item.note || '',
                color: item.color || DEFAULT_COLOR,
                customized: !!item.customized
            });
        });
        AppData.staging = [];
        saveData();
        renderQuickTable();
        renderCalendar();
        if (selectedDate) renderDayPanel();
        alert('✅ 已成功加入 ' + count + ' 筆行程到日曆！');
    });

    // 匯出已加入日曆的行程
    document.getElementById('exportCsvBtn').addEventListener('click', exportSchedulesToCSV);
    switchView(location.hash.replace('#', '') || 'calendar');
});