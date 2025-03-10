import Tree, {TreeNode} from "./tree";

export type Category = {
    id: number;
    name: string;
    active: boolean;
    budget?: number;
}

export type Transaction = {
    id: number;
    date: number;
    amount: number;
    currency: string,
    category: string;
    account: string;
}

export class TransactionsManager {
    transactions: Array<Transaction>;
    startDate: Date;
    endDate: Date;

    constructor(transactions: Array<Transaction>) {
        this.transactions = transactions;
        this.startDate = this.transactions.map(obj => new Date(obj.date * 1000)).reduce((min, current) => (current < min ? current : min), new Date());
        this.endDate = this.transactions.map(obj => new Date(obj.date * 1000)).reduce((max, current) => (current > max ? current : max), new Date());
    }

    get accounts(): Array<string> {
        return [...new Set(this.transactions.map(obj => obj.account).filter(account => account))]
    }

    calculateNumberOfMonths(): number {
        const startYear = this.startDate.getFullYear();
        const startMonth = this.startDate.getMonth();
        const endYear = this.endDate.getFullYear();
        const endMonth = this.endDate.getMonth();

        return (endYear - startYear) * 12 + (endMonth - startMonth);
    }
}

export class CategoryTree {
    public categories: Map<number,Category> = new Map();
    public categoryTree: Tree;
    protected categoryPathSeparator: string;

    constructor(mainNodeId: number, categoryPathSeparator: string) {
        this.categoryTree = new Tree(new TreeNode(mainNodeId, 0));
        this.categories.set(mainNodeId, {id: mainNodeId, name: 'Saldo', active: true});
        this.categoryPathSeparator = categoryPathSeparator;
    }

    fromTransactions(transactions: Array<Transaction>): void {
        transactions.forEach(transaction => {
            let parentCategoryId = this.categoryTree.root.key;
            const path = [];
            transaction.category.split(this.categoryPathSeparator).forEach(categoryName => {
                path.push(categoryName);
                let categorySubPath = path.join(this.categoryPathSeparator);

                let categoryId = generateCategoryIdFromPath(categorySubPath);
                let existingNode: TreeNode = this.categoryTree.find(categoryId);
                if (existingNode === null) {
                    this.categoryTree.insert(parentCategoryId, categoryId, transaction.amount);
                    this.categories.set(categoryId, {id: categoryId, name: categoryName, active: true});
                } else if (categorySubPath === transaction.category) { // full category path already exists
                    existingNode.value += transaction.amount;
                }

                parentCategoryId = categoryId;
            });
        });
    }
}

export class MoneyMoneyCategoryTree extends CategoryTree {
    constructor(mainNodeId: number) {
        super(mainNodeId, "\\\\");
    }
}

function generateCategoryIdFromPath(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i); // hash * 31 + charCodeAt
        hash |= 0;  // Convert to a 32-bit integer
    }

    return Math.abs(hash);
}