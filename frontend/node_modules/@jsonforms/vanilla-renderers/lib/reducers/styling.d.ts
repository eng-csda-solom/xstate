import { StyleDef } from '../styles';
export declare const findStyle: (styles: StyleDef[]) => (style: string, ...args: any[]) => string[];
export declare const findStyleAsClassName: (styles: StyleDef[]) => (style: string, ...args: any[]) => string;
export declare const stylingReducer: (state: StyleDef[], action: any) => any;
