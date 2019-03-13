import { IComponent, ComponentList, TComAndDir, DirectiveList } from '../types';

import { utils } from '../utils';
import { Compile } from './compile';
import { buildComponentScope } from './compiler-utils';
import { Vnode, parseTemplateToVnode } from '../vnode';
import { mountDirective } from './directive-compiler';
import { buildViewChild, buildViewChildren, buildContentChild, buildContentChildren } from '../component';
import { lifecycleCaller } from '../lifecycle';

/**
 * use lifecycle nvDestory for @Directive
 *
 * @param {DirectiveList[]} directiveList
 */
function emitDirectiveDestory(directiveList: DirectiveList[]): void {
  directiveList.forEach(directive => {
    lifecycleCaller(directive.instanceScope, 'nvOnDestory');
  });
}

/**
 * use lifecycle nvDestory for @Component
 *
 * @param {ComponentList[]} componentList
 */
function emitComponentDestory(componentList: ComponentList[]): void {
  componentList.forEach(component => {
    lifecycleCaller(component.instanceScope, 'nvOnDestory');
    emitDirectiveDestory(component.instanceScope.directiveList);
    emitComponentDestory(component.instanceScope.componentList);
  });
}

/**
 * mountComponent for Components in Component
 *
 * @export
 * @param {IComponent} componentInstance
 * @param {TComAndDir} componentAndDirectives
 */
export async function mountComponent(componentInstance: IComponent, componentAndDirectives: TComAndDir): Promise<void> {
  const cacheComponentList: ComponentList[] = [...componentInstance.componentList];
  const foundCacheComponentList: ComponentList[] = [];
  componentsConstructor(componentInstance, componentAndDirectives);
  const componentListLength = componentInstance.componentList.length;
  for (let i = 0; i < componentListLength; i++) {
    const component = componentInstance.componentList[i];
    // find Component from cache
    const cacheComponentIndex = cacheComponentList.findIndex(cache => cache.nativeElement === component.nativeElement);
    const cacheComponent = cacheComponentList[cacheComponentIndex];

    // clear cache, the rest need to be destoried, and push cacheComponent to foundCacheComponentList
    if (cacheComponentIndex !== -1) {
      cacheComponentList.splice(cacheComponentIndex, 1);
      foundCacheComponentList.push(cacheComponent);
    }
    if (cacheComponent) {
      component.instanceScope = cacheComponent.instanceScope;
      // old inputs: component.instanceScope._save_inputs
      // new inputs: component.inputs
      if (!utils.isEqual(component.instanceScope._save_inputs, component.inputs)) {
        if (component.instanceScope.nvReceiveInputs) component.instanceScope.nvReceiveInputs({ ...component.inputs });
        component.instanceScope._save_inputs = component.inputs;

        for (const key in component.inputs) {
          if (component.instanceScope.inputsList) {
            component.instanceScope.inputsList.forEach(({ propertyName, inputName }) => {
              if (inputName === key) (component.instanceScope as any)[propertyName] = component.inputs[key];
            });
          }
        }

      }
    } else {
      component.instanceScope = buildComponentScope(component.constructorFunction, component.inputs, component.nativeElement, componentInstance);
    }

    component.instanceScope.$indivInstance = componentInstance.$indivInstance;
    // 赋值 <nv-content>的Vnode[] 给组件实例nvContent
    component.instanceScope.nvContent = component.nvContent;
    component.instanceScope.parentComponent = componentInstance;

    if (!cacheComponent) {
      lifecycleCaller(component.instanceScope, 'nvOnInit');
      lifecycleCaller(component.instanceScope, 'watchData');
      lifecycleCaller(component.instanceScope, 'nvBeforeMount');
    }
  }
  // the rest should use nvOnDestory to destory
  const cacheComponentListLength = cacheComponentList.length;
  for (let i = 0; i < cacheComponentListLength; i++) {
    const cache = cacheComponentList[i];
    lifecycleCaller(cache.instanceScope, 'nvOnDestory');
    emitDirectiveDestory(cache.instanceScope.directiveList);
    emitComponentDestory(cache.instanceScope.componentList);
  }

  // render, only component which isn't rendered will be rendered and called 
  for (let i = 0; i < componentListLength; i++) {
    const component = componentInstance.componentList[i];
    if (!foundCacheComponentList.find(cache => cache.nativeElement === component.nativeElement)) {
      await component.instanceScope.render();
      // in ssr env indiv won't call nvAfterMount
      if (!component.instanceScope.$indivInstance.getIndivEnv.isServerRendering) lifecycleCaller(component.instanceScope, 'nvAfterMount');
    }
  }

  // todo inComponent 有问题
  console.log(999999999999, componentInstance, componentAndDirectives, componentInstance.parentComponent);

  // build @ViewChild
  buildViewChild(componentInstance);
  // build @ViewChildren
  buildViewChildren(componentInstance);
  // // build @Content
  buildContentChild(componentInstance);
  // build @ContentChild
  buildContentChildren(componentInstance);
}

