declare global {
  interface Element {
    value?: any;
  }
}

export class CompileUtilForRepeat {
  [index: string]: any;
  public $fragment?: Element | DocumentFragment;

  constructor(fragment?: Element | DocumentFragment) {
    this.$fragment = fragment;
  }

  public _getValueByValue(vm: any, exp: string, key: string): any {
    const valueList = exp.replace('()', '').split('.');
    let value = vm;
    valueList.forEach((v, index) => {
      if (v === key && index === 0) return;
      value = value[v];
    });
    return value;
  }

  public _getVMVal(vm: any, exp: string): any {
    const valueList = exp.replace('()', '').split('.');
    let value = vm;
    valueList.forEach(v => {
      if (v === 'this') return;
      value = value[v];
    });
    return value;
  }

  public _getVMRepeatVal(val: any, exp: string, key: string): any {
    let value: any;
    const valueList = exp.replace('()', '').split('.');
    valueList.forEach((v, index) => {
      if (v === key && index === 0) {
        value = val;
        return;
      }
      value = value[v];
    });
    return value;
  }

  public bind(node: Element, val?: any, key?: string, dir?: string, exp?: string, index?: number, vm?: any, watchValue?: any): void {
    let value;
    if (exp.indexOf(key) === 0 || exp.indexOf(`${key}.`) === 0) {
      value = this._getVMRepeatVal(val, exp, key);
    } else {
      value = this._getVMVal(vm, exp);
    }

    let watchData;
    if (exp.indexOf(key) === 0 || exp.indexOf(`${key}.`) === 0) {
      watchData = watchValue;
    } else {
      watchData = this._getVMVal(vm, exp);
    }

    if (!node.hasChildNodes()) this.templateUpdater(node, val, key, vm);

    const updaterFn: any = this[`${dir}Updater`];
    switch (dir) {
      case 'model':
        if (updaterFn) (updaterFn as Function).call(this, node, value, exp, key, index, watchData, vm);
        break;
      default:
        if (updaterFn) (updaterFn as Function).call(this, node, value);
    }
  }

  public templateUpdater(node: Element, val?: any, key?: string, vm?: any): void {
    const text = node.textContent;
    const reg = /\{\{(.*)\}\}/g;
    if (reg.test(text)) {
      const exp = RegExp.$1;
      let value;
      if (exp.indexOf(key) === 0 || exp.indexOf(`${key}.`) === 0) {
        value = this._getVMRepeatVal(val, exp, key);
      } else {
        value = this._getVMVal(vm, exp);
      }
      node.textContent = node.textContent.replace(/(\{\{.*\}\})/g, value);
    }
  }

  public textUpdater(node: Element, value: any): void {
    node.textContent = typeof value === 'undefined' ? '' : value;
  }

  public htmlUpdater(node: Element, value: any): void {
    node.innerHTML = typeof value === 'undefined' ? '' : value;
  }

  public ifUpdater(node: Element, value: any): void {
    if (value) this.$fragment.appendChild(node);
  }

  public classUpdater(node: Element, value: any, oldValue: any): void {
    let className = node.className;
    className = className.replace(oldValue, '').replace(/\s$/, '');
    const space = className && String(value) ? ' ' : '';
    node.className = className + space + value;
  }

