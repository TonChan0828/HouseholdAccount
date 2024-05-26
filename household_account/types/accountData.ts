export type IncomeOrExpenditure = "INCOME" | "EXPENDITURE";

export type AccountData = {
    id: number;
    name: string;
    category:string;
    price: number;
    balanceOfPayment: string;
};

export type CategoryData = {
    category: string;
    categoryId: number;
    price: number;
};