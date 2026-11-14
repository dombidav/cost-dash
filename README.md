# RezsiPont

Rezsiszámlák egyszerűen. Pont.

Magyar nyelvű, mobilra tervezett, sötét megjelenésű kalkulátor. Svelte 5, TypeScript, Vite és Chart.js. Teljesen kliensoldali alkalmazás, jQuery nélkül.

## Indítás és build

Node.js 22.13–22.x vagy 24+ szükséges. A függőségek pontos verzióit a `package-lock.json` rögzíti.

```sh
npm ci
npm run dev
```

Fejlesztői cím: http://127.0.0.1:5173. Production build és előnézet:

```sh
npm run build
npm run preview
```

A `dist/` teljes tartalma statikus HTTP-tárhelyre tölthető fel. Az `index.html` a gáz-, az `aram.html` az áramoldal; relatív assetutakkal alkönyvtárban is működnek. Nincs szerveroldali futtatás, API vagy SPA-átirányítási követelmény. A közvetlen `file://` megnyitás már nem támogatott. A preview alapértelmezett címe http://127.0.0.1:4173. A localStorage címhez és porthoz kötött: a korábbi 4173-as adatok ezen a preview-címen érhetők el, az 5173-as fejlesztői cím külön tárhely.

A további statikus oldalak: `viz.html`, `auto.html`, `havidijak.html` és `dashboard.html`. Mindegyik ugyanazon a címen futtatva ugyanazt a helyi böngészőtárhelyet éri el.

A `src/` könyvtár tartalmazza a Svelte-komponenseket és a tiszta TypeScript-számításokat, a `vite.config.ts` a buildet állítja be. Szigorú TypeScript-típusellenőrzés, Terser-tömörítés három optimalizálási menettel, névrövidítéssel és megjegyzéseltávolítással; tömörített CSS, production sourcemap nélkül. A Chart.js a grafikonokhoz szükséges elemekkel, külön chunkban töltődik be. A `.gitignore` kizárja a függőségeket, buildet, helyi környezeti és ideiglenes fájlokat.

Az `npm run lint` az ESLint és a Prettier ellenőrzését is futtatja. Az `npm run format` a Prettier alapbeállításaival formázza a forrásfájlokat. A `npm run typecheck` önálló fordítói ellenőrzés; a build ezt automatikusan futtatja. Az `npm test` a PDF-mentések teljes oda-vissza adatmegőrzését, validálását és a többkategóriás visszaállítás hibakezelését ellenőrzi; a Pages workflow ezt is futtatja.

## Mérési képek és bizonylatok

A gáz-, áram- és vízmérésekhez, valamint az autós kiadásokhoz egy-egy JPG-, PNG- vagy WebP-fotó csatolható. A Cropper.js 2 szerkesztő az eredeti képen enged szabad oldalarányú vágást, nagyítást és 90°-os forgatást. A szerkesztő csak kép kiválasztásakor töltődik be. A bemenet legfeljebb 15 MiB és 50 megapixel lehet; a HEIC és a PDF közvetlen képcsatolmányként nem támogatott.

Mentéskor legfeljebb 1600 pixeles hosszabbik oldalú WebP készül, 250 kB-os célmérettel. A minőségi lépések 0,78 / 0,68 / 0,58; az olvashatóság megőrzése érdekében a célméret túlléphető, legfeljebb 1 MB-ig. Külön, legfeljebb 320 pixeles bélyegkép készül. Az eredeti fájl csak a szerkesztés idejére marad elérhető, ezért a levágott részek később nem állíthatók vissza.

A mérési adatok továbbra is localStorage-ban maradnak, és opcionális `photoId` hivatkozást kapnak. A `rezsipont-photos` IndexedDB-adatbázis külön `images` és `thumbnails` tárolóban őrzi a két változatot. Először a képpár mentődik egy tranzakcióban, majd a mérési hivatkozás; sikertelen adatmentéskor az új képpár törlődik. A már nem hivatkozott képek takarítása késleltetett, és helyben elérhető visszavonás esetén várakozik.

A WebP támogatását tényleges canvas-kódolás ellenőrzi, böngészőnév-vizsgálat nélkül. A PNG-re visszaeső kódolás sikertelennek számít. Ilyenkor a feltöltés eltűnik, és megjelenik a tájékoztató dialog; a „Ne jelenjen meg többször” választás a `rezsipont.photos.hide-unsupported.v1` localStorage-kulcsba kerül. Az importált képek megtekintése és továbbexportálása WebP-kódolás nélkül is működik, ha a böngésző meg tudja jeleníteni őket.

