export type Publisher = {
  institution: string;
  name: string;
  logoSrc: string;
};

// Display names and custom marks can change without migrating paper keys or saved attempts.
export const publishers: Publisher[] = [
  { institution: "四海", name: "花生", logoSrc: "assets/publishers/sihai-peanut.svg" },
  { institution: "超格", name: "超格", logoSrc: "assets/publishers/chaoge-study.svg" },
  { institution: "粉笔", name: "粉笔", logoSrc: "assets/publishers/fenbi-mark.svg" },
  { institution: "上岸村", name: "上岸村", logoSrc: "assets/publishers/shangancun-mark.svg" },
];
export const publisherName = (institution: string) => publishers.find(item => item.institution === institution)?.name ?? institution;
export const publisherIcon = (institution: string) => publishers.find(item => item.institution === institution)?.logoSrc ?? "";
