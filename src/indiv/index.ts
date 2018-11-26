import { INvModule, IComponent, ElementRef } from '../types';

import { Utils } from '../utils';
import { factoryCreator, Injector } from '../di';
import { factoryModule } from '../nv-module';
import { render } from '../platform-browser';

export { ElementRef } from '../types';

export interface IMiddleware<ES> {
  bootstrap(vm: ES): void;
}

const utils = new Utils();

/**
 * main: for new InDiv
 *
 * @class InDiv
 */
export class InDiv {
  private modalList: IMiddleware<InDiv>[] = [];
  private rootDom: Element;
  private $routeDOMKey: string = 'router-render';
  private $rootModule: INvModule = null;
  private $declarations: Function[];
  private bootstrapComponent: IComponent;
  private render: () => Promise<IComponent>;
  private reRender: () => Promise<IComponent>;

  constructor() {
    if (!utils.isBrowser()) return;

    this.rootDom = document.querySelector('#root');

    // render,reRender for Component
    // developer can use function use(modal: IMiddleware<InDiv>): number to change render and reRender
    this.render = render;
    this.reRender = render;
  }

  /**
   * for using middleware and use bootstrap method of middleware
   *
   * @param {IMiddleware<InDiv>} modal
   * @returns {number}
   * @memberof InDiv
   */
  public use(modal: IMiddleware<InDiv>): number {
    modal.bootstrap(this);
    this.modalList.push(modal);
    return this.modalList.length - 1;
  }
  
/**
 * set component Render function 
 *
 * @template R
 * @template Re
 * @param {R} [render]
 * @param {Re} [reRender]
 * @memberof InDiv
 */
  public setComponentRender<S = any, P = any, V = any>(render: () => Promise<IComponent<S, P, V>>, reRender?: () => Promise<IComponent<S, P, V>>): void {
    this.render = render;
    this.reRender = reRender ? reRender : render;
  }

  /**
   * get component Render function 
   *
   * @returns {{ render: () => Promise<IComponent>, reRender: () => Promise<IComponent> }}
   * @memberof InDiv
   */
  public getComponentRender(): { render: () => Promise<IComponent>, reRender: () => Promise<IComponent> } {
    return {
      render: this.render,
      reRender: this.reRender,
    };
  }

  /**
   * return component instance of root module's bootstrap
   *
   * @returns {IComponent}
   * @memberof InDiv
   */
  public getBootstrapComponent(): IComponent {
    return this.bootstrapComponent;
  }

  /**
   * set route's DOM tag name
   *
   * @param {string} routeDOMKey
   * @memberof InDiv
   */
  public setRouteDOMKey(routeDOMKey: string): void {
    this.$routeDOMKey = routeDOMKey;
  }
  
  /**
   * get route's DOM tag name
   *
   * @returns {string}
   * @memberof InDiv
   */
  public getRouteDOMKey(): string {
    return this.$routeDOMKey;
  }

  /**
   * get root module in InDiv
   *
   * @returns {INvModule}
   * @memberof InDiv
   */
  public getRootModule(): INvModule {
    return this.$rootModule;
  }

  /**
   * get root module in root module
   *
   * @returns {Function[]}
   * @memberof InDiv
   */
  public getDeclarations(): Function[] {
    return this.$declarations;
  }

  /**
   * bootstrap NvModule
   * 
   * if not use Route it will be used
   *
   * @param {Function} Esmodule
   * @returns {void}
   * @memberof InDiv
   */
  public bootstrapModule(Esmodule: Function): void {
    if (!Esmodule) throw new Error('must send a root module');

    this.$rootModule = factoryModule(Esmodule, null, this);
    this.$declarations = [...this.$rootModule.$declarations];
  }

  /**
   * init InDiv and renderModuleBootstrap()
   *
   * @returns {void}
   * @memberof InDiv
   */
  public init(): void {
    if (!utils.isBrowser()) return;

    if (!this.$rootModule) throw new Error('must use bootstrapModule to declare a root NvModule before init');
    this.renderModuleBootstrap();
  }

  /**
   * expose function for render Component
   * 
   * if otherModule don't has use rootModule
   * 
   * if has otherInjector, build component will use otherInjector instead of rootInjector
   *
   * @param {Function} BootstrapComponent
   * @param {Element} renderDOM
   * @param {INvModule} [otherModule]
   * @param {Injector} [otherInjector]
   * @returns {Promise<IComponent>}
   * @memberof InDiv
   */
  public async renderComponent(BootstrapComponent: Function, renderDOM: Element, otherModule?: INvModule, otherInjector?: Injector): Promise<IComponent> {
    const provideAndInstanceMap = new Map();
    provideAndInstanceMap.set(InDiv, this);
    provideAndInstanceMap.set(ElementRef, renderDOM);

    const component: any = factoryCreator(BootstrapComponent, otherInjector, provideAndInstanceMap);

    component.$vm = this;

    if (otherModule) {
      otherModule.$declarations.forEach((findDeclaration: Function) => {
        if (!component.$declarationMap.has((findDeclaration as any).$selector)) component.$declarationMap.set((findDeclaration as any).$selector, findDeclaration);
      });
    } else {
      this.$rootModule.$declarations.forEach((findDeclaration: Function) => {
        if (!component.$declarationMap.has((findDeclaration as any).$selector)) component.$declarationMap.set((findDeclaration as any).$selector, findDeclaration);
      });
    }

    component.render = this.render.bind(component);
    component.reRender = this.reRender.bind(component);
    component.otherInjector = otherInjector;

    if (component.nvOnInit) component.nvOnInit();
    if (component.watchData) component.watchData();
    if (!component.$template) throw new Error('must decaler this.$template in bootstrap()');
    const template = component.$template;
    if (template && typeof template === 'string' && renderDOM) {
      if (component.nvBeforeMount) component.nvBeforeMount();

      const _component = await this.replaceDom(component, renderDOM);
      if (_component.nvAfterMount) _component.nvAfterMount();
      return _component;

    } else {
      throw new Error('renderBootstrap failed: template or rootDom is not exit');
    }
  }

  /**
   * render NvModule Bootstrap
   *
   * @returns {void}
   * @memberof InDiv
   */
  private async renderModuleBootstrap(): Promise<IComponent> {
    if (!this.$rootModule.$bootstrap) throw new Error('need bootstrap for render Module Bootstrap');
    const BootstrapComponent = this.$rootModule.$bootstrap;
    this.bootstrapComponent = await this.renderComponent(BootstrapComponent, this.rootDom);
    return this.bootstrapComponent;
  }

  /**
   * render adn replace DOM
   *
   * @param {IComponent} component
   * @param {Element} renderDOM
   * @returns {Promise<IComponent>}
   * @memberof InDiv
   */
  private replaceDom(component: IComponent, renderDOM: Element): Promise<IComponent> {
    component.renderDom = renderDOM;
    return component.render();
  }
}
