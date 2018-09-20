import { TRouter, IInDiv, IComponent, ComponentList } from '../types';

import Utils from '../Utils';
import KeyWatcher from '../KeyWatcher';

export { TRouter } from '../types';

/**
 * route for InDiv
 *
 * @export
 * @class Router
 */
export class Router {
  public routes: TRouter[];
  public routesList: TRouter[];
  public currentUrl: string;
  public lastRoute: string;
  public rootDom: Element;
  public utils: Utils;
  public $rootPath: string;
  public hasRenderComponentList: IComponent[];
  public needRedirectPath: string;
  public $vm: IInDiv;
  public watcher: KeyWatcher;
  public renderRouteList: string[];
  public routeChange?: (lastRoute?: string, nextRoute?: string) => void;

  constructor() {
    this.routes = [];
    this.routesList = [];
    this.currentUrl = '';
    this.lastRoute = null;
    this.rootDom = null;
    this.utils = new Utils();
    this.$rootPath = '/';
    this.hasRenderComponentList = [];
    this.needRedirectPath = null;
    this.$vm = null;
    this.watcher = null;
    this.renderRouteList = [];
  }

  /**
   * bootstrap and init watch $esRouteParmasObject in InDiv
   *
   * @param {IInDiv} vm
   * @returns {void}
   * @memberof Router
   */
  public bootstrap(vm: IInDiv): void {
      this.$vm = vm;
      this.$vm.setRootPath(this.$rootPath);
      this.$vm.$canRenderModule = false;
      this.$vm.$routeDOMKey = 'router-render';

      if (!this.utils.isBrowser()) return;
      window.addEventListener('load', this.refresh.bind(this), false);
      window.addEventListener('popstate', () => {
        let path;
        if (this.$rootPath === '/') {
          path = location.pathname || '/';
        } else {
          path = location.pathname.replace(this.$rootPath, '') === '' ? '/' : location.pathname.replace(this.$rootPath, '');
        }
        this.$vm.$esRouteObject = {
          path,
          query: {},
          data: null,
        };
        this.$vm.$esRouteParmasObject = {};
      }, false);
    }

  /**
   * set rootDom
   *
   * @param {TRouter[]} arr
   * @returns {void}
   * @memberof Router
   */
  public init(arr: TRouter[]): void {
    if (!this.utils.isBrowser()) return;

    if (arr && arr instanceof Array) {
      const rootDom = document.querySelector('#root');
      this.rootDom = rootDom || null;
      this.routes = arr;
      this.routesList = [];
    } else {
      console.error('route error: no routes exit');
    }
  }

  public setRootPath(rootPath: string): void {
    if (rootPath && typeof rootPath === 'string') {
      this.$rootPath = rootPath;
    } else {
      console.error('route error: rootPath is not defined or rootPath must be a String');
    }
  }

  /**
   * redirectTo a path
   *
   * @param {string} redirectTo
   * @memberof Router
   */
  public redirectTo(redirectTo: string): void {
    const rootPath = this.$rootPath === '/' ? '' : this.$rootPath;
    history.replaceState(null, null, `${rootPath}${redirectTo}`);
    this.$vm.$esRouteObject = {
      path: redirectTo || '/',
      query: {},
      data: null,
    };
    this.$vm.$esRouteParmasObject = {};
  }

  /**
   * refresh if not watch $esRouteObject
   *
   * @memberof Router
   */
  public refresh(): void {
    if (!this.$vm.$esRouteObject || !this.watcher) {
      let path;
      if (this.$rootPath === '/') {
        path = location.pathname || '/';
      } else {
        path = location.pathname.replace(this.$rootPath, '') === '' ? '/' : location.pathname.replace(this.$rootPath, '');
      }
      this.$vm.$esRouteObject = {
        path,
        query: {},
        data: null,
      };
      this.$vm.$esRouteParmasObject = {};
      this.watcher = new KeyWatcher(this.$vm, '$esRouteObject', this.refresh.bind(this));
    }
    this.currentUrl = this.$vm.$esRouteObject.path || '/';
    this.routesList = [];
    this.renderRouteList = this.currentUrl === '/' ? ['/'] : this.currentUrl.split('/');
    this.renderRouteList[0] = '/';
    this.distributeRoutes();
  }

  /**
   * distribute routes and decide insert or general Routes
   *
   * @memberof Router
   */
  public distributeRoutes(): void {
    if (this.lastRoute && this.lastRoute !== this.currentUrl) {
      // has rendered
      this.$vm.$esRouteParmasObject = {};
      this.insertRenderRoutes();
    } else {
      // first render
      this.generalDistributeRoutes();
    }
    if (this.routeChange) this.routeChange(this.lastRoute, this.currentUrl);
    this.lastRoute = this.currentUrl;
    if (this.needRedirectPath) {
      this.redirectTo(this.needRedirectPath);
      this.needRedirectPath = null;
    }
  }

