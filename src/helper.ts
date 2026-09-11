import defaultConfig from "./config";

export function numberFormat(nb: number, currency: string = defaultConfig.currency) {
    return '<strong>' + new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(nb) + '</strong>';
}

export function numberFormatColored(nb: number, currency: string = defaultConfig.currency) {
    const color = (nb >= 0) ? '#14c57e' : '#ff6b4a';
    return '<strong style="color:' + color + '">' + numberFormat(nb, currency) + '</strong>';
}

export function percentageFormat(nb: number|null): string {
    return nb && nb < 1 ? '<span class="badge text-bg-secondary">' + Math.round(nb * 100) + '% </span>' : '';
}

const hexColorCache = new Map<string, string>();

export function cssColorToHex(color: string): string {
    // resolves any css color to plain #rrggbb as required by <input type="color">, because
    // default colors may be dynamic expressions like light-dark() (Highcharts >= 13 palette)
    const cacheKey = document.documentElement.getAttribute('data-bs-theme') + '|' + color;

    const cached = hexColorCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    const probe = document.body.appendChild(document.createElement('span'));
    probe.style.color = color; // CSSOM assignment is allowed by the strict CSP (unlike style attributes)
    const rgb = getComputedStyle(probe).color.match(/\d+/g);
    probe.remove();

    const hex = rgb === null ? color : '#' + rgb.slice(0, 3).map((value: string) => Number(value).toString(16).padStart(2, '0')).join('');
    hexColorCache.set(cacheKey, hex);

    return hex;
}

export function resetApp(): void {
    localStorage.clear();
    window.location.reload();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the resolved value is only known to the caller
export function getValueByPath(obj: unknown, path: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return path.split('.').reduce<any>((acc, key) => acc?.[key], obj);
}