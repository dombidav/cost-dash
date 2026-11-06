# Rezsi — gázkalkulátor

Magyar nyelvű, mobilra tervezett, sötét megjelenésű kalkulátor. TypeScript, Vite és Chart.js, keretrendszer nélkül.

## Indítás és build

Node.js 22.12+ szükséges. A függőségek pontos verzióit a `package-lock.json` rögzíti.

```sh
npm ci
npm run dev
```

Fejlesztői cím: http://127.0.0.1:5173. Production build és előnézet:

```sh
npm run build
npm run preview
```

A `dist/` könyvtár statikus HTTP-tárhelyre tölthető fel, a közvetlen `file://` megnyitás már nem támogatott. A preview alapértelmezett címe http://127.0.0.1:4173. A localStorage címhez és porthoz kötött: a korábbi 4173-as adatok ezen a preview-címen érhetők el, az 5173-as fejlesztői cím külön tárhely.

A `src/` könyvtár tartalmazza a TypeScript-modulokat, a `vite.config.ts` a buildet állítja be. Szigorú TypeScript-típusellenőrzés, Terser-tömörítés három optimalizálási menettel, névrövidítéssel és megjegyzéseltávolítással; tömörített CSS, production sourcemap nélkül. A Chart.js csak a használt elemekkel, külön chunkban töltődik be, amikor grafikon közelébe görgetsz. A `.gitignore` kizárja a függőségeket, buildet, helyi környezeti és ideiglenes fájlokat.

Teszt- és lintereszköz nincs beállítva. A `npm run typecheck` önálló fordítói ellenőrzés; a build ezt automatikusan futtatja.

## Használat

- Állítsd be a számlán szereplő fűtőértéket és korrekciós tényezőt. A mező elhagyásakor mentődnek, a számítás azonnal frissül.
- Válassz számlázási módot: egyenletes részszámlázás, havi diktálás vagy hőmérsékletfüggő részszámlázás. A választás helyben mentődik; az MVM-nél nem módosít beállítást.
- Add meg a gázóra teljes állását és a mérés dátumát (alapból a helyi mai nap). A kitöltés mezőelhagyáskor piszkozatként mentődik; a **Mérőállás rögzítése** gomb adja a naplóhoz.
- A naplóban a dátum és a mérőállás közvetlenül szerkeszthető, mentés mezőelhagyáskor. A törlés 15 másodpercig visszavonható.
- A dátum szerinti előző és következő mérés is korlátozza az állást. Csökkenő állás, duplikált nap, jövőbeli/érvénytelen dátum, negatív/nem számszerű adat nem menthető. Azonos mérőállás megengedett.
- Az éves keret augusztus 1. – július 31. között értendő. Évkezdő mérés nélkül a maradék csak felső becslés; az első mérés előtti fogyasztás ismeretlen. A kijelzés az utolsó mérés időpontjára vonatkozik, nem vetítjük ki a fogyasztást mára.
- A korrekció és fűtőérték az összes mérésre egységesen érvényes. Óracsere vagy átfordulás külön kezelése nincs beépítve.

Az adatok a `rezsi-calculator.v1` localStorage-kulcsban maradnak, hálózaton nem továbbítjuk őket. Hibás korábbi adatot az alkalmazás nem ír felül. Több lapon történő módosításkor újratöltést kér a felülírás elkerülésére.

## Számítás és ellenőrzés

Éves keret: **63 645 MJ**. Köbméter = MJ ÷ (fűtőérték × korrekció). A felső éves áttekintés a mért fogyasztást követi, számlázási módtól függetlenül.

Az **időszaki kalkuláció** a kezdőnapot beleszámítja, a záró dátumot kizárja: egy teljes januárhoz január 1. → február 1. adandó meg. A záró dátum tehát a következő időszak kezdete. Legfeljebb 366 nap számolható, 2024-08-01-től. A fenti kedvezményesév-választó az éves áttekintést és a naplót szűri; az időszaki kalkulációt a saját dátummezői határozzák meg.

- **Átalány:** az éves fogyasztás 1/12-e teljes naptári hónapra, törthónapra ennek naparányos része. A kedvezmény napi összege az adott kedvezményes év 365 vagy 366 napjából számolódik. Évváltáskor naponta a megfelelő éves nevezőt használjuk.
- **Diktálás:** a kezdő és záró dátumra rögzített tényleges mérőállás különbsége. Hiányzó határnapi mérésnél nincs interpoláció vagy kitalált fogyasztás. Az „Utolsó két mérés” gomb a kiválasztott év két legutolsó adatát állítja be.
- **Hőmérsékletfüggő részszámla:** éves becslés × havi profilsúly / összes profilsúly; törthónapra a havi érték naparányos része. A kiinduló `[19,16,13,8,3,1,1,1,2,7,12,17]` súlyok **szemléltető példák, nem MVM-adatok**, és szerkeszthetők. A szolgáltató teljes, időjárási és fogyasztási adatokat használó algoritmusát nem modellezzük.

Diktálásnál és hőmérsékletfüggő módban a kedvezmény az MVM rögzített, kerekített havi MJ-táblázatából készül: `[12365,10421,8915,5145,1827,635,512,565,1109,3724,7490,10937]`, januártól decemberig. A hónap napjaira osztjuk, szökőéves februárban 29 nappal, köztes kerekítés nélkül. Ez a **kedvezménygörbe nem a fogyasztási profil**. A két szezonális mód kedvezménye azonos, a számlázott fogyasztás számítása eltérő.

