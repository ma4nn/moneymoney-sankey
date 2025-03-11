import {Category} from "./transaction";

export type Config = {
    scalingFactor: number;
    threshold: number; // unscaled
    currency: string;
    categories: Map<number,Category>;
    mainNodeId: number;
}

const defaultConfig: Config = {scalingFactor: 1, threshold: 0, currency: 'EUR', categories: new Map(), mainNodeId: 1};
export default defaultConfig;
