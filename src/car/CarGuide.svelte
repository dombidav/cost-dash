<script lang="ts">
  type GuideLink = { label: string; href: string };
  const cards: {
    id: string;
    topic: string;
    title: string;
    paragraphs: string[];
    example?: string;
    links: GuideLink[];
  }[] = [
    {
      id: "kgfb",
      topic: "Kötelező biztosítás",
      title: "Kinek fizet a KGFB?",
      paragraphs: [
        "A kötelező gépjármű-felelősségbiztosítás a másnak okozott jogos kárt téríti. Ha neked okoztak kárt, főszabály szerint a károkozó biztosítójához fordulhatsz.",
        "A saját autódban általad okozott kárra a cascód nyújthat fedezetet, ha a szerződésed kiterjed az esetre.",
      ],
      example:
        "Ha nekikoccansz egy parkoló autónak, a másik autó kárát a te KGFB-d rendezheti.",
      links: [
        {
          label: "MNB · Gépjármű-biztosítás",
          href: "https://okokalk.mnb.hu/letoltes/gepjarmu-biztositas.pdf",
        },
      ],
    },
    {
      id: "casco",
      topic: "Casco és önrész",
      title: "Mennyit fizet a casco?",
      paragraphs: [
        "A casco a saját autód fedezett káraira fizethet, például törés, lopás vagy jégverés esetén. A biztosító a biztosítottnak vagy a megjelölt kedvezményezettnek téríthet.",
        "Az önrészt te állod. Ha százalékos és minimum önrész is van, általában a nagyobbat vonják le.",
      ],
      example:
        "400 000 Ft elfogadott kárnál, 10%, de legalább 100 000 Ft önrésszel te 100 000 Ft-ot állsz, a biztosító 300 000 Ft-ot térít.",
      links: [
        {
          label: "MABISZ · Casco gyakori kérdések",
          href: "https://mabisz.hu/casco-biztositas-gyik/",
        },
      ],
    },
    {
      id: "bonus",
      topic: "Biztosítási díj",
      title: "Drágulhat a biztosítás kár után?",
      paragraphs: [
        "A KGFB-nél a károkozáshoz kapcsolódó kárkifizetés ronthatja a következő időszak bonus–malus besorolását. Ez emelheti a díjat.",
        "A cascónál a szerződés saját szabályai számítanak. Egy kárkifizetés csökkentheti vagy megszüntetheti a kármentességi kedvezményt, így a következő időszak díja magasabb lehet.",
      ],
      links: [
        {
          label: "MNB · KGFB bonus–malus",
          href: "https://www.mnb.hu/fogyasztovedelem/biztositasok/gepjarmu-biztositas/a-bonus-malus-besorolasi-rendszer",
        },
        {
          label: "MABISZ · Casco bónusz",
          href: "https://mabisz.hu/gyakori-kerdesek-hogyan-mukodik-a-bonusz-rendszer-a-casco-biztositasoknal/",
        },
      ],
    },
    {
      id: "claim",
      topic: "Kárbejelentés",
      title: "Mi segít a kárrendezésnél?",
      paragraphs: [
        "Ha biztonságosan megteheted, fotózd le a helyszínt és a sérüléseket, rögzítsd a résztvevők adatait, és töltsétek ki a baleseti bejelentőt. Az E-kárbejelentő továbbítja a bejelentést a biztosítónak.",
        "KGFB-nél a károkozónak 5 munkanapja, a károsultnak a káreseménytől vagy a tudomásszerzéstől 30 napja van a bejelentésre. A casco határidejét a szerződésedben keresd.",
      ],
      links: [
        {
          label: "MNB · Bejelentési határidők",
          href: "https://www.mnb.hu/fogyasztovedelem/biztositasok/gepjarmu-biztositas/alapveto-fogalmak-a-kotelezo-gepjarmu-felelossegbiztositassal-kapcsolatosan",
        },
        {
          label: "MABISZ · E-kárbejelentő",
          href: "https://mabisz.hu/a-mabisz-es-az-autos-nagykoalicio-kozosen-nepszerusiti-az-e-karbejelento-applikaciot2026-03-06/",
        },
      ],
    },
    {
      id: "tax",
      topic: "Gépjárműadó",
      title: "Ki fizet, ha év közben eladják az autót?",
      paragraphs: [
        "Főszabály szerint az fizeti az éves adót, aki január 1-jén üzembentartóként szerepelt a nyilvántartásban. Ha nincs bejegyzett üzembentartó, a tulajdonos fizet. Egy év közbeni adásvétel ezt általában nem változtatja meg.",
        "Személyautónál a nyilvántartott kW és a gyártási év alapján számítják az összeget. A fizetendő adót és az esedékességet a NAV-határozatban ellenőrizheted.",
      ],
      links: [
        { label: "Gépjárműadó-kalkulátor", href: "#car-tax-title" },
        {
          label: "NAV · Az éves adó szabályai",
          href: "https://nav.gov.hu/gepjarmuado/altalanos-tudnivalok-a-gepjarmuadorol",
        },
      ],
    },
    {
      id: "cost",
      topic: "Fenntartás",
      title: "Mennyibe kerül egy kilométer?",
      paragraphs: [
        "Az üzemanyag mellé számold hozzá az azonos időszakra jutó biztosítást, adót, szervizt és gumit. Az összeg és a megtett kilométerek hányadosa mutatja meg, mennyibe került átlagosan egy kilométer.",
        "A havi tervezéshez az éves díjakat oszd el tizenkettővel. Így a ritkán fizetett tételekre is félre tudsz tenni.",
      ],
      example:
        "Egy 72 000 Ft-os éves biztosításra havonta 6000 Ft-ot érdemes félretenni.",
      links: [{ label: "Rendszeres autós kiadások", href: "#car-recurring" }],
    },
  ];
</script>

<section aria-labelledby="car-guide-title">
  <h2 id="car-guide-title" tabindex="-1">Autós tudnivalók</h2>
  <p class="expense-subtitle">
    Melyik biztosítás fizet, mi marad a te költséged, és mire érdemes
    félretenni?
  </p>
  <div class="guide-grid">
    {#each cards as card (card.id)}
      <article class="card guide-card" aria-labelledby={`car-guide-${card.id}`}>
        <p class="guide-topic">{card.topic}</p>
        <h3 id={`car-guide-${card.id}`}>{card.title}</h3>
        {#each card.paragraphs as paragraph (paragraph)}<p>
            {paragraph}
          </p>{/each}
        {#if card.example}<p class="guide-example">{card.example}</p>{/if}
        <ul class="guide-links">
          {#each card.links as link (link.href)}<li>
              <a href={link.href}>{link.label}</a>
            </li>{/each}
        </ul>
      </article>
    {/each}
  </div>
</section>

<style>
  .guide-grid {
    display: grid;
    gap: 14px;
  }
  .guide-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 10px;
    padding: clamp(16px, 2vw, 24px);
    overflow-wrap: anywhere;
  }
  .guide-card :is(p, h3, ul) {
    margin: 0;
  }
  .guide-card p {
    color: var(--muted);
  }
  .guide-card .guide-topic {
    color: var(--accent);
    font-size: 0.8125rem;
    font-weight: 650;
  }
  .guide-example {
    border-inline-start: 2px solid var(--accent);
    padding-inline-start: 10px;
  }
  .guide-card .guide-links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: auto;
    padding: 6px 0 0;
    list-style: none;
    font-size: 0.8125rem;
  }
  .guide-links a {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
  }
  @media (min-width: 700px) {
    .guide-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1050px) {
    .guide-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
