import { stylingReducer } from './styling';
import { JsonFormsState } from '@jsonforms/core';
export { stylingReducer };
export declare const getStyle: (state: JsonFormsState) => (styleName: string, ...args: any[]) => string[];
export declare const getStyleAsClassName: (state: JsonFormsState) => (styleName: string, ...args: any[]) => string;
