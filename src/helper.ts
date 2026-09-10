import defaultConfig from "./config";

export function numberFormat(nb: number, currency: string = defaultConfig.currency) {
    return '<strong>' + new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(nb) + '</strong>';
}

export function numberFormatColored(nb: number, currency: string = defaultConfig.currency) {
    const color = (nb >= 0) ? '#14c57e' : '#ff6b4a';
    return '<strong style="color:' + color + '">' + numberFormat(nb, currency) + '</strong>';
}

export function percentageFormat(nb: number): string {
    return nb && nb < 1 ? '<span class="badge text-bg-secondary">' + Math.round(nb * 100) + '% </span>' : '';
}

const hexColorCache = new Map<string, string>();

export function cssColorToHex(color: string): string {
    // resolves any css color to plain #rrggbb as required by <input type="color">, because
    // default colors may be dynamic expressions like light-dark() (Highcharts >= 13 palette)
    const cacheKey = document.documentElement.getAttribute('data-bs-theme') + '|' + color;

    if (! hexColorCache.has(cacheKey)) {
        const probe = document.body.appendChild(document.createElement('span'));
        probe.style.color = color; // CSSOM assignment is allowed by the strict CSP (unlike style attributes)
        const rgb = getComputedStyle(probe).color.match(/\d+/g);
        probe.remove();

        hexColorCache.set(cacheKey, rgb === null ? color : '#' + rgb.slice(0, 3).map((value: string) => Number(value).toString(16).padStart(2, '0')).join(''));
    }

    return hexColorCache.get(cacheKey);
}

export function resetApp(): void {
    localStorage.clear();
    window.location.reload();
}

export function getValueByPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}