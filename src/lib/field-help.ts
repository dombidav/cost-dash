export type FieldHelp = { what: string; where: string };
const help = (what: string, where: string): FieldHelp => ({ what, where });
const readingDate = help(
  "Az a nap, amikor a mérőállást leolvastad, ÉÉÉÉ-HH-NN formátumban. Alapból a mai nap; korábbi mérés is rögzíthető.",
  "A saját leolvasásod dátumát add meg. Számláról átvett állásnál a mérési dátumot keresd, ne a számla keltét vagy a fizetési határidőt.",
);
const gasReading = help(
  "A gázóra teljes, összegzett állása m³-ben. Nem az utolsó hónap fogyasztása; azt két állás különbségéből számoljuk. Az állás időrendben nem csökkenhet.",
  "A gázóra számlálóján vagy kijelzőjén. A tizedeseket vesszővel is megadhatod; a számlán a mérőállásadatok között keresd.",
);
const electricReading = help(
  "A hálózatból vételezett energia összegzett mérőállása kWh-ban. Nem a havi fogyasztás és nem a pillanatnyi teljesítmény. Napelemes mérőn a betáplálási állás más adat.",
  "A villanyóra kijelzőjén vagy a számla mérőállásadatai között. A vételezés összesítőjét gyakran 1.8.0 jelöli; a pontos kijelzőkódot a saját mérő útmutatójával ellenőrizd.",
);
const electricPeak = help(
  "A2 tarifán a csúcsidőhöz tartozó regiszter teljes állása kWh-ban. A csúcs és a völgy külön növekvő számláló, nem szabad felcserélni őket.",
  "A mérő kijelzőjén és a számla csúcsidős mérőállássorában. A T1/T2 vagy 1.8.1/1.8.2 kód hozzárendelését a számlán vagy a mérő útmutatójában ellenőrizd; nem minden mérő jelölése azonos.",
);
const electricOff = help(
  "Az A2 tarifa völgyidős regiszterének összegzett állása kWh-ban. A kalkulációhoz ezt és a csúcsregisztert is add meg; ugyanannak a napnak az állásaival.",
  "A villanyóra völgyidős kijelzőjén vagy a számla völgyidős mérőállássorában. A T1/T2 vagy OBIS-kódot a saját számládhoz és mérőleírásodhoz párosítsd.",
);
const year = help(
  "Az éves kedvezmény követési időszaka augusztus 1-jétől a következő július 31-éig. Az éves összesítőt, a statisztikákat és a naplót szűri; az időszaki kalkuláció külön dátumokkal dolgozik.",
  "Itt válaszd ki a vizsgált évet. A számlán szereplő elszámolási időszak ettől eltérhet.",
);
const start = help(
  "A számolt időszak első napja, amely már beleszámít a fogyasztás és a kedvezmény elosztásába.",
  "A számlán az elszámolt időszak kezdete, vagy a saját kezdő leolvasásod napja. A formátum ÉÉÉÉ-HH-NN.",
);
const end = help(
  "A záró dátum már nem része a számolt időszaknak. Például teljes novemberhez december 1-jét adj meg; a záró mérőállás erre a határnapra kell.",
  "A saját záró leolvasásod napja. Ha a számla utolsó napja még beleszámít az időszakba, itt az azt követő napot add meg.",
);
const saving = help(
  "Ennyivel csökkentjük a saját éves fogyasztást a megtakarítás szemléltetéséhez, majd újraszámoljuk az ársávokat. Az alapdíj változatlan.",
  "Saját kipróbálható feltételezés, nincs hozzá számlaadat. A csúszka nem módosítja a naplót vagy a szolgáltatói beállításokat.",
);
const region = help(
  "A saját éves fogyasztás mellé a választott vármegye vagy Budapest háztartási átlagát is megjelenítjük. A referencia nem személyre szabott fogyasztási cél.",
  "A lakás helye alapján válassz területet. A referenciaértékeket a KSH táblázatából töltöttük az alkalmazásba; nem kell őket kézzel megkeresned.",
);

