import Alpine from '@alpinejs/csp';
import LZString from 'lz-string';
import Tree from '../tree';
import {Category} from "../transaction";
import {Config} from "../config";
import {resetApp} from "../helper";

export default (tree: Tree) => ({
    get categories(): Map<number,Category> {
        return this.config.categories;
    },

    get scaling(): number {
        return this.config.scalingFactor;
    },

    get config(): Config {
        return Alpine.store('config');
    },

    get sankeymaticUrl(): string {
        // @see https://github.com/nowthis/sankeymatic/blob/c49af0fb377705c65d1b8be0c0f0ea79f07f195e/build/sankeymatic.js#L1878
        let data = LZString.compressToEncodedURIComponent(this.buildData());
        const urlInputsParam = 'i';

        return `https://sankeymatic.com/build/?${urlInputsParam}=${encodeURIComponent(data).replace(/-/g, '%2D')}`;
    },

    reset(): void {
        resetApp();
    },

    buildData(): string {
        let data: Array<string> = [];
        [...tree.preOrderTraversal()].filter(node => node.parent).forEach(node => {
            const parentCategory: string = this.categories.get(node.parent.key)?.name;
            const nodeCategory: string = this.categories.get(node.key)?.name;

            const node1 = node.value < 0 ? parentCategory : nodeCategory;
            const node2 = node.value < 0 ? nodeCategory : parentCategory;

            data.push(`${node1} [${Math.abs(node.value/this.scaling).toFixed(2)}] ${node2}`);
        });

        return data.join("\n");
    }
});