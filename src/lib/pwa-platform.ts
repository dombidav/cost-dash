export function excludedPlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
) {
  const apple = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(userAgent);
  const applePlatform = /Mac|iPhone|iPad|iPod/i.test(platform);
  const ipadDesktop = platform === "MacIntel" && maxTouchPoints > 1;
  const safari =
    /Safari/i.test(userAgent) &&
    !/Chrome|Chromium|Edg|OPR|SamsungBrowser/i.test(userAgent);
  return apple || applePlatform || ipadDesktop || safari;
}