  public modelUpdater(node: Element, value: any, exp: string, key: string, index: number, watchData: any, vm: any): void {
    node.value = typeof value === 'undefined' ? '' : value;
    const func = (event: Event) => {
      event.preventDefault();
      if (/(this.state.).*/.test(exp)) {
        const val = exp.replace(/(this.state.)|(this.props)/, '');
        if ((event.target as HTMLInputElement).value === watchData) return;
        vm.state[val] = (event.target as HTMLInputElement).value;
      }
      if (/(this.props.).*/.test(exp)) {
        const val = exp.replace(/(this.state.)|(this.props)/, '');
        if ((event.target as HTMLInputElement).value === watchData) return;
        vm.props[val] = (event.target as HTMLInputElement).value;
      }
      if (exp.indexOf(key) === 0 || exp.indexOf(`${key}.`) === 0) {   
        const val = exp.replace(`${key}.`, '');
        if (val === key) watchData[index] = (event.target as HTMLInputElement).value;
        // if (val !== key) watchData[index][val] = (event.target as HTMLInputElement).value;
        if (val !== key) {
          watchData[index][val] = (event.target as HTMLInputElement).value;
        }
      }
    };
    node.addEventListener('input', func, false);
    (node as any).eventinput = func;
    if (node.getAttribute('eventTypes')) {
      const eventlist = JSON.parse(node.getAttribute('eventTypes'));
      eventlist.push('input');
      node.setAttribute(`eventTypes`, JSON.stringify(eventlist));
    } else {
      node.setAttribute(`eventTypes`, JSON.stringify(['input']));
    }
  }