Mindkét PDF-export megőrzi a képeket külön WebP-csatolmányként. A képes mentés 2-es formátumverziót használ; a korábbi, kép nélküli mentések továbbra is visszaállíthatók. Importkor ellenőrizzük a hivatkozásokat és a csatolmányokat, új képazonosítókat és bélyegképeket készítünk. A PDF fájlméretkorlátja 200 MiB; nagy adatállománynál oldalankénti export használható. A képek PDF-csatolmányok, nem a kimutatás látható oldalaira helyezett fotók.

Az `npm test` a képtárolás, a hibás mentések visszagörgetése és a képes PDF-csatolmányok adatmegőrzése mellett a korábbi mentéseket is ellenőrzi. A futó fejlesztői szerveren a `/tests/browser/unsupported-photos.html` tesztoldal a WebP helyetti PNG-kimenetet szimulálja; így tesztelhető a dialog és az elnémítás valódi Safari-eszköz nélkül. A fixture a normál fejlesztői origin helyi adatait használja, ezért külön teszt-böngészőprofilban nyisd meg.

## GitHub Pages deployment

A `.github/workflows/pages.yml` workflow a `master` ágra történő push esetén Node.js 24 alatt telepíti a rögzített függőségeket (`npm ci`), futtatja a lintet és a típusellenőrzést is tartalmazó buildet, majd a `dist/` tartalmát publikálja GitHub Pagesre. A `master` ágra nyitott pull requesteknél ugyanezek az ellenőrzések futnak. A deployment kézzel is indítható az Actions → GitHub Pages → Run workflow menüből, a `master` ágat kiválasztva.

