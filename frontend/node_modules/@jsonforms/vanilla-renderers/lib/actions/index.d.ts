export declare const REGISTER_STYLE = "REGISTER_STYLE";
export declare const REGISTER_STYLES = "REGISTER_STYLES";
export declare const UNREGISTER_STYLE = "UNREGISTER_STYLE";
export declare const registerStyle: (styleName: string, classNames: string[]) => {
    type: string;
    name: string;
    classNames: string[];
};
export declare const unregisterStyle: (styleName: string) => {
    type: string;
    name: string;
};
export declare const registerStyles: (styleDefs: {
    name: string;
    classNames: string[];
}[]) => {
    type: string;
    styles: {
        name: string;
        classNames: string[];
    }[];
};
