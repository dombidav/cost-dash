<script lang="ts">
  import Help from '../components/Help.svelte';
  import { A2_PEAK_HELP } from '../lib/field-help';
  import TariffGuide from './TariffGuide.svelte';
  import PointSettings from './PointSettings.svelte';
  import { initialState, validState, migrateState, createPoint, validatePoint, validateReading, annual, total, periodResult } from './calculator';
  import { AREAS, TARIFFS, supported, officialRates, ELECTRICITY_REGIONS } from './reference';
  import { today, validDate, number, yearFor, days, yearPeriod } from '../calendar';
  import { fmt, money, uid } from '../lib/format';
  import { storage } from '../lib/storage';
  import { toast, ui } from '../lib/ui.svelte';
  import type { ElectricityPoint, ElectricityReading, ElectricityState, Area, Tariff } from './types';
  import Field from '../components/Field.svelte';
  import Select from '../components/Select.svelte';
  import Gauge from '../components/Gauge.svelte';
  import Chart from '../components/Chart.svelte';
  import ReadingLog from '../components/ReadingLog.svelte';
  import ElectricStats from './ElectricStats.svelte';
  const key = 'rezsi-electricity.v1';
  const disk = storage(key, initialState, validState, migrateState);
  let model = $state(disk.data), warning = $state(disk.warning);
  let point = $derived(model.points.find(p => p.id === model.selected)!);
  let a = $derived(annual(point, model.year));
  let bill = $derived(periodResult(point));
  let years = $derived([...new Set([yearFor(today()) + 1, yearFor(today()), yearFor(today()) - 1, model.year, ...model.points.flatMap(p => p.readings.map(r => yearFor(r.date)))])].sort((a,b) => b - a));
  let draft = $state({ date: today(), peak: '', off: '' }), formError = $state('');
  let readingInput = $state<HTMLInputElement>();
  $effect(() => { draft = { ...point.draft }; formError = ''; });
  let allRows = $derived(model.points.map(p => ({ point: p, period: periodResult(p, model.aggregate.start, model.aggregate.end), annual: annual(p, model.year) })));
  let completeVolume = $derived(allRows.every(r => r.period.volume !== null));
  let completeCost = $derived(allRows.every(r => r.period.total !== null));
  let completeAnnual = $derived(allRows.every(r => r.annual.annualCost?.total !== null && r.annual.annualCost?.total !== undefined));
  let knownCost = $derived(allRows.reduce((n,r) => n + (r.period.total ?? 0), 0));
  let aggregateBars = $derived(allRows.filter(r => r.period.volume !== null).map(r => ({ label: r.point.name, short: r.point.name.length > 20 ? `${r.point.name.slice(0, 18)}…` : r.point.name, value: r.period.volume!, own: r.point.id === model.selected })));
  const scheduleOptions = [{ value: 'flat', label: 'Egyenletes részszámla / átalány' }, { value: 'actual', label: 'Tényleges fogyasztás utólag' }, { value: 'prepaid', label: 'Előre fizetős fogyasztásbecslés' }];
  const meteringOptions = [{ value: 'manual', label: 'Hagyományos / kézi diktálás' }, { value: 'smart', label: 'Okosmérős / idősoros' }];
  const sourceOptions = [{ value: 'readings', label: 'Napló pontos határnapi méréseiből' }, { value: 'period', label: 'Időszaki tény-kWh megadása' }];
  function save() { return disk.save($state.snapshot(model)); }
  function selectPoint(id: string) { model.selected = id; save(); }
  function commit(key: string, raw: string) {
    const p = structuredClone($state.snapshot(point));
    switch (key) {
      case 'name': p.name = raw.trim(); break;
      case 'annualEstimate': p.annualEstimate = raw.trim(); break;
      case 'low': p.rates.low = number(raw); break;
      case 'second': p.rates.second = number(raw); break;
      case 'market': p.rates.market = number(raw); break;
      case 'monthlyBase': p.rates.monthlyBase = number(raw); break;
      case 'effective': p.rates.effective = raw.trim(); break;
      case 'eligibleFrom': p.eligibleFrom = raw.trim(); break;
      case 'eligibleTo': p.eligibleTo = raw.trim(); break;
      case 'extraAnnual': p.extraAnnual = number(raw); break;
      case 'extraFrom': p.extraFrom = raw.trim(); break;
      case 'extraTo': p.extraTo = raw.trim(); break;
      case 'offPercent': p.offPercent = number(raw); break;
      case 'heatingPercent': p.heatingPercent = number(raw); break;
      case 'solar': p.solar = raw as ElectricityPoint['solar']; break;
      case 'schedule': p.billing.schedule = raw as ElectricityPoint['billing']['schedule']; break;
      case 'metering': p.billing.metering = raw as ElectricityPoint['billing']['metering']; break;
      case 'source': p.billing.source = raw as ElectricityPoint['billing']['source']; break;
      case 'start': p.billing.start = raw.trim(); break;
      case 'end': p.billing.end = raw.trim(); break;
      case 'peak': p.billing.peak = raw.trim(); break;
      case 'off': p.billing.off = raw.trim(); break;
      case 'credit': p.billing.credit = number(raw); break;
      case 'balance': p.billing.balance = raw.trim(); break;
    }
    const message = validatePoint(p); if (message) return message;
    model.points[model.points.findIndex(x => x.id === p.id)] = p; save();
  }
  function tariff(area: Area, tariff: Tariff) {
    const p = structuredClone($state.snapshot(point)); p.area = area; p.tariff = supported(area, tariff) ? tariff : 'A1'; p.rates = officialRates(p.area, p.tariff);
    model.points[model.points.findIndex(x => x.id === p.id)] = p; save();
  }
  function addPoint() { if (model.points.length >= 20) { toast('Legfeljebb 20 mérési pont kezelhető.'); return; } const p = createPoint(model.points.length + 1); model.points.push(p); model.selected = p.id; save(); toast('Új önálló mérési pont hozzáadva. Állítsd be a tarifáját.'); }
  function removePoint() {
    if (model.points.length === 1) { toast('Legalább egy mérési pontnak maradnia kell.'); return; }
    const removed = structuredClone($state.snapshot(point)), index = model.points.findIndex(p => p.id === removed.id);
    model.points = model.points.filter(p => p.id !== removed.id); model.selected = model.points[0].id; save();
    toast('Mérési pont eltávolítva.', () => { if (model.points.some(p => p.id === removed.id)) return; model.points.splice(index, 0, removed); model.selected = removed.id; save(); toast('Mérési pont visszaállítva.'); });
  }
  function saveDraft() { point.draft = { peak: draft.peak, off: draft.off, date: validDate(draft.date) ? draft.date : point.draft.date }; save(); }
  function addReading(event: SubmitEvent) {
    event.preventDefault(); const row = { id: uid(), date: draft.date, peak: number(draft.peak), off: point.tariff === 'A2' ? number(draft.off) : null };
    formError = validateReading(point, row); if (formError) return;
    point.readings.push(row); model.year = yearFor(row.date); point.draft = { date: today(), peak: '', off: '' }; draft = { ...point.draft };
    toast(save() ? 'Villanyóraállás rögzítve és elmentve.' : 'Mérés rögzítve, de a helyi mentés sikertelen.');
  }
  function editReading(id: string, field: number | 'date', raw: string) {
    const current = point.readings.find(r => r.id === id)!;
    const candidate = { ...current, ...(field === 'date' ? { date: raw } : field === 0 ? { peak: number(raw) } : { off: number(raw) }) };
    const message = validateReading(point, candidate); if (message) return message;
    Object.assign(current, candidate); model.year = yearFor(candidate.date); save();
  }
  function removeReading(id: string) {
    const pId = point.id, row = { ...point.readings.find(r => r.id === id)! };
    point.readings = point.readings.filter(r => r.id !== id); save();
    toast('Mérés törölve.', () => { const p = model.points.find(p => p.id === pId); if (!p) { toast('A mérési pont már nincs a listában.'); return; } const error = validateReading(p, row, false); if (error) { toast(error); return; } p.readings.push(row); model.selected = p.id; model.year = yearFor(row.date); save(); toast('Mérés visszaállítva.'); });
  }
  function opening() { draft.date = a.activeStart; saveDraft(); readingInput?.focus(); }
  function useReadings() {
    const rows = a.items.slice(-2); if (rows.length < 2) { toast('Legalább két mérés szükséges a kiválasztott évhez.'); return; }
    point.billing.start = rows[0].date; point.billing.end = rows[1].date; save();
  }
  function aggregate(field: 'start' | 'end', value: string) {
    const next = { ...model.aggregate, [field]: value.trim() };
    if (!validDate(next.start) || !validDate(next.end) || next.start < '2022-08-01' || days(next.start, next.end) <= 0 || days(next.start, next.end) > 366) return 'Adj meg 2022-08-01 utáni, 1–366 napos közös időszakot, kizáró végdátummal.';
    model.aggregate = next; save();
  }
  function stats(candidate: ElectricityState['stats']) {
    for (const key of ['people', 'floorArea'] as const) if (candidate[key].trim() && (!Number.isFinite(number(candidate[key])) || number(candidate[key]) <= 0 || number(candidate[key]) > 1e6 || key === 'people' && !Number.isInteger(number(candidate[key])))) return 'A létszám pozitív egész, az alapterület pozitív szám lehet. Üresen is hagyhatod.';
    if (candidate.region !== 'country' && !Object.hasOwn(ELECTRICITY_REGIONS, candidate.region)) return 'Válassz érvényes területet.';
    if (!Number.isFinite(candidate.deviceWatts) || candidate.deviceWatts <= 0 || candidate.deviceWatts > 1e7 || !Number.isFinite(candidate.dailyHours) || candidate.dailyHours <= 0 || candidate.dailyHours > 24 || !Number.isFinite(candidate.saving) || candidate.saving < 0 || candidate.saving > 100) return 'Érvényes teljesítmény, 0-nál több és legfeljebb 24 óra, illetve 0–100% megtakarítás adható meg.';
    model.stats = candidate; save();
  }
  function crossTab(event: StorageEvent) { if (event.key === key) { disk.lock(); warning = 'Az áramadatok másik lapon megváltoztak. Töltsd újra az oldalt; addig a mentés szünetel a felülírás elkerülésére.'; ui.status = 'Újratöltés szükséges'; ui.storageError = true; } }
  const comparison = [
    { key: 'flat', title: 'Egyenletes részszámla', subtitle: 'Kiszámíthatóbb havi ütemezés', basis: 'A becsült éves kWh havi része, egyszerűsítve 1/12-e. Az okosmérő mellett is elérhető lehet.', action: 'Jellemzően 11 részszámla és 1 éves elszámoló. A tényleges mérés rendezi a különbözetet.', benefit: 'Naparányos kedvezmény a számlázott napokra.', note: 'Az alacsonyabbra állított becslés nem csökkenti a tényleges energia költségét.' },
    { key: 'manual', title: 'Havi diktálás', subtitle: 'A bejelentett állásokat követi', basis: 'Két mérőállás különbsége, kWh-ban. Nincs gázos fűtőérték vagy fűtési jelleggörbe.', action: 'A kijelölt diktálási időszakban állást kell közölni; kimaradáskor becslés készülhet.', benefit: 'Naparányos keret, esetleges göngyölítéssel és sávkorrekcióval.', note: 'Közvetlenebb visszajelzés, rendszeres havi teendővel.' },
    { key: 'smart', title: 'Okosmérős / idősoros', subtitle: 'Távleolvasott mérési adatok', basis: 'A mérő jellemzően 15 perces adatai. Tényalapú havi elszámolás vagy elérhető részszámlás ütemezés.', action: 'Kézi diktálás jellemzően nincs. Itt a szolgáltatói időszaki összes kWh-t adhatod meg; élő kapcsolat nincs.', benefit: 'Az idősoros mérés nem azonos a D tarifával; A1 áron is működhet.', note: 'D-nél a sáv feletti árhoz külön negyedórás fogyasztási és áradatok szükségesek.' },
    { key: 'prepaid', title: 'Előre fizetős mérő', subtitle: 'Előbb feltöltés, utána fogyasztás', basis: 'A tarifa és az elhasznált kWh. A feltöltött pénz és a fogyasztási mennyiség két külön adat.', action: 'A megadott aktuális egyenlegből, ismert napi költség mellett becsülhető, meddig elegendő.', benefit: 'A tarifa és a jogosultság szerinti keret; nem jár új kedvezmény a feltöltéssel.', note: 'A kalkulátor nem kapcsolódik a mérőhöz, nem tölt fel és nem von le pénzt.' },
  ];
