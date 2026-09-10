type Scheme = 'light' | 'dark';
type ThemePreference = Scheme | 'system';

const storageKey = 'theme';
const darkSchemeQuery = '(prefers-color-scheme: dark)';

const getStoredTheme = (): ThemePreference => {
    const theme = localStorage.getItem(storageKey);

    return theme === 'light' || theme === 'dark' ? theme : 'system';
};

const getSystemScheme = (): Scheme => window.matchMedia(darkSchemeQuery).matches ? 'dark' : 'light';

export default () => ({
    theme: getStoredTheme(),

    init(): void {
        this.apply(); // usually a no-op because the inline script in the html head already applied the theme before first paint

        window.matchMedia(darkSchemeQuery).addEventListener('change', () => {
            if (this.isSystem) {
                this.apply();
            }
        });
    },

    get isLight(): boolean {
        return this.theme === 'light';
    },

    get isDark(): boolean {
        return this.theme === 'dark';
    },

    get isSystem(): boolean {
        return this.theme === 'system';
    },

    select(event: Event): void {
        this.theme = (event.target as HTMLInputElement).value as ThemePreference;

        if (this.isSystem) {
            localStorage.removeItem(storageKey);
        } else {
            localStorage.setItem(storageKey, this.theme);
        }

        console.debug('theme: ' + this.theme);

        this.apply();
    },

    apply(): void {
        document.documentElement.setAttribute('data-bs-theme', this.isSystem ? getSystemScheme() : this.theme);
    },
});