  /**
   * insert Routes and render
   * 
   * if has rendered Routes, it will find which is different and render it
   *
   * @returns {void}
   * @memberof Router
   */
  public insertRenderRoutes(): void {
    const lastRouteList = this.lastRoute === '/' ? ['/'] : this.lastRoute.split('/');
    lastRouteList[0] = '/';

    for (let index = 0; index < this.renderRouteList.length; index++) {
      const path = this.renderRouteList[index];
      if (index === 0) {
        const rootRoute = this.routes.find(route => route.path === `${path}` || /^\/\:.+/.test(route.path));
        if (!rootRoute) {
          console.error('route error: wrong route instantiation in insertRenderRoutes:', this.currentUrl);
          return;
        }
        this.routesList.push(rootRoute);
      } else {
        const lastRoute = this.routesList[index - 1].children;
        if (!lastRoute || !(lastRoute instanceof Array)) {
          console.error('route error: routes not exit or routes must be an array!');
          return;
        }
        const route = lastRoute.find((r: TRouter) => r.path === `/${path}` || /^\/\:.+/.test(r.path));
        if (!route) {
          console.error('route error: wrong route instantiation:', this.currentUrl);
          return;
        }
        this.routesList.push(route);
      }

      if (path !== lastRouteList[index]) {
        const needRenderRoute = this.routesList[index];
        if (!needRenderRoute) {
          console.error('route error: wrong route instantiation in insertRenderRoutes:', this.currentUrl);
          return;
        }

        const needRenderComponent = this.$vm.$components.find((component: any) => component.$selector === needRenderRoute.component);
        const renderDom = document.querySelectorAll('router-render')[index - 1];

        if (!needRenderRoute.component && !needRenderRoute.redirectTo) {
          console.error(`route error: path ${needRenderRoute.path} need a component which has children path or need a  redirectTo which has't children path`);
          return;
        }

        if (/^\/\:.+/.test(needRenderRoute.path) && !needRenderRoute.redirectTo) {
          const key = needRenderRoute.path.split('/:')[1];
          this.$vm.$esRouteParmasObject[key] = path;
        }

        if (needRenderComponent) {
          const component = this.instantiateComponent(needRenderComponent, renderDom);
          if (component) {
            if (this.hasRenderComponentList[index]) {
              this.hasRenderComponentList[index + 1] = this.hasRenderComponentList[index];
              this.hasRenderComponentList[index] = component;
            }
            if (!this.hasRenderComponentList[index]) this.hasRenderComponentList[index] = component;
          }

          this.routerChangeEvent(index);
        }

        if (needRenderRoute.redirectTo && /^\/.*/.test(needRenderRoute.redirectTo) && (index + 1) === this.renderRouteList.length) {
          this.needRedirectPath = needRenderRoute.redirectTo;
          return;
        }
      }

      // add parmas in $esRouteParmasObject
      if (path === lastRouteList[index]) {
        const needRenderRoute = this.routesList[index];
        if (/^\/\:.+/.test(needRenderRoute.path) && !needRenderRoute.redirectTo) {
          const key = needRenderRoute.path.split('/:')[1];
          this.$vm.$esRouteParmasObject[key] = path;
        }
      }

      if (index === (this.renderRouteList.length - 1) && index < (lastRouteList.length - 1)) {
        const renderDom = document.querySelectorAll('router-render')[index];
        this.routerChangeEvent(index);

        if (renderDom && renderDom.hasChildNodes()) renderDom.removeChild(renderDom.childNodes[0]);

        const needRenderRoute = this.routesList[index];
        if (needRenderRoute.redirectTo && /^\/.*/.test(needRenderRoute.redirectTo) && (index + 1) === this.renderRouteList.length) {
          this.needRedirectPath = needRenderRoute.redirectTo;
          return;
        }
      }
    }
  }

