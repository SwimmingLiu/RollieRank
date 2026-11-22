// UI catalogue metadata is derived from the supplied .raw folder names, not a fabricated run of periods.
// Numeric selection keys keep existing preview attempts intact; display metadata never treats every key as a period.
export const previewCatalog = {
  "四海": {
    "year": 2026,
    "periods": [
      {
        "number": 1,
        "id": "peanut-2026-h2-1",
        "title": "行测套题班",
        "year": 2026,
        "meta": "2026 下半年 · 第1期",
        "displayPeriod": 1,
        "variant": "",
        "papers": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12
        ]
      },
      {
        "number": 2,
        "id": "peanut-2026-h2-2-city",
        "title": "行测套题班",
        "year": 2026,
        "meta": "2026 下半年 · 第2期 · 地市",
        "displayPeriod": 2,
        "variant": "地市",
        "papers": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12
        ]
      },
      {
        "number": 102,
        "id": "peanut-2026-h2-2-province",
        "title": "行测套题班",
        "year": 2026,
        "meta": "2026 下半年 · 第2期 · 副省",
        "displayPeriod": 2,
        "variant": "副省",
        "papers": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12
        ]
      }
    ]
  },
  "超格": {
    "year": 2027,
    "periods": [
      {
        "number": 1,
        "id": "chaoge-2027-10",
        "title": "公考10套卷",
        "year": 2027,
        "meta": "2027 · 行测",
        "displayPeriod": null,
        "variant": "",
        "papers": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ]
      }
    ]
  },
  "粉笔": {
    "year": 2027,
    "periods": [
      {
        "number": 1,
        "id": "fenbi-2027-6",
        "title": "国考极致模考",
        "year": 2027,
        "meta": "2027 · 6套卷",
        "displayPeriod": null,
        "variant": "",
        "papers": [
          1,
          2,
          3,
          4,
          5,
          6
        ]
      }
    ]
  },
  "上岸村": {
    "year": 2027,
    "periods": [
      {
        "number": 1,
        "id": "shangancun-2027-10",
        "title": "公考10套卷",
        "year": 2027,
        "meta": "2027 · 国考 / 混合组卷",
        "displayPeriod": null,
        "variant": "",
        "papers": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "paperNames": {
          "1": "2026国考卷",
          "2": "2025国考卷",
          "3": "混合组卷1",
          "4": "混合组卷2",
          "5": "混合组卷3",
          "6": "混合组卷4",
          "7": "混合组卷5",
          "8": "混合组卷6",
          "9": "混合组卷7",
          "10": "混合组卷8"
        }
      }
    ]
  }
};
export const collectionsFor = institution => previewCatalog[institution]?.periods ?? [];
export const collectionFor = (institution, key) => collectionsFor(institution).find(item => item.number === key);
export const isPeriodNumber = value => Number.isSafeInteger(value) && value > 0;
export const isInstitution = institution => Object.hasOwn(previewCatalog, institution);
export const periodsFor = (institution, catalog = previewCatalog) => (catalog[institution]?.periods ?? []).map(p => p.number);
export const papersFor = (institution, period, catalog = previewCatalog) => catalog[institution]?.periods.find(p => p.number === period)?.papers ?? [];
export const isAvailablePeriod = (institution, period, catalog = previewCatalog) => isPeriodNumber(period) && periodsFor(institution, catalog).includes(period);
