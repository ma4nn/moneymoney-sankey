import Alpine from '@alpinejs/csp';
import {ErrorStore} from "../config";
import {resetApp} from "../helper";

export default () => ({
    get message(): string|null {
        return Alpine.store<ErrorStore>('error').errorMessage;
    },

    reset(): void {
        resetApp();
    }
});