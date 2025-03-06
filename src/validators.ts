import { Category } from "./category";
import { Config } from "./config";
import { numberFormat } from "./helper";
import {SankeyNode} from "./sankey";

interface ValidatorInterface {
    message(): string;
    valid(): boolean;
}

export class NodeValidator {
    public messages: Array<string> = [];
    private validators: Array<ValidatorInterface>;
    static warningSign = '⚠️ ';

    constructor(node: any, config: Config) {
        this.validators = [
            new BudgetValidator(node, config)
        ];
    }

    public validate(): boolean {
        this.validators.filter(validator => ! validator.valid()).forEach(validator =>
            this.messages.push(NodeValidator.warningSign + validator.message() + "\n")
        );

        return this.messages.length === 0;
    }
}

class BudgetValidator implements ValidatorInterface {
    private readonly category: Category;
    private readonly scalingFactor: number;
    private readonly node: any;

    constructor(node: SankeyNode, config: Config) {
        this.node = node;
        this.category = config.categories.get(node.categoryId);
        this.scalingFactor = config.scalingFactor;
    }

    public valid(): boolean {
        return this.getBudget() === null || this.getBudget() >= this.getValue();
    }

    public message(): string {
        return 'Budget um ' + numberFormat(this.getValue() - this.getBudget()) + ' überschritten';
    }

    private getValue(): number {
        return 'getSum' in this.node ? this.node.getSum()/this.scalingFactor : 0;
    }

    private getBudget(): number|null {
        if (typeof this.category == 'undefined' || typeof this.category?.budget == 'undefined' || this.category?.budget === null) {
            return null;
        }

        return this.category.budget * this.scalingFactor;
    }
}