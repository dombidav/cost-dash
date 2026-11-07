<script lang="ts">
  let { electricity }: { electricity: boolean } = $props();

  const electricityQuestions = [
    { question: 'Hol találom a tarifámat?', answer: 'A villanyszámla részletezőjén keresd az árszabást, például az A1 vagy H jelölést. A tarifát a szerződésedben is megtalálod.' },
    { question: 'Melyik mérőállást adjam meg A2 tarifánál?', answer: 'Add meg a csúcsidős és a völgyidős állást is, ugyanarról a napról. A számlád vagy a mérő útmutatója segít azonosítani a két kijelzett értéket.' },
    { question: 'Hogyan követhetem több mérő fogyasztását?', answer: 'Az „Új mérési pont” gombbal add hozzá a következő mérőt. Mindegyikhez külön tarifát és mérőállásokat adhatsz meg, a közös összesítőben pedig együtt is láthatod a fogyasztásukat.' },
  ];

  const gasQuestions = [
    { question: 'Mit írjak be gázóraállásnak?', answer: 'A mérőn látható teljes állást add meg köbméterben. Az időszaki fogyasztást az oldal két rögzített állás különbségéből számolja.' },
    { question: 'Hol találom a fűtőértéket és a korrekciós tényezőt?', answer: 'A gázszámla részletezőjén keresd a „Fűtőérték” és a „Korrekciós tényező” sorokat. Ezekkel számolja át a kalkulátor a köbmétert energiára.' },
    { question: 'Milyen időszakot mutat az éves összesítő?', answer: 'A kiválasztott kedvezményes évet mutatja augusztus 1-jétől a következő július végéig. A teljes időszak követéséhez rögzíts egy állást a kezdőnapra is.' },
  ];

  const siteQuestions = [
    { question: 'Hol maradnak a megadott adataim?', answer: 'A mérőállásaid és beállításaid abban a böngészőben maradnak, amelyikben megadtad őket. Egy e-mailben kapott link másik böngészőben is megnyílhat, ahol a mentett adatok nem látszanak.' },
    { question: 'Milyen adatokat gyűjt az oldal?', answer: 'A kalkulátor nem küldi el nekünk a megadott adataidat, és statisztikai vagy követő sütiket sem használ.' },
    { question: 'Használtatok mesterséges intelligenciát a fejlesztéshez?', answer: 'Igen, az oldal fejlesztésében mesterséges intelligencia is segített.' },
    { question: 'Mi történik, ha törlöm a böngésző adatait?', answer: 'Ha törlöd az oldalhoz mentett böngészőadatokat, az itt rögzített mérőállások és beállítások is törlődnek.' },
    { question: 'Miért térhet el a becslés a számlámtól?', answer: 'A kalkulátor a megadott adatokból becsül. A számlád összegét az elszámolás és az egyedi jóváírások is befolyásolhatják.' },
  ];

  let groups = $derived([
    { title: electricity ? 'Áram' : 'Gáz', questions: electricity ? electricityQuestions : gasQuestions },
    { title: 'Az oldalról', questions: siteQuestions },
  ]);
</script>

<section class="faq" id="gyakori-kerdesek" aria-labelledby="faq-title">
  <h2 id="faq-title">Gyakori kérdések</h2>
  {#each groups as group (group.title)}
    <div class="card faq-group">
      <h3>{group.title}</h3>
      {#each group.questions as item (item.question)}
        <details>
          <summary><span>{item.question}</span><span class="faq-icon" aria-hidden="true">＋</span></summary>
          <p>{item.answer}</p>
        </details>
      {/each}
    </div>
  {/each}
</section>

<style>
  .faq { display: grid; gap: 16px; margin: 36px 0 32px; }
  h2 { margin: 0; font-size: clamp(22px, 3vw, 30px); }
  h3 { margin: 0 0 12px; color: var(--accent); font-size: 14px; font-weight: 600; }
  details { border-top: 1px solid var(--border); }
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 48px;
    padding: 12px 0;
    list-style: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 550;
  }
  summary::-webkit-details-marker { display: none; }
  .faq-icon { flex: none; color: var(--accent); font-size: 16px; }
  details[open] .faq-icon { transform: rotate(45deg); }
  p { max-width: 70ch; margin: 0 0 16px; color: var(--muted); font-size: 13px; line-height: 1.7; }
</style>
