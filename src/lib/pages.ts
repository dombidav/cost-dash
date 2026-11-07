export const categories = {
  gas: {
    label: "Gáz",
    title: "Gázkalkulátor",
    href: "./index.html",
    icon: "♨",
  },
  electricity: {
    label: "Áram",
    title: "Áramkalkulátor",
    href: "./aram.html",
    icon: "ϟ",
  },
  water: {
    label: "Víz",
    title: "Vízkalkulátor",
    href: "./viz.html",
    icon: "≈",
  },
  car: {
    label: "Autó",
    title: "Autóköltségek",
    href: "./auto.html",
    icon: "↔",
  },
} as const;

export const pages = categories;
export type PageId = keyof typeof pages;

export function currentPage(path: string): PageId {
  return (
    (Object.keys(pages) as PageId[]).find(
      (id) => path.split("/").at(-1) === pages[id].href.slice(2),
    ) ?? "gas"
  );
}
