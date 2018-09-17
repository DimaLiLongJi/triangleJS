export interface IVnode {
    tagName?: string;
    node?: DocumentFragment | Element;
    parentNode?: Node;
    attributes?: TAttributes[];
    nodeValue?: string | null;
    childNodes?: IVnode[] | any[];
    type?: string;
    value?: string | number;
    repeatData?: any;
    shouldRemove?: boolean;
}

export type TAttributes = {
    name: string;
    value: string;
};

export interface IPatchList {
    type?: number;
    node?: DocumentFragment | Element;
    parentNode?: Node;
    newNode?: DocumentFragment | Element;
    oldVnode?: DocumentFragment | Element;
    newValue?: TAttributes | string | number | boolean;
    oldValue?: TAttributes | string | number | boolean;
}

export interface IParseToVnode {
    (node: DocumentFragment | Element): IVnode;
}

export interface IDiffVnode {
    (oldVnode: IVnode, newVnode: IVnode, patchList: IPatchList[]): void;
}

export interface IRenderVnode {
    (patchList: IPatchList[]): void;
}

export interface IVirtualDOM {
    parseToVnode: IParseToVnode;
    diffVnode: IDiffVnode;
    renderVnode: IRenderVnode;
}
