import {Category} from "./category";

const DATA_TYPE_MAP: string = 'Map';
const STORAGE_KEY = 'sankey-config-v2'; // increase this version number if config is not backwards compatible

export type Config = {
    scalingFactor: number;
    threshold: number; // unscaled
    currency: string;
    categories: Map<number,Category>;
}

let defaultConfig: Config = {scalingFactor: 1, threshold: 0, currency: 'EUR', categories: new Map()};
export default defaultConfig;

export function save(config: Config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config, mapReplacer));
}

export function load(): Config|null {
    const jsonConfig = localStorage.getItem(STORAGE_KEY);
    return jsonConfig === null ? null : JSON.parse(jsonConfig, mapReviver);
}

function mapReplacer(key: string, value: any): any {
    if (value instanceof Map) {
        return {
            dataType: DATA_TYPE_MAP,
            value: Array.from(value.entries()),
        };
    } else {
        return value;
    }
}

function mapReviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null) {
        if (value.dataType === DATA_TYPE_MAP) {
            return new Map(value.value);
        }
    }
    return value;
}
