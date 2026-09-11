import Alpine from '@alpinejs/csp';
import LZString from 'lz-string';
import {TreeNode, TreeNodeWithParent} from '../tree';
import {Category} from "../transaction";
import {Config} from "../config";
import {resetApp} from "../helper";

export default () => ({
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
        const data = this.buildSankeymaticData();
        const urlInputsParam = 'i';

        if (data.length === 0) {
            return '';
        }

        // @see https://github.com/nowthis/sankeymatic/blob/c49af0fb377705c65d1b8be0c0f0ea79f07f195e/build/sankeymatic.js#L1878
        return `https://sankeymatic.com/build/?${urlInputsParam}=${encodeURIComponent(LZString.compressToEncodedURIComponent(data)).replace(/-/g, '%2D')}`;
    },

    reset(): void {
        resetApp();
    },

    confirmSankeymaticExport(event: Event): void {
        if (! window.confirm('Beim Öffnen in SankeyMATIC werden die Diagrammdaten an den externen Anbieter (sankeymatic.com) übertragen.\n\nFortfahren?')) {
            event.preventDefault();
        }
    },

    buildSankeymaticData(): string {
        const data: Array<string> = [];

        this.config.chartData.filter((node: TreeNode): node is TreeNodeWithParent => node.parent !== null).forEach((node: TreeNodeWithParent) => {
            const parentCategory = this.categories.get(node.parent.key)?.name ?? '';
            const nodeCategory = this.categories.get(node.key)?.name ?? '';

            const node1 = node.value < 0 ? parentCategory : nodeCategory;
            const node2 = node.value < 0 ? nodeCategory : parentCategory;

            data.push(`${node1} [${Math.abs(node.value/this.scaling).toFixed(2)}] ${node2}`);
        });

        return data.join("\n");
    }
});