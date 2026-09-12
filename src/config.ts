import {Category} from "./transaction";
import {TreeNode} from "./tree";

export type Config = {
    scalingFactor: number;
    threshold: number; // unscaled
    currency: string;
    sortKey: string;
    mainNodeId: number;
    categories: Map<number,Category>;
    nodePositions: Record<string,number>; // category id => dragged chart position, see SankeyChartNode.position
    chartData: Array<TreeNode>;
}

/** The `config` store as registered in app.ts: the shared {@link Config} plus its persistence internals. */
export type ConfigStore = Config & {
    _categories: Array<Category>; // Alpine.$persist does not work with Maps, so the categories are persisted as an array
    init(): void;
}

export type ErrorStore = {
    errorMessage: string|null;
    setMessage(message: string): void;
    clear(): void;
}

const defaultConfig: Config = {scalingFactor: 1, threshold: 0, currency: 'EUR', sortKey: 'custom.category.path', mainNodeId: 1, categories: new Map(), nodePositions: {}, chartData: []};
export default defaultConfig;
