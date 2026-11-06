import type { AppState, StatisticsSettings } from './types';
import { scheduleChart } from './chart-loader';
import { S } from './statistics';
import { M } from './calculator';
import { R } from './reference-data';
import { element as $, control } from './dom';
const fmt = (n: number | null | undefined, digits = 1) => n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const money = (n: number) => `${fmt(n, 0)} Ft`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}%`;
const text = (id: string, value: string) => { $(id).textContent = value; };
const range = (r: { start: string; end: string; days: number }) => `${r.start} → ${r.end} · ${r.days} nap`;
const annualLabels = { measured: 'TELJES MÉRT ÉV', forecast: 'PROFILALAPÚ BECSLÉS', manual: 'KÉZI ÉVES BECSLÉS', missing: 'KEVÉS ADAT' };
const annualPhrases = { measured: 'teljes mért éves fogyasztás', forecast: 'szezonális profilból becsült éves fogyasztás', manual: 'kézzel megadott éves becslés', missing: 'hiányzó éves adat' };
const fields = { 'stat-low': 'low', 'stat-high': 'high', 'stat-base': 'annualBase', 'stat-effective': 'effective', 'stat-area': 'area', 'stat-region': 'region', 'stat-power': 'heaterPower', 'stat-efficiency': 'efficiency', 'stat-saving': 'savingPercent' } as const;
let getState: () => AppState, save: () => boolean;

function render(state: AppState, previewStats?: StatisticsSettings) {
  const current = previewStats ? { ...state, stats: previewStats } : state;
  const stats = current.stats, result = S.calculate(current);
  const { billing, settings } = current;
  const factor = settings.heat * settings.correction;
  text('stats-basis', annualLabels[result.annualKind]);
  const custom = stats.low !== R.tariff.low || stats.high !== R.tariff.high || stats.annualBase !== R.tariff.annualBase || stats.effective !== R.tariff.effective;
  const source = $('tariff-source'); source.replaceChildren();
  source.append(document.createTextNode(`${custom ? 'Egyéni díjak.' : 'MVM-alapértékek; a kedvezményes bruttó díj a nettó 2,256 × 1,27 értékből készül.'} Érvényesség: ${stats.effective}. Forrásellenőrzés: ${R.checked}. `));
  const link = document.createElement('a'); link.href = R.tariff.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'MVM díjtáblázat ↗'; source.append(link);
  text('cost-period', `${billing.start} → ${billing.end} · ${result.bill.days} nap`);
  text('cost-total', result.billingCost ? fmt(result.billingCost.total, 0) : '—');
  text('cost-low', result.billingCost ? money(result.billingCost.low) : '—');
  text('cost-high', result.billingCost ? money(result.billingCost.high) : '—');
  text('cost-base', money(S.baseBetween(billing.start, billing.end, stats.annualBase)));
  text('cost-description', result.billingCost ? billing.mode === 'reading' ? 'Mért időszaki fogyasztásból becsült költség, sávkorrekció nélkül.' : 'Becsült részszámla a megadott éves fogyasztásból, sávkorrekció nélkül.' : billing.mode === 'reading' ? 'A forintos becsléshez rögzíts mérőállást mindkét időszakhatárra.' : 'A forintos becsléshez add meg a becsült éves fogyasztást az időszaki kalkulátornál.');
  text('cost-measured', result.latestCost ? `Külön a legutóbbi mért időszak: ${range(result.latest!)}, ${fmt(result.latest!.volume)} m³ → ${money(result.latestCost.total)} becsült költség alapdíjjal. Ez eltérhet a részszámlától.` : 'A tényleges fogyasztás költségbecsléséhez legalább két mérés kell. A megadott díjakból számolunk, nem korábban kifizetett számlákat összesítünk.');
  text('unit-low', `${fmt(factor * stats.low, 2)} Ft/m³`);
  text('unit-high', `${fmt(factor * stats.high, 2)} Ft/m³`);
  text('unit-price-note', `1 m³ = ${fmt(factor, 3)} MJ a megadott fűtőértékkel és korrekcióval.`);

  text('stat-average', result.latest ? fmt(result.latest!.average, 2) : '—');
  text('stat-average-note', result.latest ? `Az utolsó két mérés között ${fmt(result.latest!.volume)} m³ fogyott.` : 'Rögzíts legalább két mérőállást a kiválasztott kedvezményes évhez.');
  text('stat-change', result.previous ? result.change === null ? 'Az előző időszakban 0 volt a fogyasztás; százalékos változás nem számolható.' : `${signed(result.change)} az előző mérési időszak napi átlagához képest.` : 'A változás összevetéséhez legalább három mérés kell.');
  text('stat-average-period', result.latest ? range(result.latest!) : 'Az eltérő hosszúságú időszakokat napi átlagra hozzuk.');
  text('stat-headroom', fmt(result.headroom, 2));
  text('stat-headroom-note', !result.annual.complete ? `A maradék napi mozgástérhez ${result.annual.start}-i évkezdő állás kell.` : result.remainingDays === 0 ? 'Ez a kedvezményes év már teljesen le van mérve; nincs hátralévő nap.' : `Az utolsó méréskor (${result.annual.last!.date}) ${fmt(result.annual.remaining)} m³ és ${result.remainingDays} nap volt hátra az évből.`);

  text('forecast-badge', annualLabels[result.annualKind]);
  text('stat-forecast', fmt(result.annualVolume));
  text('stat-forecast-note', result.annualKind === 'measured' ? 'A kedvezményes év nyitó és záró méréséből számolt tényleges éves mennyiség.' : result.annualKind === 'forecast' ? 'A mért fogyasztást a megfigyelt napokra jutó fogyasztási profilsúllyal arányosítjuk. A profil a hőmérsékletfüggő módnál szerkeszthető; nem időjárás-előrejelzés.' : result.annualKind === 'manual' ? 'Még kevés a mérés a profilalapú előrejelzéshez, ezért a kézzel megadott éves becslést mutatjuk.' : 'Legalább 30 nap és az éves fogyasztási profilsúly 5%-ának megfigyelése kell. Addig megadhatsz kézi éves becslést az időszaki kalkulátornál.');
  $('forecast-progress').style.width = `${result.annualVolume === null ? 0 : Math.min(100, result.annualVolume / result.annual.annual * 100)}%`;
  $('forecast-progress').classList.toggle('over-budget', (result.annualVolume ?? 0) > result.annual.annual);
  text('stat-forecast-budget', result.annualVolume === null ? `Éves kedvezményes keret: ${fmt(result.annual.annual)} m³.` : `${fmt(result.annualVolume / result.annual.annual * 100)}% az éves keretből; ${result.annualVolume > result.annual.annual ? `${fmt(result.annualVolume - result.annual.annual)} m³-rel felette` : `${fmt(result.annual.annual - result.annualVolume)} m³-rel alatta`}.`);
  text('stat-forecast-coverage', result.tracked ? `Alap: ${result.annual.items.length} mérés, ${result.tracked.days} nap (${result.tracked.start} → ${result.tracked.end}), ${fmt(result.share * 100)}% éves profilsúly. A profilalapú szám becslés, nem garantált év végi eredmény.` : 'A kézi becslést, a profilalapú becslést és a teljes éves mérést külön jelöljük.');

  text('stat-year-change', fmt(result.yearChange));
  text('stat-year-note', !result.tracked ? 'Legalább két idei mérés és az előző év azonos határnapjaira rögzített állások szükségesek.' : !result.prior ? `Tavalyi mérés szükséges: ${result.priorStart} és ${result.priorEnd}.` : result.yearChange === null ? 'A tavalyi időszakban 0 volt a fogyasztás; százalékos eltérés nem számolható.' : `Idei napi átlag: ${fmt(result.tracked.average, 2)} m³; tavaly: ${fmt(result.prior.average, 2)} m³.`);
  text('stat-year-period', result.prior ? `Idei időszak: ${range(result.tracked!)}. Tavaly: ${range(result.prior)}. Február 29. párja február 28.; a napok eltérését a napi átlag kezeli.` : 'Hiányzó határnapi mérést nem interpolálunk.');

  text('benchmark-note', result.annualVolume === null ? 'A referenciaértékek már láthatók. A saját összevetéshez teljes éves mérés, megfelelő profilalapú becslés vagy kézi éves becslés kell.' : `Saját ${state.year}/${state.year + 1}-es ${annualPhrases[result.annualKind]}: ${fmt(result.annualVolume)} m³. Referencia: 2025-ös naptári év.`);
  const bars = [{ label: 'Országos átlag · 2025', value: result.national, own: false }];
  if (result.regional !== null) bars.push({ label: `${stats.region} · 2025`, value: result.regional, own: false });
  if (result.annualVolume !== null) bars.unshift({ label: result.annualKind === 'measured' ? 'Saját teljes mért év' : 'Saját éves becslés', value: result.annualVolume, own: true });
  const max = Math.max(...bars.map(bar => bar.value), 1);
  $('benchmark-bars').replaceChildren(...bars.map(bar => {
    const row = document.createElement('div'); row.className = 'benchmark-row';
    const label = document.createElement('span'); label.textContent = bar.label;
    const value = document.createElement('strong'); value.textContent = `${fmt(bar.value)} m³/év`;
    const track = document.createElement('div'); track.className = 'benchmark-track'; track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span'); fill.style.width = `${bar.value / max * 100}%`; if (bar.own) fill.className = 'own'; track.append(fill);
    row.append(label, value, track); return row;
  }));
  const benchmarkCanvas = $<HTMLCanvasElement>('benchmark-canvas');
  benchmarkCanvas.setAttribute('aria-label', bars.map(bar => `${bar.label}: ${fmt(bar.value)} köbméter évente`).join('. '));
  scheduleChart(benchmarkCanvas, charts => charts.drawBenchmark(benchmarkCanvas, bars));
  text('benchmark-change', result.nationalChange === null ? '' : `${signed(result.nationalChange)} az országos átlaghoz képest.`);
  text('benchmark-region-note', result.regional === null ? 'A beállításoknál Budapestet vagy vármegyét is választhatsz.' : result.regionalChange === null ? `${stats.region}: ${fmt(result.regional)} m³/év referencia.` : `${stats.region} átlagához képest: ${signed(result.regionalChange)}.`);
  text('stat-area-energy', result.perArea ? fmt(result.perArea.kwh) : '—');
  text('stat-area-note', stats.area === null ? 'Add meg a fűtött alapterületet a statisztika beállításai között.' : result.perArea ? `${fmt(result.perArea.volume, 2)} m³/m²/év · ${fmt(stats.area)} m² · alap: ${annualPhrases[result.annualKind]}.` : 'Az alapterület megvan; éves mért vagy becsült fogyasztási adat még szükséges.');

  text('saving-percent', `${fmt(stats.savingPercent, 0)}%`);
  $('stat-saving').setAttribute('aria-valuetext', `${fmt(stats.savingPercent, 0)} százalék fogyasztáscsökkentés`);
  text('stat-savings', fmt(result.savings, 0));
  text('stat-saving-note', result.annualVolume === null ? 'A szimulációhoz teljes éves mérés vagy éves becslés kell.' : `${fmt(stats.savingPercent, 0)}%-kal kevesebb fogyasztás: ${fmt(result.annualVolume)} → ${fmt(result.reducedVolume)} m³/év. Alap: ${annualPhrases[result.annualKind]}.`);
  text('stat-saving-costs', result.annualCost ? `Becsült éves költség: ${money(result.annualCost.total)} → ${money(result.reducedCost!.total)}, mindkettő alapdíjjal.` : 'A díjak a fenti beállításokból származnak.');
  const anomalyLabels = { missing: 'MÉG NINCS ÖSSZEVETÉS', stable: 'NINCS 50%-OS ELTÉRÉS', increase: 'NAGYOBB NAPI ÁTLAG', decrease: 'KISEBB NAPI ÁTLAG', new: 'NULLÁRÓL INDULÓ FOGYASZTÁS' };
  text('anomaly-badge', anomalyLabels[result.anomaly]);
  $('anomaly-badge').classList.toggle('anomaly-warning', result.anomaly === 'increase' || result.anomaly === 'new');
  text('stat-anomaly-note', result.anomaly === 'missing' ? 'Legalább három mérés kell két egymást követő mérési időszak összevetéséhez.' : `${result.previous!.days} napos korábbi időszak: ${fmt(result.previous!.average, 2)} m³/nap. ${result.latest!.days} napos legutóbbi időszak: ${fmt(result.latest!.average, 2)} m³/nap.${result.change === null ? ' Százalékos változás a nullás előzményből nem számolható.' : ` Változás: ${signed(result.change)}.`}`);
  const eq = result.equivalence;
  text('equivalence-basis', eq.kind === 'measured' ? `Legutóbbi mért időszak: ${fmt(eq.volume)} m³ · ${range(result.latest!)}.` : eq.kind === 'billing' ? `A vizsgált számlázási időszak ${fmt(eq.volume)} m³ mennyiségének megfelelő energia.` : 'Egységnyi gáz: 1 m³. Mérés hiányában ez átváltási példa.');
  text('equivalence-kwh', fmt(eq.kwh)); text('equivalence-hours', fmt(eq.hours)); text('equivalence-heat', fmt(eq.usefulHeat));
  text('equivalence-heater', `óra egy ${fmt(stats.heaterPower)} kW-os fűtőtesttel`);
  text('equivalence-efficiency', `kWh hasznos hő, ${fmt(stats.efficiency, 0)}% feltételezett hatásfokkal`);
}
function init(readState: () => AppState, persist: () => boolean) {
  getState = readState; save = persist;
  const stats = getState().stats;
  Object.keys(R.ksh.regions).sort((a, b) => a.localeCompare(b, 'hu')).forEach(region => {
    const option = document.createElement('option'); option.value = region; option.textContent = region; $('stat-region').append(option);
  });
  Object.entries(fields).forEach(([id, key]) => { control(id).value = stats[key] === null ? '' : key === 'effective' || key === 'region' ? String(stats[key]) : String(stats[key]).replace('.', ','); });
  function commit(event: Event) {
    const candidate: StatisticsSettings = {
      low: M.parseNumber(control('stat-low').value), high: M.parseNumber(control('stat-high').value),
      annualBase: M.parseNumber(control('stat-base').value), effective: control('stat-effective').value.trim(),
      area: control('stat-area').value.trim() === '' ? null : M.parseNumber(control('stat-area').value),
      region: control('stat-region').value, heaterPower: M.parseNumber(control('stat-power').value),
      efficiency: M.parseNumber(control('stat-efficiency').value), savingPercent: M.parseNumber(control('stat-saving').value),
    };
    const message = S.validate(candidate);
    text('stats-error', message); $('stats-error').hidden = !message;
    (event.target as HTMLElement).setAttribute('aria-invalid', String(!!message));
    if (message) return;
    Object.keys(fields).forEach(id => $(id).setAttribute('aria-invalid', 'false'));
    getState().stats = candidate; save(); render(getState());
  }
  Object.keys(fields).forEach(id => $(id).addEventListener('blur', commit));
  $('stat-region').addEventListener('change', commit);
  $('stat-saving').addEventListener('change', commit);
  $('stat-saving').addEventListener('input', () => {
    const candidate = { ...getState().stats, savingPercent: Number(control('stat-saving').value) };
    if (!S.validate(candidate)) render(getState(), candidate);
  });
}
export const StatsUi = Object.freeze({ init, render });
