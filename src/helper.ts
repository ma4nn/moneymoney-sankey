import defaultConfig from "./config";

export function numberFormat(nb: number, currency: string = defaultConfig.currency) {
    return '<strong>' + new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(nb) + '</strong>';
}

export function numberFormatColored(nb: number, currency: string = defaultConfig.currency) {
    let color = (nb >= 0) ? '#14c57e' : '#ff6b4a';
    return '<strong style="color:' + color + '">' + numberFormat(nb, currency) + '</strong>';
}

export function percentageFormat(nb: number): string {
    return nb && nb < 1 ? '<span class="badge text-bg-secondary">' + Math.round(nb * 100) + '% </span>' : '';
}

export function resetApp(): void {
    localStorage.clear();
    window.location.reload();
}

export function getValueByPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}