export type Catalog = Readonly<Record<string, { readonly year: number; readonly periods: readonly { readonly number: number; readonly papers: readonly number[] }[] }>>;
export const previewCatalog: Catalog;
export function isPeriodNumber(value: unknown): value is number;
export function isInstitution(institution: string): boolean;
export function periodsFor(institution: string, catalog?: Catalog): readonly number[];
export function papersFor(institution: string, period: number, catalog?: Catalog): readonly number[];
export function isAvailablePeriod(institution: string, period: number, catalog?: Catalog): boolean;

export type Collection = {number:number;id:string;title:string;year:number;meta:string;displayPeriod:number|null;variant:string;papers:number[];paperNames?:Record<string,string>};
export function collectionsFor(institution:string):Collection[];
export function collectionFor(institution:string,key:number):Collection|undefined;