  /**
   * render Routes
   * 
   * first render
   *
   * @returns {void}
   * @memberof Router
   */
  public generalDistributeRoutes(): void {
    for (let index = 0; index < this.renderRouteList.length; index++) {
      const path = this.renderRouteList[index];
      if (index === 0) {
        const rootRoute = this.routes.find(route => route.path === `${path}` || /^\/\:.+/.test(route.path));
        if (!rootRoute) {
          console.error('route error: wrong route instantiation in generalDistributeRoutes:', this.currentUrl);
          return;
        }

        let FindComponent = null;
        if (this.$vm.$rootModule.$components.find((component: any) => component.$selector === rootRoute.component)) {
          FindComponent = this.$vm.$rootModule.$components.find((component: any) => component.$selector === rootRoute.component);
        } else {
          console.error(`route error: path ${rootRoute.path} is undefined`);
          return;
        }

        if (/^\/\:.+/.test(rootRoute.path)) {
          const key = rootRoute.path.split('/:')[1];
          this.$vm.$esRouteParmasObject[key] = path;
        }

        if (!this.utils.isBrowser()) return;
        const rootDom = document.querySelector('#root');
        this.routesList.push(rootRoute);

        const component = this.instantiateComponent(FindComponent, rootDom);
        // 因为没有 所有要push进去
        if (component) this.hasRenderComponentList.push(component);

        if (index === this.renderRouteList.length - 1) this.routerChangeEvent(index);

        if (rootRoute.redirectTo && /^\/.*/.test(rootRoute.redirectTo) && (index + 1) === this.renderRouteList.length) {
          this.needRedirectPath = rootRoute.redirectTo;
          this.renderRouteList.push(rootRoute.redirectTo);
          return;
        }
      } else {
        const lastRoute = this.routesList[index - 1].children;
        if (!lastRoute || !(lastRoute instanceof Array)) {
          console.error('route error: routes not exit or routes must be an array!');
        }
        const route = lastRoute.find(r => r.path === `/${path}` || /^\/\:.+/.test(r.path));
        if (!route) {
          console.error('route error: wrong route instantiation:', this.currentUrl);
          return;
        }

        let FindComponent = null;
        if (this.$vm.$rootModule.$components.find((component: any) => component.$selector === route.component)) {
          FindComponent = this.$vm.$rootModule.$components.find((component: any) => component.$selector === route.component);
        }

        if (!route.component && !route.redirectTo) {
          console.error(`route error: path ${route.path} need a component which has children path or need a  redirectTo which has't children path`);
          return;
        }

        if (/^\/\:.+/.test(route.path)) {
          const key = route.path.split('/:')[1];
          this.$vm.$esRouteParmasObject[key] = path;
        }

        const renderDom = document.querySelectorAll('router-render')[index - 1];
        this.routesList.push(route);

        if (FindComponent) {
          const component = this.instantiateComponent(FindComponent, renderDom);
          if (component) this.hasRenderComponentList.push(component);
        }

        if (index === this.renderRouteList.length - 1) this.routerChangeEvent(index);

        if (route.redirectTo && /^\/.*/.test(route.redirectTo) && (index + 1) === this.renderRouteList.length) {
          this.needRedirectPath = route.redirectTo;
          return;
        }
      }
    }
  }

  /**
   * emit nvRouteChange and nvOnDestory for Components
   *
   * @param {number} index
   * @memberof Router
   */
  public routerChangeEvent(index: number): void {
    this.hasRenderComponentList.forEach((c, i) => {
      if (c.nvRouteChange) c.nvRouteChange(this.lastRoute, this.currentUrl);
      this.emitComponentEvent(c.$componentList, 'nvRouteChange');
      if (i >= index + 1) {
        if (c.nvOnDestory) c.nvOnDestory();
        this.emitComponentEvent(c.$componentList, 'nvOnDestory');
      }
    });
    this.hasRenderComponentList.length = index + 1;
  }

  /**
   * emit nvRouteChange and nvOnDestory for Components with recursion
   *
   * @param {ComponentList<IComponent>[]} componentList
   * @param {string} event
   * @memberof Router
   */
  public emitComponentEvent(componentList: ComponentList<IComponent>[], event: string): void {
    if (event === 'nvRouteChange') {
      componentList.forEach(component => {
        if (component.scope.nvRouteChange) component.scope.nvRouteChange(this.lastRoute, this.currentUrl);
        this.emitComponentEvent(component.scope.$componentList, event);
      });
    }
    if (event === 'nvOnDestory') {
      componentList.forEach(component => {
        if (component.scope.nvOnDestory) component.scope.nvOnDestory();
        this.emitComponentEvent(component.scope.$componentList, event);
      });
    }
  }

  /**
   * instantiate Component
   * 
   * use InDiv renderComponent
   *
   * @param {Function} FindComponent
   * @param {Element} renderDom
   * @returns {*}
   * @memberof Router
   */
  public instantiateComponent(FindComponent: Function, renderDom: Element): any {
    return this.$vm.renderComponent(FindComponent, renderDom);
  }
}
