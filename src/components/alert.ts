import Alpine from '@alpinejs/csp';

export default () => ({
    get message(): string {
        return Alpine.store('error').errorMessage;
    },

    reset(): void {
        localStorage.clear();
        window.location.reload();
    }
});