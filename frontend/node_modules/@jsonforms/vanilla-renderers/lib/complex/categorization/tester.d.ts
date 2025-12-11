import { Categorization, Category, RankedTester } from '@jsonforms/core';
export declare const isCategorization: (category: Category | Categorization) => category is Categorization;
export declare const categorizationTester: RankedTester;
