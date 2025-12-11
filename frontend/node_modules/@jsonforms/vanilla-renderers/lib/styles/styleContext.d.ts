import React from 'react';
import { StyleDef } from './styles';
export interface StyleContext {
    styles: StyleDef[];
}
export declare const JsonFormsStyleContext: React.Context<StyleContext>;
export declare const useStyleContext: () => StyleContext;
export declare const useStyles: () => StyleDef[];