/**
 * construct Components in Component
 *
 * @export
 * @param {IComponent} componentInstance
 * @param {TComAndDir} componentAndDirectives
 */
export function componentsConstructor(componentInstance: IComponent, componentAndDirectives: TComAndDir): void {
  componentInstance.componentList = [];

  componentAndDirectives.components.forEach(component => {
    const declaration = componentInstance.declarationMap.get(component.name);
    componentInstance.componentList.push({
      nativeElement: component.nativeElement,
      inputs: component.inputs,
      instanceScope: null,
      constructorFunction: declaration,
      nvContent: component.nvContent,
      inComponent: component.inComponent,
    });
  });
}

/**
 * build list for build @Component and @Directive
 *
 * @export
 * @param {Vnode} vnode
 * @param {TComAndDir} componentAndDirectives
 */
export function buildComponentsAndDirectives(vnode: Vnode, componentAndDirectives: TComAndDir): void {
  if (vnode.childNodes && vnode.childNodes.length > 0) vnode.childNodes.forEach(child => buildComponentsAndDirectives(child, componentAndDirectives));

  if (vnode.type === 'text') return;
  const componentInputs: any = {};

  if (vnode.attributes && vnode.attributes.length > 0) {
    vnode.attributes.forEach(attr => {
      if (attr.type === 'directive') {
        componentAndDirectives.directives.push({
          nativeElement: vnode.nativeElement,
          inputs: attr.nvValue,
          name: attr.name,
          inComponent: vnode.inComponent,
        });
      }
      if (attr.type === 'prop') componentInputs[attr.name] = attr.nvValue;
    });
  }

  if (vnode.type === 'component') {
    componentAndDirectives.components.push({
      nativeElement: vnode.nativeElement,
      inputs: componentInputs,
      name: vnode.tagName,
      nvContent: vnode.childNodes,
      inComponent: vnode.inComponent,
    });
  }
}

/**
 * render Component with using nativeElement and RenderTask instance
 *
 * @export
 * @param {*} nativeElement
 * @param {IComponent} componentInstance
 * @returns {Promise<IComponent>}
 */
export async function componentCompiler(nativeElement: any, componentInstance: IComponent): Promise<IComponent> {
  // for compile, @Component must init parseVnodeOptions, templateVnode and compileInstance
  if (!componentInstance.parseVnodeOptions) {
    componentInstance.parseVnodeOptions = {
      components: [],
      directives: [],
    };
    componentInstance.declarationMap.forEach((value, key) => {
      if (componentInstance.parseVnodeOptions.components.indexOf(key) === -1 && (value as any).nvType === 'nvComponent') componentInstance.parseVnodeOptions.components.push(key);
      if (componentInstance.parseVnodeOptions.directives.indexOf(key) === -1 && (value as any).nvType === 'nvDirective') componentInstance.parseVnodeOptions.directives.push(key);
    });
  }
  if (!componentInstance.templateVnode) componentInstance.templateVnode = parseTemplateToVnode(componentInstance.template, componentInstance.parseVnodeOptions);
  if (!componentInstance.compileInstance) componentInstance.compileInstance = new Compile(nativeElement, componentInstance);

  let saveVnode: Vnode[] = [];
  try {
    saveVnode = componentInstance.compileInstance.startCompile();
  } catch (error) {
    throw new Error(`Error: ${error}, compoent ${(componentInstance.constructor as any).selector} was compiled failed!`);
  }

  // for save saveVnode in componentInstance
  componentInstance.saveVnode = saveVnode;

  const componentAndDirectives: TComAndDir = { components: [], directives: [] };
  saveVnode.forEach(vnode => buildComponentsAndDirectives(vnode, componentAndDirectives));

  // firstly mount directive
  try {
    mountDirective(componentInstance, componentAndDirectives);
  } catch (error) {
    throw new Error(`Error: ${error}, directives of compoent ${(componentInstance.constructor as any).selector} were compiled failed!`);
  }

  // then mount component
  try {
    await mountComponent(componentInstance, componentAndDirectives);
    lifecycleCaller(componentInstance, 'nvHasRender');
  } catch (error) {
    throw new Error(`Error: ${error}, components of compoent ${(componentInstance.constructor as any).selector} were compiled failed!`);
  }

  return componentInstance;
}
