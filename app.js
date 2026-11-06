(() => {
  'use strict';
  const M = globalThis.RezsiMath;
  const KEY = 'rezsi-calculator.v1';
  const $ = id => document.getElementById(id);
  const fmt = (value, digits = 1) => new Intl.NumberFormat('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const dateLabel = date => date.replaceAll('-', '. ') + '.';
  const initial = () => ({ version: 1, settings: { heat: 34.8, correction: 1 }, readings: [], draft: { value: '', date: M.today() }, year: M.yearFor(M.today()), billing: M.defaultBilling() });
  const months = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
  const modeCopy = {
    flat: { badge: 'ÁTALÁNY', description: 'Közel azonos havi mennyiség, naparányos kedvezmény a részszámlákban.', note: 'Egyszerűsített részszámlabecslés: teljes naptári hónapra az éves becslés 1/12-e, törthónapra annak naparányos része. Az éves elszámolás szezonális szabályai ettől eltérhetnek.' },
    reading: { badge: 'HAVI DIKTÁLÁS', description: 'A tényleges mérőállás-különbség és a számlázott napokra jutó szezonális kedvezmény.', note: 'A fogyasztás a pontos kezdő és záró dátumra rögzített mérőállások különbsége. A kedvezmény a vizsgált napok szezonális kerete; a korábbi megtakarításból járó sávkorrekció nincs benne.' },
    temperature: { badge: 'HŐMÉRSÉKLETFÜGGŐ', description: 'Évszakos fogyasztásbecslés, külön szezonális kedvezménykerettel. A példaprofil szerkeszthető.', note: 'Szemléltető részszámlabecslés: az éves fogyasztást a szerkeszthető havi profilsúlyok osztják el, törthónapra naparányosan. A példasúlyok nem szolgáltatói hőmérsékleti adatok; az MVM tényleges részszámlája eltérhet.' }
  };
  let state = initial(), removed = null, toastTimer, preserveStoredData = false;

  function storageWarning(message) {
    $('storage-warning').textContent = message;
    $('storage-warning').hidden = false;
    $('save-status').classList.add('error');
    $('save-status').lastElementChild.textContent = 'A helyi mentés nem működik';
  }
  function isState(data) {
    if (!data || data.version !== 1 || !data.settings || !Number.isFinite(data.settings.heat) || data.settings.heat <= 0 || data.settings.heat > 100 || !Number.isFinite(data.settings.correction) || data.settings.correction <= 0 || data.settings.correction > 10 || !Array.isArray(data.readings) || !data.draft || typeof data.draft.value !== 'string' || !M.validDate(data.draft.date) || !Number.isInteger(data.year) || data.year < 1899 || data.year > 9998) return false;
    const ids = new Set();
    for (const r of data.readings) {
      if (!r || typeof r.id !== 'string' || ids.has(r.id) || M.validateReading(r, data.readings)) return false;
      ids.add(r.id);
    }
    return !M.validateBilling(data.billing);
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const data = JSON.parse(raw);
      // Extend the previous v1 schema without changing or discarding existing readings.
      if (data && data.version === 1 && !Object.hasOwn(data, 'billing')) data.billing = M.defaultBilling();
      if (!isState(data)) throw new Error('invalid stored state');
      state = data;
    }
  } catch {
    preserveStoredData = true;
    storageWarning('A korábbi helyi adatok nem olvashatók, vagy a tárhely nem érhető el. A tárolt adatokat nem írjuk felül. A most megadott adatok ebben a munkamenetben használhatók, de újratöltéskor elveszhetnek.');
  }

  function save() {
    if (preserveStoredData) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      $('storage-warning').hidden = true;
      $('save-status').classList.remove('error');
      $('save-status').lastElementChild.textContent = 'Minden módosítás mentve';
      return true;
    } catch {
      storageWarning('A böngésző tárhelye nem érhető el vagy megtelt. A módosítás működik, de nincs elmentve; újratöltéskor elveszhet.');
      return false;
    }
  }
  function error(id, message, input) {
    $(id).textContent = message;
    $(id).hidden = !message;
    if (input) input.setAttribute('aria-invalid', String(!!message));
  }
  function toast(message, undo = false) {
    clearTimeout(toastTimer);
    $('toast-text').textContent = message;
    $('undo-button').hidden = !undo;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, undo ? 15000 : 4500);
  }
  function renderYears() {
    const current = M.yearFor(M.today());
    const years = new Set([current, current - 1, state.year, ...state.readings.map(r => M.yearFor(r.date))]);
    $('year').replaceChildren(...[...years].sort((a, b) => b - a).map(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = `${year}. aug. – ${year + 1}. júl.`;
      return option;
    }));
    $('year').value = state.year;
  }
  function renderSummary(result) {
    $('annual').textContent = fmt(result.annual);
    $('daily').textContent = fmt(result.daily, 2);
    [1, 28, 30, 31].forEach(days => { $(`period-${days}`).textContent = fmt(result.daily * days, days === 1 ? 2 : 1); });
    const hasConsumption = result.items.length >= 2;
    const showBalance = hasConsumption || result.complete;
    $('consumed').textContent = hasConsumption || result.complete ? fmt(result.consumed) : '—';
    $('remaining').textContent = showBalance ? fmt(result.remaining) : '—';
    $('remaining-percent').textContent = showBalance ? `${fmt(result.percent, 0)}%` : '—';
    $('gauge-fill').style.strokeDashoffset = 421 * (1 - (showBalance ? result.percent : 0) / 100);
    $('gauge-fill').style.stroke = result.over ? '#ffb5a8' : '';
    $('coverage-badge').textContent = !result.first ? 'ÉVES ÁTTEKINTÉS' : result.complete ? 'ÉVKEZDÉSTŐL KÖVETVE' : 'HIÁNYOS IDŐSZAK';
    $('remaining-label').textContent = result.over ? 'A kedvezményes keret elfogyott' : result.complete ? 'Még rendelkezésre áll' : 'Becsült maradék · legfeljebb';
    $('remaining-energy').textContent = showBalance ? `${fmt(result.remaining * state.settings.heat * state.settings.correction, 0)} MJ energiának felel meg` : result.first ? 'Még egy mérés, és látod a fogyasztásod.' : 'Az első méréseddel kezdődik.';
    $('remaining-caption').textContent = result.over ? `${fmt(result.over)} m³-rel a keret felett` : `Éves energiakeret: ${fmt(M.ANNUAL_MJ, 0)} MJ`;
    const note = $('coverage-note');
    note.classList.toggle('warning', !!result.first && !result.complete || result.over > 0);
    note.textContent = !result.first ? `A ${state.year}/${state.year + 1}-es évhez még nincs mérés. Az éves követéshez ${result.start}-i kezdőállást adj meg.` : !result.complete ? `Követés kezdete: ${result.first.date}. Az évkezdés (${result.start}) és az első mérés közötti fogyasztás hiányzik, ezért a maradék csak felső becslés. A mérés dátumáig számolunk.` : `Követett időszak: ${result.first.date} → ${result.last.date}. A maradék az utolsó mérés dátumára vonatkozik.`;
    renderBilling();
  }
  function renderBilling() {
    const billing = state.billing;
    const result = M.calculateBilling(state.settings, state.readings, billing);
    const copy = modeCopy[billing.mode];
    const measured = billing.mode === 'reading';
    $('billing-badge').textContent = copy.badge;
    $('mode-description').textContent = copy.description;
    $('annual-estimate-field').hidden = measured;
    $('profile-settings').hidden = billing.mode !== 'temperature';
    $('billing-consumption-label').textContent = measured ? 'Mért időszaki fogyasztás' : 'Becsült számlázott mennyiség';
    $('billing-consumption').textContent = result.consumption === null ? '—' : fmt(result.consumption);
    $('billing-allowance').textContent = fmt(result.allowance);
    $('billing-allowance-energy').textContent = `${fmt(result.allowanceMJ, 1)} MJ · ${result.days} napra`;
    $('billing-eligible').textContent = result.eligible === null ? '—' : fmt(result.eligible);
    $('billing-over').textContent = result.over === null ? '—' : fmt(result.over);
    $('billing-over-value').classList.toggle('over-budget', result.over > 0);
    $('billing-consumption-note').textContent = measured ? result.consumption === null ? `Mérés szükséges: ${[!result.opening && billing.start, !result.closing && billing.end].filter(Boolean).join(' és ')}.` : 'A két határnap mérőállásának különbsége' : result.consumption === null ? 'Add meg a becsült éves fogyasztásodat.' : billing.mode === 'temperature' ? 'Szerkeszthető példaprofil alapján' : 'Az éves fogyasztás havi része alapján';
    $('billing-note').textContent = copy.note;
    $('daily-title').textContent = 'Keret a kezdőnaptól';
    $('daily-badge').textContent = billing.mode === 'flat' ? 'NAPARÁNYOS BECSLÉS' : 'SZEZONÁLIS BECSLÉS';
    $('daily-description').textContent = `${billing.start}-től számolva, a hónap- és évváltást figyelembe véve.`;
    [1, 28, 30, 31].forEach(days => {
      const volume = M.allowanceBetween(billing.start, M.addDays(billing.start, days), billing.mode) / (state.settings.heat * state.settings.correction);
      $(`period-${days}`).textContent = fmt(volume, days === 1 ? 2 : 1);
    });
    document.querySelectorAll('.comparison-card').forEach(card => {
      const selected = card.dataset.mode === billing.mode;
      card.classList.toggle('is-selected', selected);
      card.querySelector('.selected-mode').hidden = !selected;
    });
  }
  function chart(result) {
    const items = result.items;
    const w = Math.max(240, $('consumption-chart').clientWidth || 800), h = 150, left = 45, right = 12, top = 12, bottom = 30;
    const max = Math.max(result.consumed, 1) * 1.15;
    const firstDay = Date.parse(items[0].date);
    const span = Math.max(1, Date.parse(items.at(-1).date) - firstDay);
    const x = r => items.length === 1 ? left + (w - left - right) / 2 : left + (Date.parse(r.date) - firstDay) / span * (w - left - right);
    const y = r => h - bottom - (r.value - items[0].value) / max * (h - top - bottom);
    const points = items.map(r => `${x(r)},${y(r)}`).join(' ');
    const grid = [0, .5, 1].map(f => { const yy = top + (h - top - bottom) * f; return `<line x1="${left}" x2="${w - right}" y1="${yy}" y2="${yy}" stroke="#344035" stroke-dasharray="3 6"/><text x="0" y="${yy + 4}">${fmt(max * (1 - f), 0)}</text>`; }).join('');
    const circles = items.map(r => `<circle cx="${x(r)}" cy="${y(r)}" r="4" fill="#b9f592" stroke="#19201d" stroke-width="2"><title>${r.date}: ${fmt(r.value - items[0].value)} m³ fogyasztás</title></circle>`).join('');
    $('consumption-chart').innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Mért fogyasztás: ${fmt(result.consumed)} köbméter, ${items.length} mérés alapján"><defs><linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b9f592" stop-opacity=".13"/><stop offset="1" stop-color="#b9f592" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${x(items[0])},${h - bottom} ${points} ${x(items.at(-1))},${h - bottom}" fill="url(#chart-gradient)"/><polyline points="${points}" fill="none" stroke="#b9f592" stroke-width="2" vector-effect="non-scaling-stroke"/>${circles}<text x="${left}" y="${h - 3}">${dateLabel(items[0].date)}</text>${items.length > 1 ? `<text x="${w - right}" y="${h - 3}" text-anchor="end">${dateLabel(items.at(-1).date)}</text>` : ''}</svg>`;
    $('chart-range').textContent = `${fmt(result.consumed)} m³`;
  }
  function renderHistory(result) {
    $('reading-count').textContent = `${result.items.length} mérés`;
    $('history-empty').hidden = !!result.items.length;
    $('history-content').hidden = !result.items.length;
    $('history-body').replaceChildren();
    if (!result.items.length) return;
    chart(result);
    const rows = result.items.map((reading, index) => {
      const row = document.createElement('tr');
      row.dataset.id = reading.id;
      const dateCell = document.createElement('td');
      const dateInput = document.createElement('input');
      dateInput.type = 'text'; dateInput.value = reading.date; dateInput.placeholder = 'ÉÉÉÉ-HH-NN'; dateInput.maxLength = 10; dateInput.autocomplete = 'off'; dateInput.dataset.field = 'date';
      dateInput.setAttribute('aria-label', `${reading.date} mérés dátuma`); dateInput.setAttribute('aria-describedby', 'history-error');
      dateCell.append(dateInput);
      const valueCell = document.createElement('td');
      const valueInput = document.createElement('input');
      valueInput.type = 'text'; valueInput.inputMode = 'decimal'; valueInput.value = String(reading.value).replace('.', ','); valueInput.dataset.field = 'value';
      valueInput.setAttribute('aria-label', `${reading.date} mérőállás köbméterben`); valueInput.setAttribute('aria-describedby', 'history-error');
      valueCell.append(valueInput);
      const consumption = document.createElement('td'); consumption.className = 'consumption-cell';
      consumption.textContent = index ? `+${fmt(reading.value - result.items[index - 1].value)}` : '—';
      const small = document.createElement('small');
      small.textContent = index ? `${(Date.parse(reading.date) - Date.parse(result.items[index - 1].date)) / M.DAY} nap alatt` : 'Kezdőállás';
      consumption.append(small);
      const action = document.createElement('td');
      const button = document.createElement('button'); button.type = 'button'; button.className = 'delete-button'; button.dataset.delete = reading.id;
      button.setAttribute('aria-label', `${reading.date} mérés törlése`);
      button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6"/></svg>';
      action.append(button); row.append(dateCell, valueCell, consumption, action); return row;
    });
    $('history-body').append(...rows.reverse());
  }
  function render() {
    renderYears();
    const result = M.calculate(state.settings, state.readings, state.year);
    renderSummary(result); renderHistory(result);
  }
  $('heat').value = String(state.settings.heat).replace('.', ',');
  $('correction').value = state.settings.correction.toFixed(4).replace('.', ',');
  $('meter').value = state.draft.value;
  $('reading-date').value = state.draft.date;
  $('billing-mode').value = state.billing.mode;
  $('billing-start').value = state.billing.start;
  $('billing-end').value = state.billing.end;
  $('annual-estimate').value = state.billing.annualEstimate;
  state.billing.weights.forEach((weight, month) => {
    const wrapper = document.createElement('div');
    const label = document.createElement('label'); label.htmlFor = `profile-${month}`; label.textContent = months[month];
    const input = document.createElement('input'); input.id = label.htmlFor; input.type = 'text'; input.inputMode = 'decimal'; input.value = String(weight).replace('.', ','); input.dataset.month = month; input.setAttribute('aria-label', `${months[month]} fogyasztási profilsúlya`); input.setAttribute('aria-describedby', 'profile-error');
    wrapper.append(label, input); $('profile-inputs').append(wrapper);
  });
  $('billing-mode').addEventListener('change', () => {
    state.billing.mode = $('billing-mode').value;
    save(); renderBilling();
  });
  const billingFields = ['billing-start', 'billing-end', 'annual-estimate'];
  billingFields.forEach(id => $(id).addEventListener('blur', () => {
    const candidate = { ...state.billing, start: $('billing-start').value.trim(), end: $('billing-end').value.trim(), annualEstimate: $('annual-estimate').value.trim() };
    const message = M.validateBilling(candidate);
    error('billing-error', message);
    $(id).setAttribute('aria-invalid', String(!!message));
    if (message) return;
    billingFields.forEach(field => $(field).setAttribute('aria-invalid', 'false'));
    state.billing = candidate; save(); renderBilling();
  }));
  $('profile-inputs').addEventListener('focusout', event => {
    if (!(event.target instanceof HTMLInputElement)) return;
    const weights = [...$('profile-inputs').querySelectorAll('input')].map(input => M.parseNumber(input.value));
    const candidate = { ...state.billing, weights };
    const message = M.validateBilling(candidate);
    error('profile-error', message, event.target);
    if (message) return;
    $('profile-inputs').querySelectorAll('input').forEach(input => input.setAttribute('aria-invalid', 'false'));
    state.billing = candidate; save(); renderBilling();
  });
  $('use-readings').addEventListener('click', () => {
    const readings = M.calculate(state.settings, state.readings, state.year).items.slice(-2);
    if (readings.length < 2) { toast('A kiválasztott kedvezményes évhez legalább két mérés szükséges.'); return; }
    const candidate = { ...state.billing, start: readings[0].date, end: readings[1].date };
    const message = M.validateBilling(candidate);
    if (message) { error('billing-error', message); return; }
    state.billing = candidate;
    $('billing-start').value = candidate.start; $('billing-end').value = candidate.end;
    billingFields.forEach(id => $(id).setAttribute('aria-invalid', 'false'));
    error('billing-error', ''); save(); renderBilling();
  });

  const settingsErrors = {};
  ['heat', 'correction'].forEach(id => {
    $(id).addEventListener('blur', () => {
      const number = M.parseNumber($(id).value);
      const max = id === 'heat' ? 100 : 10;
      const message = !Number.isFinite(number) || number <= 0 || number > max ? `${id === 'heat' ? 'A fűtőérték' : 'A korrekciós tényező'} 0-nál nagyobb, legfeljebb ${max} lehet.` : '';
      settingsErrors[id] = message;
      error('settings-error', Object.values(settingsErrors).filter(Boolean).join(' '));
      $(id).setAttribute('aria-invalid', String(!!message));
      if (message) return;
      state.settings[id] = number;
      save();
      renderSummary(M.calculate(state.settings, state.readings, state.year));
    });
  });
  function saveDraft() {
    state.draft.value = $('meter').value;
    if (M.validDate($('reading-date').value)) state.draft.date = $('reading-date').value;
    save();
  }
  ['meter', 'reading-date'].forEach(id => {
    $(id).addEventListener('blur', saveDraft);
    $(id).addEventListener('input', () => {
      error('form-error', '');
      $('meter').setAttribute('aria-invalid', 'false');
      $('reading-date').setAttribute('aria-invalid', 'false');
    });
  });
  $('reading-form').addEventListener('submit', event => {
    event.preventDefault();
    const reading = { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, value: M.parseNumber($('meter').value), date: $('reading-date').value };
    const message = M.validateReading(reading, state.readings);
    error('form-error', message);
    $('meter').setAttribute('aria-invalid', String(!!message && M.validDate(reading.date) && reading.date <= M.today()));
    $('reading-date').setAttribute('aria-invalid', String(!!message && (!M.validDate(reading.date) || reading.date > M.today())));
    if (message) return;
    state.readings.push(reading); state.year = M.yearFor(reading.date);
    state.draft = { value: '', date: M.today() };
    $('meter').value = ''; $('reading-date').value = state.draft.date;
    const saved = save(); render();
    toast(saved ? 'Mérőállás rögzítve és elmentve.' : 'Mérőállás rögzítve. A helyi mentés sikertelen.');
  });
  $('year').addEventListener('change', () => { state.year = Number($('year').value); save(); render(); });
  $('opening-button').addEventListener('click', () => {
    const start = M.period(state.year).start;
    if (state.readings.some(r => r.date === start)) {
      toast('Az évkezdő mérés már szerepel a naplóban; ott módosíthatod.'); return;
    }
    $('reading-date').value = start;
    error('form-error', '');
    saveDraft(); $('reading-form').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('meter').focus({ preventScroll: true });
    toast(`Add meg a ${start}-i mérőállást.`);
  });
  $('history-body').addEventListener('focusout', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.field) return;
    const reading = state.readings.find(r => r.id === input.closest('tr').dataset.id);
    const field = input.dataset.field;
    const value = field === 'value' ? M.parseNumber(input.value) : input.value;
    if (reading[field] === value) return;
    const candidate = { ...reading, [field]: value };
    const message = M.validateReading(candidate, state.readings);
    error('history-error', message, input);
    if (message) {
      // Keep the last valid state. Invalid edits never affect calculations or storage.
      input.value = field === 'value' ? String(reading.value).replace('.', ',') : reading.date;
      input.setAttribute('aria-invalid', 'false');
      return;
    }
    Object.assign(reading, candidate);
    state.year = M.yearFor(candidate.date);
    save();
    // Wait for the current click/focus movement before replacing editable rows.
    setTimeout(() => {
      const focused = document.activeElement;
      const focusId = focused?.closest?.('tr')?.dataset.id;
      const focusField = focused?.dataset.field;
      render();
      if (focusId && focusField) {
        const row = [...$('history-body').rows].find(r => r.dataset.id === focusId);
        row?.querySelector(`[data-field="${focusField}"]`)?.focus({ preventScroll: true });
      }
    }, 0);
  });
  $('history-body').addEventListener('click', event => {
    const button = event.target.closest('button[data-delete]');
    if (!button) return;
    removed = state.readings.find(r => r.id === button.dataset.delete);
    state.readings = state.readings.filter(r => r.id !== removed.id);
    save(); render(); error('history-error', ''); toast('Mérés törölve.', true);
  });
  $('undo-button').addEventListener('click', () => {
    if (!removed) return;
    const message = M.validateReading(removed, state.readings);
    if (message) { toast(`A visszaállítás nem lehetséges. ${message}`); return; }
    state.readings.push(removed); state.year = M.yearFor(removed.date); removed = null;
    save(); render(); toast('Mérés visszaállítva.');
  });
  // Flush focused fields on tab close as well as normal blur.
  window.addEventListener('pagehide', () => { document.activeElement?.blur(); });
  window.addEventListener('storage', event => {
    if (event.key !== KEY) return;
    storageWarning('Az adatok egy másik böngészőlapon megváltoztak. A legfrissebb adatokhoz töltsd újra ezt az oldalt. Addig a mentés szünetel, hogy a másik lap adatait ne írjuk felül.');
    preserveStoredData = true;
  });
  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const result = M.calculate(state.settings, state.readings, state.year);
      if (result.items.length) chart(result);
    });
  });
  render();
})();
