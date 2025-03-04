import {Category} from "./category";

export type Config = {
    excludedCategoryIds: number[];
    scalingFactor: number;
    threshold: number;
    currency: string;
    categories: Map<number,Category>;
}

export function save(config: Config) {
    localStorage.setItem('config', JSON.stringify(config));
}

export function load(): Config|null {
    const jsonConfig = localStorage.getItem('config');

    return jsonConfig === null ? null : JSON.parse(jsonConfig);
}