export function regionLabel(region: string) {
  return region === "Budapest" ? region : `${region} megye`;
}

export function regionOptions(regions: Record<string, number>) {
  return [
    { value: "country", label: "Csak országos átlag" },
    ...Object.keys(regions)
      .sort((a, b) => a.localeCompare(b, "hu"))
      .map((value) => ({ value, label: regionLabel(value) })),
  ];
}
