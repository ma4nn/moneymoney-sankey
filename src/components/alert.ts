import Alpine from '@alpinejs/csp';
import {resetApp} from "../helper";

export default () => ({
    get message(): string {
        return Alpine.store('error').errorMessage;
    },

    reset(): void {
        resetApp();
    }
});