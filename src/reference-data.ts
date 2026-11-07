/* Reviewed public snapshots; no network request is made by the calculator. */
export const R = Object.freeze({
  checked: "2026-11-06",
  tariff: Object.freeze({
    low: 2.256 * 1.27,
    high: 22.002,
    annualBase: 11674,
    effective: "2023-10-01",
    source:
      "https://www.mvmnext.hu/foldgaz/contents/Documents/Ugyintezes/Arak/202610/MVM-Fo%CC%88ldga%CC%81z-Lak-Nemlak-2026-10.pdf?download",
  }),
  // KSH 15.1.2.25, monthly average m³ per household gas consumer, 2025 column.
  // Live HTML retrieved 2026-11-06; the source was updated 2026-10-30.
  ksh: Object.freeze({
    year: 2025,
    updated: "2026-10-30",
    nationalMonthly: 79.5,
    source: "https://www.ksh.gov.hu/stadat_files/kor/hu/kor0068.html",
    regions: Object.freeze({
      Budapest: 55.8,
      Pest: 105.8,
      Fejér: 78.7,
      "Komárom-Esztergom": 109.7,
      Veszprém: 77.7,
      "Győr-Moson-Sopron": 80.4,
      Vas: 79.6,
      Zala: 70.1,
      Baranya: 74.8,
      Somogy: 69.3,
      Tolna: 91.3,
      "Borsod-Abaúj-Zemplén": 79.8,
      Heves: 90,
      Nógrád: 95.1,
      "Hajdú-Bihar": 87.2,
      "Jász-Nagykun-Szolnok": 90.2,
      "Szabolcs-Szatmár-Bereg": 89,
      "Bács-Kiskun": 84.9,
      Békés: 86.8,
      "Csongrád-Csanád": 73.2,
    } as Record<string, number>),
  }),
});
