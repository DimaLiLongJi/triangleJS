import { IDirective, DirectiveList, IComponent, TComAndDir } from '../types';

import { utils } from '../utils';
import { buildDirectiveScope } from './compiler-utils';

/**
 * mountDirective for Directives in Component
 *
 * @export
 * @param {IComponent} componentInstance
 * @param {TComAndDir} componentAndDirectives
 */
export function mountDirective(componentInstance: IComponent, componentAndDirectives: TComAndDir): void {
  const cacheDirectiveList: DirectiveList<IDirective>[] = [ ...componentInstance.directiveList ];
  directivesConstructor(componentInstance, componentAndDirectives);
  const directiveListLength = componentInstance.directiveList.length;
  for (let i = 0; i < directiveListLength; i ++) {
    const directive = componentInstance.directiveList[i];
    // find Directive from cache
    const cacheDirectiveIndex = cacheDirectiveList.findIndex(cache => cache.nativeElement === directive.nativeElement);
    const cacheDirective = cacheDirectiveList[cacheDirectiveIndex];

    // clear cache and the rest need to be destoried
    if (cacheDirectiveIndex !== -1) cacheDirectiveList.splice(cacheDirectiveIndex, 1);
    if (cacheDirective) {
      directive.instanceScope = cacheDirective.instanceScope;
      // old props: directive.instanceScope._save_props
      // new props: directive.props
      if (!utils.isEqual(directive.instanceScope._save_props, directive.props)) {
        if (directive.instanceScope.nvReceiveProps) directive.instanceScope.nvReceiveProps(directive.props);
        directive.instanceScope._save_props = directive.props;
        if (directive.instanceScope.inputPropsMap && directive.instanceScope.inputPropsMap.has((directive.instanceScope as any).constructor.selector)) (directive.instanceScope as any)[directive.instanceScope.inputPropsMap.get((directive.instanceScope as any).constructor.selector)] = directive.props;
      }
    } else {
      directive.instanceScope = buildDirectiveScope(directive.constructorFunction, directive.props, directive.nativeElement as Element, componentInstance);
    }

    directive.instanceScope.$indivInstance = componentInstance.$indivInstance;

    if (directive.instanceScope.nvOnInit && !cacheDirective) directive.instanceScope.nvOnInit();
  }
  // the rest should use nvOnDestory
  const cacheDirectiveListLength = cacheDirectiveList.length;
  for (let i = 0; i < cacheDirectiveListLength; i ++) {
    const cache = cacheDirectiveList[i];
    if (cache.instanceScope.nvOnDestory) cache.instanceScope.nvOnDestory();
  }

  // after mount
  for (let i = 0; i < directiveListLength; i++) {
    const directive = componentInstance.directiveList[i];
    if (directive.instanceScope.nvHasRender) directive.instanceScope.nvHasRender();
  }
}

/**
 * construct Directives in Directive
 *
 * @export
 * @param {IComponent} componentInstance
 * @param {TComAndDir} componentAndDirectives
 */
export function directivesConstructor(componentInstance: IComponent, componentAndDirectives: TComAndDir): void {
  componentInstance.directiveList = [];

  componentAndDirectives.directives.forEach(directive => {
    const declaration = componentInstance.declarationMap.get(directive.name);
    componentInstance.directiveList.push({
      nativeElement: directive.nativeElement,
      props: directive.props,
      instanceScope: null,
      constructorFunction: declaration,
    });
  });
}

/**
 * render Directive with using nativeElement and RenderTask instance
 *
 * @export
 * @param {IComponent} componentInstance
 * @param {TComAndDir} componentAndDirectives
 * @returns {Promise<IDirective>}
 */
export async function directiveCompiler(componentInstance: IComponent, componentAndDirectives: TComAndDir): Promise<IDirective> {
  return Promise.resolve()
    .then(() => {
      mountDirective(componentInstance, componentAndDirectives);
      return componentInstance;
    })
    .catch(e => {
      throw new Error(`directive ${(componentInstance.constructor as any).selector} render failed: ${e}`);
    });
}