export const FIELD_HELP: Record<string, FieldHelp> = {
  "gas-year": year,
  "gas-mode": help(
    "Azt szabja meg, hogyan becsüljük a havi számlázott mennyiséget: egyenletes részszámla, havi diktálás vagy hőmérsékletfüggő részszámla.",
    "A szolgáltatói szerződésben, az online ügyfélszolgálaton vagy a számlázási tájékoztatóban. Ha bizonytalan vagy, kérdezd az ügyfélszolgálatot; az itteni választás nem módosítja a szerződésedet.",
  ),
  "gas-reading": gasReading,
  "gas-date": readingDate,
  "gas-heat": help(
    "Egy köbméter gáz energiatartalma MJ-ban. A számlázott energia a fogyasztott m³, a korrekciós tényező és a fűtőérték szorzata.",
    "A gázszámla részletezőjében a „Fűtőérték” vagy „Átlagos fűtőérték” sorban, MJ/m³ egységgel. Számlánként változhat; itt egy közös értékkel becslünk.",
  ),
  "gas-correction": help(
    "A mért gáztérfogatot az elszámolás referenciaállapotára igazító szorzó. Nem százalék: például 1,01-et adj meg, ne 101-et.",
    "A gázszámla részletezőjében „Korrekciós tényező” néven, a mérőállások vagy a fogyasztási adatok mellett.",
  ),
  "gas-bill-start": start,
  "gas-bill-end": end,
  "gas-annual-estimate": help(
    "A várható teljes éves gázfogyasztás m³-ben. Az átalány és a hőmérsékletfüggő mód ebből osztja szét az időszaki mennyiséget.",
    "A legutóbbi éves elszámolószámlán a teljes év fogyasztásánál, vagy az online ügyfélszolgálaton a beállított éves mennyiségnél. A megváltozott szokásaid szerint módosíthatod.",
  ),
  "gas-stat-low": help(
    "A kedvezményes sávban egy MJ gáz bruttó fogyasztási díja. A nettó összegre egyszer számíts áfát; a Ft/m³-ben megadott ár más egység.",
    "A gázszámla díjrészletezőjében vagy a hivatalos díjtáblában, Ft/MJ egységgel. A kalkulátor ellenőrzött alapértéket kínál.",
  ),
  "gas-stat-high": help(
    "Az éves vagy időszaki keret feletti energia bruttó díja Ft/MJ-ban. Csak a magasabb sávba jutó részre alkalmazzuk.",
    "A gázszámlán a magasabb díjsáv energiadíjánál vagy az MVM lakossági díjtáblájában. Bruttó, nem nettó Ft/MJ értéket használj.",
  ),
  "gas-stat-annualBase": help(
    "A fogyasztástól független éves bruttó alapdíj. A kalkulátor az időszak napjaira arányosítja.",
    "A gázszámla alapdíjsorában vagy a hivatalos díjtáblában. Ha havi díjat látsz, évesítsd; a kiinduló érték önálló, 20 m³/h alatti lakossági mérőre szól.",
  ),
  "gas-stat-effective": help(
    "A megadott díjakhoz tartozó érvényességi dátum. Tájékoztató jelölés: a kalkulátor a megadott árakkal számol az egész vizsgált időszakra, nem vált automatikusan történeti díjakat.",
    "A szolgáltatói díjtábla hatálybalépési dátumánál vagy a díjváltozásról szóló értesítésben, ÉÉÉÉ-HH-NN formátumban.",
  ),
  "gas-stat-area": help(
    "A ténylegesen fűtött helyiségek összes alapterülete. Az éves m³/m² és kWh/m² összevetéshez kell; a gázköltséget nem befolyásolja.",
    "Az alaprajzról, energetikai tanúsítványból vagy saját felmérésből. A nem fűtött garázst, teraszt ne számold ide. Nem kötelező.",
  ),
  "gas-stat-heaterPower": help(
    "A szemléltető elektromos fűtőtest teljesítménye kW-ban. Ebből becsüljük, hány óra működésnek felel meg a gáz energiatartalma.",
    "A készülék adattábláján vagy leírásában. Ha wattot látsz, oszd 1000-rel: 2000 W = 2 kW. Ez energia-összevetés, nem azonos fűtési költség.",
  ),
  "gas-stat-efficiency": help(
    "A gáz energiatartalmából hasznos hővé váló rész feltételezett aránya. Csak a szemléltető hasznos hőt módosítja, a számlázott gázt nem.",
    "A kazán műszaki adatlapján vagy szakember becsléséből. A valós üzem eltérhet a laborértéktől; az alapérték szemléltető feltételezés.",
  ),
  "gas-stat-region": region,
  "gas-saving": saving,
  "electricity-year": year,
  "electricity-point-select": help(
    "A mérési pont, amelynek a beállításait, naplóját és statisztikáit szerkeszted. A többi pont adatai megmaradnak, a közös összesítőben együtt láthatók.",
    "A számla mérési pontjai és tarifái alapján különítsd el például a nappali, a vezérelt és a H pontot. Ugyanannak a mérőnek az A2-regiszterei egy pontba tartoznak.",
  ),
  "electricity-reading-peak": electricReading,
  "electricity-reading-off": electricOff,
  "electricity-reading-date": readingDate,
  "electricity-name": help(
    "Saját, könnyen felismerhető név ehhez az önálló mérési ponthoz, például „Nappali”, „Bojler” vagy „Hőszivattyú”.",
    "Te adod meg; nem szükséges számlaazonosító vagy személyes adat. A név az aktív mérő választójában és az összesítőben is megjelenik.",
  ),
  "electricity-area": help(
    "A helyi villamosenergia-hálózat üzemeltetője. Azonos tarifa kedvezményes ára elosztói területenként eltérhet; a választás betölti az alapárakat.",
    "A villanyszámla részletezőjében vagy a hálózathasználati szerződésben az elosztó neve szerepel. Ez eltérhet a számlát kiállító kereskedő, például az MVM Next nevétől.",
  ),
  "electricity-tariff": help(
    "A mérési pontra szerződött árszabás: például egész napos A1, kétzónás A2, vezérelt B vagy hőszivattyús H. Meghatározza az árakat és a kedvezmény feltételeit.",
    "A villanyszámla részletezőjében az „Árszabás” vagy „Tarifa” megnevezésnél, illetve a szerződésben. Az oldal tarifaismertetője segít eligazodni; az itteni váltás nem szerződésmódosítás.",
  ),
  "electricity-annual-estimate": help(
    "Ennek az egy mérési pontnak a várható teljes éves hálózati vételezése kWh-ban. Az A2 két zónáját együtt add meg; más mérő fogyasztását ne add hozzá.",
    "Az éves elszámolószámlán, az online ügyfélszolgálat éves fogyasztásánál vagy saját teljes éves mérésből. Az induló 2500 kWh/év a KSH háztartási átlagának kerekítése, nem saját mérés. Külön B/H-mérőnél írd át a saját mennyiségre; napelemnél a hálózati vételezés kell.",
  ),
  "electricity-consumption-profile": help(
    "A kiválasztott mérő fogyasztásának feltételezett havi eloszlása. A hiányzó évkezdet és a várható éves fogyasztás becslését befolyásolja.",
    "A korábbi havi számlákon vagy saját mérőállásaidból nézd meg, nyáron, télen vagy nagyjából egyformán használod-e ezt a mérőt.",
  ),
  "electricity-low": help(
    "Az alap kedvezményes bruttó kWh-díj. A2-nél a csúcsidő, H-nál a fűtési idény díja. Már tartalmazza az áfát és a kWh-alapú rendszerhasználatot.",
    "A számla megfelelő árszabású díjsoraiból vagy az elosztói területhez tartozó MVM-díjtáblából. A külön feltüntetett nettó energiadíj önmagában nem ez az összeg.",
  ),
  "electricity-second": help(
    "A2-nél a völgyidős kedvezményes bruttó ár, H-nál az idényen kívüli kedvezményes ár. A kWh-díj a fogyasztási időszaktól vagy zónától függ.",
    "A számla megfelelő csúcs/völgy vagy H-idényen kívüli sorából, illetve az elosztóhoz tartozó hivatalos bruttó díjtáblából.",
  ),
  "electricity-market": help(
    "A normál kedvezményes keret feletti rész bruttó Ft/kWh díja, a kWh-alapú rendszerhasználattal és áfával együtt. Nem az egész fogyasztás kerül ebbe a sávba.",
    "A számla lakossági piaci ársorában vagy az MVM díjtáblájában. A B tarifa és az A tarifa keret feletti díja eltérhet.",
  ),
  "electricity-fixed": help(
    "A fogyasztástól független havi bruttó alapdíj erre a pontra jutó része. Törthónapnál napokra osztjuk.",
    "A számla elosztói alapdíjsorában, csatlakozási pont/hó egységgel. Ha ugyanazt az alapdíjat már másik pontnál figyelembe vetted, itt 0 is megadható.",
  ),
  "electricity-effective": help(
    "A használt díjtábla érvényességének kezdete. Jelölésként tároljuk: nem indít automatikus díjváltást; minden számolt napra a megadott díjakat használjuk.",
    "A hivatalos díjtábla hatálybalépési dátumánál vagy a szolgáltatói díjértesítőben, ÉÉÉÉ-HH-NN formátumban.",
  ),
  "electricity-off-percent": help(
    "A kézi éves A2-becslésből völgyidőre jutó százalék. A maradék a csúcsidőé. A 50% fele-fele megoszlást jelent.",
    "Az éves számla csúcs- és völgyfogyasztásából: völgy kWh ÷ összes kWh × 100. Ha nincs ilyen adatod, saját feltételezésként kezeld; pontos zónaméréseknél azok az elsődlegesek.",
  ),
  "electricity-heating-percent": help(
    "A kézi éves H-becslésből az október 15. és április 15. közti fűtési idényre jutó rész. A maradékot az idényen kívülre osztjuk.",
    "A teljes éves, idény szerint bontott mérési vagy számlaadatokból becsüld meg. Az induló százalék szemléltető feltételezés, nem hivatalos fogyasztási profil.",
  ),
  "electricity-solar": help(
    "A háztartási napelem elszámolási típusa. Bruttó módban csak a vételezés költségét számoljuk, a betáplálást nem vonjuk le; szaldóhoz ez a költségmodell nem ad összeget.",
    "A HMKE-szerződésedben, az éves elszámolásodban vagy az online ügyfélszolgálaton. A napelem telepítési dátuma önmagában nem mindig elég a besoroláshoz.",
  ),
  "electricity-eligible-from": help(
    "Az első nap, amelytől ezen a ponton a megadott lakossági kedvezményre jogosult vagy. Részéves jogosultságnál a keret is időarányos.",
    "A szerződés vagy az átírás hatálybalépési dátumánál, a szolgáltatói visszaigazolásban. Új szerződésnél a régi, alapból kitöltött kezdőnapot javítsd a sajátodra.",
  ),
  "electricity-eligible-to": help(
    "Az első nap, amelyre már nem jár a megadott jogosultság. Folyamatos szerződésnél hagyd üresen.",
    "A szerződés megszűnéséről vagy jogosultságváltozásról szóló visszaigazolásban. Ha a dokumentum az utolsó jogosult napot adja meg, itt a következő napot használd.",
  ),
  "electricity-extra": help(
    "A normál kereten felüli, szolgáltató által jóváhagyott éves A1/A2-kedvezmény kWh-ban. Nem általános családi kedvezmény, és nem jár automatikusan.",
    "A szolgáltató jogosultsági visszaigazolásában vagy határozatában. Csak igazolt mennyiséget írj be; ha nincs ilyen jogosultságod, maradjon 0. Egészségügyi adatot ne adj meg.",
  ),
  "electricity-extra-from": help(
    "Az első nap, amelytől a jóváhagyott többletkeretet figyelembe vehetjük. Csak a jogosult napokra arányosítjuk az éves mennyiséget.",
    "A többletkedvezményről szóló szolgáltatói visszaigazolás érvényességi kezdeténél, ÉÉÉÉ-HH-NN formátumban.",
  ),
  "electricity-extra-to": help(
    "Az első nap, amelytől a többletkeret már nem érvényes. Határozatlan idejű kedvezménynél üres maradhat.",
    "A jogosultsági visszaigazolás vagy a megszűnésről szóló értesítés alapján. Ha az utolsó jogosult nap szerepel rajta, itt a következő napot add meg.",
  ),
  "electricity-schedule": help(
    "Az elszámolás ütemezése: éves becslésből egyenletes részszámla, tényleges fogyasztás utólag, vagy előre fizetős mérő fogyasztási költsége.",
    "A szerződésedben, számlázási tájékoztatódban vagy az online ügyfélszolgálaton. Ez külön beállítás a tarifától és a mérés módjától; itt csak a becslést állítod.",
  ),
  "electricity-metering": help(
    "Kézi leolvasás/diktálás vagy távleolvasott, idősoros mérés. Az okosmérő önmagában nem jelent D tarifát, és részszámla is tartozhat hozzá.",
    "A számla mérési/elszámolási adatai között vagy a szolgáltatói visszaigazolásban. A kalkulátor nem kér le automatikusan adatot a mérőről.",
  ),
  "electricity-source": help(
    "A tényfogyasztást pontos kezdő és záró naplóbeli állásokból, vagy közvetlenül megadott időszaki kWh-ból számoljuk.",
    "A mérőnaplóból, illetve a szolgáltatói számla vagy online fogyasztási kimutatás kWh-összegéből válassz adatforrást. Az összeg időszaka egyezzen meg a megadott dátumokkal.",
  ),
  "electricity-start": start,
  "electricity-end": end,
  "electricity-period-peak": help(
    "A kiválasztott időszak alatt elhasznált hálózati energia kWh-ban; A2-nél csak a csúcsidős rész. Ez már fogyasztás, nem összegzett mérőállás.",
    "A számla vagy az online fogyasztási kimutatás azonos időszakra vonatkozó kWh-sorában. A2-nél a csúcs és a völgy külön mezőbe kerül.",
  ),
  "electricity-period-off": help(
    "Az A2 tarifa völgyidőben elfogyasztott időszaki energiája kWh-ban. A csúcsidős részhez hozzáadjuk, közösen használják a normál keretet.",
    "A számla vagy szolgáltatói fogyasztási kimutatás völgyidős kWh-sorában. Ugyanarra a kezdő és záró dátumra vonatkozzon, mint a csúcsfogyasztás.",
  ),
  "electricity-credit": help(
    "Kizárólag ehhez a pontos időszakhoz tartozó, igazolt forintjóváírás. A számolt időszaki költségből egyszer levonjuk; az éves becslésben nem ismételjük meg.",
    "A számla jóváírási sorában vagy szolgáltatói visszaigazolásban. Nem azonos a rezsibox szemléltető megtakarításával, a befizetett előleggel vagy az általános számlaegyenleggel.",
  ),
  "electricity-balance": help(
    "Az előre fizetős mérő jelenlegi, forintban megadott felhasználható egyenlege. Ebből és a mért napi költségből becsüljük, meddig elegendő.",
    "A mérő egyenlegkijelzőjén vagy a szolgáltatói feltöltési felületen. Ha csak kWh-t mutat, az nem Ft-egyenleg; itt ne a legutóbbi feltöltés összegét add meg.",
  ),
  "electricity-all-start": help(
    "A közös összehasonlítás kezdőnapja. Minden mérő erre az időszakra számolódik, ezért az összeadott adatok ugyanazokat a napokat fedik le.",
    "Te választhatod ki, például a közös havi számlák kezdőnapját. Az „Aktív mérő időszakának átvétele” gomb átmásolja a kiválasztott pont dátumait.",
  ),
  "electricity-all-end": help(
    "A közös összesítő kizáró záró dátuma. Teljes novemberhez december 1. kell. A hiányzó adatokkal rendelkező pontokat az összesítő külön jelzi.",
    "A választott közös időszakot lezáró határnapot add meg. A saját időszaki tény-kWh csak egyező dátumok esetén használható fel ehhez az összesítéshez.",
  ),
  "electricity-people": help(
    "A háztartásban élők száma az éves kWh/fő összevetéshez. A kedvezményes keretet és a számlabecslést nem növeli.",
    "Saját adat, nem kell hozzá számla. Külön H- vagy B-mérőnél az eredmény csak az aktív mérőre, nem a teljes háztartásra vonatkozik. Nem kötelező.",
  ),
  "electricity-floor-area": help(
    "A lakás alapterülete m²-ben az éves kWh/m² mutatóhoz. Nem változtatja meg a tarifát vagy a kedvezményes keretet.",
    "Alaprajzról, ingatlandokumentumból vagy saját mérésből. A külön mérőre vetített mutató nem energetikai tanúsítvány és nem a ház teljes energiaigénye.",
  ),
  "electricity-region": region,
  "electricity-watts": help(
    "A példaként választott készülék névleges elektromos teljesítménye wattban. Ebből készül az üzemóra- és havi energia-egyenérték.",
    "A készülék adattábláján vagy használati útmutatójában, W egységgel. 1 kW = 1000 W. A termosztát miatt a tényleges fogyasztás kisebb is lehet a folyamatos névlegesnél.",
  ),
  "electricity-hours": help(
    "A példakészülék feltételezett napi működési ideje órában. 30 napra számítunk energiát; ez nem növeli meg a naplózott fogyasztást.",
    "Saját becslésből vagy fogyasztásmérős megfigyelésből. A 0,5 fél órát jelent. A ki-be kapcsoló készüléknél az aktív működési idővel számolj.",
  ),
  "electricity-saving": saving,
};

export function fieldHelp(id: string): FieldHelp {
  if (id.startsWith("gas-profile-"))
    return help(
      "A hónap relatív súlya a hőmérsékletfüggő éves fogyasztási becslésben. Például kétszeres súly kétszer akkora részt kap. Ez a fogyasztást osztja, nem a kedvezményt.",
      "Saját korábbi havi fogyasztásaid arányából becsülheted. A betöltött súlyok szemléltető példák, nem MVM-időjárási adatok vagy kötelező százalékok.",
    );
  if (id.startsWith("gas-history-"))
    return id.endsWith("-date") ? readingDate : gasReading;
  if (id.startsWith("electricity-history-"))
    return id.endsWith("-date")
      ? readingDate
      : id.endsWith("-1")
        ? electricOff
        : electricReading;
  return (
    FIELD_HELP[id] ??
    help(
      "Ez az adat a helyi kalkuláció egyik beállítása.",
      "A mező megnevezése és mértékegysége alapján add meg; az érvényes módosítás helyben mentődik.",
    )
  );
}
export const A2_PEAK_HELP = electricPeak;
