<script lang="ts">
  import { pages, type PageId } from "../lib/pages";
  let { id }: { id: PageId } = $props();

  type Question = {
    question: string;
    answer: string;
    link?: { href: string; label: string };
  };
  const electricityQuestions: Question[] = [
    {
      question: "Hol találom a tarifámat?",
      answer:
        "A villanyszámla részletezőjén keresd az árszabást, például az A1 vagy H jelölést. A tarifát a szerződésedben is megtalálod.",
      link: {
        href: "#electricity-tariffs",
        label: "Áramtarifák összehasonlítása",
      },
    },
    {
      question: "Melyik mérőállást adjam meg A2 tarifánál?",
      answer:
        "Add meg a csúcsidős és a völgyidős állást is, ugyanarról a napról. A számlád vagy a mérő útmutatója segít azonosítani a két kijelzett értéket.",
      link: { href: "#electricity-reading-peak", label: "Mérőállás rögzítése" },
    },
    {
      question: "Hogyan követhetem több mérő fogyasztását?",
      answer:
        "Mindegyik mérőhöz külön tarifát és mérőállásokat adhatsz meg. Ha több mérőt felvettél, a közös összesítőben együtt is láthatod a fogyasztásukat.",
      link: {
        href: "#electricity-add-point",
        label: "Ugrás az új mérési ponthoz",
      },
    },
    {
      question: "Mi a különbség a kW és a kWh között?",
      answer:
        "A kW a készülék teljesítménye, a kWh az elfogyasztott energia. Egy 2 kW-os fűtőtest egy óra folyamatos működés alatt 2 kWh-t fogyaszt.",
    },
  ];

  const gasQuestions: Question[] = [
    {
      question: "Mit írjak be gázóraállásnak?",
      answer:
        "A mérőn látható teljes állást add meg köbméterben. Az időszaki fogyasztást az oldal két rögzített állás különbségéből számolja.",
      link: { href: "#gas-reading", label: "Gázóraállás rögzítése" },
    },
    {
      question: "Hol találom a fűtőértéket és a korrekciós tényezőt?",
      answer:
        "A gázszámla részletezőjén keresd a „Fűtőérték” és a „Korrekciós tényező” sorokat. Ezekkel számolja át a kalkulátor a köbmétert energiára.",
      link: { href: "#gas-heat", label: "Ugrás a számlaadatokhoz" },
    },
    {
      question: "Milyen időszakot mutat az éves összesítő?",
      answer:
        "A kiválasztott kedvezményes évet mutatja augusztus 1-jétől a következő július végéig. Ha nincs kezdőnapi mérésed, a hiányzó fogyasztást havi súlyozással becsüljük, amint van hozzá elég adat.",
      link: { href: "#gas-year", label: "Kedvezményes év kiválasztása" },
    },
  ];

  const siteQuestions: Question[] = [
    {
      question: "Hol maradnak a megadott adataim?",
      answer:
        "A mérőállásaid, kiadásaid és beállításaid abban a böngészőben maradnak, amelyikben megadtad őket. Egy e-mailben kapott link másik böngészőben is megnyílhat, ahol a mentett adatok nem látszanak.",
    },
    {
      question: "Milyen adatokat gyűjt az oldal?",
      answer:
        "A kalkulátor nem küldi el nekünk a megadott adataidat, és statisztikai vagy követő sütiket sem használ.",
    },
    {
      question: "Használtatok mesterséges intelligenciát a fejlesztéshez?",
      answer:
        "Igen, az oldal fejlesztésében mesterséges intelligencia is segített.",
    },
    {
      question: "Mi történik, ha törlöm a böngésző adatait?",
      answer:
        "Ha törlöd az oldalhoz mentett böngészőadatokat, az itt rögzített mérőállások, kiadások és beállítások is törlődnek.",
    },
    {
      question: "Miért térhet el a becslés a számlámtól?",
      answer:
        "A kalkulátor a megadott adatokból becsül. A számlád összegét az elszámolás és az egyedi jóváírások is befolyásolhatják.",
    },
  ];

  const questions: Record<PageId, Question[]> = {
    electricity: electricityQuestions,
    gas: gasQuestions,
    subscriptions: [
      {
        question: "Mi történik, ha megszűnik egy előfizetés?",
        answer:
          "Szerkeszd a tételt, és add meg az utolsó fizetett hónapot. A korábbi hónapokban továbbra is szerepelni fog.",
      },
      {
        question: "Hogyan rögzítsem a díjemelést?",
        answer:
          "Zárd le a régi tételt a régi áron fizetett utolsó hónappal, majd vedd fel az új árat a következő hónaptól.",
      },
    ],
    car: [
      {
        question: "Miért kell liter vagy literár is a fogyasztáshoz?",
        answer:
          "A forintból és a kilométerből csak az út költsége számolható. A liter/100 km értékhez az elfogyasztott üzemanyag mennyisége is kell.",
      },
      {
        question: "Az értékvesztést is elköltöttem?",
        answer:
          "Az értékvesztés a futásteljesítmény becsült hatása az autó árára. Külön mutatjuk, és nem számítjuk hozzá a kifizetéseidhez.",
      },
    ],
    water: [
      {
        question: "Mit tegyek, ha a településem nincs a listán?",
        answer:
          "Válaszd az Egyedi díjak lehetőséget, és add meg a számládon szereplő bruttó díjakat. Az alapdíjat külön írd be.",
      },
      {
        question: "Mit adjak meg, ha nincs csatornadíjam?",
        answer:
          "Írj nullát a csatornadíj mezőbe. Ha csak a csatornázott mennyiség tér el, add meg külön a számlán szereplő mennyiséget.",
      },
    ],
  };
  let groups = $derived([
    { title: pages[id].label, questions: questions[id] },
    { title: "Az oldalról", questions: siteQuestions },
  ]);
</script>

<section class="faq" id="gyakori-kerdesek" aria-labelledby="faq-title">
  <h2 id="faq-title">Gyakori kérdések</h2>
  {#each groups as group (group.title)}
    <div class="card faq-group">
      <h3>{group.title}</h3>
      {#each group.questions as item (item.question)}
        <details>
          <summary
            ><span>{item.question}</span><span
              class="faq-icon"
              aria-hidden="true">＋</span
            ></summary
          >
          <p>
            {item.answer}
            {#if item.link}<a href={item.link.href}>{item.link.label}</a>{/if}
          </p>
        </details>
      {/each}
    </div>
  {/each}
</section>

<style>
  .faq {
    display: grid;
    gap: 16px;
    margin: 36px 0 32px;
  }
  h2 {
    margin: 0;
    font-size: clamp(22px, 3vw, 30px);
  }
  h3 {
    margin: 0 0 12px;
    color: var(--accent);
    font-size: 14px;
    font-weight: 600;
  }
  details {
    border-top: 1px solid var(--border);
  }
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
  summary::-webkit-details-marker {
    display: none;
  }
  .faq-icon {
    flex: none;
    color: var(--accent);
    font-size: 16px;
  }
  details[open] .faq-icon {
    transform: rotate(45deg);
  }
  p {
    max-width: 70ch;
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.7;
  }
</style>
