// Augments @types/alpinejs — the top-level import is what makes `declare module` augment rather than declare.
import { ConfigStore, ErrorStore } from '../config';

declare module 'alpinejs' {
    // registering the shapes here means call sites no longer restate the store type
    interface Stores {
        config: ConfigStore;
        error: ErrorStore;
    }

    interface Alpine {
        // not @types/alpinejs__persist: it types $persist as an interceptor, which store() cannot
        // unwrap. Alpine resolves interceptors before init(), so callers really do see T.
        $persist<T>(value: T): T;
    }
}