</script>
<svelte:window onstorage={crossTab} onpagehide={() => { (document.activeElement as HTMLElement | null)?.blur(); }}/>
{#if warning}<p class="notice danger" role="alert">{warning}</p>{/if}
<section class="page-heading"><div><div class="eyebrow"><span class="tiny-line"></span>ENERGIA, ÁTLÁTHATÓAN</div><h1>Kapcsolj több rálátásra<span>.</span></h1><p>Az áramfogyasztásod, a tarifáid és a kereted, egy helyen.</p></div><Select id="electricity-year" label="Kedvezményes év" value={model.year} options={years.map(y => ({ value: String(y), label: `${y}. aug. – ${y + 1}. júl.` }))} oncommit={value => { model.year = Number(value); save(); }}/></section>
<section class="card point-picker" id="electricity-point"><Select id="electricity-point-select" label="Aktív mérési pont" value={model.selected} options={model.points.map(p => ({ value: p.id, label: `${p.name} · ${TARIFFS[p.tariff]}` }))} oncommit={selectPoint}/><button id="electricity-add-point" type="button" class="primary-button" onclick={addPoint}><span>Új mérési pont</span><span aria-hidden="true">＋</span></button><p>Önálló A1, A2, vezérelt és H mérők egymás után felvehetők, külön naplóval és kerettel. <a href="#electricity-aggregate">Minden mérő együtt ↓</a> · <a href="#electricity-tariffs">Mit jelentenek a tarifák? ↓</a></p></section>
{#key point.id}
<div class="overview-grid"><section class="card balance-card"><div class="card-heading"><h2>{point.name} kerete</h2><span class="badge">{point.tariff === 'B_GEO' ? 'KORLÁTMENTES TARIFA' : a.complete ? 'KEZDŐÁLLÁSTÓL KÖVETVE' : 'HIÁNYOS MÉRÉSI IDŐSZAK'}</span></div><div class="balance-main"><div class="balance-copy"><p class="muted">{point.tariff === 'H' ? 'Hátralévő normál keret · H-idényen felül' : a.complete ? 'Hátralévő kedvezményes mennyiség' : 'Becsült maradék · legfeljebb'}</p><div class="big-number"><span>{point.tariff === 'B_GEO' ? '∞' : fmt(a.remaining)}</span>{#if point.tariff !== 'B_GEO'}<span class="big-unit">kWh</span>{/if}</div><p class="energy">{point.tariff === 'H' ? 'A fűtési idény fogyasztása nem csökkenti a normál keretet.' : point.tariff === 'B_GEO' ? 'Meglévő szerződésnél nincs 2523-as fogyasztási határ.' : `${fmt(a.quota.cap)} kWh keret a jogosult éves napokra.`}</p><div class="legend"><span class="status-dot"></span><span>{TARIFFS[point.tariff]} · {AREAS[point.area].label}</span></div></div><Gauge percent={point.tariff === 'B_GEO' ? 100 : a.remaining === null || a.quota.cap === 0 ? null : a.remaining / a.quota.cap * 100}/></div><div class="balance-stats"><div><span>Mért összfogyasztás</span><strong>{fmt(a.tracked?.volume ?? (a.complete ? 0 : null))} <small>kWh</small></strong></div><div><span>Normál éves keret</span><strong>{point.tariff === 'B_GEO' ? '∞' : fmt(a.quota.cap)} <small>kWh</small></strong></div><div><span>Éves adat / becslés</span><strong>{fmt(a.volume)} <small>kWh</small></strong></div></div><p class="balance-note">{a.active === 0 ? 'Ebben a kedvezményes évben nincs megadott jogosult nap.' : !a.first ? `A pontos követéshez ${a.activeStart}-i kezdőállás szükséges.` : `Követés: ${a.first.date} → ${a.last!.date}. ${a.complete ? 'A maradék az utolsó mérésre vonatkozik.' : 'A kezdőállás előtti fogyasztást nem ismerjük; a maradék felső becslés.'}`}</p></section>
<section class="card reading-card" id="electricity-new-reading"><div class="card-heading"><h2>Új villanyóraállás</h2><span class="icon-circle" aria-hidden="true">＋</span></div><form onsubmit={addReading}><div class="field-label"><label for="electricity-reading-peak">{point.tariff === 'A2' ? 'Csúcsidős regiszter állása' : 'Mérőállás'}</label><Help forId="electricity-reading-peak" label={point.tariff === 'A2' ? 'Csúcsidős regiszter állása' : 'Mérőállás'} content={point.tariff === 'A2' ? A2_PEAK_HELP : undefined}/></div><div class="input-unit meter-input"><input id="electricity-reading-peak" aria-describedby="electricity-reading-peak-help electricity-reading-error" type="text" inputmode="decimal" bind:this={readingInput} bind:value={draft.peak} placeholder="pl. 12 450,5" onblur={saveDraft} oninput={() => formError = ''}/><span>kWh</span></div>{#if point.tariff === 'A2'}<div class="field-label"><label for="electricity-reading-off">Völgyidős regiszter állása</label><Help forId="electricity-reading-off" label="Völgyidős regiszter állása"/></div><div class="input-unit"><input id="electricity-reading-off" aria-describedby="electricity-reading-off-help" type="text" inputmode="decimal" bind:value={draft.off} onblur={saveDraft} oninput={() => formError = ''}/><span>kWh</span></div>{/if}<p class="field-hint">A teljes vételezési állás, nem az időszaki fogyasztás. A2-nél mindkét regiszter kell.</p><div class="field-label"><label for="electricity-reading-date">Rögzítés dátuma · ÉÉÉÉ-HH-NN</label><Help forId="electricity-reading-date" label="Rögzítés dátuma · ÉÉÉÉ-HH-NN"/></div><input id="electricity-reading-date" aria-describedby="electricity-reading-date-help" type="text" maxlength="10" bind:value={draft.date} onblur={saveDraft} oninput={() => formError = ''}/>{#if formError}<p class="field-error" id="electricity-reading-error" role="alert">{formError}</p>{/if}<button class="primary-button" type="submit"><span>Mérőállás rögzítése</span><span aria-hidden="true">↗</span></button><p class="form-footnote">Csak ebben a böngészőben, ehhez a mérési ponthoz.</p></form></section></div>
<PointSettings {point} canRemove={model.points.length > 1} oncommit={commit} ontariff={tariff} onremove={removePoint}/>
<section class="card billing-card"><div class="card-heading"><h2>Időszaki áramkalkuláció</h2><span class="badge neutral">{point.name}</span></div><p class="section-intro">A kezdőnap beleszámít, a záró nap már nem. Teljes november: november 1. → december 1. A keret a 365/366 napos kedvezményes évhez igazodik.</p><div class="e-form-grid"><Select id="electricity-schedule" label="Számlázási ütemezés" value={point.billing.schedule} options={scheduleOptions} oncommit={v => { commit('schedule',v); }}/><Select id="electricity-metering" label="Mérés módja" value={point.billing.metering} options={meteringOptions} oncommit={v => { commit('metering',v); }}/><Field id="electricity-start" label="Időszak kezdete" value={point.billing.start} oncommit={v => commit('start',v)}/><Field id="electricity-end" label="Záró dátum · már nem része" value={point.billing.end} oncommit={v => commit('end',v)}/>
{#if point.billing.schedule !== 'flat'}<Select id="electricity-source" label="Tényfogyasztás forrása" value={point.billing.source} options={sourceOptions} oncommit={v => { commit('source',v); }}/>{#if point.billing.source === 'period'}<Field id="electricity-period-peak" label={point.tariff === 'A2' ? 'Időszaki csúcsfogyasztás · kWh' : 'Időszaki tényfogyasztás · kWh'} value={point.billing.peak} decimal oncommit={v => commit('peak',v)}/>{#if point.tariff === 'A2'}<Field id="electricity-period-off" label="Időszaki völgyfogyasztás · kWh" value={point.billing.off} decimal oncommit={v => commit('off',v)}/>{/if}{/if}{/if}<Field id="electricity-credit" label="Visszaigazolt időszaki jóváírás · Ft" value={point.billing.credit} decimal oncommit={v => commit('credit',v)}/>{#if point.billing.schedule === 'prepaid'}<Field id="electricity-balance" label="Aktuális feltöltött egyenleg · Ft" value={point.billing.balance} placeholder="Nem kötelező" decimal oncommit={v => commit('balance',v)}/>{/if}</div><button class="text-button" type="button" onclick={useReadings}>Utolsó két mérés időszakának használata ↗</button><div class="billing-results"><div><span>Időszaki fogyasztás</span><strong>{fmt(bill.volume)} <small>kWh</small></strong><p>{point.billing.schedule === 'flat' ? 'Az éves becslés havi része' : point.billing.source === 'period' ? 'Megadott időszaki tényadat' : 'Pontos határnapi mérésekből'}</p></div><div><span>Kedvezményes / korlátmentes</span><strong class="accent">{bill.cheap === null ? '—' : fmt(bill.cheap + (bill.unlimited ?? 0))} <small>kWh</small></strong><p>{fmt(bill.cap)} kWh normál keret, {bill.unlimitedDays} korlátmentes nap</p></div><div><span>Keret feletti mennyiség</span><strong>{fmt(bill.over)} <small>kWh</small></strong><p>Csak a sáv feletti rész drágább</p></div><div><span>Becsült időszaki összeg</span><strong>{fmt(bill.total,0)} <small>Ft</small></strong><p>Alapdíjjal, megadott jóváírással</p></div></div><div class="e-cost-details"><span>Kedvezményes / H / GEO díj: <strong>{money(bill.lowCost)}</strong></span><span>Piaci díj: <strong>{money(bill.highCost)}</strong></span><span>Alapdíj: <strong>{money(bill.base)}</strong></span><span>Jóváírás: <strong>−{money(bill.credit)}</strong></span></div><p class="balance-note">{bill.outside ? 'A fogyasztás egy része a megadott lakossági jogosultságon kívülre esik; ehhez nem adunk teljes költséget.' : bill.dynamicMissing ? 'D tarifa: 2027 előtti időszak vagy dinamikus áradatok nélküli kerettúllépés miatt nincs teljes forintösszeg.' : point.solar === 'balance' ? 'Szaldós napelemhez ez a költségmodell nem alkalmazható.' : bill.volume === null ? 'Átalányhoz éves becslés, tényalapú számításhoz pontos határnapi mérés vagy megadott időszaki kWh kell.' : point.solar === 'gross' ? 'Csak a hálózatból vételezett energia költsége; a betáplálási bevételt nem nettósítjuk.' : point.billing.schedule === 'prepaid' ? 'Ez a fogyasztás költségbecslése, nem a feltöltés összege vagy egy élő egyenleg.' : 'Sávkorrekció nélküli becslés; a korábbi megtakarítás és az éves elszámolás módosíthatja.'}</p><p class="field-hint e-long-hint">Két mérés közti H-idény- vagy évhatárnál a fogyasztást naparányosan osztjuk; pontos köztes állásokkal finomítható. A2-nél fogyasztásarányos zónabecslés készül. A 2026. januári támogatást nem vonjuk le automatikusan; csak igazolt, ide tartozó jóváírást adj meg.</p></section>
{/key}
<section class="card aggregate-card" id="electricity-aggregate"><div class="card-heading"><h2>Minden mérőd, egy helyen</h2><span class="badge">{model.points.length} MÉRÉSI PONT</span></div><p class="section-intro">Közös időszak, önálló pontonként külön számítás. A kedvezményes keretek nem vonhatók össze. A teljes összeg csak minden pont ismert adataival jelenik meg.</p><div class="e-aggregate-dates"><Field id="electricity-all-start" label="Közös időszak kezdete" value={model.aggregate.start} oncommit={v => aggregate('start',v)}/><Field id="electricity-all-end" label="Közös záró dátum · kizáró" value={model.aggregate.end} oncommit={v => aggregate('end',v)}/><button class="text-button" type="button" onclick={() => { model.aggregate = { start: point.billing.start,end: point.billing.end }; save(); }}>Aktív mérő időszakának átvétele ↗</button></div><div class="e-aggregate-metrics"><div><span>Összes időszaki fogyasztás</span><strong>{completeVolume ? fmt(allRows.reduce((n,r) => n + r.period.volume!,0)) : '—'} <small>kWh</small></strong></div><div><span>Összes időszaki költség</span><strong>{completeCost ? money(knownCost) : '—'}</strong></div><div><span>Összes éves költségbecslés</span><strong>{completeAnnual ? money(allRows.reduce((n,r) => n + r.annual.annualCost!.total!,0)) : '—'}</strong></div></div><p class="field-hint">{allRows.filter(r => r.period.total !== null).length}/{allRows.length} pont költsége számolható; ismert időszaki részösszeg: {money(knownCost)}. Éves összesítő: {model.year}/{model.year + 1}.</p>{#if aggregateBars.length}<Chart id="electricity-aggregate-chart" kind="benchmark" unit="kWh" bars={aggregateBars} label={aggregateBars.map(b => `${b.label}: ${fmt(b.value)} kWh`).join('. ')}/>{/if}<div class="point-summaries">{#each allRows as row (row.point.id)}<article class="point-summary" class:is-selected={row.point.id === model.selected}><div><h3>{row.point.name}</h3><p>{TARIFFS[row.point.tariff]} · {AREAS[row.point.area].label}</p></div><dl><div><dt>Közös időszak</dt><dd>{fmt(row.period.volume)} kWh · {money(row.period.total)}</dd></div><div><dt>Kedvezményes / korlátmentes</dt><dd>{row.period.cheap === null ? '—' : fmt(row.period.cheap + (row.period.unlimited ?? 0))} kWh</dd></div><div><dt>Keret felett</dt><dd>{fmt(row.period.over)} kWh</dd></div><div><dt>Éves adat / költségbecslés</dt><dd>{fmt(row.annual.volume)} kWh · {money(row.annual.annualCost?.total)}</dd></div></dl><a href="#electricity-point" onclick={() => selectPoint(row.point.id)}>{row.point.id === model.selected ? 'Aktív mérő ↑' : 'Részletek megnyitása ↑'}</a></article>{/each}</div><p class="field-hint e-long-hint">Ha az időszaki tényadatot más dátumokra adtad meg, a közös időszakra új adat kell. A visszaigazolt jóváírás csak a saját pontos időszakában szerepel. Új pontot kizárólag valóban önálló mérési pontra vegyél fel: ugyanaz a mérő más néven nem kap új keretet.</p></section>
<ElectricStats {model} {point} onstats={stats}/>
<ReadingLog id="electricity-history" unit="kWh" rows={a.items.map(r => ({ id: r.id,date:r.date,values:point.tariff === 'A2' ? [r.peak,r.off] : [r.peak],total: total(point,r) }))} columns={point.tariff === 'A2' ? ['Csúcsregiszter','Völgyregiszter'] : ['Mérőállás']} onedit={editReading} onremove={removeReading} onopening={opening}/>
<TariffGuide active={point.tariff}/>
<section class="comparison-section" id="electricity-comparison"><div class="eyebrow"><span class="tiny-line"></span>ÉRTHETŐEN A SZÁMLÁZÁSRÓL</div><h2>Mi a különbség az áram számlázási módjai között?</h2><p class="comparison-intro">A tarifa az árat, a mérés az adatforrást, a számlázás a havi elszámolást határozza meg. Az okosmérő mellett is lehet egyenletes részszámla.</p><div class="comparison-grid e-comparison-grid">{#each comparison as mode,index}<article class="card comparison-card" class:is-selected={mode.key === point.billing.schedule || point.billing.schedule === 'actual' && mode.key === point.billing.metering}><div class="comparison-top"><span>0{index + 1}</span></div><h3>{mode.title}</h3><p class="mode-subtitle">{mode.subtitle}</p><dl><dt>A számítás alapja</dt><dd>{mode.basis}</dd><dt>Teendő és elszámolás</dt><dd>{mode.action}</dd><dt>Keret / árszabás</dt><dd>{mode.benefit}</dd></dl><p class="mode-tradeoff">{mode.note}</p></article>{/each}</div><div class="comparison-footnote"><span class="info-icon" aria-hidden="true">i</span><p>A bankkártya, átutalás, beszedés és csekk befizetési mód, nem külön tarifa. Az itt választott beállítás az MVM-szerződésedet nem módosítja.</p></div></section>
<details class="info-panel"><summary><span>ⓘ Tarifák, feltételezések és források</span><span aria-hidden="true">＋</span></summary><div class="info-content"><div><h3>Normál keret és külön pontok</h3><p>2523 kWh teljes kedvezményes évre, augusztus 1. → következő augusztus 1., önálló mérési pontonként. A 365/366 napot pontos törttel számoljuk. A1 és B kerete nem csoportosítható át; A2 két regisztere egy keretet használ. Jogosultság és igazolt többletkeret csak a megadott napokra jár.</p><a href="https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-aram" target="_blank" rel="noopener noreferrer">MVM keret és jogosultság ↗</a></div><div><h3>H és B GEO</h3><p>A H-idényt október 15. → április 16. kizáró végdátummal modellezzük: a fűtési időszak kWh-ja korlátmentes. Nyáron naparányos normál keret és A1-jellegű ár. B GEO csak meglévő szerződésnél, támogatott területen, korlátmentesen.</p></div><div><h3>D és napelemes kivételek</h3><p>D-nél 2027 előtt, illetve sáv felett negyedórás adatsor nélkül nincs teljes összeg. A2 fogyasztásarányos zónabecslése nem igazolt számlabeli algoritmus. Bruttó napelemnél csak a vételezés költsége látható, betáplálást nem nettósítunk. Szaldóra ez a költségmodell nem használható.</p><a href="https://www.mvmnext.hu/aram/pages/aloldal.jsp?id=16455107" target="_blank" rel="noopener noreferrer">MVM D tarifa ↗</a></div><div><h3>Helyi adatok, dátumozott becslés</h3><p>Az áram és a gáz adatai külön helyi tárhelyen maradnak. A 2027-es értékek a díjak és szabályok változatlanságát feltételezik. Számlapontos sávkorrekció, történeti tarifaváltás, HMKE-szaldó és dinamikus árimport nincs modellezve.</p><a href="https://www.mvmnext.hu/aram/pages/aloldal.jsp?id=14098370" target="_blank" rel="noopener noreferrer">MVM számlázás ↗</a></div></div></details>
