/**
 * A style associates a name with a list of CSS class names or a function that calculates them.
 */
export interface StyleDef {
    name: string;
    classNames: string[] | ((...args: any[]) => string[]);
}
/**
 * Pre-defined vanilla styles.
 *
 * @type {{name: string; classNames: string[]}[]}
 */
export declare const vanillaStyles: StyleDef[];
