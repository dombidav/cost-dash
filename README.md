# Rezsi — gázkalkulátor

Magyar nyelvű, mobilra tervezett, sötét megjelenésű kalkulátor. Vanilla HTML, CSS és JavaScript, külső függőségek és build nélkül.

## Indítás

Az `index.html` közvetlenül megnyitható. A megbízható, azonos címhez kötött localStorage-mentéshez ajánlott helyi HTTP-kiszolgálót használni:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Ezután: http://127.0.0.1:4173

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

Az időszaki kedvezménybe férő rész = min(fogyasztás, keret); a keret feletti rész = max(0, fogyasztás − keret). Ez **sávkorrekció nélküli tájékoztató becslés**: korábbi megtakarítás és éves elszámolás módosíthatja a tényleges besorolást. Forintösszeget nem számolunk. Fűtési célú, általános lakossági profilra készült, külön jogosultságokat és rendkívüli egyszeri kedvezményeket nem modellez.

A korábbi v1 localStorage-adatokat a program a napló és beállítások megtartásával egészíti ki az új számlázási mezőkkel. A módválasztó azonnal, a többi érvényes adat mezőelhagyáskor mentődik. Hibás adat nem módosítja az utolsó érvényes számítási alapot.

Forrás: [MVM hivatalos kalkulátora és tájékoztatója](https://www.mvmnext.hu/foldgaz/egyetemes-szolgaltatas/ugyintezes/arak-dijszabasok/rogzitett-kedvezmeny-kalkulator), valamint a feladatban megadott handoff. A 2027-es értékek a szabályok változatlanságát feltételezik.

További források (ellenőrizve: 2026-11-06): [MVM havi kedvezménymegosztás](https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-foldgaz), [számlázási tájékoztató](https://www.mvmnext.hu/foldgaz/contents/Documents/Ugyintezes/Szamlazas/Tajekoztato-a-szamlazasi-rendszerrol.pdf), [hőmérsékletfüggő részszámlázás](https://gyik.mvmnext.hu/foldgaz/mit-jelent-a-homersekletfuggo-reszszamlazas).

```powershell
node --test tests/calculator.test.cjs
node --check app.js
```