Egyszeri beállítás a [repo Pages-beállításaiban](https://github.com/dombidav/cost-dash/settings/pages): **Build and deployment → Source → GitHub Actions**. Ezután a következő `master` push vagy kézi workflow-indítás publikálja az appot. Külön token vagy repository secret nem szükséges; a workflow a beépített `GITHUB_TOKEN` és az OIDC használatával telepít. A build csak olvasási jogot kap, a Pages írási jogosultsága a deployment jobra korlátozódik.

A várható publikus cím: https://dombidav.github.io/cost-dash/. Mind a hat HTML-oldal közvetlenül elérhető, például a Dashboard a `dashboard.html` útvonalon. A Vite `base: "./"` beállítása és a relatív navigáció miatt az assetek, a PDF-betűtípusok és a PDF-import worker a `/cost-dash/` alkönyvtárból is betöltődnek; nincs szükség SPA fallbackre vagy külön `gh-pages` ágra.

A helyi böngészőadatok nem kerülnek át automatikusan a localhostról az új címre. A Dashboard teljes PDF-mentésével az egész app adatai átvihetők. A localStorage originenként közös, ezért az azonos `dombidav.github.io` domainen futó más appokkal azonos tárhelyen lesznek.

A workflow a [Vite hivatalos GitHub Pages útmutatójára](https://vite.dev/guide/static-deploy#github-pages) épül; a GitHub Actions lépések teljes commit SHA-ra vannak rögzítve.

## Használat

- **Víz:** a fogyasztás két dátumozott vízóraállás különbsége. A település, a bruttó egységárak és a havi alapdíj egy helyen állíthatók; az összes becslés a jelenlegi díjakat használja. Az alapdíj naparányos. A korábbi havi tételek megmaradnak, külön a mérési naplótól. A Dashboard a hónapokat átfedő méréseket egyenletes napi fogyasztást feltételezve osztja szét.
- **Autó:** minden autóhoz egyedi nevet vagy rendszámot és külön naplót adhatsz. A Dashboard az autók kiadásait összeadja. A fizetett összegek a fizetés dátumára kerülnek. Kilométeróra-állás tankoláshoz és egyszeri kiadáshoz is menthető. Ha az előző tankolásnak van óraállása, a megtett út és az új óraállás egymásból frissül. Összesített l/100 km = 100 × összes liter / összes kilométer, csak a tele tankolások közötti megjelölt utakra. Ha csak literár ismert, liter = fizetett összeg / literár. A futáshoz köthető becsült értékvesztés külön szerepel.
- **Havidíjak:** a tétel az első és az utolsó megadott hónapban is esedékes. Díjemeléskor a lezárt régi és az új áras tétel külön őrzi meg az időszakokat.
- **Dashboard:** az ismert tételeket adja össze naptári hónaponként és évenként; a folyó év az aktuális hónapig látható. A gáz- és áramdíjak a hónapot lefedő mérések, az egyező időszaki adatok vagy az aktuális havi részszámla alapján becsültek. A kategóriák becslései és rögzített kifizetései eltérő jelölést kapnak.

### PDF-export és visszaállítás

Mind a hat oldalon van PDF-export és visszaállítás. A vízmentés a vízóraállásokat, a korábbi havi tételeket és a díjbeállításokat tartalmazza. Az autómentés minden autót ment, a tankolásokkal, kiadásokkal, ütemezett díjakkal és adóbeállításokkal együtt. A havidíjmentés a korábbi, aktív és jövőbeli tételeket is megőrzi.

A **Dashboard → Teljes mentés (PDF)** az egész alkalmazás minden tárolt adatát menti: gáz, áram, víz, autók, havidíjak és havi keret, a beállításokkal és mentett piszkozatokkal együtt. Mindkét Dashboard-export teljes adatmentést tartalmaz; a kiválasztott év és hónap csak az olvasható kimutatást szűri. A teljes mentés nem vágja le a régi naplóbejegyzéseket. A gáz- és áramoldal saját, 120 méréses naplókorlátja továbbra is érvényes az adott oldal használatakor.

Az adatmentés a PDF `rezsipont-adatok.json` csatolmányában található; a PDF-et eredeti formájában őrizd meg, mert az újranyomtatás eltávolíthatja a csatolmányt. A visszaállítás a RezsiPont által exportált PDF-ekből működik, szolgáltatói számlák beolvasását nem végzi. A korábbi gáz- és árammentések továbbra is visszaállíthatók a saját oldalukon.

Import előtt megjelenik a mentés tartalma, és az **Adatok cseréje** gombbal kell jóváhagyni a cserét. A külön oldalak a saját adataikat, a Dashboard a teljes appot cseréli le; a teljes mentésben üres kategória az aktuális adatokat is kiüríti. Sérült, ismeretlen verziójú, más kategóriájú vagy érvénytelen adatú PDF nem kerül mentésre. A beolvasás óta módosult adatok esetén újra ki kell választani a PDF-et. Sikertelen többkategóriás mentéskor az alkalmazás megkísérli az addigi írások visszaállítását, és jelzi, ha ez nem sikerül teljesen. Az import legfeljebb 50 MB-os PDF-et fogad el.

### Gáz

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

## Svelte felépítés

- `src/App.svelte`: közös keret, navigáció, külön, igény szerint betöltött gáz- és áramoldal.
- `src/components/`: újrafelhasználható, reaktív mezők, választók, körjelző, mérési napló és Chart.js-komponens.
- `src/gas/`: gázoldal, statisztikák és a korábbi helyi adatok migrációja.
- `src/electricity/`: áramoldal, önálló mérési pontok, tarifaadatok, számítások és statisztikák.
- `src/lib/`: formázás, validált helyi tárolás és Svelte-állapot a mentési visszajelzéshez.
- `src/style.css`: közös mobilközpontú stílusok és témaváltozók; gázon zöld, áramon kék kiemelés, azonos sötét háttérrel.

A korábbi DOM-ot kézzel építő alkalmazásmodulokat eltávolítottuk. A Svelte-migráció előtti mentőcommit: `b381eb7` (`feat: add electricity calculator and TypeScript build`). A fordítás `svelte-check` ellenőrzést is futtat.

## Áram és több mérő

Az áramoldalon legfeljebb 20 önálló mérési pont vehető fel, saját névvel, elosztóval, tarifával, díjakkal, jogosultsággal, mérési naplóval és helyben mentett piszkozattal. Az A1, A2, B alap, elérhető B Komfort, H, meglévő B GEO és D tarifák szerepelnek. A két A2-regiszter együtt kap egy keretet; a külön pontok kedvezménye nem ruházható át egymásra. A mérőpont törlése visszavonható.

A közös összesítő minden mérőre ugyanazt a kezdő és kizáró záró dátumot használja. Csak teljes adatlefedettségnél ad teljes költséget, különben az ismert részösszeget és a hiányzó pontokat mutatja. Külön megjelenik az összes éves becsült költség is. A mérésekből pontos határnapok szükségesek; két mérés között naparányos elosztás készül. A2-nél a kedvezményt a két zóna fogyasztásának arányában osztjuk, jelölt becslésként.

A normál keret 2523 kWh / kedvezményes év, a tényleges 365/366 napra arányosítva. A H-idény október 15. – április 15. (a számításban április 16. a kizáró záró nap); az ekkori fogyasztás korlátmentes, és nem fogyasztja a nyári normál keretet. B GEO-nál nincs normál keret. Igazolt A1/A2-többletkeret külön érvényességi dátummal megadható.

A bruttó kWh-díjak már tartalmazzák az áfát és a kWh-alapú rendszerhasználatot. A csatlakozási alapdíj szerkeszthető, akár 0 is lehet a kétszeres számítás elkerülésére. A megadott díjak az egész vizsgált időszakra érvényes becslési paraméterek; történeti díjváltozás nem rekonstruálható. A visszaigazolt jóváírás csak a saját pontos időszakára kerül levonásra, nem ismétlődik az éves becslésben.

A D tarifa 2027 előtti időszakára, illetve a keret feletti dinamikus rész negyedórás fogyasztási és áradatainak hiányában nincs teljes forintösszeg. HMKE bruttó módnál csak a hálózati vételezés költségét számoljuk, visszatáplálást nem nettósítunk. Szaldós elszámolás költségét a modell nem számolja. A 2026. januári támogatást nem vonjuk le automatikusan.

A számlázási ütemezés (átalány, tényleges, előre fizetős), a mérés módja (kézi, okosmérő) és az adatforrás külön választható. A módok összehasonlítása az oldal alján található. A statisztikák éves/napi előrejelzést, költséget, maradékot, tavalyi összevetést, KSH-referenciát, megtakarítást, változásjelzést, egy főre és területre vetített értékeket, készülék-egyenértéket és előre fizetős egyenlegbecslést adnak.

Az áramadatok külön `rezsi-electricity.v1` localStorage-kulcsban maradnak. A gáz naplója és korábbi `rezsi-calculator.v1` adatai megmaradnak. Hibás adatot nem írunk felül; a több böngészőlap közti ütközés újratöltést kér.

## Ismeretterjesztés és mezősúgók

Mindkét oldal minden adatmezője mellett `?` gomb található, a választóknál, csúszkáknál, feltételes beállításoknál és a szerkeszthető mérési naplóban is. A súgó két részből áll: **Mit jelent?** és **Hol találod / mit adj meg?** A számlaadatokat, mérőállásokat és saját becslési feltételezéseket külön magyarázza; a regiszterkódoknál a saját mérő útmutatójának ellenőrzését kéri.

A súgó egérrel rámutatva, kattintással/koppintással vagy billentyűzetfókusszal nyílik meg. Újabb kattintás, Escape vagy külső kattintás bezárja. A natív popover a napló és más konténerek fölött jelenik meg, a képernyő széléhez igazítva; a mezőket `aria-describedby` kapcsolja a magyarázathoz. A szövegek a `src/lib/field-help.ts`, a közös megjelenítés a `src/components/Help.svelte` fájlban vannak.

Az áramoldal önálló tarifaismertetője az A1, A2, B alap, B Komfort, H, B GEO és D árszabást mutatja be: mire való, mikor van ellátás, hogyan működik a kedvezmény, mire kell figyelni. Az aktív mérő tarifáját kiemeli, a kW/kWh különbséget példával tanítja, és a hivatalos forrásokhoz vezet. A tartalom a `src/electricity/TariffGuide.svelte` komponensben található.

Az árammérő beállításai alapból négy mezőt mutatnak: név, elosztó, tarifa és éves becslés. Az automatikusan kitöltött díjak összefoglalója alatt a „Díjak módosítása” rész nyitja meg az árakat és az alapdíjat. A jogosultsági időszak, a napelem és az igazolt többletkeret külön lenyitható esetek; összecsukásuk nem törli vagy kapcsolja ki a mentett adatot, az aktív beállítást az összefoglaló jelzi. A2/H választásakor a hozzájuk tartozó fogyasztási arány is megjelenik. A mérő eltávolítása külön alsó művelet. Ezt a `src/electricity/PointSettings.svelte` komponens kezeli.

Ellenőrzött áramforrások (2026-11-06): [MVM díjtábla](https://www.mvmnext.hu/aram/servlet/download?id=16214&type=file), [kedvezmények és jogosultságok](https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-aram), [D árszabás](https://www.mvmnext.hu/aram/pages/aloldal.jsp?id=16455107), [KSH háztartási fogyasztás](https://www.ksh.gov.hu/stadat_files/kor/hu/kor0068.html). Az országos áramreferencia a 2025-ös 205,7 kWh/hó × 12 = 2468,4 kWh/év; egy külön B/H-mérő nem azonos egy teljes háztartással.

A „Mérő beállításai” harmonika minden oldalbetöltéskor és mérőváltáskor összecsukva indul. Nyitását és csukását 280 ms-os magasságátmenet kíséri; csökkentett mozgás beállításnál az animáció kikapcsol. A zárt tartalom nem kerül a billentyűzetes fókuszsorrendbe.

Az új árammérők éves fogyasztási alapértéke **2500 kWh/év**, a KSH 2025-ös országos 205,7 kWh/hó × 12 = 2468,4 kWh/év értékéből száz kWh-ra kerekítve. Ez szerkeszthető kiinduló becslés, nem mért saját adat vagy kedvezményes keret. Külön B/H-mérőnél a saját mennyiséget kell beállítani. A korábbi üres mezőket egyszeri migráció tölti ki; a megadott, akár nullás értékek megmaradnak. A később szándékosan kiürített mezőt a program már nem tölti vissza. Az egyszeri migrációt az `annualEstimateDefaultVersion` jelölő követi a helyi állapotban.
