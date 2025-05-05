import {Category} from "./transaction";
import {TreeNode} from "./tree";

export type Config = {
    scalingFactor: number;
    threshold: number; // unscaled
    currency: string;
    sortKey: string;
    categories: Map<number,Category>;
    chartData: Array<TreeNode>;
}

const defaultConfig: Config = {scalingFactor: 1, threshold: 0, currency: 'EUR', sortKey: 'custom.category.path', categories: new Map(), chartData: []};
export default defaultConfig;