  public eventHandler(node: Element, vm: any, exp: string, eventName: string, key: string, val: any): void {
    const eventType = eventName.split(':')[1];
    const fnList = exp.replace(/\(.*\)/, '').split('.');
    const args = exp.match(/\((.*)\)/)[1].replace(/ /g, '').split(',');
    let fn = vm;
    fnList.forEach(f => {
      if (f === 'this') return;
      fn = fn[f];
    });
    const func = (event: Event): any => {
      const argsList: any[] = [];
      args.forEach(arg => {
        if (arg === '') return false;
        if (arg === '$event') argsList.push(event);
        if (/(this.).*/g.test(arg) || /(this.state.).*/g.test(arg) || /(this.props.).*/g.test(arg)) argsList.push(this._getVMVal(vm, arg));
        if (/\'.*\'/g.test(arg)) argsList.push(arg.match(/\'(.*)\'/)[1]);
        if (!/\'.*\'/g.test(arg) && /^[0-9]*$/g.test(arg)) argsList.push(Number(arg));
        if (arg === 'true' || arg === 'false') argsList.push(arg === 'true');
        if (arg.indexOf(key) === 0 || arg.indexOf(`${key}.`) === 0) argsList.push(this._getVMRepeatVal(val, arg, key));
      });
      fn.apply(vm, argsList);
    };
    if (eventType && fn) {
      node.addEventListener(eventType, func, false);
      (node as any)[`event${eventType}`] = func;
      if (node.getAttribute('eventTypes')) {
        const eventlist = JSON.parse(node.getAttribute('eventTypes'));
        eventlist.push(eventType);
        node.setAttribute(`eventTypes`, JSON.stringify(eventlist));
      } else {
        node.setAttribute(`eventTypes`, JSON.stringify([eventType]));
      }
    }
  }
}

export class CompileUtil {
  [index: string]: any;
  public $fragment?: Element | DocumentFragment;

  constructor(fragment?: Element | DocumentFragment) {
    this.$fragment = fragment;
  }

  public _getValueByValue(vm: any, exp: string, key: string): any {
    const valueList = exp.replace('()', '').split('.');
    let value = vm;
    valueList.forEach((v, index) => {
      if (v === key && index === 0) return;
      value = value[v];
    });
    return value;
  }

  public _getVMVal(vm: any, exp: string): any {
    const valueList = exp.replace('()', '').split('.');
    let value = vm;
    valueList.forEach((v, index) => {
      if (v === 'this' && index === 0) return;
      value = value[v];
    });
    return value;
  }

  public _getVMRepeatVal(vm: any, exp: string): void {
    const vlList = exp.split(' ');
    const value = this._getVMVal(vm, vlList[3]);
    return value;
  }

  public bind(node: Element, vm: any, exp: string, dir: string): void {
    const updaterFn = this[`${dir}Updater`];
    const isRepeatNode = this.isRepeatNode(node);
    if (isRepeatNode) { // compile repeatNode's attributes
      switch (dir) {
        case 'repeat':
          if (updaterFn) (updaterFn as Function).call(this, node, this._getVMRepeatVal(vm, exp), exp, vm);
          break;
      }
    } else { // compile unrepeatNode's attributes
      switch (dir) {
        case 'model':
          if (updaterFn) (updaterFn as Function).call(this, node, this._getVMVal(vm, exp), exp, vm);
          break;
        case 'text':
          if (updaterFn) (updaterFn as Function).call(this, node, this._getVMVal(vm, exp));
          break;
        case 'if':
          if (updaterFn) (updaterFn as Function).call(this, node, this._getVMVal(vm, exp), exp, vm);
          break;
        default:
          if (updaterFn) (updaterFn as Function).call(this, node, this._getVMVal(vm, exp));
      }
    }
  }

  public templateUpdater(node: any, vm: any, exp: string): void {
    node.textContent = node.textContent.replace(/(\{\{.*\}\})/g, this._getVMVal(vm, exp));
  }

  public textUpdater(node: Element, value: any): void {
    node.textContent = typeof value === 'undefined' ? '' : value;
  }

  public htmlUpdater(node: Element, value: any): void {
    node.innerHTML = typeof value === 'undefined' ? '' : value;
  }

  public ifUpdater(node: Element, value: any): void {
    if (!value && this.$fragment.contains(node)) {
      this.$fragment.removeChild(node);
    } else {
      this.$fragment.appendChild(node);
    }
  }

  public classUpdater(node: Element, value: any, oldValue: any): void {
    let className = node.className;
    className = className.replace(oldValue, '').replace(/\s$/, '');
    const space = className && String(value) ? ' ' : '';
    node.className = className + space + value;
  }

  public modelUpdater(node: Element, value: any, exp: string, vm: any): void {
    node.value = typeof value === 'undefined' ? '' : value;
    const val = exp.replace(/(this.state.)|(this.props)/, '');
    const func = (event: Event) => {
      event.preventDefault();
      if (/(this.state.).*/.test(exp)) vm.state[val] = (event.target as HTMLInputElement).value;
      if (/(this.props.).*/.test(exp)) vm.props[val] = (event.target as HTMLInputElement).value;
    };
    node.addEventListener('input', func, false);
    (node as any).eventinput = func;
    if (node.getAttribute('eventTypes')) {
      const eventlist = JSON.parse(node.getAttribute('eventTypes'));
      eventlist.push('input');
      node.setAttribute(`eventTypes`, JSON.stringify(eventlist));
    } else {
      node.setAttribute(`eventTypes`, JSON.stringify(['input']));
    }
  }

  public repeatUpdater(node: Element, value: any, expFather: string, vm: any): void {
    const key = expFather.split(' ')[1];
    value.forEach((val: any, index: number) => {
      const newElement = this.cloneNode(node);
      const nodeAttrs = (newElement as Element).attributes;
      const text = newElement.textContent;
      const reg = /\{\{(.*)\}\}/g;
      if (reg.test(text) && text.indexOf(`{{${key}`) >= 0 && !newElement.hasChildNodes()) {
        new CompileUtilForRepeat(this.$fragment).templateUpdater(newElement as Element, val, key, vm);
      }
      if (nodeAttrs) {
        Array.from(nodeAttrs).forEach(attr => {
          const attrName = attr.name;
          if (this.isDirective(attrName) && attrName !== 'es-repeat') {
            const dir = attrName.substring(3);
            const exp = attr.value;
            if (this.isEventDirective(dir)) {
              new CompileUtilForRepeat(this.$fragment).eventHandler(newElement as Element, vm, exp, dir, key, val);
            } else {
              new CompileUtilForRepeat(this.$fragment).bind(newElement as Element, val, key, dir, exp, index, vm, value);
            }
          }
        });
      }
      if (!this.isIfNode(node)) this.$fragment.insertBefore(newElement, node);
      if (newElement.hasChildNodes()) this.repeatChildrenUpdater((newElement as Element), val, expFather, index, vm);
    });
  }

  public repeatChildrenUpdater(node: Element, value: any, expFather: string, index: number, vm: any): void {
    const key = expFather.split(' ')[1];
    Array.from(node.childNodes).forEach((child: Element) => {
      if (this.isRepeatProp(child)) child.setAttribute(`_prop-${key}`, JSON.stringify(value));

      const nodeAttrs = child.attributes;
      const text = child.textContent;
      const reg = /\{\{(.*)\}\}/g;
      let canShowByIf = true;
      if (reg.test(text) && text.indexOf(`{{${key}`) >= 0 && !child.hasChildNodes()) {
        new CompileUtilForRepeat(node).templateUpdater(child, value, key, vm);
      }
      if (nodeAttrs) {
        Array.from(nodeAttrs).forEach(attr => {
          const attrName = attr.name;
          const exp = attr.value;
          const dir = attrName.substring(3);
          const repeatUtils = new CompileUtilForRepeat();
          if (this.isDirective(attrName) && attrName !== 'es-repeat' && new RegExp(`(^${key})|(^this)`).test(exp)) {
            if (this.isEventDirective(dir)) {
              new CompileUtilForRepeat(node).eventHandler(child, vm, exp, dir, key, value);
            } else {
              new CompileUtilForRepeat(node).bind(child, value, key, dir, exp, index, vm, value);
            }
            if (dir === 'if' && new RegExp(`(^${key})`).test(exp)) canShowByIf = repeatUtils._getVMRepeatVal(value, exp, key);
            if (dir === 'if' && /^(this\.)/.test(exp)) canShowByIf = repeatUtils._getVMVal(vm, exp);
            child.removeAttribute(attrName);
          }
        });
      }

      if (child.hasChildNodes()) this.repeatChildrenUpdater(child, value, expFather, index, vm);

      if (!canShowByIf && node.contains(child)) node.removeChild(child);

      const newAttrs = child.attributes;
      if (newAttrs && canShowByIf) {
        const restRepeat = Array.from(newAttrs).find(attr => this.isDirective(attr.name) && attr.name === 'es-repeat');
        if (restRepeat) {
          const newWatchData = restRepeat.value.split(' ')[3];
          if (/^(this\.)/.test(newWatchData)) {
            new CompileUtil(node).bind(child, vm, restRepeat.value, restRepeat.name.substring(3));
            if (node.contains(child)) node.removeChild(child);
          }
          if (new RegExp(`(^${key})`).test(newWatchData)) {
            new CompileUtil(node).repeatUpdater(child, this._getValueByValue(value, newWatchData, key), restRepeat.value, vm);
            if (node.contains(child)) node.removeChild(child);
          }
        }
      }
    });
  }

  public isDirective(attr: string): boolean {
    return attr.indexOf('es-') === 0;
  }

  public isEventDirective(event: string): boolean {
    return event.indexOf('on') === 0;
  }

  public isElementNode(node: Element): boolean {
    return node.nodeType === 1;
  }

  public isRepeatNode(node: Element): boolean {
    const nodeAttrs = node.attributes;
    let result = false;
    if (nodeAttrs) {
      Array.from(nodeAttrs).forEach(attr => {
        const attrName = attr.name;
        if (attrName === 'es-repeat') result = true;
      });
    }
    return result;
  }

  public isIfNode(node: Element): boolean {
    const nodeAttrs = node.attributes;
    let result = false;
    if (nodeAttrs) {
      Array.from(nodeAttrs).forEach(attr => {
        const attrName = attr.name;
        if (attrName === 'es-if') result = true;
      });
    }
    return result;
  }

  public isRepeatProp(node: Element): boolean {
    const nodeAttrs = node.attributes;
    const result = false;
    if (nodeAttrs) return !!(Array.from(nodeAttrs).find(attr => /^\{(.+)\}$/.test(attr.value)));
    return result;
  }

  public cloneNode(node: Element): Node {
    const newElement = node.cloneNode(true);
    const eventList: string[] = JSON.parse((newElement as Element).getAttribute('eventTypes'));
    if (eventList) eventList.forEach(eve => { newElement.addEventListener(eve, (node as any)[`event${eve}`], false); });
    return newElement;
  }
}