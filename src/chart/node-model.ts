import { SankeyChartLink } from "./types";
import { numberFormat, numberFormatColored } from "../helper";

export interface NodeModelContext {
    links: Array<SankeyChartLink>;
    mainNodeId: number;
    scaling: number;
    nameOf(nodeId: string): string;
}

// read model for a sankey node, computed purely from the displayed link list — no chart library involved
export class SankeyNodeModel { // @todo use accessors
    public readonly id: string;
    public readonly name: string;
    public readonly categoryId: number;

    private readonly context: NodeModelContext;

    constructor(nodeId: string, context: NodeModelContext) {
        this.id = nodeId;
        this.context = context;
        this.name = context.nameOf(nodeId);
        this.categoryId = parseInt(nodeId);
    }

    get isMain(): boolean {
        return Number(this.id) === this.context.mainNodeId;
    }

    public toString(): string {
        const format = this.isMain ? numberFormatColored : numberFormat;
        return `${this.name}: ${this.getValue() == 0 ? '' : format(this.getValue())}`;
    }

    public getValue(): number {
        return this.isMain ? this.getTotalIncomingWeight() - this.getTotalOutgoingWeight() : this.getSum();
    }

    // mirrors Highcharts' node.getSum(): max of incoming and outgoing sum
    public getSum(): number {
        return Math.max(this.getTotalIncomingWeight(), this.getTotalOutgoingWeight());
    }

    public getPercentage(): number|null {
        const linksTo = this.getLinksTo();
        if (linksTo.length === 0) {
            return null;
        }

        const parentNode = new SankeyNodeModel(linksTo[0].from, this.context);

        return (this.getValue() / parentNode.getTotalOutgoingWeight());
    }

    public getLinksFrom(): Array<SankeyChartLink> {
        return this.context.links.filter(link => link.from === this.id);
    }

    public getLinksTo(): Array<SankeyChartLink> {
        return this.context.links.filter(link => link.to === this.id);
    }

    public getTotalIncomingWeight(): number {
        return this.getLinksTo().map(link => link.weight).reduce((pv, cv) => pv + cv, 0) / this.context.scaling;
    }

    public getTotalOutgoingWeight(): number {
        return this.getLinksFrom().map(link => link.weight).reduce((pv, cv) => pv + cv, 0) / this.context.scaling;
    }
}
