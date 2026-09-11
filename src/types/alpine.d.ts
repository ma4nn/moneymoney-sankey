// Neither Alpine package ships declarations; both borrow @types/alpinejs.
// No top-level imports here — that is what makes `declare module` declare rather than augment.

declare module '@alpinejs/csp' {
    // the CSP build only swaps core Alpine's evaluator, so the JS API is identical — but the types
    // are wider than the build: string-expression APIs (evaluate, bind) compile, then break at runtime
    export { default, Magics } from 'alpinejs';
}

declare module '@alpinejs/persist' {
    const persist: import('alpinejs').PluginCallback;
    export default persist;
}
