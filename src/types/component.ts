import { RenderTaskQueue } from '../platform-browser/render/render-task-queue';
import { DirectiveList, IDirective } from './directive';
import { Watcher } from '../watcher';
import { CompileUtil } from '../platform-browser';
import { Injector } from '../di';

export type ComponentList<C> = {
    dom: Node;
    props: any;
    scope: C;
    constructorFunction: Function;
    hasRender: boolean;
};

export type SetState = (newState: any) => void;

export interface IComponent<State = any, Props = any, Vm = any> {
    state?: State | any;
    props?: Props | any;
    compileUtil: CompileUtil;
    renderDom?: Element;
    $vm?: Vm | any;
    stateWatcher?: Watcher;

    $template?: string;
    $declarationMap?: Map<string, Function>;
    $providerList?: Map<Function | string, Function | any>;
    $componentList?: ComponentList<IComponent<any, any, any>>[];
    $directiveList?: DirectiveList<IDirective<any, any>>[];
    otherInjector?: Injector;

    renderTaskQueue?: RenderTaskQueue;

    nvOnInit?(): void;
    watchData?(): void;
    nvBeforeMount?(): void;
    nvAfterMount?(): void;
    nvOnDestory?(): void;
    nvHasRender?(): void;
    nvWatchState?(oldState?: any): void;
    nvRouteChange?(lastRoute: string, newRoute: string): void;
    nvReceiveProps?(nextProps: Props): void;
    render?(): Promise<IComponent<State, Props, Vm>>;
    reRender?(): Promise<IComponent<State, Props, Vm>>;
}