Az időszaki kedvezménybe férő rész = min(fogyasztás, keret); a keret feletti rész = max(0, fogyasztás − keret). Ez **sávkorrekció nélküli tájékoztató becslés**: korábbi megtakarítás és éves elszámolás módosíthatja a tényleges besorolást. A statisztikák szerkeszthető bruttó egységárakkal és időarányos alapdíjjal adnak forintos becslést. Fűtési célú, általános lakossági profilra készült, külön jogosultságokat és rendkívüli egyszeri kedvezményeket nem modellez.

A korábbi v1 localStorage-adatokat a program a napló és beállítások megtartásával egészíti ki az új számlázási mezőkkel. A módválasztó azonnal, a többi érvényes adat mezőelhagyáskor mentődik. Hibás adat nem módosítja az utolsó érvényes számítási alapot.

Forrás: [MVM hivatalos kalkulátora és tájékoztatója](https://www.mvmnext.hu/foldgaz/egyetemes-szolgaltatas/ugyintezes/arak-dijszabasok/rogzitett-kedvezmeny-kalkulator), valamint a feladatban megadott handoff. A 2027-es értékek a szabályok változatlanságát feltételezik.

További források (ellenőrizve: 2026-11-06): [MVM havi kedvezménymegosztás](https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-foldgaz), [számlázási tájékoztató](https://www.mvmnext.hu/foldgaz/contents/Documents/Ugyintezes/Szamlazas/Tajekoztato-a-szamlazasi-rendszerrol.pdf), [hőmérsékletfüggő részszámlázás](https://gyik.mvmnext.hu/foldgaz/mit-jelent-a-homersekletfuggo-reszszamlazas).

## Statisztikák

- Költségbontás: kedvezményes és keret feletti díj, időarányos alapdíj. A részszámla becslését és a legutóbbi mért szakasz költségbecslését külön jelöljük. Minden időszakra a megadott díjakat vetítjük, történeti díjváltozást nem rekonstruálunk.
- További 1 m³ fogyasztási díja mindkét ársávban; napi átlag és változása két egymást követő mérési szakaszból.
- Napi mozgástér: ismert évkezdő állástól az utolsó méréskor hátralévő éves keret / hátralévő napok. Lezárt évre nincs nullával osztás.
- Éves adat: teljes mért év az elsődleges. Enélkül legalább 30 nap és 5% éves fogyasztási profilsúly megfigyelése után mért fogyasztás / megfigyelt súly. Kevés adatnál a kézi éves becslés jelenik meg, külön jelölve; ezek hiányában üres állapot.
- Tavalyi összevetés: mindkét naptári határnapra pontos tavalyi mérés szükséges. Február 29. párja február 28.; napi átlagok kezelik az eltérő napokat. Időjárási korrekció nincs.
- Országos és vármegyei KSH-összevetés: a 2025-ös, gázfogyasztó háztartásra jutó havi éves átlag × 12. Országosan 79,5 m³/hó, azaz 954 m³/év. Eltérő lakásméret és gázhasználat, nem hatékonysági minősítés. Becsült saját adat külön jelölve.
- Éves m³/m² és kWh/m² a megadott fűtött alapterületre; az összes gázfelhasználást tartalmazza, nem energetikai tanúsítvány.
- Megtakarítási szimulátor: az éves csökkentett fogyasztást újraosztjuk a 63 645 MJ sávhatárnál; az alapdíj változatlan. A sávváltást is kezeli.
- Változásjelzés: legalább három mérésből az utolsó két szakasz napi átlagának legalább 50%-os változása. Egyszerű jelzési szabály, nem statisztikai bizonyosság vagy hibadiagnózis.
- Energia-egyenérték: legutóbbi mért szakasz, enélkül számlázási mennyiség, ezek hiányában 1 m³ szemléltetés. kWh = MJ / 3,6; fűtőtest-óra = kWh / kW. Állítható teljesítmény és feltételezett kazánhatásfok; nem költségegyenlőség.

A következő augusztus 1-jei mérés az előző kedvezményes év záróállása és az új év kezdőállása is. A statisztikai beállítások a korábbi napló megőrzésével, automatikusan kerülnek a localStorage-adatokhoz. Minden érvényes mezőmódosítás mentődik; a szimulátor a csúszka elengedésekor is ment.

Referenciaadatok: `src/reference-data.ts`. Az MVM 2026. októberi [díjtájékoztatójából](https://www.mvmnext.hu/foldgaz/contents/Documents/Ugyintezes/Arak/202610/MVM-Fo%CC%88ldga%CC%81z-Lak-Nemlak-2026-10.pdf?download) nettó 2,256 × 1,27 = bruttó 2,86512 Ft/MJ; magasabb díj 22,002 Ft/MJ; éves alapdíj 11 674 Ft (20 m³/h alatti önálló lakossági mérő). A forrás szerint ezek 2023-10-01-től érvényesek. A KSH élő táblázata 2026-10-30-án frissült; a 2025-ös oszlopot használjuk. Ellenőrizve: 2026-11-06. Az alkalmazás nem végez háttérlekérést és nem továbbít személyes adatokat.
