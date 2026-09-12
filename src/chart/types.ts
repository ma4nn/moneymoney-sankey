import { Category } from "../transaction";

// library-agnostic chart contract; swap the chart library by adding another renderer implementation (see ./index.ts)

export interface SankeyChartNode {
    id: string; // category id as string
    name: string;
    isMain: boolean;
    // dragged position as a fraction (0..1) of the chart height, undefined leaves it to the layout
    position?: number;
}

export interface SankeyChartLink {
    from: string;
    to: string;
    weight: number; // always positive, the sign lives in custom.real
    categoryId: number; // the non-main end of the link
    outgoing?: boolean;
    // persisted Config.sortKey paths (e.g. 'custom.category.path') point into this structure
    custom: {
        real: number; // signed original value
        category?: Category;
    };
}

export interface SankeyChartData {
    nodes: Array<SankeyChartNode>;
    links: Array<SankeyChartLink>;
    colors: Map<string, string>; // node id => css color value
}

// callbacks for the renderer to delegate content and interactions back to the app; returned strings are plain HTML
export interface SankeyChartHooks {
    onLinkClick(link: SankeyChartLink): void;
    // a node was dragged, null resets it to the automatic layout
    onNodeDrag(nodeId: string, position: number|null): void;
    nodeLabel(nodeId: string): string;
    nodeTooltip(nodeId: string): string;
    linkTooltip(link: SankeyChartLink): string;
    nodeValue(nodeId: string): number; // scaled value, exposed as data-value for the e2e tests
    formatValue(value: number): string; // for library-internal output (e.g. accessibility)
}

export interface SankeyChartRenderer {
    // node set is considered stable for the chart's lifetime; call render() to show the links
    mount(container: HTMLElement, data: SankeyChartData, hooks: SankeyChartHooks): void;
    render(data: SankeyChartData): void;
}
