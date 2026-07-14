var e,t=globalThis,i=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,n=Symbol(),r=/* @__PURE__ */new WeakMap,s=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==n)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(i&&void 0===e){const i=void 0!==t&&1===t.length;i&&(e=r.get(t)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&r.set(t,e))}return e}toString(){return this.cssText}},r$5=e=>new s("string"==typeof e?e:e+"",void 0,n),i$6=(e,...t)=>new s(1===e.length?e[0]:t.reduce((t,i,n)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+e[n+1],e[0]),e,n),l=i?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const i of e.cssRules)t+=i.cssText;return r$5(t)})(e):e,{is:d,defineProperty:c,getOwnPropertyDescriptor:u,getOwnPropertyNames:p,getOwnPropertySymbols:g,getPrototypeOf:m}=Object,f=globalThis,b=f.trustedTypes,v=b?b.emptyScript:"",y=f.reactiveElementPolyfillSupport,d$2=(e,t)=>e,w={toAttribute(e,t){switch(t){case Boolean:e=e?v:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let i=e;switch(t){case Boolean:i=null!==e;break;case Number:i=null===e?null:Number(e);break;case Object:case Array:try{i=JSON.parse(e)}catch(e){i=null}}return i}},f$2=(e,t)=>!d(e,t),_={attribute:!0,type:String,converter:w,reflect:!1,useDefault:!1,hasChanged:f$2};(e=Symbol).metadata??(e.metadata=Symbol("metadata")),f.litPropertyMetadata??(f.litPropertyMetadata=/* @__PURE__ */new WeakMap);var H=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=_){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const i=Symbol(),n=this.getPropertyDescriptor(e,i,t);void 0!==n&&c(this.prototype,e,n)}}static getPropertyDescriptor(e,t,i){const{get:n,set:r}=u(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:n,set(t){const s=n?.call(this);r?.call(this,t),this.requestUpdate(e,s,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??_}static _$Ei(){if(this.hasOwnProperty(d$2("elementProperties")))return;const e=m(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(d$2("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(d$2("properties"))){const e=this.properties,t=[...p(e),...g(e)];for(const i of t)this.createProperty(i,e[i])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,i]of t)this.elementProperties.set(e,i)}this._$Eh=/* @__PURE__ */new Map;for(const[t,i]of this.elementProperties){const e=this._$Eu(t,i);void 0!==e&&this._$Eh.set(e,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const e of i)t.unshift(l(e))}else void 0!==e&&t.push(l(e));return t}static _$Eu(e,t){const i=t.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=/* @__PURE__ */new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??(this._$EO=/* @__PURE__ */new Set)).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=/* @__PURE__ */new Map,t=this.constructor.elementProperties;for(const i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((e,n)=>{if(i)e.adoptedStyleSheets=n.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const i of n){const n=document.createElement("style"),r=t.litNonce;void 0!==r&&n.setAttribute("nonce",r),n.textContent=i.cssText,e.appendChild(n)}})(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){const i=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,i);if(void 0!==n&&!0===i.reflect){const r=(void 0!==i.converter?.toAttribute?i.converter:w).toAttribute(t,i.type);this._$Em=e,null==r?this.removeAttribute(n):this.setAttribute(n,r),this._$Em=null}}_$AK(e,t){const i=this.constructor,n=i._$Eh.get(e);if(void 0!==n&&this._$Em!==n){const e=i.getPropertyOptions(n),r="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:w;this._$Em=n;const s=r.fromAttribute(t,e.type);this[n]=s??this._$Ej?.get(n)??s,this._$Em=null}}requestUpdate(e,t,i,n=!1,r){if(void 0!==e){const s=this.constructor;if(!1===n&&(r=this[e]),i??(i=s.getPropertyOptions(e)),!((i.hasChanged??f$2)(r,t)||i.useDefault&&i.reflect&&r===this._$Ej?.get(e)&&!this.hasAttribute(s._$Eu(e,i))))return;this.C(e,t,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:n,wrapped:r},s){i&&!(this._$Ej??(this._$Ej=/* @__PURE__ */new Map)).has(e)&&(this._$Ej.set(e,s??t??this[e]),!0!==r||void 0!==s)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),!0===n&&this._$Em!==e&&(this._$Eq??(this._$Eq=/* @__PURE__ */new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,i]of e){const{wrapped:e}=i,n=this[t];!0!==e||this._$AL.has(t)||void 0===n||this.C(t,void 0,i,n)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=/* @__PURE__ */new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(e){}firstUpdated(e){}};H.elementStyles=[],H.shadowRootOptions={mode:"open"},H[d$2("elementProperties")]=/* @__PURE__ */new Map,H[d$2("finalized")]=/* @__PURE__ */new Map,y?.({ReactiveElement:H}),(f.reactiveElementVersions??(f.reactiveElementVersions=[])).push("2.1.2");var j=globalThis,i$4=e=>e,z=j.trustedTypes,M=z?z.createPolicy("lit-html",{createHTML:e=>e}):void 0,$="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,D="?"+C,A=`<${D}>`,R=document,c$1=()=>R.createComment(""),a=e=>null===e||"object"!=typeof e&&"function"!=typeof e,E=Array.isArray,d$1=e=>E(e)||"function"==typeof e?.[Symbol.iterator],T="[ \t\n\f\r]",O=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,L=/-->/g,P=/>/g,F=RegExp(`>|${T}(?:([^\\s"'>=/]+)(${T}*=${T}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),I=/'/g,U=/"/g,W=/^(?:script|style|textarea|title)$/i,x=e=>(t,...i)=>({_$litType$:e,strings:t,values:i}),B=x(1),G=x(2),q=(x(3),Symbol.for("lit-noChange")),K=Symbol.for("lit-nothing"),Z=/* @__PURE__ */new WeakMap,Y=R.createTreeWalker(R,129);function V(e,t){if(!E(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==M?M.createHTML(t):t}var N=(e,t)=>{const i=e.length-1,n=[];let r,s=2===t?"<svg>":3===t?"<math>":"",l=O;for(let d=0;d<i;d++){const t=e[d];let i,c,u=-1,p=0;for(;p<t.length&&(l.lastIndex=p,c=l.exec(t),null!==c);)p=l.lastIndex,l===O?"!--"===c[1]?l=L:void 0!==c[1]?l=P:void 0!==c[2]?(W.test(c[2])&&(r=RegExp("</"+c[2],"g")),l=F):void 0!==c[3]&&(l=F):l===F?">"===c[0]?(l=r??O,u=-1):void 0===c[1]?u=-2:(u=l.lastIndex-c[2].length,i=c[1],l=void 0===c[3]?F:'"'===c[3]?U:I):l===U||l===I?l=F:l===L||l===P?l=O:(l=F,r=void 0);const g=l===F&&e[d+1].startsWith("/>")?" ":"";s+=l===O?t+A:u>=0?(n.push(i),t.slice(0,u)+$+t.slice(u)+C+g):t+C+(-2===u?d:g)}return[V(e,s+(e[i]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),n]},J=class S{constructor({strings:e,_$litType$:t},i){let n;this.parts=[];let r=0,s=0;const l=e.length-1,d=this.parts,[c,u]=N(e,t);if(this.el=S.createElement(c,i),Y.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(n=Y.nextNode())&&d.length<l;){if(1===n.nodeType){if(n.hasAttributes())for(const e of n.getAttributeNames())if(e.endsWith($)){const t=u[s++],i=n.getAttribute(e).split(C),l=/([.?@])?(.*)/.exec(t);d.push({type:1,index:r,name:l[2],strings:i,ctor:"."===l[1]?te:"?"===l[1]?ie:"@"===l[1]?ae:ee}),n.removeAttribute(e)}else e.startsWith(C)&&(d.push({type:6,index:r}),n.removeAttribute(e));if(W.test(n.tagName)){const e=n.textContent.split(C),t=e.length-1;if(t>0){n.textContent=z?z.emptyScript:"";for(let i=0;i<t;i++)n.append(e[i],c$1()),Y.nextNode(),d.push({type:2,index:++r});n.append(e[t],c$1())}}}else if(8===n.nodeType)if(n.data===D)d.push({type:2,index:r});else{let e=-1;for(;-1!==(e=n.data.indexOf(C,e+1));)d.push({type:7,index:r}),e+=C.length-1}r++}}static createElement(e,t){const i=R.createElement("template");return i.innerHTML=e,i}};function M$1(e,t,i=e,n){if(t===q)return t;let r=void 0!==n?i._$Co?.[n]:i._$Cl;const s=a(t)?void 0:t._$litDirective$;return r?.constructor!==s&&(r?._$AO?.(!1),void 0===s?r=void 0:(r=new s(e),r._$AT(e,i,n)),void 0!==n?(i._$Co??(i._$Co=[]))[n]=r:i._$Cl=r),void 0!==r&&(t=M$1(e,r._$AS(e,t.values),r,n)),t}var X=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:i}=this._$AD,n=(e?.creationScope??R).importNode(t,!0);Y.currentNode=n;let r=Y.nextNode(),s=0,l=0,d=i[0];for(;void 0!==d;){if(s===d.index){let t;2===d.type?t=new Q(r,r.nextSibling,this,e):1===d.type?t=new d.ctor(r,d.name,d.strings,this,e):6===d.type&&(t=new oe(r,this,e)),this._$AV.push(t),d=i[++l]}s!==d?.index&&(r=Y.nextNode(),s++)}return Y.currentNode=R,n}p(e){let t=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}},Q=class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,n){this.type=2,this._$AH=K,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=M$1(this,e,t),a(e)?e===K||null==e||""===e?(this._$AH!==K&&this._$AR(),this._$AH=K):e!==this._$AH&&e!==q&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):d$1(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==K&&a(this._$AH)?this._$AA.nextSibling.data=e:this.T(R.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:i}=e,n="number"==typeof i?this._$AC(e):(void 0===i.el&&(i.el=J.createElement(V(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===n)this._$AH.p(t);else{const e=new X(n,this),i=e.u(this.options);e.p(t),this.T(i),this._$AH=e}}_$AC(e){let t=Z.get(e.strings);return void 0===t&&Z.set(e.strings,t=new J(e)),t}k(e){E(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let i,n=0;for(const r of e)n===t.length?t.push(i=new k(this.O(c$1()),this.O(c$1()),this,this.options)):i=t[n],i._$AI(r),n++;n<t.length&&(this._$AR(i&&i._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=i$4(e).nextSibling;i$4(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}},ee=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,n,r){this.type=1,this._$AH=K,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=r,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(/* @__PURE__ */new String),this.strings=i):this._$AH=K}_$AI(e,t=this,i,n){const r=this.strings;let s=!1;if(void 0===r)e=M$1(this,e,t,0),s=!a(e)||e!==this._$AH&&e!==q,s&&(this._$AH=e);else{const n=e;let l,d;for(e=r[0],l=0;l<r.length-1;l++)d=M$1(this,n[i+l],t,l),d===q&&(d=this._$AH[l]),s||(s=!a(d)||d!==this._$AH[l]),d===K?e=K:e!==K&&(e+=(d??"")+r[l+1]),this._$AH[l]=d}s&&!n&&this.j(e)}j(e){e===K?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},te=class extends ee{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===K?void 0:e}},ie=class extends ee{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==K)}},ae=class extends ee{constructor(e,t,i,n,r){super(e,t,i,n,r),this.type=5}_$AI(e,t=this){if((e=M$1(this,e,t,0)??K)===q)return;const i=this._$AH,n=e===K&&i!==K||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,r=e!==K&&(i===K||n);n&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},oe=class{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){M$1(this,e)}},ne={M:$,P:C,A:D,C:1,L:N,R:X,D:d$1,V:M$1,I:Q,H:ee,N:ie,U:ae,B:te,F:oe},re=j.litHtmlPolyfillSupport;re?.(J,Q),(j.litHtmlVersions??(j.litHtmlVersions=[])).push("3.3.2");var se=globalThis,le=class extends H{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,i)=>{const n=i?.renderBefore??t;let r=n._$litPart$;if(void 0===r){const e=i?.renderBefore??null;n._$litPart$=r=new Q(t.insertBefore(c$1(),e),e,void 0,i??{})}return r._$AI(e),r})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return q}};le._$litElement$=!0,le.finalized=!0,se.litElementHydrateSupport?.({LitElement:le});var de=se.litElementPolyfillSupport;de?.({LitElement:le}),(se.litElementVersions??(se.litElementVersions=[])).push("4.2.2");var t$2=e=>(t,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)},ce={attribute:!0,type:String,converter:w,reflect:!1,hasChanged:f$2},r$2=(e=ce,t,i)=>{const{kind:n,metadata:r}=i;let s=globalThis.litPropertyMetadata.get(r);if(void 0===s&&globalThis.litPropertyMetadata.set(r,s=/* @__PURE__ */new Map),"setter"===n&&((e=Object.create(e)).wrapped=!0),s.set(i.name,e),"accessor"===n){const{name:n}=i;return{set(i){const r=t.get.call(this);t.set.call(this,i),this.requestUpdate(n,r,e,!0,i)},init(t){return void 0!==t&&this.C(n,void 0,e,t),t}}}if("setter"===n){const{name:n}=i;return function(i){const r=this[n];t.call(this,i),this.requestUpdate(n,r,e,!0,i)}}throw Error("Unsupported decorator location: "+n)};function n$1(e){return(t,i)=>"object"==typeof i?r$2(e,t,i):((e,t,i)=>{const n=t.hasOwnProperty(i);return t.constructor.createProperty(i,e),n?Object.getOwnPropertyDescriptor(t,i):void 0})(e,t,i)}function r$1(e){return n$1({...e,state:!0,attribute:!1})}var e$3=(e,t,i)=>(i.configurable=!0,i.enumerable=!0,Reflect.decorate&&"object"!=typeof t&&Object.defineProperty(e,t,i),i);var ue=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,i){this._$Ct=e,this._$AM=t,this._$Ci=i}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}},{I:he}=ne,pe={},ge=(e=>(...t)=>({_$litDirective$:e,values:t}))(class extends ue{constructor(){super(...arguments),this.key=K}render(e,t){return this.key=e,t}update(e,[t,i]){return t!==this.key&&(((e,t=pe)=>{e._$AH=t})(e),this.key=t),i}}),me=36e5,fe=864e5,be=Math.PI/180,ve="#ffc107",ye=-.833,ke=9e5,we=9e5,_e=[3e5,9e5,36e5],Se=[6e4,3e5,9e5,36e5],He=6e4,je=18e5,ze=.95047,xe=1.08883,Me=.137931034,$e=.12841855,Ce=1200,De=111320,clamp=(e,t,i)=>Math.max(t,Math.min(i,e));function cacheId(e){const t=e?.["cache-id"];return"string"==typeof t?t.trim():""}function resolveClampedInt(e,t,i,n,r){const s=e?.[t],l="number"==typeof s?s:"string"==typeof s?parseFloat(s):NaN;return Number.isFinite(l)?clamp(Math.round(l),n,r):i}function valueDecimals(e){return resolveClampedInt(e,"value-decimals",1,0,3)}function powerUnit(e){return"W"===e?.["power-unit"]?"W":"kW"}function irradianceUnit(e){return"kW/m²"===e?.["irradiance-unit"]?"kW/m²":"W/m²"}function autoHideUi(e){return!0===e?.["auto-hide-ui"]}function showTimeline(e){return!1!==e?.["show-timeline"]}function noUiDelayMs(e){const t=Number(e?.["no-ui-delay"]);return 1e3*(Number.isFinite(t)?Math.min(10,Math.max(0,t)):5)}function hiddenDevices(e){const t=e?.["hidden-devices"],i=/* @__PURE__ */new Set;if(Array.isArray(t))for(const n of t)"string"==typeof n&&""!==n.trim()&&i.add(n.trim());return i}var Ae=["#4269d0","#efb118","#ff725c","#6cc5b0"];function monitoringGroups(e){const t=e?.["monitoring-groups"],i=/* @__PURE__ */new Map;if(t&&"object"==typeof t&&!Array.isArray(t))for(const[n,r]of Object.entries(t)){const e=n.trim(),t="number"==typeof r?r:"string"==typeof r?parseInt(r,10):NaN;""!==e&&Number.isInteger(t)&&t>=1&&t<=4&&i.set(e,t)}return i}function groupMapString(e,t,i){const n=e?.[t];if(n&&"object"==typeof n&&!Array.isArray(n)){const e=n[String(i)];if("string"==typeof e)return e.trim()}return""}function monitoringGroupName(e,t){return groupMapString(e,"monitoring-group-names",t)}function monitoringGroupIcon(e,t){return groupMapString(e,"monitoring-group-icons",t)}function monitoringGroupColorToken(e,t){return groupMapString(e,"monitoring-group-colors",t)}function monitoringGroupColor(e,t){const i=`var(--graph-color-${t}, ${Ae[(t-1)%Ae.length]})`,n=monitoringGroupColorToken(e,t);return n?/^(#|rgb|var)/i.test(n)?n:`var(--${n}-color, ${i})`:i}function groupChipVisible(e,t){const i=e?.["monitoring-group-hidden"];return!(i&&"object"==typeof i&&!Array.isArray(i))||!0!==i[String(t)]}function chipVisible(e,t){return!1!==e?.[t]}function mapThemeMode(e){const t=e?.["map-theme-mode"];return"dark"===t||"light"===t||"custom"===t?t:"auto"}function mapColorKey(e){return`map-color-${e}`}function mapShowKey(e){return`map-show-${e}`}function mapLayerColor(e,t){const i=e?.[mapColorKey(t)];return"string"==typeof i?i.trim():""}function mapLayerVisible(e,t){return!1!==e?.[mapShowKey(t)]}function buildingRealSize(e){return!1!==e?.["building-real-size"]}function buildingFixedHeightM(e){return resolveClampedInt(e,"building-height",6,3,10)}var Re=class extends Error{constructor(e,t){super(`callWS timeout after ${t} ms (${e})`),this.wsType=e,this.timeoutMs=t,this.name="WsTimeoutError"}},Ee=class extends Error{constructor(e){super(`callWS aborted (${e})`),this.wsType=e,this.name="WsAbortError"}},Te=0,Oe=[];function callWS(e,t,i){if(!e||"function"!=typeof e.callWS)return Promise.reject(/* @__PURE__ */new Error("hass.callWS unavailable"));const n=i?.timeoutMs??3e4,r=i?.signal;return r?.aborted?Promise.reject(new Ee(t.type)):function acquireFetchSlot(){return Te<2?(Te++,Promise.resolve()):new Promise(e=>{Oe.push(()=>{Te++,e()})})}().then(()=>new Promise((i,s)=>{let l=!1;const finish=e=>{l||(l=!0,function releaseFetchSlot(){Te=Math.max(0,Te-1);const e=Oe.shift();e&&e()}(),e())},d=setTimeout(()=>{finish(()=>s(new Re(t.type,n)))},n);r&&r.addEventListener("abort",()=>{clearTimeout(d),finish(()=>s(new Ee(t.type)))},{once:!0}),e.callWS(t).then(e=>{clearTimeout(d),finish(()=>i(e))},e=>{clearTimeout(d),finish(()=>s(e))})}))}var Le=class{constructor(e){this._ttlMs=e,this._entries=/* @__PURE__ */new Map}get(e,t){const i=Date.now();this._prune(i);const n=this._entries.get(e);if(n){if(n.inflight)return n.inflight;if(i-n.ts<this._ttlMs)return Promise.resolve(n.result)}const r=t();return this._entries.set(e,{ts:i,inflight:r}),r.then(t=>(this._entries.set(e,{ts:Date.now(),result:t}),t),t=>{throw this._entries.delete(e),t})}clear(){this._entries.clear()}_prune(e){for(const[t,i]of this._entries)!i.inflight&&e-i.ts>this._ttlMs&&this._entries.delete(t)}},Pe=/* @__PURE__ */new Set;function warnOnce(e,t){Pe.has(e)||(Pe.add(e),console.warn(`[Helios] ${t}`))}var Fe="helios:durable:";function loadDurable(e,t){try{const i=window.localStorage?.getItem(Fe+e);if(!i)return null;const n=JSON.parse(i);return n&&1===n.v&&"number"==typeof n.storedAt?Date.now()-n.storedAt>t?null:n.data??null:null}catch{return null}}function saveDurable(e,t){const i=function safeLocalStorage(){try{return window.localStorage??null}catch{return null}}();if(!i)return;const n=Fe+e;let r;try{r=JSON.stringify(t)}catch{return}if(function storedDataJson(e,t){try{const i=e.getItem(t);if(!i)return null;const n=JSON.parse(i);return n&&1===n.v?JSON.stringify(n.data):null}catch{return null}}(i,n)===r)return;const s=`{"v":1,"storedAt":${Date.now()},"data":${r}}`;try{i.setItem(n,s)}catch{let e=!1;if(function evictOldestDurable(e,t){try{const i=[];for(let r=0;r<e.length;r++){const n=e.key(r);if(!n||!n.startsWith(Fe)||n===t)continue;let s=0;try{s=JSON.parse(e.getItem(n)??"{}").storedAt||0}catch{s=0}i.push({k:n,at:s})}if(0===i.length)return!1;i.sort((e,t)=>e.at-t.at);const n=Math.max(1,Math.floor(i.length/4));for(let t=0;t<n;t++)e.removeItem(i[t].k);return!0}catch{return!1}}(i,n))try{i.setItem(n,s),e=!0}catch{}e||warnOnce("durable-write","durable cache write failed (storage full or blocked); last-good data may be degraded")}}function saveDurableSeries(e,t){saveDurable(e,{t:t.times.map(e=>e.getTime()),v:t.values})}function loadDurableSeries(e,t){const i=loadDurable(e,t);return i?{times:i.t.map(e=>new Date(e)),values:i.v}:null}function changeRefreshAnchorMs(){return Math.floor(Date.now()/He)*He}var Ie=new Le(55e3);async function fetchChangeById(e,t,i,n,r="5minute"){if(0===t.length)return null;if(!e?.callWS)return null;if(n<=i)return null;const s=[...t].sort(),l=`${r}|${i}|${n}|${s.join("|")}`,d=`cbid:${r}|${Math.floor((n-i)/fe)}|${s.join("|")}`;return Ie.get(l,async()=>{try{const s=await callWS(e,{type:"recorder/statistics_during_period",start_time:new Date(i).toISOString(),end_time:new Date(n).toISOString(),statistic_ids:t,period:r,types:["change"],units:{energy:"kWh"}}),l={};let c=!1;for(const e of t){const t=s?.[e];if(!Array.isArray(t))continue;const i=[];for(const e of t){const t=parseStatBoundary(e?.start);if(null===t)continue;const n="number"==typeof e?.change?e.change:null;if(null===n||!Number.isFinite(n))continue;const s=parseStatBoundary(e?.end)??t+periodMs(r);i.push({startMs:t,endMs:s,kwh:n}),c=!0}i.length>0&&(l[e]=i)}return c?(saveDurable(d,l),l):null}catch(L){return warnOnce("recorder-change","recorder change fetch failed; showing cached data until it recovers"),loadDurable(d,fe)}})}function mergeChangeSeries(e,t){const i=/* @__PURE__ */new Map;let n=!1;for(const r of t){const t=e[r];if(t)for(const e of t){const t=i.get(e.startMs);t?t.kwh+=e.kwh:i.set(e.startMs,{startMs:e.startMs,endMs:e.endMs,kwh:e.kwh}),n=!0}}return n?[...i.values()].sort((e,t)=>e.startMs-t.startMs):null}async function fetchChangeSeries(e,t,i,n,r="5minute"){const s=await fetchChangeById(e,t,i,n,r);return null===s?null:mergeChangeSeries(s,t)}function outlierCapKwh(e){if(!e)return 1/0;const t=e.map(e=>Math.abs(e.kwh)).filter(e=>isFinite(e)&&e>0).sort((e,t)=>e-t);return t.length?20*t[Math.min(t.length-1,Math.floor(.9*t.length))]:1/0}function changeSeriesToWatts(e,t,i,n,r){const s=new Array(n).fill(null);if(!e||0===e.length)return s;const l=outlierCapKwh(e),d=new Array(n).fill(0),c=new Array(n).fill(!1);for(const p of e){if(p.startMs<t||p.startMs>=r)continue;if(Math.abs(p.kwh)>l)continue;const e=Math.floor((p.startMs-t)/i);e<0||e>=n||(d[e]+=p.kwh,c[e]=!0)}!function smoothCoarseReports(e,t){const i=[];for(let l=0;l<e.length;l++)t[l]&&0!==e[l]&&i.push(l);if(i.length<3)return;const n=[];for(let l=1;l<i.length;l++)n.push(i[l]-i[l-1]);const r=[...n].sort((e,t)=>e-t)[Math.floor(n.length/2)];if(r<=1||r>6)return;if(n.filter(e=>Math.abs(e-r)<=1).length/n.length<.6)return;let s=-1;for(const l of i){const i=s<0?r:Math.min(l-s,r),n=Math.max(0,l-i+1),d=e[l]/(l-n+1);for(let r=n;r<=l;r++)e[r]=d,t[r]=!0;s=l}}(d,c);const u=i/me;for(let p=0;p<n;p++)c[p]&&(s[p]=1e3*d[p]/u);return s}function wattsFromBucket(e){const t=e.endMs-e.startMs;return t>0?Math.max(0,1e3*e.kwh/(t/me)):0}function wattsAtFromChangeSeries(e,t){if(!e||0===e.length)return null;const i=45e4,n=function probeChangeWindow(e,t,i){let n=0,r=0,s=0,l=0;for(const d of e){if(d.endMs<=t||d.startMs>=i)continue;const e=d.endMs-d.startMs;if(e<=0)continue;const c=Math.min(d.endMs,i)-Math.max(d.startMs,t);c<=0||(n+=d.kwh*(c/e),r+=c,l++,d.kwh>0&&s++)}return{kwh:n,ms:r,nonZero:s,total:l}}(e,t-i,t+i);if(0===n.total)return null;if(n.nonZero>=Math.ceil(.6*n.total))for(const r of e)if(t>=r.startMs&&t<r.endMs)return wattsFromBucket(r);return n.ms>0?Math.max(0,1e3*n.kwh/(n.ms/me)):0}function sumChangeForDay(e,t,i){if(!e||0===e.length)return null;let n=0,r=!1;for(const s of e)s.startMs<t||s.startMs>=i||(n+=s.kwh,r=!0);return r?n:null}function periodMs(e){return"5minute"===e?3e5:"hour"===e?me:fe}function parseStatBoundary(e){if("number"==typeof e&&Number.isFinite(e))return e;if("string"==typeof e){const t=Date.parse(e);return Number.isNaN(t)?null:t}return null}function parseStatBoundaryLoose(e){if(null==e)return null;if("number"==typeof e)return e>1e12?e:1e3*e;if("string"==typeof e){const t=Number(e);if(Number.isFinite(t)&&t>1e9)return t>1e12?t:1e3*t;const i=new Date(e).getTime();return isFinite(i)?i:null}return null}var Ue=["forecast","yesterday","today","week","month","year"];var We,Ne,Be={forecast:{pastDays:1,futureDays:2,weather:!0,maxBucketsPerHour:12},yesterday:{pastDays:1,futureDays:-1,weather:!0,maxBucketsPerHour:12},today:{pastDays:0,futureDays:0,weather:!0,maxBucketsPerHour:12},week:{pastDays:6,futureDays:0,weather:!0,maxBucketsPerHour:12},month:{pastDays:()=>function daysInPrevMonth(){const e=/* @__PURE__ */new Date;return new Date(e.getFullYear(),e.getMonth(),0).getDate()}()-1,futureDays:0,weather:!1,maxBucketsPerHour:1},year:{pastDays:()=>function daysInPrevYear(){const e=/* @__PURE__ */(new Date).getFullYear()-1;return(Date.UTC(e+1,0,1)-Date.UTC(e,0,1))/fe}()-1,futureDays:0,weather:!1,maxBucketsPerHour:1/24}};function modePastDays(e){const t=Be[e].pastDays;return"function"==typeof t?t():t}function modeFutureDays(e){return Be[e].futureDays}function modeBucketsPerHour(e,t){return Math.min(function displayUpdateFrequencyPerHour(e){return resolveClampedInt(e,"display-update-frequency-per-hour",4,1,6)}(t),Be[e].maxBucketsPerHour)}function consumptionLoad(e,t,i,n){return Math.max(0,e+t-i-n)}function localMidnightMinusDays(e){const t=/* @__PURE__ */new Date;return t.setHours(0,0,0,0),t.setDate(t.getDate()-e),t.getTime()}var Ve=/* @__PURE__ */new Map;function serverHourFrac(e){if(!Ne){const t=new Date(e);return t.getHours()+t.getMinutes()/60+t.getSeconds()/3600}return((e+function offsetMs(e){const t=Math.floor(e/me),i=Ve.get(t);if(void 0!==i)return i;let n=0,r=0,s=0,l=0,d=0,c=0;for(const p of Ne.formatToParts(new Date(e)))"year"===p.type?n=Number(p.value):"month"===p.type?r=Number(p.value):"day"===p.type?s=Number(p.value):"hour"===p.type?l=Number(p.value)%24:"minute"===p.type?d=Number(p.value):"second"===p.type&&(c=Number(p.value));const u=6e4*Math.round((Date.UTC(n,r-1,s,l,d,c)-e)/6e4);return Ve.set(t,u),u}(e))%fe+fe)%fe/me}function serverHour(e){return Math.floor(serverHourFrac(e))}function binChangeByHour(e){const t=new Array(24).fill(0);if(!e)return t;const i=outlierCapKwh(e);for(const n of e)!isFinite(n.kwh)||Math.abs(n.kwh)>i||(t[serverHour(n.startMs)]+=Math.max(0,n.kwh));return t}async function statByHour(e,t,i,n){const r=new Array(24).fill(0),s=new Array(24).fill(0);if(!t.length)return r;try{const l=await callWS(e,{type:"recorder/statistics_during_period",start_time:new Date(i).toISOString(),end_time:new Date(n).toISOString(),statistic_ids:[...t].sort(),period:"hour",types:["mean"]});for(const e of t){const t=Array.isArray(l?.[e])?l[e]:[];for(const e of t){const t="number"==typeof e?.start?e.start:Date.parse(e?.start);if(!isFinite(t))continue;const i="number"==typeof e?.mean&&isFinite(e.mean)?e.mean:null;if(null===i)continue;const n=serverHour(t);r[n]+=i,s[n]+=1}}}catch(L){}return r.map((e,t)=>s[t]?e/s[t]:0)}async function refreshPeriodHourly(e){if(!function periodNeedsHourly(e){return!(modeBucketsPerHour(e._timelineMode,e.config)>=1)&&!0===e._infoPanelOpen}(e)||!e.hass?.callWS||!e._timeRange)return null!==e._periodHourly&&(e._periodHourly=null,e.requestUpdate()),void(e._periodHourlyKey="");const t=e._energyDefaults,i=e._timeRange.start.getTime(),n=Math.floor(Math.min(Date.now(),e._timeRange.end.getTime())/me)*me;if(i>=n)return;const r=`${i}|${n}|${t.solarStatEnergyFroms}|${t.gridStatEnergyFroms}|${t.gridStatEnergyTos}|${t.batteryStatEnergyTos}|${t.batteryStatEnergyFroms}|${t.batteryStatSocs}`;if(r===e._periodHourlyKey)return;const s=!e._periodHourlyKey.startsWith(`${i}|`);e._periodHourlyKey=r,s&&null!==e._periodHourly&&(e._periodHourly=null,e.requestUpdate()),e._periodHourly=await async function fetchHourlyProfile(e,t,i,n){const chg=t=>t.length?fetchChangeSeries(e,[...t].sort(),i,n,"hour"):Promise.resolve(null),r=t.solarStatEnergyFroms,[s,l,d,c,u,p]=await Promise.all([Promise.all(r.map(t=>fetchChangeSeries(e,[t],i,n,"hour"))),chg(t.gridStatEnergyFroms),chg(t.gridStatEnergyTos),chg(t.batteryStatEnergyTos),chg(t.batteryStatEnergyFroms),statByHour(e,t.batteryStatSocs,i,n)]),g=s.map(e=>binChangeByHour(e)),m=new Array(24).fill(0);for(const w of g)for(let e=0;e<24;e++)m[e]+=w[e];const f=binChangeByHour(l),b=binChangeByHour(d),v=binChangeByHour(c),y=binChangeByHour(u);return{pv:g,gridImport:f,gridExport:b,batteryCharge:v,batteryDischarge:y,consumption:m.map((e,t)=>consumptionLoad(e,f[t],b[t],v[t]-y[t])),soc:p}}(e.hass,t,i,n),e.requestUpdate()}var Ge={cardName:"Helios",cardDescription:"☀️ A real-time 2.5D view of your home with the sun, weather, solar production, battery and grid, plus cast shadows and an interactive timeline",period:{rangeLabel:"Time range",forecast:"Forecast",yesterday:"Yesterday",today:"Today",week:"Week",month:"Month",year:"Year"},cloudCover:{cloudLow:"Low cloud cover",cloudMid:"Mid cloud cover",cloudHigh:"High cloud cover"},mapConfig:{section:"Map configuration",intro:"The basemap is drawn from OpenStreetMap vector tiles. Auto follows your theme, Dark / Light force one, and Custom lets you set every colour and hide any layer.",modeAuto:"Auto",modeDark:"Dark",modeLight:"Light",modeCustom:"Custom",land:"Background",water:"Water",wood:"Woodland",grass:"Greenery",sand:"Sand",wetland:"Wetland",ice:"Ice & snow",landuse:"Built-up land",roadMajor:"Major roads",roadMinor:"Minor roads",roadCasing:"Road outline",path:"Paths & tracks",rail:"Railways",building:"Buildings",boundary:"Boundaries"},editor:{locationSection:"Home location",homeLatitude:"Home latitude",homeLongitude:"Home longitude",locationHint:"Override the home address used as the card's center. Leave both fields empty to use Home Assistant's configured home. The override is only applied when BOTH fields are set to valid coordinates.",uiAndMapSection:"UI",autoRotate:"Camera auto-rotation",autoRotateHint:"When idle for a few seconds, the camera slowly orbits the home (about 1.5°/s, opposite to the sun's apparent motion). A single-finger drag pauses it instantly and it resumes once you let go. Avoid it on very old devices: auto-rotation forces a render every second.",autoRotateOn:"On",autoRotateOff:"Off",dataDisplaySection:"Data display",displayUpdateFrequency:"Graph detail",displayUpdateFrequencyHelp:"How many points per hour the graphs draw. The data itself is always Home Assistant's 5-minute statistics - this only controls how densely the curve is plotted: 1 = one point per hour (smoothest, lightest to render), 6 = one point every 10 minutes (full detail, heaviest). Default 4 = a point every 15 minutes. Lower it on older or slower devices to cut rendering cost. The forecast curve follows the same cadence, so a finer setting also resolves short shadow dips (a tree clipping production for half an hour) that an hourly curve steps over.",valueDecimals:"Decimals",valueDecimalsHelp:"Number of decimals shown on every value readout, so the chips read uniform. Applies to kW values (whole watts stay integers) and to kWh. 0 to 3, default 1.",powerUnit:"Power unit",powerUnitHelp:"Unit for every power readout on the card (chips, graph tooltips). Energy follows it too, so the card stays consistent: kW pairs with kWh, W with Wh.",irradianceUnit:"Solar constant unit",irradianceUnitHelp:"Unit for the solar constant (irradiance) readout above the sun.",batterySign:"Battery sign",batterySignHelp:"Sign shown on the battery chip. Default is minus while charging and plus while discharging. Inverted flips it. Hidden shows the value with no sign.",batterySignDefault:"Default",batterySignInverted:"Inverted",batterySignHidden:"Hidden",noUiMode:"No UI mode",noUiModeHint:"Fade the timeline and the on-card controls after a few seconds of inactivity. Any tap or move brings them back. Great for a wall display.",noUiDelay:"Idle delay before hiding",noUiDelayHint:"Seconds of inactivity before the timeline and controls fade away in No UI mode. 0 keeps the UI hidden permanently. Only used when No UI mode is on.",showTimeline:"Show timeline",showTimelineHint:"Show the timeline and the period selector below the scene. Off keeps just the scene.",showDetailPanel:"Show additional info",showDetailPanelHint:"Allow the per-chip mini-panel (aggregated metrics) to open top-right when a chip is tapped. Off never shows it.",showSunTimes:"Show sunrise / sunset times",showSunTimesHint:"Show the sunrise and sunset times and their markers at the feet of the solar arc.",lockRotation:"Lock rotation",lockRotationHint:"Set the viewing angle directly in the preview (drag to rotate and tilt the scene), then turn on the lock to freeze it: drag-to-rotate and the idle auto-orbit are disabled, keeping the angle you set.",chipsSection:"Entity display",chipsIntro:"Show or hide each entity, and pick its icon and colour. The home follows the selected chip, or your primary colour by default.",chipIrradiance:"Irradiance display",chipProduction:"Production display",chipGrid:"Grid display",chipBattery:"Battery display",chipHome:"Home consumption display",groupsConfigTitle:"Group configuration",optionalSensors:"Optional sensors",solarIrradianceEntity:"Solar irradiance entity",solarIrradianceEntityHelp:"Pick a sensor reporting global shortwave irradiance in W/m² (typical Ecowitt / Davis / personal weather station). When set, its current state and recorder history replace Open-Meteo for the live + past irradiance everywhere it appears (sun chip number, PV chart Y axis, sun arc colouring). Forecast hours stay on Open-Meteo since a sensor cannot carry future values.",liveDataTitle:"Configuration status",liveDataIntro:"Live chips show measured sensors only. Each family needs the optional live power sensor of its energy dashboard source - curves and totals always come from your meters.",liveSolarOk:"Solar: live power sensor detected.",liveSolarMissing:"Solar: no live power sensor, the production chip stays hidden. Add one under Settings > Dashboards > Energy > Solar panels.",liveSolarAbsent:"Solar: not set up in your Energy dashboard. Add solar panels there to get the production chip.",liveGridOk:"Grid: live power sensor detected.",liveGridMissing:"Grid: no live power sensor, the import/export chips stay hidden. Add one under Settings > Dashboards > Energy > Grid.",liveGridMiswired:"Grid: the live power sensor contradicts your meters (it seems to measure a single direction). The chips stay hidden - configure a signed sensor or the Two sensors mode.",liveGridAbsent:"Grid: not set up in your Energy dashboard. Add the grid there to get the import and export chips.",liveBatteryOk:"Battery: live power sensors cover every battery.",liveBatteryMissing:"Battery: live power missing on at least one battery, the power chip stays hidden. Add the power sensor(s) under Settings > Dashboards > Energy > Battery.",liveBatteryAbsent:"Battery: not set up in your Energy dashboard. Add a battery there to get the charge and discharge chip.",liveHomeOk:"Home consumption: shown, derived from the live families above.",liveHomeNote:"Home consumption: appears once every configured family above has its live sensor.",openEnergyConfig:"Open Energy configuration",buildingsSection:"Home & buildings",buildingsHint:'To keep the card smooth in dense urban areas, only buildings within the configured radius around the home are rendered in 3D. The home itself stays at full opacity - nearby buildings are rendered with the configured opacity so they provide urban context without competing with the data overlays. The cluster radius groups attached outbuildings (verandas, garages, sheds) into the "home" set.',displayRadius:"Display radius",displayRadiusHelp:"Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device - 0 shows just the home.",buildingCount:"Building count",buildingCountHelp:"Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device.",buildingRealSize:"Real building heights",buildingRealSizeOn:"On",buildingRealSizeOff:"Off",buildingRealSizeHint:"On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below.",buildingHeight:"Building height",hiddenDevicesEmpty:"No individual devices are tracked in your Energy dashboard yet. Add device consumption there to control them here.",deviceVisibilityLabel:"Show device",deviceGroupLabel:"Monitoring group",group:"Group",noGroup:"No group",devicesEnergyNote:"These are the individual devices currently set up in your Home Assistant Energy dashboard. The eye shows or hides each one everywhere, and the pill assigns it to a group.",buildingClusterRadius:"Home cluster radius",buildingClusterRadiusHelp:"Radius around the home within which attached outbuildings (verandas, garages, sheds) are treated as part of the home: they render at the home's full opacity and colour instead of as faded neighbours. 0 keeps only the main building.",buildingOpacity:"Surrounding opacity",buildingColor:"Building colour",buildingColorHelp:"Base tint applied to the surrounding buildings in the scene.",shadowsSection:"Shadows",shadowsEnabled:"Show shadows",shadowsEnabledOn:"Shown",shadowsEnabledOff:"Hidden",shadowsEnabledHint:"Toggles the ground shadows cast by the buildings as the sun moves.",shadowOpacity:"Shadow opacity",shadowOpacityHint:"Opacity of the cast ground shadows.",resetSection:"Reset",resetSectionHint:"Maintenance tools: refetch the card's cached data, or reset every option to its default.",resetCacheButton:"Reset data cache",resetCacheWarning:"Warning: this refetches everything the card has cached - the Open-Meteo weather, every in-memory energy series (production, grid, battery, devices, irradiance), the refined forecast's calibration, and the OpenFreeMap building footprints - for every Helios card open on this page. Use it to clear stuck calibration or stale weather/map data - a full refetch takes a few minutes depending on your HA server. Your data inside Home Assistant is never touched.",resetCacheDone:"Cache cleared ✓",resetOptionsButton:"Reset options to defaults",resetOptionsConfirm:"Click again to confirm",resetOptionsWarning:"Warning: this resets ALL of this card's options to their defaults - chip visibility, colours and icons, group names/colours/icons, buildings, shadows, units and every other setting. Your Home Assistant data and Energy dashboard are untouched, but your customisation is cleared and cannot be undone.",resetOptionsDone:"Options reset ✓",aboutSection:"About",aboutVersionLabel:"Version",aboutRepoCard:"Helios",aboutCoffeeMessage:"I build Helios alone, mostly at night, chasing the small details until the sun and your energy feel alive on screen. If it has found a place on your dashboard, that already makes me happy - a star on GitHub even more, and a coffee keeps it all moving forward.",aboutDeveloperLabel:"Developer",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},qe={bg:{cardName:"Helios",cardDescription:"☀️ 2.5D изглед на дома ти в реално време със слънцето, времето, соларното производство, батерията и мрежата, плюс хвърлени сенки и интерактивна времева лента",period:{rangeLabel:"Период",forecast:"Прогноза",today:"Днес",week:"седмица",month:"месец",year:"година"},cloudCover:{cloudLow:"Ниска облачност",cloudMid:"Средна облачност",cloudHigh:"Висока облачност"},editor:{locationSection:"Местоположение",homeLatitude:"Географска ширина на дома",homeLongitude:"Географска дължина на дома",locationHint:"Замени адреса на дома, използван като център на картата. Остави и двете полета празни, за да се използва домът, конфигуриран в Home Assistant. Замяната се прилага само когато И ДВЕТЕ полета съдържат валидни координати.",uiAndMapSection:"Интерфейс",autoRotate:"Автоматично завъртане на камерата",autoRotateHint:"След няколко секунди бездействие камерата бавно обикаля около дома (около 1.5°/s, в посока, обратна на видимото движение на слънцето). Плъзгане с един пръст моментално поставя на пауза завъртането и то се възобновява веднага щом пуснеш. Избягвай го на много стари устройства: автоматичното завъртане налага преизчертаване на всяка секунда.",autoRotateOn:"Вкл",autoRotateOff:"Изкл",dataDisplaySection:"Обекти и показване на данните",displayUpdateFrequency:"Детайлност на графиката",displayUpdateFrequencyHelp:"Колко точки на час чертаят графиките. Самите данни винаги са 5-минутната статистика на Home Assistant; това контролира само колко плътно се чертае кривата: 1 = една точка на час (най-гладката, най-лека за изчертаване), 6 = една точка на всеки 10 минути (пълна детайлност, най-тежка). По подразбиране 4 = точка на всеки 15 минути. Намали го на по-стари или бавни устройства, за да намалиш цената на изчертаването. Кривата на прогнозата следва същия ритъм, така че по-фината настройка също разкрива кратки спадове от сянка (дърво, прекъсващо производството за половин час), които почасовата крива прескача.",valueDecimals:"Десетични знаци",valueDecimalsHelp:"Брой десетични знаци, показвани при всяка стойност. Мощността винаги се показва в kW, а енергията в kWh; това задава точността за всички тях, така че чиповете да изглеждат еднакво. От 0 до 3, по подразбиране 1.",powerUnit:"Единица за мощност",powerUnitHelp:"Единица за всеки показател на мощността в картата (чипове, подсказки на графиката). Енергията също я следва, за да остане картата съгласувана: kW се съчетава с kWh, W с Wh.",irradianceUnit:"Единица за слънчева константа",irradianceUnitHelp:"Единица за показателя на слънчевата константа (облъчване) над слънцето.",batterySign:"Знак на батерията",batterySignHelp:"Знак, показван върху чипа на батерията. По подразбиране е минус при зареждане и плюс при разреждане. Обърнат го обръща. Скрит показва стойността без знак.",batterySignDefault:"По подразбиране",batterySignInverted:"Обърнат",batterySignHidden:"Скрит",noUiMode:"Режим без интерфейс",noUiModeHint:"Затъмнява timeline и контролите върху картата след няколко секунди бездействие. Всяко докосване или движение ги връща. Идеално за wall display.",solarIrradianceEntity:"Единица за слънчево облъчване",solarIrradianceEntityHelp:"Избери сензор, отчитащ глобалното късовълново облъчване в W/m² (типична метеостанция Ecowitt / Davis / лична). Когато е зададен, текущото му състояние и историята от записващото устройство заменят Open-Meteo за облъчването на живо + миналото навсякъде, където се появява (числото на слънчевия чип, оста Y на PV графиката, оцветяването на слънчевата дъга). Часовете на прогнозата остават на Open-Meteo, тъй като сензорът не може да съдържа бъдещи стойности.",buildingsSection:"Дом и сгради",buildingsHint:'За да остане картата плавна в гъсти градски райони, в 3D се изчертават само сградите в рамките на конфигурирания радиус около дома. Самият дом остава с пълна непрозрачност; близките сгради се изчертават с конфигурираната прозрачност, така че да дават градски контекст, без да се конкурират с наслагванията на данни. Радиусът на клъстера групира прилежащите постройки (веранди, гаражи, навеси) в групата "дом".',displayRadius:"Радиус на показване",displayRadiusHelp:"Радиус около дома, в който сградите се извличат и изчертават, до ръба на избледнелия диск на картата. Намали го, за да облекчиш изчертаването на бавно устройство; 0 показва само дома.",buildingCount:"Брой сгради",buildingCountHelp:"Максимален брой близки сгради за изчертаване. Намали го, за да облекчиш изчертаването на бавно устройство.",buildingRealSize:"Реални височини на сградите",buildingRealSizeOn:"Вкл",buildingRealSizeOff:"Изкл",buildingRealSizeHint:"Вкл: използвай реалните височини от OpenStreetMap (ограничени, за да остане кадрирането четимо). Изкл: дай на всяка сграда една и съща фиксирана височина по-долу.",buildingHeight:"Височина на сградите",buildingClusterRadius:"Радиус на клъстера на дома",buildingOpacity:"Прозрачност на околните",buildingColor:"Цвят на сградите",buildingColorHelp:"Основен нюанс, прилаган към околните сгради в сцената.",shadowsSection:"Сенки",shadowsEnabled:"Показвай сенки",shadowsEnabledOn:"Показани",shadowsEnabledOff:"Скрити",shadowsEnabledHint:"Превключва сенките на земята, хвърляни от сградите, докато слънцето се движи.",shadowOpacity:"Прозрачност на сенките",shadowOpacityHint:"Прозрачност на хвърлените на земята сенки.",resetSection:"Нулиране",resetSectionHint:"Инструменти за поддръжка за изтриване на данни, кеширани локално от картата.",resetCacheButton:"Нулирай кеша на данните",resetCacheWarning:"Внимание: това изчиства кешираното време от Open-Meteo и PV историята в паметта за ВСЯКА карта Helios, отворена на тази страница. Прецизираната прогноза ще загуби своите 5 дни калибриране, докато не бъдат извлечени отново (няколко минути в зависимост от твоя HA сървър). Данните ти вътре в Home Assistant никога не се засягат.",resetCacheDone:"Кешът е изчистен ✓",aboutSection:"Относно",aboutVersionLabel:"Версия",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios е създаден от един запален разработчик, с много енергия и много малко сън. Ако харесваш работата ми, една малка звезда в GitHub вече ми помага много, а ако можеш, едно малко кафе поддържа проекта жив.",aboutDeveloperLabel:"Разработчик",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},cs:{cardName:"Helios",cardDescription:"☀️ 2.5D pohled na tvůj domov v reálném čase se sluncem, počasím, solární výrobou, baterií a sítí, plus vržené stíny a interaktivní časová osa",period:{rangeLabel:"Časový rozsah",forecast:"Předpověď",today:"Dnes",week:"týden",month:"měsíc",year:"rok"},cloudCover:{cloudLow:"Nízká oblačnost",cloudMid:"Střední oblačnost",cloudHigh:"Vysoká oblačnost"},editor:{locationSection:"Poloha",homeLatitude:"Zeměpisná šířka domova",homeLongitude:"Zeměpisná délka domova",locationHint:"Přepíše adresu domova použitou jako střed karty. Nech obě pole prázdná, aby se použil domov nastavený v Home Assistant. Přepis se použije pouze tehdy, když jsou OBĚ pole nastavena na platné souřadnice.",uiAndMapSection:"UI",autoRotate:"Automatické otáčení kamery",autoRotateHint:"Po několika sekundách nečinnosti kamera pomalu obíhá kolem domova (přibližně 1.5°/s, opačně k zdánlivému pohybu slunce). Tažení jedním prstem ji okamžitě pozastaví a obnoví se, jakmile prst zvedneš. Na velmi starých zařízeních se tomu vyhni: automatické otáčení vynutí vykreslení každou sekundu.",autoRotateOn:"Zapnuto",autoRotateOff:"Vypnuto",dataDisplaySection:"Entity a zobrazení dat",displayUpdateFrequency:"Detail grafu",displayUpdateFrequencyHelp:"Kolik bodů za hodinu grafy vykreslí. Samotná data jsou vždy 5minutové statistiky Home Assistant; tohle řídí jen to, jak hustě je křivka vykreslena: 1 = jeden bod za hodinu (nejhladší, nejlehčí na vykreslení), 6 = jeden bod každých 10 minut (plný detail, nejnáročnější). Výchozí 4 = bod každých 15 minut. Sniž to na starších nebo pomalejších zařízeních, abys snížil náročnost vykreslování. Křivka předpovědi sleduje stejný rytmus, takže jemnější nastavení rozliší i krátké poklesy stínem (strom zastiňující výrobu na půl hodiny), které hodinová křivka přeskočí.",valueDecimals:"Desetinná místa",valueDecimalsHelp:"Počet desetinných míst zobrazených u každé hodnoty. Výkon je vždy v kW a energie v kWh; tohle nastaví přesnost pro všechny, aby čipy vypadaly jednotně. 0 až 3, výchozí 1.",powerUnit:"Jednotka výkonu",powerUnitHelp:"Jednotka pro každý údaj výkonu na kartě (čipy, popisky grafu). Energie ji také následuje, takže karta zůstává konzistentní: kW se pojí s kWh, W s Wh.",irradianceUnit:"Jednotka sluneční konstanty",irradianceUnitHelp:"Jednotka pro údaj sluneční konstanty (ozáření) nad sluncem.",batterySign:"Znaménko baterie",batterySignHelp:"Znaménko zobrazené na čipu baterie. Výchozí je mínus při nabíjení a plus při vybíjení. Obrácené jej převrátí. Skryté zobrazí hodnotu bez znaménka.",batterySignDefault:"Výchozí",batterySignInverted:"Obrácené",batterySignHidden:"Skryté",noUiMode:"Režim bez rozhraní",noUiModeHint:"Ztlumí timeline a ovládací prvky na kartě po několika sekundách nečinnosti. Jakékoli klepnutí nebo pohyb je vrátí zpět. Skvělé pro wall display.",solarIrradianceEntity:"Entita slunečního ozáření",solarIrradianceEntityHelp:"Vyber senzor hlásící globální krátkovlnné ozáření ve W/m² (typicky Ecowitt / Davis / vlastní meteostanice). Po nastavení jeho aktuální stav a historie z rekordéru nahradí Open-Meteo pro živé i minulé ozáření všude, kde se objevuje (číslo na čipu slunce, osa Y grafu FV, vybarvení slunečního oblouku). Hodiny předpovědi zůstávají na Open-Meteo, protože senzor nemůže nést budoucí hodnoty.",buildingsSection:"Domov a budovy",buildingsHint:'Aby karta zůstala plynulá v hustě zastavěných městských oblastech, ve 3D se vykreslují pouze budovy v nastaveném poloměru kolem domova. Samotný domov zůstává v plné neprůhlednosti; okolní budovy se vykreslují s nastavenou průhledností, takže poskytují městský kontext, aniž by soupeřily s datovými vrstvami. Poloměr shlukování seskupuje přilehlé přístavby (verandy, garáže, kůlny) do skupiny "domova".',displayRadius:"Poloměr zobrazení",displayRadiusHelp:"Poloměr kolem domova, ve kterém se budovy načítají a vykreslují, až k okraji ztlumeného disku mapy. Sniž ho, abys odlehčil vykreslování na pomalém zařízení; 0 zobrazí jen domov.",buildingCount:"Počet budov",buildingCountHelp:"Maximální počet okolních budov k vykreslení. Sniž ho, abys odlehčil vykreslování na pomalém zařízení.",buildingRealSize:"Skutečné výšky budov",buildingRealSizeOn:"Zapnuto",buildingRealSizeOff:"Vypnuto",buildingRealSizeHint:"Zapnuto: použij skutečné výšky z OpenStreetMap (omezené, aby kompozice zůstala čitelná). Vypnuto: dej každé budově stejnou pevnou výšku níže.",buildingHeight:"Výška budovy",buildingClusterRadius:"Poloměr shlukování domova",buildingOpacity:"Průhlednost okolí",buildingColor:"Barva budov",buildingColorHelp:"Základní odstín použitý na okolní budovy ve scéně.",shadowsSection:"Stíny",shadowsEnabled:"Zobrazit stíny",shadowsEnabledOn:"Zobrazeno",shadowsEnabledOff:"Skryto",shadowsEnabledHint:"Přepíná stíny vržené budovami na zem, jak se slunce pohybuje.",shadowOpacity:"Průhlednost stínů",shadowOpacityHint:"Průhlednost vržených stínů na zemi.",resetSection:"Reset",resetSectionHint:"Údržbové nástroje pro vymazání dat, která karta uložila lokálně do mezipaměti.",resetCacheButton:"Resetovat mezipaměť dat",resetCacheWarning:"Upozornění: tohle vymaže počasí Open-Meteo z mezipaměti a historii FV v paměti pro KAŽDOU kartu Helios otevřenou na této stránce. Zpřesněná předpověď ztratí svých 5 dní kalibrace, dokud se znovu nenačtou (pár minut podle tvého HA serveru). Tvých dat uvnitř Home Assistant se to nikdy nedotkne.",resetCacheDone:"Mezipaměť vymazána ✓",aboutSection:"O kartě",aboutVersionLabel:"Verze",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios vytváří jeden zapálený vývojář, s velkou energií a velmi malým spánkem. Pokud se ti moje práce líbí, malá hvězdička na GitHub mi už hodně pomáhá, a pokud můžeš, malá káva drží projekt naživu.",aboutDeveloperLabel:"Vývojář",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Kup mi kávu"}},da:{cardName:"Helios",cardDescription:"☀️ En 2.5D-visning i realtid af dit hjem med solen, vejret, solproduktion, batteri og net, plus kastede skygger og en interaktiv tidslinje",period:{rangeLabel:"Tidsrum",forecast:"Prognose",today:"I dag",week:"uge",month:"måned",year:"år"},cloudCover:{cloudLow:"Lav skydække",cloudMid:"Mellem skydække",cloudHigh:"Høj skydække"},editor:{locationSection:"Placering",homeLatitude:"Hjemmets breddegrad",homeLongitude:"Hjemmets længdegrad",locationHint:"Tilsidesæt hjemmeadressen, der bruges som kortets centrum. Lad begge felter være tomme for at bruge det hjem, der er konfigureret i Home Assistant. Tilsidesættelsen anvendes kun, når BEGGE felter er sat til gyldige koordinater.",uiAndMapSection:"UI",autoRotate:"Automatisk kamerarotation",autoRotateHint:"Når der er inaktivt i et par sekunder, kredser kameraet langsomt om hjemmet (cirka 1.5°/s, modsat solens tilsyneladende bevægelse). Et træk med en finger sætter det straks på pause, og det fortsætter, når du slipper. Undgå det på meget gamle enheder: automatisk rotation tvinger en gengivelse hvert sekund.",autoRotateOn:"Til",autoRotateOff:"Fra",dataDisplaySection:"Entiteter og datavisning",displayUpdateFrequency:"Grafdetaljer",displayUpdateFrequencyHelp:"Hvor mange punkter pr. time graferne tegner. Selve dataene er altid Home Assistants 5-minutters statistik; dette styrer kun, hvor tæt kurven plottes: 1 = ét punkt pr. time (mest jævn, lettest at gengive), 6 = ét punkt hvert 10. minut (fuld detalje, tungest). Standard 4 = et punkt hvert 15. minut. Sænk den på ældre eller langsommere enheder for at reducere gengivelsesomkostningen. Prognosekurven følger samme kadence, så en finere indstilling viser også korte skyggedyk (et træ, der skygger for produktionen i en halv time), som en timekurve springer over.",valueDecimals:"Decimaler",valueDecimalsHelp:"Antal decimaler vist på hver værdiaflæsning. Effekt vises altid i kW og energi i kWh; dette indstiller præcisionen for dem alle, så chipsene fremstår ensartet. 0 til 3, standard 1.",powerUnit:"Effektenhed",powerUnitHelp:"Enhed for hver effektaflæsning på kortet (chips, grafværktøjstips). Energi følger den også, så kortet forbliver konsistent: kW parres med kWh, W med Wh.",irradianceUnit:"Enhed for solkonstant",irradianceUnitHelp:"Enhed for aflæsningen af solkonstanten (irradians) over solen.",batterySign:"Batteritegn",batterySignHelp:"Tegn vist på batterichippen. Standard er minus under opladning og plus under afladning. Omvendt vender det. Skjult viser værdien uden tegn.",batterySignDefault:"Standard",batterySignInverted:"Omvendt",batterySignHidden:"Skjult",noUiMode:"Ingen UI-tilstand",noUiModeHint:"Nedtoner timeline og kontrollerne på kortet efter et par sekunders inaktivitet. Ethvert tryk eller enhver bevægelse bringer dem tilbage. Perfekt til en wall display.",solarIrradianceEntity:"Entitet for solirradians",solarIrradianceEntityHelp:"Vælg en sensor, der rapporterer global kortbølget irradians i W/m² (typisk Ecowitt / Davis / personlig vejrstation). Når den er sat, erstatter dens aktuelle tilstand og optagerhistorik Open-Meteo for live- og fortidsirradiansen overalt, hvor den optræder (tal på solchippen, PV-diagrammets Y-akse, farvelægning af solbuen). Prognosetimer forbliver på Open-Meteo, da en sensor ikke kan bære fremtidige værdier.",buildingsSection:"Hjem & bygninger",buildingsHint:'For at holde kortet flydende i tætte byområder gengives kun bygninger inden for den konfigurerede radius omkring hjemmet i 3D. Selve hjemmet forbliver fuldt uigennemsigtigt; nærliggende bygninger gengives med den konfigurerede uigennemsigtighed, så de giver bymæssig kontekst uden at konkurrere med dataoverlejringerne. Klyngeradiussen samler tilknyttede udhuse (verandaer, garager, skure) i "hjem"-sættet.',displayRadius:"Visningsradius",displayRadiusHelp:"Radius omkring hjemmet, hvori bygninger hentes og tegnes, helt ud til kanten af den falmede kortskive. Sænk den for at lette gengivelsen på en langsom enhed; 0 viser kun hjemmet.",buildingCount:"Antal bygninger",buildingCountHelp:"Maksimalt antal nærliggende bygninger at tegne. Sænk det for at lette gengivelsen på en langsom enhed.",buildingRealSize:"Reelle bygningshøjder",buildingRealSizeOn:"Til",buildingRealSizeOff:"Fra",buildingRealSizeHint:"Til: brug reelle OpenStreetMap-højder (begrænset for at holde rammen læselig). Fra: giv hver bygning den samme faste højde nedenfor.",buildingHeight:"Bygningshøjde",buildingClusterRadius:"Hjemmets klyngeradius",buildingOpacity:"Uigennemsigtighed for omgivelser",buildingColor:"Bygningsfarve",buildingColorHelp:"Grundtone anvendt på de omgivende bygninger i scenen.",shadowsSection:"Skygger",shadowsEnabled:"Vis skygger",shadowsEnabledOn:"Vist",shadowsEnabledOff:"Skjult",shadowsEnabledHint:"Slår de jordskygger til/fra, som bygningerne kaster, mens solen bevæger sig.",shadowOpacity:"Skyggeuigennemsigtighed",shadowOpacityHint:"Uigennemsigtighed for de kastede jordskygger.",resetSection:"Nulstil",resetSectionHint:"Vedligeholdelsesværktøjer til at slette data, som kortet har gemt lokalt.",resetCacheButton:"Nulstil datacache",resetCacheWarning:"Advarsel: dette rydder den cachelagrede Open-Meteo-vejrdata og PV-historikken i hukommelsen for HVERT Helios-kort, der er åbent på denne side. Den forfinede prognose mister sine 5 dages kalibrering, indtil de hentes igen (et par minutter afhængigt af din HA-server). Dine data inde i Home Assistant røres aldrig.",resetCacheDone:"Cache ryddet ✓",aboutSection:"Om",aboutVersionLabel:"Version",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios er bygget af én passioneret udvikler, med masser af energi og meget lidt søvn. Hvis du kan lide mit arbejde, hjælper en lille stjerne på GitHub mig allerede meget, og hvis du kan, holder en lille kaffe projektet i live.",aboutDeveloperLabel:"Udvikler",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Køb mig en kaffe"}},de:{cardName:"Helios",cardDescription:"☀️ Eine 2.5D-Echtzeitansicht deines Zuhauses mit Sonne, Wetter, Solarproduktion, Batterie und Netz, dazu Schlagschatten und eine interaktive Zeitleiste",period:{rangeLabel:"Zeitraum",forecast:"Prognose",today:"Heute",week:"Woche",month:"Monat",year:"Jahr"},cloudCover:{cloudLow:"Tiefe Bewölkung",cloudMid:"Mittlere Bewölkung",cloudHigh:"Hohe Bewölkung"},editor:{locationSection:"Standort",homeLatitude:"Breitengrad des Zuhauses",homeLongitude:"Längengrad des Zuhauses",locationHint:"Überschreibt die Adresse des Zuhauses, die als Mittelpunkt der Karte dient. Lass beide Felder leer, um das in Home Assistant konfigurierte Zuhause zu verwenden. Die Überschreibung wird nur angewendet, wenn BEIDE Felder gültige Koordinaten enthalten.",uiAndMapSection:"UI",autoRotate:"Automatische Kameradrehung",autoRotateHint:"Nach ein paar Sekunden Inaktivität dreht sich die Kamera langsam um das Zuhause (etwa 1.5°/s, entgegen der scheinbaren Sonnenbewegung). Ein Wischen mit einem Finger pausiert sie sofort und sie läuft weiter, sobald du loslässt. Auf sehr alten Geräten besser vermeiden: die Autodrehung erzwingt jede Sekunde ein Rendern.",autoRotateOn:"An",autoRotateOff:"Aus",dataDisplaySection:"Entitäten und Datenanzeige",displayUpdateFrequency:"Diagrammdetail",displayUpdateFrequencyHelp:"Wie viele Punkte pro Stunde die Diagramme zeichnen. Die Daten selbst sind immer die 5-Minuten-Statistiken von Home Assistant; dies steuert nur, wie dicht die Kurve gezeichnet wird: 1 = ein Punkt pro Stunde (am glattesten, am leichtesten zu rendern), 6 = ein Punkt alle 10 Minuten (volles Detail, am schwersten). Standard 4 = ein Punkt alle 15 Minuten. Senke ihn auf älteren oder langsameren Geräten, um den Renderaufwand zu verringern. Die Prognosekurve folgt derselben Taktung, eine feinere Einstellung zeigt also auch kurze Schatteneinbrüche (ein Baum, der die Produktion eine halbe Stunde lang verdeckt), über die eine stündliche Kurve hinweggeht.",valueDecimals:"Dezimalstellen",valueDecimalsHelp:"Anzahl der Dezimalstellen, die bei jeder Wertanzeige gezeigt werden. Leistung wird immer in kW und Energie in kWh angezeigt; dies legt die Genauigkeit für alle fest, damit die Chips einheitlich lesbar sind. 0 bis 3, Standard 1.",powerUnit:"Leistungseinheit",powerUnitHelp:"Einheit für jede Leistungsanzeige auf der Karte (Chips, Diagramm-Tooltips). Energie folgt ihr ebenfalls, damit die Karte konsistent bleibt: kW passt zu kWh, W zu Wh.",irradianceUnit:"Einheit der Solarkonstante",irradianceUnitHelp:"Einheit für die Anzeige der Solarkonstante (Bestrahlung) über der Sonne.",batterySign:"Batterievorzeichen",batterySignHelp:"Vorzeichen, das auf dem Batterie-Chip angezeigt wird. Standard ist Minus beim Laden und Plus beim Entladen. Invertiert dreht es um. Ausgeblendet zeigt den Wert ohne Vorzeichen.",batterySignDefault:"Standard",batterySignInverted:"Invertiert",batterySignHidden:"Ausgeblendet",noUiMode:"Kein-UI-Modus",noUiModeHint:"Blendet die timeline und die Bedienelemente auf der Karte nach einigen Sekunden Inaktivität aus. Jedes Tippen oder Bewegen holt sie zurück. Ideal für ein wall display.",solarIrradianceEntity:"Sonneneinstrahlungs-Entität",solarIrradianceEntityHelp:"Wähle einen Sensor, der die globale kurzwellige Bestrahlung in W/m² meldet (typischerweise eine Ecowitt- / Davis- / private Wetterstation). Wenn gesetzt, ersetzen sein aktueller Zustand und sein Recorder-Verlauf Open-Meteo für die Live- und Vergangenheitsbestrahlung überall, wo sie erscheint (Zahl auf dem Sonnen-Chip, Y-Achse des PV-Diagramms, Färbung des Sonnenbogens). Prognosestunden bleiben bei Open-Meteo, da ein Sensor keine Zukunftswerte liefern kann.",buildingsSection:"Zuhause & Gebäude",buildingsHint:'Damit die Karte in dicht bebauten Stadtgebieten flüssig bleibt, werden nur Gebäude innerhalb des konfigurierten Radius um das Zuhause in 3D gerendert. Das Zuhause selbst bleibt voll deckend; nahe Gebäude werden mit der konfigurierten Deckkraft gerendert, sodass sie städtischen Kontext liefern, ohne mit den Datenoverlays zu konkurrieren. Der Cluster-Radius gruppiert angebaute Nebengebäude (Wintergärten, Garagen, Schuppen) in die "Zuhause"-Gruppe.',displayRadius:"Anzeigeradius",displayRadiusHelp:"Radius um das Zuhause, in dem Gebäude geladen und gezeichnet werden, bis zum Rand der ausgeblendeten Kartenscheibe. Senke ihn, um das Rendern auf einem langsamen Gerät zu erleichtern; 0 zeigt nur das Zuhause.",buildingCount:"Anzahl Gebäude",buildingCountHelp:"Maximale Anzahl naher Gebäude, die gezeichnet werden. Senke sie, um das Rendern auf einem langsamen Gerät zu erleichtern.",buildingRealSize:"Reale Gebäudehöhen",buildingRealSizeOn:"An",buildingRealSizeOff:"Aus",buildingRealSizeHint:"An: reale OpenStreetMap-Höhen verwenden (begrenzt, damit der Bildausschnitt lesbar bleibt). Aus: jedem Gebäude die gleiche feste Höhe unten geben.",buildingHeight:"Gebäudehöhe",buildingClusterRadius:"Cluster-Radius Zuhause",buildingOpacity:"Deckkraft der Umgebung",buildingColor:"Gebäudefarbe",buildingColorHelp:"Grundton, der auf die umliegenden Gebäude in der Szene angewendet wird.",shadowsSection:"Schatten",shadowsEnabled:"Schatten anzeigen",shadowsEnabledOn:"Angezeigt",shadowsEnabledOff:"Ausgeblendet",shadowsEnabledHint:"Schaltet die Bodenschatten ein oder aus, die die Gebäude werfen, während die Sonne wandert.",shadowOpacity:"Schattendeckkraft",shadowOpacityHint:"Deckkraft der geworfenen Bodenschatten.",resetSection:"Zurücksetzen",resetSectionHint:"Wartungswerkzeuge zum Löschen von Daten, die die Karte lokal zwischengespeichert hat.",resetCacheButton:"Datencache zurücksetzen",resetCacheWarning:"Achtung: dies löscht das zwischengespeicherte Open-Meteo-Wetter und den PV-Verlauf im Speicher für JEDE auf dieser Seite geöffnete Helios-Karte. Die verfeinerte Prognose verliert ihre 5 Tage Kalibrierung, bis sie erneut abgerufen sind (ein paar Minuten, je nach deinem HA-Server). Deine Daten in Home Assistant werden nie angetastet.",resetCacheDone:"Cache gelöscht ✓",aboutSection:"Über",aboutVersionLabel:"Version",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios wird von einem einzigen leidenschaftlichen Entwickler gebaut, mit viel Energie und sehr wenig Schlaf. Wenn dir meine Arbeit gefällt, hilft mir ein kleiner Stern auf GitHub schon enorm, und wenn du kannst, hält ein kleiner Kaffee das Projekt am Leben.",aboutDeveloperLabel:"Entwickler",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},el:{cardName:"Helios",cardDescription:"☀️ Μια προβολή 2.5D του σπιτιού σου σε πραγματικό χρόνο με τον ήλιο, τον καιρό, τη φωτοβολταϊκή παραγωγή, την μπαταρία και το δίκτυο, καθώς και ριγμένες σκιές και μια διαδραστική χρονογραμμή",period:{rangeLabel:"Περίοδος",forecast:"Πρόγνωση",today:"Σήμερα",week:"εβδομάδα",month:"μήνας",year:"έτος"},cloudCover:{cloudLow:"Χαμηλή νέφωση",cloudMid:"Μέση νέφωση",cloudHigh:"Υψηλή νέφωση"},editor:{locationSection:"Τοποθεσία",homeLatitude:"Γεωγραφικό πλάτος σπιτιού",homeLongitude:"Γεωγραφικό μήκος σπιτιού",locationHint:"Αντικατέστησε τη διεύθυνση του σπιτιού που χρησιμοποιείται ως κέντρο της κάρτας. Άφησε και τα δύο πεδία κενά για να χρησιμοποιηθεί το σπίτι που έχει ρυθμιστεί στο Home Assistant. Η αντικατάσταση εφαρμόζεται μόνο όταν ΚΑΙ ΤΑ ΔΥΟ πεδία περιέχουν έγκυρες συντεταγμένες.",uiAndMapSection:"Διεπαφή",autoRotate:"Αυτόματη περιστροφή κάμερας",autoRotateHint:"Μετά από λίγα δευτερόλεπτα αδράνειας, η κάμερα περιστρέφεται αργά γύρω από το σπίτι (περίπου 1.5°/s, αντίθετα από τη φαινόμενη κίνηση του ήλιου). Ένα σύρσιμο με ένα δάχτυλο σταματάει αμέσως την περιστροφή και αυτή συνεχίζεται μόλις αφήσεις. Απόφυγέ το σε πολύ παλιές συσκευές: η αυτόματη περιστροφή επιβάλλει μια απόδοση κάθε δευτερόλεπτο.",autoRotateOn:"Ενεργό",autoRotateOff:"Ανενεργό",dataDisplaySection:"Οντότητες και εμφάνιση δεδομένων",displayUpdateFrequency:"Λεπτομέρεια γραφήματος",displayUpdateFrequencyHelp:"Πόσα σημεία ανά ώρα σχεδιάζουν τα γραφήματα. Τα ίδια τα δεδομένα είναι πάντα τα 5λεπτα στατιστικά του Home Assistant; αυτό ελέγχει μόνο πόσο πυκνά σχεδιάζεται η καμπύλη: 1 = ένα σημείο ανά ώρα (το πιο ομαλό, το πιο ελαφρύ στην απόδοση), 6 = ένα σημείο κάθε 10 λεπτά (πλήρης λεπτομέρεια, το πιο βαρύ). Προεπιλογή 4 = ένα σημείο κάθε 15 λεπτά. Χαμήλωσέ το σε παλαιότερες ή πιο αργές συσκευές για να μειώσεις το κόστος απόδοσης. Η καμπύλη πρόβλεψης ακολουθεί τον ίδιο ρυθμό, οπότε μια πιο λεπτομερής ρύθμιση αναδεικνύει και τις σύντομες βυθίσεις σκιάς (ένα δέντρο που κόβει την παραγωγή για μισή ώρα) που μια ωριαία καμπύλη προσπερνά.",valueDecimals:"Δεκαδικά",valueDecimalsHelp:"Αριθμός δεκαδικών που εμφανίζονται σε κάθε τιμή. Η ισχύς εμφανίζεται πάντα σε kW και η ενέργεια σε kWh; αυτό ορίζει την ακρίβεια για όλες ώστε τα chips να διαβάζονται ομοιόμορφα. Από 0 έως 3, προεπιλογή 1.",powerUnit:"Μονάδα ισχύος",powerUnitHelp:"Μονάδα για κάθε ένδειξη ισχύος στην κάρτα (chips, επεξηγήσεις γραφήματος). Η ενέργεια την ακολουθεί επίσης, ώστε η κάρτα να παραμένει συνεπής: τα kW συνδυάζονται με kWh, τα W με Wh.",irradianceUnit:"Μονάδα ηλιακής σταθεράς",irradianceUnitHelp:"Μονάδα για την ένδειξη της ηλιακής σταθεράς (ακτινοβολίας) πάνω από τον ήλιο.",batterySign:"Σύμβολο μπαταρίας",batterySignHelp:"Σύμβολο που εμφανίζεται στο chip της μπαταρίας. Προεπιλογή είναι το μείον κατά τη φόρτιση και το συν κατά την εκφόρτιση· το Αντεστραμμένο το αναστρέφει· το Κρυμμένο δείχνει την τιμή χωρίς σύμβολο.",batterySignDefault:"Προεπιλογή",batterySignInverted:"Αντεστραμμένο",batterySignHidden:"Κρυμμένο",noUiMode:"Λειτουργία χωρίς περιβάλλον",noUiModeHint:"Ξεθωριάζει το timeline και τα χειριστήρια της κάρτας μετά από λίγα δευτερόλεπτα αδράνειας. Οποιοδήποτε άγγιγμα ή κίνηση τα επαναφέρει. Ιδανικό για wall display.",solarIrradianceEntity:"Οντότητα ηλιακής ακτινοβολίας",solarIrradianceEntityHelp:"Διάλεξε έναν αισθητήρα που αναφέρει την παγκόσμια βραχυκυματική ακτινοβολία σε W/m² (τυπικός σταθμός Ecowitt / Davis / προσωπικός). Όταν οριστεί, η τρέχουσα κατάστασή του και το ιστορικό του recorder αντικαθιστούν το Open-Meteo για τη ζωντανή + παρελθούσα ακτινοβολία όπου κι αν εμφανίζεται (αριθμός στο chip του ήλιου, άξονας Y του γραφήματος PV, χρωματισμός του ηλιακού τόξου). Οι ώρες πρόβλεψης παραμένουν στο Open-Meteo αφού ένας αισθητήρας δεν μπορεί να φέρει μελλοντικές τιμές.",buildingsSection:"Σπίτι και κτήρια",buildingsHint:'Για να παραμείνει η κάρτα ομαλή σε πυκνές αστικές περιοχές, μόνο τα κτήρια εντός της ρυθμισμένης ακτίνας γύρω από το σπίτι αποδίδονται σε 3D. Το ίδιο το σπίτι παραμένει σε πλήρη αδιαφάνεια; τα κοντινά κτήρια αποδίδονται με τη ρυθμισμένη αδιαφάνεια ώστε να παρέχουν αστικό πλαίσιο χωρίς να ανταγωνίζονται τις επικαλύψεις δεδομένων. Η ακτίνα συστάδας ομαδοποιεί τα συνδεδεμένα κτίσματα (βεράντες, γκαράζ, αποθήκες) στο σύνολο "σπίτι".',displayRadius:"Ακτίνα εμφάνισης",displayRadiusHelp:"Ακτίνα γύρω από το σπίτι στην οποία ανακτώνται και σχεδιάζονται τα κτήρια, μέχρι την άκρη του ξεθωριασμένου δίσκου του χάρτη. Χαμήλωσέ την για να ελαφρύνεις την απόδοση σε μια αργή συσκευή; το 0 δείχνει μόνο το σπίτι.",buildingCount:"Πλήθος κτηρίων",buildingCountHelp:"Μέγιστος αριθμός κοντινών κτηρίων προς σχεδίαση. Χαμήλωσέ τον για να ελαφρύνεις την απόδοση σε μια αργή συσκευή.",buildingRealSize:"Πραγματικά ύψη κτηρίων",buildingRealSizeOn:"Ενεργό",buildingRealSizeOff:"Ανενεργό",buildingRealSizeHint:"Ενεργό: χρησιμοποίησε τα πραγματικά ύψη OpenStreetMap (με όριο ώστε το καδράρισμα να παραμένει ευανάγνωστο). Ανενεργό: δώσε σε κάθε κτήριο το ίδιο σταθερό ύψος παρακάτω.",buildingHeight:"Ύψος κτηρίων",buildingClusterRadius:"Ακτίνα συστάδας σπιτιού",buildingOpacity:"Αδιαφάνεια περιβάλλοντος",buildingColor:"Χρώμα κτηρίων",buildingColorHelp:"Βασική απόχρωση που εφαρμόζεται στα γύρω κτήρια στη σκηνή.",shadowsSection:"Σκιές",shadowsEnabled:"Εμφάνιση σκιών",shadowsEnabledOn:"Εμφανείς",shadowsEnabledOff:"Κρυμμένες",shadowsEnabledHint:"Εναλλάσσει τις σκιές στο έδαφος που ρίχνουν τα κτήρια καθώς κινείται ο ήλιος.",shadowOpacity:"Αδιαφάνεια σκιών",shadowOpacityHint:"Αδιαφάνεια των σκιών που πέφτουν στο έδαφος.",resetSection:"Επαναφορά",resetSectionHint:"Εργαλεία συντήρησης για διαγραφή δεδομένων που η κάρτα έχει αποθηκεύσει τοπικά στην κρυφή μνήμη.",resetCacheButton:"Επαναφορά κρυφής μνήμης δεδομένων",resetCacheWarning:"Προσοχή: αυτό καθαρίζει τον αποθηκευμένο καιρό του Open-Meteo και το ιστορικό PV στη μνήμη για ΚΑΘΕ κάρτα Helios που είναι ανοιχτή σε αυτή τη σελίδα. Η εκλεπτυσμένη πρόβλεψη θα χάσει τις 5 ημέρες βαθμονόμησής της μέχρι να ανακτηθούν ξανά (λίγα λεπτά ανάλογα με τον HA διακομιστή σου). Τα δεδομένα σου μέσα στο Home Assistant δεν αγγίζονται ποτέ.",resetCacheDone:"Η κρυφή μνήμη καθαρίστηκε ✓",aboutSection:"Σχετικά",aboutVersionLabel:"Έκδοση",aboutRepoCard:"Helios",aboutCoffeeMessage:"Το Helios φτιάχνεται από έναν παθιασμένο προγραμματιστή, με πολλή ενέργεια και πολύ λίγο ύπνο. Αν σου αρέσει η δουλειά μου, ένα μικρό αστέρι στο GitHub με βοηθάει ήδη πολύ, και αν μπορείς, ένας μικρός καφές κρατάει το έργο ζωντανό.",aboutDeveloperLabel:"Προγραμματιστής",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},en:Ge,es:{cardName:"Helios",cardDescription:"☀️ Una vista 2.5D en tiempo real de tu casa con el sol, el tiempo, la producción solar, la batería y la red, además de sombras proyectadas y una línea de tiempo interactiva",period:{rangeLabel:"Periodo",forecast:"Previsión",today:"Hoy",week:"semana",month:"mes",year:"año"},cloudCover:{cloudLow:"Nubosidad baja",cloudMid:"Nubosidad media",cloudHigh:"Nubosidad alta"},editor:{locationSection:"Ubicación",homeLatitude:"Latitud del domicilio",homeLongitude:"Longitud del domicilio",locationHint:"Sustituye la dirección del domicilio usada como centro de la tarjeta. Deja ambos campos vacíos para usar el domicilio configurado en Home Assistant. La sustitución solo se aplica cuando AMBOS campos contienen coordenadas válidas.",uiAndMapSection:"UI",autoRotate:"Rotación automática de la cámara",autoRotateHint:"Tras unos segundos de inactividad, la cámara orbita lentamente alrededor de la casa (unos 1.5°/s, en sentido contrario al movimiento aparente del sol). Un arrastre con un dedo la pausa al instante y se reanuda en cuanto sueltas. Evítala en dispositivos muy antiguos: la rotación automática fuerza un renderizado cada segundo.",autoRotateOn:"Activada",autoRotateOff:"Desactivada",dataDisplaySection:"Entidades y visualización de datos",displayUpdateFrequency:"Detalle del gráfico",displayUpdateFrequencyHelp:"Cuántos puntos por hora dibujan los gráficos. Los datos en sí siempre son las estadísticas de 5 minutos de Home Assistant; esto solo controla la densidad del trazado de la curva: 1 = un punto por hora (lo más suave, lo más ligero de renderizar), 6 = un punto cada 10 minutos (detalle máximo, lo más pesado). Por defecto 4 = un punto cada 15 minutos. Bájalo en dispositivos antiguos o lentos para reducir el coste de renderizado. La curva de previsión sigue la misma cadencia, así que un ajuste más fino también revela las bajadas cortas por sombra (un árbol que corta la producción media hora) que una curva horaria pasa por alto.",valueDecimals:"Decimales",valueDecimalsHelp:"Número de decimales mostrados en cada lectura de valor. La potencia siempre se muestra en kW y la energía en kWh; esto fija la precisión de todos para que los chips se lean uniformes. De 0 a 3, por defecto 1.",powerUnit:"Unidad de potencia",powerUnitHelp:"Unidad para cada lectura de potencia en la tarjeta (chips, información sobre herramientas del gráfico). La energía también la sigue, así que la tarjeta se mantiene coherente: kW se combina con kWh, y W con Wh.",irradianceUnit:"Unidad de constante solar",irradianceUnitHelp:"Unidad para la lectura de la constante solar (irradiancia) sobre el sol.",batterySign:"Signo de la batería",batterySignHelp:"Signo que se muestra en el chip de la batería. Por defecto es menos al cargar y más al descargar. Invertido lo cambia. Oculto muestra el valor sin signo.",batterySignDefault:"Por defecto",batterySignInverted:"Invertido",batterySignHidden:"Oculto",noUiMode:"Modo sin interfaz",noUiModeHint:"Atenúa el timeline y los controles de la tarjeta tras unos segundos de inactividad. Cualquier toque o movimiento los vuelve a mostrar. Ideal para un wall display.",solarIrradianceEntity:"Entidad de irradiancia solar",solarIrradianceEntityHelp:"Elige un sensor que reporte la irradiancia global de onda corta en W/m² (típico de estaciones Ecowitt / Davis / meteorológicas personales). Cuando se define, su estado actual y su historial del recorder reemplazan a Open-Meteo para la irradiancia en directo y pasada en todos los sitios donde aparece (número del chip del sol, eje Y del gráfico FV, coloreado del arco solar). Las horas de previsión siguen usando Open-Meteo, ya que un sensor no puede tener valores futuros.",buildingsSection:"Casa y edificios",buildingsHint:'Para mantener la tarjeta fluida en zonas urbanas densas, solo se renderizan en 3D los edificios dentro del radio configurado alrededor de la casa. La casa en sí se mantiene a plena opacidad; los edificios cercanos se renderizan con la opacidad configurada para dar contexto urbano sin competir con las capas de datos. El radio de agrupación reúne los anexos adosados (porches, garajes, cobertizos) en el grupo "casa".',displayRadius:"Radio de visualización",displayRadiusHelp:"Radio alrededor de la casa en el que se obtienen y dibujan los edificios, hasta el borde del disco del mapa difuminado. Bájalo para aligerar el renderizado en un dispositivo lento; 0 muestra solo la casa.",buildingCount:"Número de edificios",buildingCountHelp:"Número máximo de edificios cercanos a dibujar. Bájalo para aligerar el renderizado en un dispositivo lento.",buildingRealSize:"Alturas reales de los edificios",buildingRealSizeOn:"Sí",buildingRealSizeOff:"No",buildingRealSizeHint:"Sí: usa las alturas reales de OpenStreetMap (limitadas para mantener un encuadre legible). No: da a cada edificio la misma altura fija de abajo.",buildingHeight:"Altura de los edificios",buildingClusterRadius:"Radio de agrupación de la casa",buildingOpacity:"Opacidad del entorno",buildingColor:"Color de los edificios",buildingColorHelp:"Tinte base aplicado a los edificios del entorno en la escena.",shadowsSection:"Sombras",shadowsEnabled:"Mostrar sombras",shadowsEnabledOn:"Mostradas",shadowsEnabledOff:"Ocultas",shadowsEnabledHint:"Activa o oculta las sombras proyectadas en el suelo por los edificios a medida que el sol se mueve.",shadowOpacity:"Opacidad de las sombras",shadowOpacityHint:"Opacidad de las sombras proyectadas en el suelo.",resetSection:"Restablecer",resetSectionHint:"Herramientas de mantenimiento para borrar los datos que la tarjeta ha guardado en caché localmente.",resetCacheButton:"Restablecer la caché de datos",resetCacheWarning:"Aviso: esto borra el tiempo de Open-Meteo en caché y el historial FV en memoria de TODAS las tarjetas Helios abiertas en esta página. La previsión afinada perderá sus 5 días de calibración hasta que se vuelvan a obtener (unos minutos según tu servidor HA). Tus datos dentro de Home Assistant nunca se tocan.",resetCacheDone:"Caché borrada ✓",aboutSection:"Acerca de",aboutVersionLabel:"Versión",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios lo construye un único desarrollador apasionado, con mucha energía y muy poco sueño. Si te gusta mi trabajo, una pequeña estrella en GitHub ya me ayuda muchísimo, y si puedes, un pequeño café mantiene vivo el proyecto.",aboutDeveloperLabel:"Desarrollador",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},et:{cardName:"Helios",cardDescription:"☀️ Reaalajas 2.5D-vaade sinu kodust koos päikese, ilma, päikesetootmise, aku ja võrguga, lisaks heidetud varjud ja interaktiivne ajateljel",period:{rangeLabel:"Ajavahemik",forecast:"Prognoos",today:"Täna",week:"nädal",month:"kuu",year:"aasta"},cloudCover:{cloudLow:"Madal pilvkate",cloudMid:"Keskmine pilvkate",cloudHigh:"Kõrge pilvkate"},editor:{locationSection:"Asukoht",homeLatitude:"Kodu laiuskraad",homeLongitude:"Kodu pikkuskraad",locationHint:"Alista kodu aadress, mida kasutatakse kaardi keskmena. Jäta mõlemad väljad tühjaks, et kasutada Home Assistantis seadistatud kodu. Alistamine rakendub ainult siis, kui MÕLEMAD väljad on seatud kehtivatele koordinaatidele.",uiAndMapSection:"UI",autoRotate:"Kaamera automaatne pööramine",autoRotateHint:"Kui ollakse paar sekundit tegevusetu, tiirleb kaamera aeglaselt kodu ümber (umbes 1.5°/s, vastupidi päikese näivale liikumisele). Ühe sõrmega lohistamine peatab selle koheselt ja see jätkub, kui lahti lased. Väldi seda väga vanadel seadmetel: automaatne pööramine sunnib renderdamise iga sekund.",autoRotateOn:"Sees",autoRotateOff:"Väljas",dataDisplaySection:"Olemid ja andmete kuvamine",displayUpdateFrequency:"Graafiku detailsus",displayUpdateFrequencyHelp:"Mitu punkti tunnis graafikud joonistavad. Andmed ise on alati Home Assistanti 5-minutiline statistika; see juhib ainult, kui tihedalt kõver joonistatakse: 1 = üks punkt tunnis (sujuvaim, kergeim renderdada), 6 = üks punkt iga 10 minuti järel (täisdetailsus, raskeim). Vaikimisi 4 = punkt iga 15 minuti järel. Vähenda seda vanematel või aeglasematel seadmetel renderduskulu vähendamiseks. Prognoosikõver järgib sama tempot, nii et peenem säte toob esile ka lühikesed varjulohud (puu, mis varjab tootmist pool tundi), millest tunnikõver üle astub.",valueDecimals:"Kümnendkohad",valueDecimalsHelp:"Igal väärtuse näidul kuvatavate kümnendkohtade arv. Võimsus kuvatakse alati kilovattides (kW) ja energia kilovatt-tundides (kWh); see määrab täpsuse neile kõigile, et kiibid näeksid ühtlased välja. 0 kuni 3, vaikimisi 1.",powerUnit:"Võimsuse ühik",powerUnitHelp:"Ühik iga võimsuse näidu jaoks kaardil (kiibid, graafiku kohtspikrid). Energia järgib seda samuti, nii et kaart jääb ühtseks: kW sobib kWh-ga, W Wh-ga.",irradianceUnit:"Päikesekonstandi ühik",irradianceUnitHelp:"Ühik päikesekonstandi (kiirgustugevuse) näidu jaoks päikese kohal.",batterySign:"Aku märk",batterySignHelp:"Aku kiibil kuvatav märk. Vaikimisi on laadimisel miinus ja tühjenemisel pluss. Ümberpööratud vahetab need. Peidetud kuvab väärtuse ilma märgita.",batterySignDefault:"Vaikimisi",batterySignInverted:"Ümberpööratud",batterySignHidden:"Peidetud",noUiMode:"Liideseta režiim",noUiModeHint:"Hajutab timeline'i ja kaardi juhtnupud pärast mõnesekundilist tegevusetust. Iga puudutus või liigutus toob need tagasi. Suurepärane wall display jaoks.",solarIrradianceEntity:"Päikesekiirguse olem",solarIrradianceEntityHelp:"Vali andur, mis raporteerib globaalse lühilaine kiirgustugevuse ühikus W/m² (tüüpiliselt Ecowitt / Davis / isiklik ilmajaam). Kui see on määratud, asendab selle praegune olek ja salvestaja ajalugu Open-Meteo otse- ja minevikukiirguse jaoks kõikjal, kus see esineb (päikesekiibi number, päikesegraafiku Y-telg, päikesekaare värvimine). Prognoosi tunnid jäävad Open-Meteo peale, kuna andur ei saa kanda tulevasi väärtusi.",buildingsSection:"Kodu & hooned",buildingsHint:'Et hoida kaart tihedalt asustatud linnapiirkondades sujuvana, renderdatakse 3D-s ainult kodu ümber seadistatud raadiuse sees olevad hooned. Kodu ise jääb täiesti läbipaistmatuks; lähedalasuvad hooned renderdatakse seadistatud läbipaistmatusega, et need annaksid linnakonteksti ilma andmekihtidega võistlemata. Klastri raadius koondab külgneva kõrvalhooned (verandad, garaažid, kuurid) "kodu" hulka.',displayRadius:"Kuvamisraadius",displayRadiusHelp:"Kodu ümber olev raadius, mille sees hooned tõmmatakse ja joonistatakse, kuni tuhmunud kaardiketta servani. Vähenda seda, et kergendada renderdamist aeglasel seadmel; 0 näitab ainult kodu.",buildingCount:"Hoonete arv",buildingCountHelp:"Joonistatavate lähedalasuvate hoonete maksimaalne arv. Vähenda seda, et kergendada renderdamist aeglasel seadmel.",buildingRealSize:"Tegelikud hoonete kõrgused",buildingRealSizeOn:"Sees",buildingRealSizeOff:"Väljas",buildingRealSizeHint:"Sees: kasuta tegelikke OpenStreetMap kõrgusi (piiratud, et kadreering jääks loetavaks). Väljas: anna igale hoonele sama allpool olev fikseeritud kõrgus.",buildingHeight:"Hoone kõrgus",buildingClusterRadius:"Kodu klastri raadius",buildingOpacity:"Ümbruse läbipaistmatus",buildingColor:"Hoone värv",buildingColorHelp:"Stseenis ümbritsevatele hoonetele rakendatav põhitoon.",shadowsSection:"Varjud",shadowsEnabled:"Näita varje",shadowsEnabledOn:"Näidatud",shadowsEnabledOff:"Peidetud",shadowsEnabledHint:"Lülitab sisse/välja maapinna varjud, mida hooned heidavad päikese liikudes.",shadowOpacity:"Varju läbipaistmatus",shadowOpacityHint:"Heidetud maapinna varjude läbipaistmatus.",resetSection:"Lähtesta",resetSectionHint:"Hooldustööriistad, et kustutada andmed, mille kaart on kohalikult vahemällu salvestanud.",resetCacheButton:"Lähtesta andmete vahemälu",resetCacheWarning:"Hoiatus: see kustutab vahemällu salvestatud Open-Meteo ilma ja mälus oleva päikesetootmise ajaloo KÕIGI sellel lehel avatud Helios-kaartide jaoks. Täpsustatud prognoos kaotab oma 5 päeva kalibreeringu, kuni need uuesti tõmmatakse (paar minutit sõltuvalt sinu HA serverist). Sinu andmeid Home Assistanti sees ei puudutata kunagi.",resetCacheDone:"Vahemälu tühjendatud ✓",aboutSection:"Teave",aboutVersionLabel:"Versioon",aboutRepoCard:"Helios",aboutCoffeeMessage:"Heliose on ehitanud üks kirglik arendaja, suure energia ja väga vähese unega. Kui sulle meeldib minu töö, aitab väike täht GitHubis mind juba palju, ja kui saad, hoiab väike kohv projekti elus.",aboutDeveloperLabel:"Arendaja",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Osta mulle kohv"}},fi:{cardName:"Helios",cardDescription:"☀️ Reaaliaikainen 2.5D-näkymä kodistasi auringon, sään, aurinkotuotannon, akun ja verkon kanssa, lisäksi heitetyt varjot ja vuorovaikutteinen aikajana",period:{rangeLabel:"Aikaväli",forecast:"Ennuste",today:"Tänään",week:"viikko",month:"kuukausi",year:"vuosi"},cloudCover:{cloudLow:"Matala pilvisyys",cloudMid:"Keskikorkea pilvisyys",cloudHigh:"Korkea pilvisyys"},editor:{locationSection:"Sijainti",homeLatitude:"Kodin leveysaste",homeLongitude:"Kodin pituusaste",locationHint:"Ohita kotiosoite, jota käytetään kortin keskipisteenä. Jätä molemmat kentät tyhjiksi käyttääksesi Home Assistantissa määritettyä kotia. Ohitus otetaan käyttöön vain, kun MOLEMMAT kentät on asetettu kelvollisiin koordinaatteihin.",uiAndMapSection:"UI",autoRotate:"Kameran automaattinen kierto",autoRotateHint:"Kun on oltu käyttämättömänä muutaman sekunnin, kamera kiertää hitaasti kodin ympäri (noin 1.5°/s, vastakkain auringon näennäisen liikkeen kanssa). Yhden sormen veto keskeyttää sen heti, ja se jatkuu, kun päästät irti. Vältä sitä hyvin vanhoilla laitteilla: automaattinen kierto pakottaa renderöinnin joka sekunti.",autoRotateOn:"Päällä",autoRotateOff:"Pois",dataDisplaySection:"Entiteetit ja tietojen näyttö",displayUpdateFrequency:"Kaavion tarkkuus",displayUpdateFrequencyHelp:"Kuinka monta pistettä tunnissa kaaviot piirtävät. Itse data on aina Home Assistantin 5 minuutin tilastoa; tämä ohjaa vain, kuinka tiheästi käyrä piirretään: 1 = yksi piste tunnissa (tasaisin, kevyin renderöidä), 6 = yksi piste 10 minuutin välein (täysi tarkkuus, raskain). Oletus 4 = piste 15 minuutin välein. Laske sitä vanhemmilla tai hitaammilla laitteilla renderöintikustannusten vähentämiseksi. Ennustekäyrä noudattaa samaa tahtia, joten hienompi asetus tuo esiin myös lyhyet varjonotkahdukset (puu, joka varjostaa tuotantoa puoli tuntia), jotka tuntikäyrä ylittää.",valueDecimals:"Desimaalit",valueDecimalsHelp:"Jokaisessa arvolukemassa näytettävien desimaalien määrä. Teho näytetään aina kilowatteina (kW) ja energia kilowattitunteina (kWh); tämä asettaa tarkkuuden niille kaikille, jotta sirut näkyvät yhtenäisinä. 0-3, oletus 1.",powerUnit:"Tehon yksikkö",powerUnitHelp:"Yksikkö jokaiselle kortin teholukemalle (sirut, kaavion työkaluvihjeet). Energia noudattaa sitä myös, joten kortti pysyy yhtenäisenä: kW yhdistyy kWh:hon, W Wh:hon.",irradianceUnit:"Aurinkovakion yksikkö",irradianceUnitHelp:"Yksikkö auringon yläpuolella olevalle aurinkovakion (irradianssin) lukemalle.",batterySign:"Akun merkki",batterySignHelp:"Akun chipissä näkyvä merkki. Oletuksena miinus ladattaessa ja plus purettaessa. Käänteinen vaihtaa ne. Piilotettu näyttää arvon ilman merkkiä.",batterySignDefault:"Oletus",batterySignInverted:"Käänteinen",batterySignHidden:"Piilotettu",noUiMode:"Ilman käyttöliittymää -tila",noUiModeHint:"Häivyttää timelinen ja kortin säätimet muutaman toimettoman sekunnin jälkeen. Mikä tahansa kosketus tai liike tuo ne takaisin. Loistava wall display -näyttöön.",solarIrradianceEntity:"Auringon irradianssin entiteetti",solarIrradianceEntityHelp:"Valitse anturi, joka raportoi globaalin lyhytaaltoisen irradianssin yksikössä W/m² (tyypillisesti Ecowitt / Davis / oma sääasema). Kun se on asetettu, sen nykyinen tila ja tallentimen historia korvaavat Open-Meteon live- ja menneessä irradianssissa kaikkialla, missä se esiintyy (aurinkosirun luku, aurinkosähkökaavion Y-akseli, aurinkokaaren väritys). Ennustetunnit pysyvät Open-Meteossa, koska anturi ei voi kantaa tulevia arvoja.",buildingsSection:"Koti & rakennukset",buildingsHint:'Jotta kortti pysyy sujuvana tiheillä kaupunkialueilla, vain kodin ympärillä määritetyn säteen sisällä olevat rakennukset renderöidään 3D:nä. Koti itse pysyy täysin läpinäkymättömänä; lähellä olevat rakennukset renderöidään määritetyllä läpinäkymättömyydellä, jotta ne tarjoavat kaupunkikontekstia kilpailematta tietopeitteiden kanssa. Klusterisäde ryhmittelee liittyvät ulkorakennukset (kuistit, autotallit, vajat) "koti"-joukkoon.',displayRadius:"Näyttösäde",displayRadiusHelp:"Säde kodin ympärillä, jonka sisällä rakennukset haetaan ja piirretään, aina haalistuneen karttalevyn reunaan asti. Laske sitä keventääksesi renderöintiä hitaalla laitteella; 0 näyttää vain kodin.",buildingCount:"Rakennusten määrä",buildingCountHelp:"Piirrettävien lähirakennusten enimmäismäärä. Laske sitä keventääksesi renderöintiä hitaalla laitteella.",buildingRealSize:"Todelliset rakennuskorkeudet",buildingRealSizeOn:"Päällä",buildingRealSizeOff:"Pois",buildingRealSizeHint:"Päällä: käytä todellisia OpenStreetMap-korkeuksia (rajoitettu, jotta rajaus pysyy luettavana). Pois: anna jokaiselle rakennukselle sama alla oleva kiinteä korkeus.",buildingHeight:"Rakennuksen korkeus",buildingClusterRadius:"Kodin klusterisäde",buildingOpacity:"Ympäristön läpinäkymättömyys",buildingColor:"Rakennuksen väri",buildingColorHelp:"Ympäröiviin rakennuksiin näkymässä sovellettu perussävy.",shadowsSection:"Varjot",shadowsEnabled:"Näytä varjot",shadowsEnabledOn:"Näytetään",shadowsEnabledOff:"Piilotettu",shadowsEnabledHint:"Kytkee päälle/pois rakennusten maahan heittämät varjot auringon liikkuessa.",shadowOpacity:"Varjon läpinäkymättömyys",shadowOpacityHint:"Maahan heitettyjen varjojen läpinäkymättömyys.",resetSection:"Nollaa",resetSectionHint:"Huoltotyökalut kortin paikallisesti välimuistiin tallentamien tietojen pyyhkimiseen.",resetCacheButton:"Nollaa tietovälimuisti",resetCacheWarning:"Varoitus: tämä tyhjentää välimuistissa olevan Open-Meteo-sään ja muistissa olevan aurinkosähköhistorian JOKAISELLE tällä sivulla avoinna olevalle Helios-kortille. Tarkennettu ennuste menettää 5 päivän kalibrointinsa, kunnes ne haetaan uudelleen (muutama minuutti HA-palvelimestasi riippuen). Tietojasi Home Assistantin sisällä ei koskaan kosketa.",resetCacheDone:"Välimuisti tyhjennetty ✓",aboutSection:"Tietoja",aboutVersionLabel:"Versio",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helioksen on rakentanut yksi intohimoinen kehittäjä, paljolla energialla ja hyvin vähällä unella. Jos pidät työstäni, pieni tähti GitHubissa auttaa minua jo paljon, ja jos voit, pieni kahvi pitää projektin elossa.",aboutDeveloperLabel:"Kehittäjä",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Osta minulle kahvi"}},fr:{cardName:"Helios",cardDescription:"☀️ Une vue 2.5D temps réel de votre maison avec le soleil, la météo, la production solaire, la batterie et le réseau, plus les ombres projetées et une frise temporelle interactive",period:{rangeLabel:"Période",forecast:"Prévision",yesterday:"Hier",today:"Aujourd'hui",week:"Semaine",month:"Mois",year:"Année"},cloudCover:{cloudLow:"Couverture basse",cloudMid:"Couverture moyenne",cloudHigh:"Couverture haute"},mapConfig:{section:"Configuration de la carte",intro:"Le fond de carte est dessiné à partir des tuiles vectorielles OpenStreetMap. Auto suit votre thème, Dark / Light en force un, et Custom vous laisse choisir chaque couleur et masquer les couches.",modeAuto:"Auto",modeDark:"Dark",modeLight:"Light",modeCustom:"Custom",land:"Fond de carte",water:"Eau",wood:"Forêts et bois",grass:"Espaces verts",sand:"Sable",wetland:"Zones humides",ice:"Glace",landuse:"Zones bâties",roadMajor:"Grandes routes",roadMinor:"Petites routes",roadCasing:"Contour des routes",path:"Chemins",rail:"Voies ferrées",building:"Bâtiments",boundary:"Limites"},editor:{locationSection:"Emplacement de la maison",homeLatitude:"Latitude du domicile",homeLongitude:"Longitude du domicile",locationHint:"Remplace l'adresse du domicile utilisée comme centre de la carte. Laissez les deux champs vides pour utiliser le domicile configuré dans Home Assistant. La substitution n'est appliquée que lorsque LES DEUX champs contiennent des coordonnées valides.",uiAndMapSection:"UI",autoRotate:"Rotation auto de la caméra",autoRotateHint:"Après quelques secondes d'inactivité, la caméra tourne lentement autour de la maison (environ 1,5°/s, dans le sens inverse du mouvement apparent du soleil). Un glissement à un doigt met la rotation en pause immédiatement, elle reprend dès que vous lâchez. À éviter sur les appareils très anciens : la rotation auto force un rendu chaque seconde.",autoRotateOn:"Activée",autoRotateOff:"Désactivée",dataDisplaySection:"Affichage des données",displayUpdateFrequency:"Détail du graphique",displayUpdateFrequencyHelp:"Combien de points par heure les graphiques tracent. La donnée elle-même est toujours en 5 minutes (statistiques Home Assistant) - ce réglage ne change que la densité de tracé de la courbe : 1 = un point par heure (le plus lisse, le plus léger), 6 = un point toutes les 10 minutes (détail maximal, le plus lourd). Par défaut 4 = un point toutes les 15 minutes. Baissez-le sur un appareil ancien ou lent pour réduire le coût d'affichage. La courbe de prévision suit la même cadence : un réglage plus fin fait donc ressortir les creux d'ombre courts (un arbre qui coupe la production une demi-heure) qu'une courbe horaire enjambe.",valueDecimals:"Décimales",valueDecimalsHelp:"Nombre de décimales affichées sur chaque valeur, pour que les chips restent uniformes. S'applique aux valeurs en kW (les watts entiers restent sans décimale) et aux kWh. De 0 à 3, par défaut 1.",powerUnit:"Unité de puissance",powerUnitHelp:"Unité de tous les affichages de puissance de la carte (chips, infobulles du graphe). L'énergie suit aussi, pour que la carte reste cohérente : kW va avec kWh, W avec Wh.",irradianceUnit:"Unité de constante solaire",irradianceUnitHelp:"Unité de la constante solaire (irradiance) affichée au-dessus du soleil.",batterySign:"Signe batterie",batterySignHelp:"Signe affiché sur le chip batterie. Par défaut : moins en charge, plus en décharge. Inversé : l'inverse. Masqué : la valeur sans signe.",batterySignDefault:"Par défaut",batterySignInverted:"Inversé",batterySignHidden:"Masqué",noUiMode:"Mode sans interface",noUiModeHint:"Fait disparaître la timeline et les contrôles de la carte après quelques secondes d'inactivité. Le moindre appui ou mouvement les fait revenir. Idéal pour un affichage mural.",noUiDelay:"Délai avant masquage",noUiDelayHint:"Secondes d'inactivité avant que la frise et les contrôles disparaissent en mode sans interface. 0 garde l'interface masquée en permanence. Utilisé uniquement quand le mode sans interface est activé.",showTimeline:"Afficher la timeline",showTimelineHint:"Affiche la frise temporelle et le sélecteur de période sous la scène. Désactivé, il ne reste que la scène.",showDetailPanel:"Afficher les informations supplémentaires",showDetailPanelHint:"Autorise le mini-panneau par chip (métriques agrégées) à s'ouvrir en haut à droite au tap d'un chip. Désactivé, il ne s'affiche jamais.",showSunTimes:"Afficher les heures de lever / coucher du soleil",showSunTimesHint:"Affiche les heures de lever et de coucher du soleil et leurs marqueurs aux pieds de l'arc solaire.",lockRotation:"Verrouiller la rotation",lockRotationHint:"Réglez l'angle de vue directement dans l'aperçu (glissez pour tourner et incliner la scène), puis activez le verrou pour le figer : le glisser-tourner et l'auto-rotation au repos sont désactivés, l'angle réglé est conservé.",chipsSection:"Affichage des entités",chipsIntro:"Affichez ou masquez chaque entité, et choisissez son icône et sa couleur. La maison suit le chip sélectionné, ou votre couleur primaire par défaut.",chipIrradiance:"Affichage de l'irradiance",chipProduction:"Affichage de la production",chipGrid:"Affichage du réseau",chipBattery:"Affichage de la batterie",chipHome:"Affichage de la consommation",groupsConfigTitle:"Configuration des groupes",optionalSensors:"Capteurs optionnels",solarIrradianceEntity:"Entité d'irradiance solaire",solarIrradianceEntityHelp:"Choisissez un capteur qui remonte l'irradiance solaire globale en W/m² (typiquement une station météo Ecowitt / Davis / perso). Quand il est défini, son état actuel et son historique recorder remplacent Open-Meteo pour les valeurs live + passées partout où elles apparaissent (nombre sur la pastille soleil, axe Y du graphique PV, coloration de l'arc solaire). Les heures de prévision continuent d'utiliser Open-Meteo, un capteur ne peut pas avoir de valeurs dans le futur.",liveDataTitle:"État de la configuration",liveDataIntro:"Les chips live n'affichent que des capteurs mesurés. Chaque famille a besoin du capteur de puissance optionnel de sa source du dashboard énergie - les courbes et totaux viennent toujours de vos compteurs.",liveSolarOk:"Solaire : capteur de puissance live détecté.",liveSolarMissing:"Solaire : pas de capteur de puissance live, le chip de production reste masqué. Ajoutez-le dans Paramètres > Tableaux de bord > Énergie > Panneaux solaires.",liveSolarAbsent:"Solaire : pas configuré dans votre dashboard énergie. Ajoutez des panneaux solaires pour obtenir le chip de production.",liveGridOk:"Réseau : capteur de puissance live détecté.",liveGridMissing:"Réseau : pas de capteur de puissance live, les chips import/export restent masqués. Ajoutez-le dans Paramètres > Tableaux de bord > Énergie > Réseau.",liveGridMiswired:"Réseau : le capteur live contredit vos compteurs (il semble ne mesurer qu'un seul sens). Les chips restent masqués - configurez un capteur signé ou le mode Deux capteurs.",liveGridAbsent:"Réseau : pas configuré dans votre dashboard énergie. Ajoutez le réseau pour obtenir les chips import et export.",liveBatteryOk:"Batterie : les capteurs de puissance couvrent chaque batterie.",liveBatteryMissing:"Batterie : puissance live manquante sur au moins une batterie, le chip de puissance reste masqué. Ajoutez le(s) capteur(s) dans Paramètres > Tableaux de bord > Énergie > Batterie.",liveBatteryAbsent:"Batterie : pas configurée dans votre dashboard énergie. Ajoutez une batterie pour obtenir le chip charge et décharge.",liveHomeOk:"Consommation de la maison : affichée, dérivée des familles live ci-dessus.",liveHomeNote:"La consommation de la maison s'affiche dès que chaque famille configurée ci-dessus a son capteur live.",openEnergyConfig:"Ouvrir la configuration Énergie",buildingsSection:"Maison & bâtiments",buildingsHint:"Pour ménager les performances en zone urbaine dense, seuls les bâtiments dans le rayon configuré autour de la maison sont rendus en 3D. La maison elle-même reste toujours à pleine opacité, les bâtiments voisins sont rendus en transparence pour donner le contexte sans concurrencer les données. Le rayon de regroupement permet d'inclure les bâtiments attenants (véranda, dépendance, garage) dans le groupe « maison ».",displayRadius:"Rayon d'affichage",displayRadiusHelp:"Rayon autour de la maison dans lequel les bâtiments sont récupérés et affichés, jusqu'au bord du disque de carte estompé. Baissez-le pour alléger le rendu sur un appareil lent - à 0, seule la maison reste.",buildingCount:"Nombre de bâtiments",buildingCountHelp:"Nombre maximum de bâtiments voisins à afficher. Baissez-le pour alléger le rendu sur un appareil lent.",buildingRealSize:"Hauteurs réelles des bâtiments",buildingRealSizeOn:"Oui",buildingRealSizeOff:"Non",buildingRealSizeHint:"Oui : utilise les hauteurs réelles OpenStreetMap (plafonnées pour garder un cadrage lisible). Non : applique à chaque bâtiment la hauteur fixe ci-dessous.",buildingHeight:"Hauteur des bâtiments",hiddenDevicesEmpty:"Aucun appareil individuel n'est encore suivi dans votre tableau de bord Énergie. Ajoutez-y la consommation par appareil pour les gérer ici.",deviceVisibilityLabel:"Afficher l'appareil",deviceGroupLabel:"Groupe de suivi",group:"Groupe",noGroup:"Aucun groupe",devicesEnergyNote:"Voici les appareils individuels actuellement configurés dans votre tableau de bord Énergie Home Assistant. L'œil affiche ou masque chacun partout, et la pastille l'assigne à un groupe.",buildingClusterRadius:"Rayon de regroupement maison",buildingClusterRadiusHelp:"Rayon autour de la maison dans lequel les dépendances attenantes (vérandas, garages, abris) sont considérées comme faisant partie de la maison : elles sont rendues à la pleine opacité et couleur de la maison, et non en voisines estompées. À 0, seul le bâtiment principal est conservé.",buildingOpacity:"Opacité des bâtiments voisins",buildingColor:"Couleur des bâtiments",buildingColorHelp:"Teinte de base appliquée aux bâtiments environnants dans la scène.",shadowsSection:"Ombres",shadowsEnabled:"Afficher les ombres",shadowsEnabledOn:"Affichées",shadowsEnabledOff:"Masquées",shadowsEnabledHint:"Active ou masque les ombres projetées au sol par les bâtiments au fil de la course du soleil.",shadowOpacity:"Opacité des ombres",shadowOpacityHint:"Opacité des ombres projetées au sol.",resetSection:"Réinitialisation",resetSectionHint:"Outils de maintenance : recharger les données mises en cache, ou remettre toutes les options à leur valeur par défaut.",resetCacheButton:"Réinitialiser le cache des données",resetCacheWarning:"Attention : ce bouton re-télécharge tout ce que la carte a mis en cache - la météo Open-Meteo, toutes les séries d'énergie en mémoire (production, réseau, batterie, appareils, irradiance), la calibration de la prévision affinée et les empreintes de bâtiments OpenFreeMap - pour toutes les cartes Helios ouvertes. Utile pour débloquer une calibration figée ou des données météo/carte périmées - un rechargement complet prend quelques minutes selon votre serveur HA. Vos données dans Home Assistant ne sont jamais touchées.",resetCacheDone:"Cache vidé ✓",resetOptionsButton:"Réinitialiser les options",resetOptionsConfirm:"Cliquez à nouveau pour confirmer",resetOptionsWarning:"Attention : ceci remet TOUTES les options de cette carte à leurs valeurs par défaut - visibilité, couleurs et icônes des chips, noms/couleurs/icônes des groupes, bâtiments, ombres, unités et tous les autres réglages. Vos données Home Assistant et votre tableau de bord Énergie ne sont pas touchés, mais votre personnalisation est effacée et irrécupérable.",resetOptionsDone:"Options réinitialisées ✓",aboutSection:"À propos",aboutVersionLabel:"Version",aboutRepoCard:"Helios",aboutCoffeeMessage:"Je développe Helios seul, surtout la nuit, à traquer les petits détails jusqu'à ce que le soleil et votre énergie prennent vie à l'écran. S'il a trouvé une place sur votre tableau de bord, ça me rend déjà heureux - une étoile sur GitHub encore plus, et un café garde tout ça en mouvement.",aboutDeveloperLabel:"Développeur",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},hr:{cardName:"Helios",cardDescription:"☀️ 2.5D prikaz tvog doma u stvarnom vremenu sa suncem, vremenom, solarnom proizvodnjom, baterijom i mrežom, plus bačene sjene i interaktivna vremenska traka",period:{rangeLabel:"Vremenski raspon",forecast:"Prognoza",today:"Danas",week:"tjedan",month:"mjesec",year:"godina"},cloudCover:{cloudLow:"Niska naoblaka",cloudMid:"Srednja naoblaka",cloudHigh:"Visoka naoblaka"},editor:{locationSection:"Lokacija",homeLatitude:"Zemljopisna širina doma",homeLongitude:"Zemljopisna dužina doma",locationHint:"Zamjenjuje adresu doma koja se koristi kao središte kartice. Ostavi oba polja prazna da bi se koristio dom postavljen u Home Assistant. Zamjena se primjenjuje samo kada su OBA polja postavljena na valjane koordinate.",uiAndMapSection:"UI",autoRotate:"Automatska rotacija kamere",autoRotateHint:"Nakon nekoliko sekundi mirovanja kamera polako kruži oko doma (oko 1.5°/s, suprotno prividnom kretanju sunca). Povlačenje jednim prstom je odmah zaustavlja, a nastavlja se čim pustiš. Izbjegavaj na vrlo starim uređajima: automatska rotacija svaku sekundu prisiljava iscrtavanje.",autoRotateOn:"Uključeno",autoRotateOff:"Isključeno",dataDisplaySection:"Entiteti i prikaz podataka",displayUpdateFrequency:"Detalji grafa",displayUpdateFrequencyHelp:"Koliko točaka po satu grafovi iscrtavaju. Sami podaci su uvijek 5-minutne statistike Home Assistant; ovo kontrolira samo koliko gusto se crta krivulja: 1 = jedna točka po satu (najglađe, najlakše za iscrtavanje), 6 = jedna točka svakih 10 minuta (puni detalj, najteže). Zadano 4 = točka svakih 15 minuta. Smanji na starijim ili sporijim uređajima da smanjiš trošak iscrtavanja. Krivulja prognoze prati isti ritam, pa finija postavka razlučuje i kratke padove zbog sjene (stablo koje na pola sata zaklanja proizvodnju) koje satna krivulja preskoči.",valueDecimals:"Decimalna mjesta",valueDecimalsHelp:"Broj decimalnih mjesta prikazanih uz svaku vrijednost. Snaga je uvijek u kW, a energija u kWh; ovo postavlja preciznost za sve, da čipovi izgledaju ujednačeno. 0 do 3, zadano 1.",powerUnit:"Jedinica snage",powerUnitHelp:"Jedinica za svako očitanje snage na kartici (čipovi, opisi u grafu). Energija je slijedi, pa kartica ostaje dosljedna: kW ide uz kWh, W uz Wh.",irradianceUnit:"Jedinica solarne konstante",irradianceUnitHelp:"Jedinica za očitanje solarne konstante (ozračenja) iznad sunca.",batterySign:"Predznak baterije",batterySignHelp:"Predznak prikazan na čipu baterije. Zadano je minus tijekom punjenja i plus tijekom pražnjenja. Obrnuto ga preokreće. Skriveno prikazuje vrijednost bez predznaka.",batterySignDefault:"Zadano",batterySignInverted:"Obrnuto",batterySignHidden:"Skriveno",noUiMode:"Način bez sučelja",noUiModeHint:"Zatamnjuje timeline i kontrole na kartici nakon nekoliko sekundi neaktivnosti. Bilo koji dodir ili pomak vraća ih natrag. Sjajno za wall display.",solarIrradianceEntity:"Entitet sunčevog ozračenja",solarIrradianceEntityHelp:"Odaberi senzor koji javlja globalno kratkovalno ozračenje u W/m² (tipično Ecowitt / Davis / osobna meteorološka postaja). Kada je postavljen, njegovo trenutno stanje i povijest iz snimača zamjenjuju Open-Meteo za uživo i prošlo ozračenje svugdje gdje se pojavljuje (broj na čipu sunca, os Y grafa PV, bojanje sunčevog luka). Sati prognoze ostaju na Open-Meteo jer senzor ne može nositi buduće vrijednosti.",buildingsSection:"Dom i zgrade",buildingsHint:'Da bi kartica ostala glatka u gusto izgrađenim urbanim područjima, u 3D se iscrtavaju samo zgrade unutar postavljenog radijusa oko doma. Sam dom ostaje u punoj neprozirnosti; obližnje zgrade iscrtavaju se s postavljenom prozirnošću, tako da daju urbani kontekst bez natjecanja s podatkovnim slojevima. Radijus grupiranja okuplja prislonjene pomoćne zgrade (verande, garaže, šupe) u skupinu "doma".',displayRadius:"Radijus prikaza",displayRadiusHelp:"Radijus oko doma u kojem se zgrade dohvaćaju i crtaju, sve do ruba izblijedjelog diska karte. Smanji ga da olakšaš iscrtavanje na sporom uređaju; 0 prikazuje samo dom.",buildingCount:"Broj zgrada",buildingCountHelp:"Najveći broj obližnjih zgrada za iscrtavanje. Smanji ga da olakšaš iscrtavanje na sporom uređaju.",buildingRealSize:"Stvarne visine zgrada",buildingRealSizeOn:"Uključeno",buildingRealSizeOff:"Isključeno",buildingRealSizeHint:"Uključeno: koristi stvarne visine iz OpenStreetMap (ograničene da kadar ostane čitljiv). Isključeno: daj svakoj zgradi istu fiksnu visinu ispod.",buildingHeight:"Visina zgrade",buildingClusterRadius:"Radijus grupiranja doma",buildingOpacity:"Prozirnost okoline",buildingColor:"Boja zgrada",buildingColorHelp:"Osnovni ton primijenjen na okolne zgrade u sceni.",shadowsSection:"Sjene",shadowsEnabled:"Prikaži sjene",shadowsEnabledOn:"Prikazano",shadowsEnabledOff:"Skriveno",shadowsEnabledHint:"Uključuje ili isključuje sjene koje zgrade bacaju na tlo dok se sunce kreće.",shadowOpacity:"Prozirnost sjena",shadowOpacityHint:"Prozirnost bačenih sjena na tlu.",resetSection:"Resetiranje",resetSectionHint:"Alati za održavanje za brisanje podataka koje je kartica lokalno spremila u predmemoriju.",resetCacheButton:"Resetiraj predmemoriju podataka",resetCacheWarning:"Upozorenje: ovo briše predmemorirano vrijeme Open-Meteo i povijest PV u memoriji za SVAKU karticu Helios otvorenu na ovoj stranici. Pročišćena prognoza izgubit će svojih 5 dana kalibracije dok se ponovno ne dohvate (nekoliko minuta ovisno o tvom HA poslužitelju). Tvoji podaci unutar Home Assistant nikada se ne diraju.",resetCacheDone:"Predmemorija obrisana ✓",aboutSection:"O kartici",aboutVersionLabel:"Verzija",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios gradi jedan strastveni razvijatelj, s puno energije i vrlo malo sna. Ako ti se sviđa moj rad, mala zvjezdica na GitHub mi već jako pomaže, a ako možeš, mala kava održava projekt na životu.",aboutDeveloperLabel:"Razvijatelj",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Časti me kavom"}},hu:{cardName:"Helios",cardDescription:"☀️ Otthonod valós idejű 2.5D nézete a nappal, az időjárással, a napelemes termeléssel, az akkumulátorral és a hálózattal, ráadásul vetett árnyékokkal és interaktív idővonallal",period:{rangeLabel:"Időtartomány",forecast:"Előrejelzés",today:"Ma",week:"hét",month:"hónap",year:"év"},cloudCover:{cloudLow:"Alacsony felhőzet",cloudMid:"Közepes felhőzet",cloudHigh:"Magas felhőzet"},editor:{locationSection:"Hely",homeLatitude:"Otthon szélességi foka",homeLongitude:"Otthon hosszúsági foka",locationHint:"Felülírja a kártya középpontjaként használt otthoni címet. Hagyd mindkét mezőt üresen, hogy a Home Assistant beállított otthonát használd. A felülírás csak akkor érvényesül, ha MINDKÉT mező érvényes koordinátákra van állítva.",uiAndMapSection:"UI",autoRotate:"Kamera automatikus forgatása",autoRotateHint:"Néhány másodperc tétlenség után a kamera lassan az otthon körül kering (körülbelül 1.5°/s, a nap látszólagos mozgásával ellentétesen). Egyujjas húzás azonnal megállítja, és folytatódik, amint elengeded. Kerüld nagyon régi eszközökön: az automatikus forgatás másodpercenként újrarajzolásra kényszerít.",autoRotateOn:"Be",autoRotateOff:"Ki",dataDisplaySection:"Entitások és adatmegjelenítés",displayUpdateFrequency:"Grafikon részletessége",displayUpdateFrequencyHelp:"Hány pontot rajzolnak a grafikonok óránként. Maguk az adatok mindig a Home Assistant 5 perces statisztikái; ez csak azt szabályozza, milyen sűrűn van kirajzolva a görbe: 1 = egy pont óránként (a legsimább, a legkönnyebb kirajzolni), 6 = egy pont 10 percenként (teljes részletesség, a legnehezebb). Alapértelmezett 4 = egy pont 15 percenként. Csökkentsd régebbi vagy lassabb eszközökön a kirajzolási költség mérséklésére. Az előrejelzési görbe ugyanazt a ritmust követi, így a finomabb beállítás feloldja a rövid árnyékeséseket is (egy fa, ami fél órára eltakarja a termelést), amelyeket egy óránkénti görbe átlép.",valueDecimals:"Tizedesjegyek",valueDecimalsHelp:"Az egyes értékek mellett megjelenített tizedesjegyek száma. A teljesítmény mindig kW-ban, az energia kWh-ban jelenik meg; ez állítja be mindegyik pontosságát, hogy a chipek egységesek legyenek. 0-tól 3-ig, alapértelmezett 1.",powerUnit:"Teljesítmény mértékegysége",powerUnitHelp:"A kártya minden teljesítménykijelzésének mértékegysége (chipek, grafikon buboréksúgók). Az energia is ezt követi, így a kártya következetes marad: a kW a kWh-val, a W a Wh-val párosul.",irradianceUnit:"Napállandó mértékegysége",irradianceUnitHelp:"A nap fölött megjelenő napállandó (besugárzás) kijelzésének mértékegysége.",batterySign:"Akkumulátor előjele",batterySignHelp:"Az akkumulátor chipjén megjelenő előjel. Alapértelmezés szerint mínusz töltés közben és plusz kisütés közben. A Fordított megcseréli. A Rejtett előjel nélkül mutatja az értéket.",batterySignDefault:"Alapértelmezett",batterySignInverted:"Fordított",batterySignHidden:"Rejtett",noUiMode:"Felület nélküli mód",noUiModeHint:"Néhány másodpercnyi tétlenség után elhalványítja a timeline-t és a kártyán lévő vezérlőket. Bármilyen koppintás vagy mozdulat visszahozza őket. Kiváló wall display-hez.",solarIrradianceEntity:"Napsugárzás entitás",solarIrradianceEntityHelp:"Válassz egy érzékelőt, amely globális rövidhullámú besugárzást jelent W/m²-ben (jellemzően Ecowitt / Davis / saját időjárás-állomás). Ha be van állítva, az aktuális állapota és a rögzítő előzményei felváltják az Open-Meteo-t az élő és múltbeli besugárzásnál mindenhol, ahol megjelenik (nap chip szám, PV diagram Y tengely, napívszínezés). Az előrejelzési órák az Open-Meteo-n maradnak, mivel egy érzékelő nem hordozhat jövőbeli értékeket.",buildingsSection:"Otthon és épületek",buildingsHint:'Hogy a kártya sűrűn beépített városi területeken is sima maradjon, csak az otthon körüli beállított sugáron belüli épületek jelennek meg 3D-ben. Maga az otthon teljes átlátszatlanságban marad; a közeli épületek a beállított átlátszósággal jelennek meg, így városi kontextust adnak anélkül, hogy versenyeznének az adatrétegekkel. A csoportosítási sugár a hozzáépített melléképületeket (verandák, garázsok, fészerek) az "otthon" csoportba vonja.',displayRadius:"Megjelenítési sugár",displayRadiusHelp:"Az otthon körüli sugár, amelyen belül az épületeket lekéri és kirajzolja, egészen az elhalványuló térképkorong széléig. Csökkentsd, hogy lassú eszközön könnyítsd a kirajzolást; a 0 csak az otthont mutatja.",buildingCount:"Épületek száma",buildingCountHelp:"A kirajzolandó közeli épületek maximális száma. Csökkentsd, hogy lassú eszközön könnyítsd a kirajzolást.",buildingRealSize:"Valós épületmagasságok",buildingRealSizeOn:"Be",buildingRealSizeOff:"Ki",buildingRealSizeHint:"Be: valós OpenStreetMap magasságokat használ (korlátozva, hogy a keretezés olvasható maradjon). Ki: minden épületnek ugyanazt a lenti rögzített magasságot adja.",buildingHeight:"Épület magassága",buildingClusterRadius:"Otthon csoportosítási sugara",buildingOpacity:"Környező átlátszatlanság",buildingColor:"Épületek színe",buildingColorHelp:"A jelenetben a környező épületekre alkalmazott alapszínezet.",shadowsSection:"Árnyékok",shadowsEnabled:"Árnyékok megjelenítése",shadowsEnabledOn:"Megjelenítve",shadowsEnabledOff:"Elrejtve",shadowsEnabledHint:"Be- és kikapcsolja az épületek által a talajra vetett árnyékokat, ahogy a nap mozog.",shadowOpacity:"Árnyék átlátszatlansága",shadowOpacityHint:"A talajra vetett árnyékok átlátszatlansága.",resetSection:"Visszaállítás",resetSectionHint:"Karbantartási eszközök a kártya által helyileg gyorsítótárazott adatok törléséhez.",resetCacheButton:"Adatgyorsítótár visszaállítása",resetCacheWarning:"Figyelem: ez törli a gyorsítótárazott Open-Meteo időjárást és a memóriában lévő PV előzményeket MINDEN ezen az oldalon nyitva lévő Helios kártya esetében. A finomított előrejelzés elveszíti 5 napnyi kalibrációját, amíg újra le nem töltődnek (néhány perc a HA szerveredtől függően). A Home Assistant-en belüli adataidat soha nem érinti.",resetCacheDone:"Gyorsítótár törölve ✓",aboutSection:"Névjegy",aboutVersionLabel:"Verzió",aboutRepoCard:"Helios",aboutCoffeeMessage:"A Heliost egyetlen lelkes fejlesztő építi, rengeteg energiával és nagyon kevés alvással. Ha tetszik a munkám, egy kis csillag a GitHubon máris sokat segít, és ha teheted, egy kis kávé életben tartja a projektet.",aboutDeveloperLabel:"Fejlesztő",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Vegyél nekem egy kávét"}},it:{cardName:"Helios",cardDescription:"☀️ Una vista 2.5D in tempo reale di casa tua con il sole, il meteo, la produzione solare, la batteria e la rete, oltre alle ombre proiettate e una linea temporale interattiva",period:{rangeLabel:"Periodo",forecast:"Previsione",today:"Oggi",week:"settimana",month:"mese",year:"anno"},cloudCover:{cloudLow:"Nuvolosità bassa",cloudMid:"Nuvolosità media",cloudHigh:"Nuvolosità alta"},editor:{locationSection:"Posizione",homeLatitude:"Latitudine di casa",homeLongitude:"Longitudine di casa",locationHint:"Sostituisce l'indirizzo di casa usato come centro della scheda. Lascia entrambi i campi vuoti per usare la casa configurata in Home Assistant. La sostituzione viene applicata solo quando ENTRAMBI i campi contengono coordinate valide.",uiAndMapSection:"UI",autoRotate:"Rotazione automatica della camera",autoRotateHint:"Dopo qualche secondo di inattività, la camera ruota lentamente intorno alla casa (circa 1.5°/s, in senso opposto al moto apparente del sole). Un trascinamento con un dito la mette in pausa all'istante e riprende appena lasci. Da evitare su dispositivi molto vecchi: la rotazione automatica forza un rendering ogni secondo.",autoRotateOn:"Attiva",autoRotateOff:"Disattiva",dataDisplaySection:"Entità e visualizzazione dati",displayUpdateFrequency:"Dettaglio del grafico",displayUpdateFrequencyHelp:"Quanti punti per ora disegnano i grafici. I dati stessi sono sempre le statistiche a 5 minuti di Home Assistant; questo controlla solo quanto densamente viene tracciata la curva: 1 = un punto all'ora (la più morbida, la più leggera da rendere), 6 = un punto ogni 10 minuti (dettaglio massimo, la più pesante). Predefinito 4 = un punto ogni 15 minuti. Abbassalo su dispositivi vecchi o lenti per ridurre il costo di rendering. La curva di previsione segue la stessa cadenza, quindi un'impostazione più fine fa emergere anche i brevi cali d'ombra (un albero che taglia la produzione per mezz'ora) che una curva oraria scavalca.",valueDecimals:"Decimali",valueDecimalsHelp:"Numero di decimali mostrati su ogni valore. La potenza è sempre in kW e l'energia in kWh; questo imposta la precisione per tutti, così i chip restano uniformi. Da 0 a 3, predefinito 1.",powerUnit:"Unità di potenza",powerUnitHelp:"Unità per ogni lettura di potenza sulla scheda (chip, tooltip del grafico). Anche l'energia la segue, così la scheda resta coerente: kW si abbina a kWh, W a Wh.",irradianceUnit:"Unità della costante solare",irradianceUnitHelp:"Unità per la lettura della costante solare (irraggiamento) sopra il sole.",batterySign:"Segno della batteria",batterySignHelp:"Segno mostrato sul chip della batteria. Per impostazione predefinita è meno durante la carica e più durante la scarica. Invertito lo capovolge. Nascosto mostra il valore senza segno.",batterySignDefault:"Predefinito",batterySignInverted:"Invertito",batterySignHidden:"Nascosto",noUiMode:"Modalità senza interfaccia",noUiModeHint:"Sfuma la timeline e i controlli sulla scheda dopo alcuni secondi di inattività. Qualsiasi tocco o movimento li fa riapparire. Ottimo per un wall display.",solarIrradianceEntity:"Entità di irraggiamento solare",solarIrradianceEntityHelp:"Scegli un sensore che riporta l'irraggiamento globale a onda corta in W/m² (tipico delle stazioni Ecowitt / Davis / meteo personali). Quando impostato, il suo stato attuale e lo storico del recorder sostituiscono Open-Meteo per l'irraggiamento live e passato ovunque appaia (numero sul chip del sole, asse Y del grafico FV, colorazione dell'arco solare). Le ore di previsione restano su Open-Meteo, dato che un sensore non può avere valori futuri.",buildingsSection:"Casa ed edifici",buildingsHint:'Per mantenere la scheda fluida nelle zone urbane dense, solo gli edifici entro il raggio configurato attorno alla casa vengono resi in 3D. La casa stessa resta a piena opacità; gli edifici vicini vengono resi con l\'opacità configurata così da dare contesto urbano senza competere con i livelli di dati. Il raggio di raggruppamento unisce le pertinenze attigue (verande, garage, capanni) nel gruppo "casa".',displayRadius:"Raggio di visualizzazione",displayRadiusHelp:"Raggio attorno alla casa in cui gli edifici vengono recuperati e disegnati, fino al bordo del disco della mappa sfumato. Abbassalo per alleggerire il rendering su un dispositivo lento; 0 mostra solo la casa.",buildingCount:"Numero di edifici",buildingCountHelp:"Numero massimo di edifici vicini da disegnare. Abbassalo per alleggerire il rendering su un dispositivo lento.",buildingRealSize:"Altezze reali degli edifici",buildingRealSizeOn:"Sì",buildingRealSizeOff:"No",buildingRealSizeHint:"Sì: usa le altezze reali di OpenStreetMap (limitate per mantenere un'inquadratura leggibile). No: assegna a ogni edificio la stessa altezza fissa qui sotto.",buildingHeight:"Altezza degli edifici",buildingClusterRadius:"Raggio di raggruppamento casa",buildingOpacity:"Opacità degli edifici circostanti",buildingColor:"Colore degli edifici",buildingColorHelp:"Tinta di base applicata agli edifici circostanti nella scena.",shadowsSection:"Ombre",shadowsEnabled:"Mostra ombre",shadowsEnabledOn:"Mostrate",shadowsEnabledOff:"Nascoste",shadowsEnabledHint:"Attiva o nasconde le ombre proiettate al suolo dagli edifici mentre il sole si sposta.",shadowOpacity:"Opacità delle ombre",shadowOpacityHint:"Opacità delle ombre proiettate al suolo.",resetSection:"Reimposta",resetSectionHint:"Strumenti di manutenzione per cancellare i dati messi in cache localmente dalla scheda.",resetCacheButton:"Reimposta la cache dei dati",resetCacheWarning:"Attenzione: questo cancella il meteo Open-Meteo in cache e lo storico FV in memoria di OGNI scheda Helios aperta su questa pagina. La previsione affinata perderà i suoi 5 giorni di calibrazione finché non vengono recuperati di nuovo (qualche minuto a seconda del tuo server HA). I tuoi dati dentro Home Assistant non vengono mai toccati.",resetCacheDone:"Cache svuotata ✓",aboutSection:"Informazioni",aboutVersionLabel:"Versione",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios è realizzato da un solo sviluppatore appassionato, con tanta energia e pochissimo sonno. Se ti piace il mio lavoro, una piccola stella su GitHub mi aiuta già moltissimo, e se puoi, un piccolo caffè tiene in vita il progetto.",aboutDeveloperLabel:"Sviluppatore",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},lt:{cardName:"Helios",cardDescription:"☀️ Realaus laiko 2.5D tavo namų vaizdas su saule, oru, saulės gamyba, akumuliatoriumi ir tinklu, taip pat metami šešėliai ir interaktyvi laiko juosta",period:{rangeLabel:"Laiko intervalas",forecast:"Prognozė",today:"Šiandien",week:"savaitė",month:"mėnuo",year:"metai"},cloudCover:{cloudLow:"Žema debesuotumas",cloudMid:"Vidutinė debesuotumas",cloudHigh:"Aukšta debesuotumas"},editor:{locationSection:"Vieta",homeLatitude:"Namų platuma",homeLongitude:"Namų ilguma",locationHint:"Pakeisk namų adresą, naudojamą kaip žemėlapio centras. Palik abu laukus tuščius, kad būtų naudojami Home Assistant sukonfigūruoti namai. Pakeitimas taikomas tik tada, kai ABU laukai nustatyti į galiojančias koordinates.",uiAndMapSection:"UI",autoRotate:"Automatinis kameros sukimasis",autoRotateHint:"Kai kelias sekundes neaktyvi, kamera lėtai sukasi aplink namus (apie 1.5°/s, priešingai matomam saulės judėjimui). Vilkimas vienu pirštu ją iškart pristabdo, ir ji atsinaujina, kai atleidi. Venk to labai senuose įrenginiuose: automatinis sukimasis priverčia atvaizduoti kas sekundę.",autoRotateOn:"Įjungta",autoRotateOff:"Išjungta",dataDisplaySection:"Objektai ir duomenų rodymas",displayUpdateFrequency:"Grafiko detalumas",displayUpdateFrequencyHelp:"Kiek taškų per valandą piešia grafikai. Patys duomenys visada yra Home Assistant 5 minučių statistika; tai valdo tik, kaip tankiai braižoma kreivė: 1 = vienas taškas per valandą (lygiausia, lengviausia atvaizduoti), 6 = vienas taškas kas 10 minučių (visas detalumas, sunkiausia). Numatytasis 4 = taškas kas 15 minučių. Sumažink jį senesniuose ar lėtesniuose įrenginiuose, kad sumažintum atvaizdavimo sąnaudas. Prognozės kreivė laikosi to paties tempo, todėl smulkesnis nustatymas taip pat atskleidžia trumpus šešėlių kritimus (medis, pusvalandį temdantis gamybą), kuriuos valandinė kreivė peržengia.",valueDecimals:"Dešimtainės dalys",valueDecimalsHelp:"Dešimtainių skaitmenų skaičius, rodomas kiekviename vertės rodmenyje. Galia visada rodoma kW, o energija kWh; tai nustato tikslumą visiems jiems, kad lustai atrodytų vienodi. Nuo 0 iki 3, numatytasis 1.",powerUnit:"Galios vienetas",powerUnitHelp:"Vienetas kiekvienam galios rodmeniui kortelėje (lustai, grafiko debesėliai). Energija taip pat jo laikosi, kad kortelė liktų nuosekli: kW poruojasi su kWh, W su Wh.",irradianceUnit:"Saulės konstantos vienetas",irradianceUnitHelp:"Vienetas saulės konstantos (apšvitos) rodmeniui virš saulės.",batterySign:"Baterijos ženklas",batterySignHelp:"Ženklas, rodomas baterijos plakelyje. Numatytasis yra minusas įkraunant ir pliusas iškraunant. „Apverstas“ juos sukeičia. „Paslėptas“ rodo reikšmę be ženklo.",batterySignDefault:"Numatytasis",batterySignInverted:"Apverstas",batterySignHidden:"Paslėptas",noUiMode:"Režimas be UI",noUiModeHint:"Po kelių sekundžių neaktyvumo timeline ir kortelės controls išnyksta. Bet koks palietimas ar judesys juos grąžina. Puikiai tinka wall display.",solarIrradianceEntity:"Saulės apšvitos objektas",solarIrradianceEntityHelp:"Pasirink jutiklį, pranešantį apie globalią trumpabangę apšvitą W/m² (paprastai Ecowitt / Davis / asmeninė orų stotis). Kai nustatyta, jo dabartinė būsena ir įrašymo istorija pakeičia Open-Meteo gyvai ir praeities apšvitai visur, kur ji rodoma (saulės lusto skaičius, PV diagramos Y ašis, saulės lanko spalvinimas). Prognozės valandos lieka su Open-Meteo, nes jutiklis negali turėti ateities verčių.",buildingsSection:"Namai & pastatai",buildingsHint:'Kad kortelė tankiose miesto vietovėse išliktų sklandi, 3D atvaizduojami tik pastatai sukonfigūruoto spindulio ribose aplink namus. Patys namai lieka visiškai nepermatomi; netoliese esantys pastatai atvaizduojami su sukonfigūruotu nepermatomumu, kad suteiktų miesto kontekstą nekonkuruodami su duomenų sluoksniais. Sankaupos spindulys sugrupuoja prijungtus pagalbinius pastatus (verandas, garažus, sandėliukus) į "namų" rinkinį.',displayRadius:"Rodymo spindulys",displayRadiusHelp:"Spindulys aplink namus, kuriame pastatai gaunami ir piešiami, iki pat išblukusio žemėlapio disko krašto. Sumažink jį, kad palengvintum atvaizdavimą lėtame įrenginyje; 0 rodo tik namus.",buildingCount:"Pastatų skaičius",buildingCountHelp:"Maksimalus netoliese esančių pastatų skaičius, kurį piešti. Sumažink jį, kad palengvintum atvaizdavimą lėtame įrenginyje.",buildingRealSize:"Tikri pastatų aukščiai",buildingRealSizeOn:"Įjungta",buildingRealSizeOff:"Išjungta",buildingRealSizeHint:"Įjungta: naudok tikrus OpenStreetMap aukščius (apriboti, kad kadravimas liktų įskaitomas). Išjungta: suteik kiekvienam pastatui tą patį fiksuotą aukštį žemiau.",buildingHeight:"Pastato aukštis",buildingClusterRadius:"Namų sankaupos spindulys",buildingOpacity:"Aplinkos nepermatomumas",buildingColor:"Pastato spalva",buildingColorHelp:"Bazinis atspalvis, taikomas aplinkiniams pastatams scenoje.",shadowsSection:"Šešėliai",shadowsEnabled:"Rodyti šešėlius",shadowsEnabledOn:"Rodomi",shadowsEnabledOff:"Paslėpti",shadowsEnabledHint:"Įjungia/išjungia ant žemės metamus šešėlius, kuriuos pastatai meta saulei judant.",shadowOpacity:"Šešėlių nepermatomumas",shadowOpacityHint:"Ant žemės metamų šešėlių nepermatomumas.",resetSection:"Atstatyti",resetSectionHint:"Priežiūros įrankiai, skirti ištrinti duomenis, kuriuos kortelė išsaugojo vietinėje talpykloje.",resetCacheButton:"Atstatyti duomenų talpyklą",resetCacheWarning:"Įspėjimas: tai išvalo talpykloje saugomus Open-Meteo orus ir atmintyje esančią PV istoriją KIEKVIENAI šiame puslapyje atidarytai Helios kortelei. Patikslinta prognozė praras savo 5 dienų kalibravimą, kol jie bus gauti iš naujo (kelios minutės, priklausomai nuo tavo HA serverio). Tavo duomenys Home Assistant viduje niekada neliečiami.",resetCacheDone:"Talpykla išvalyta ✓",aboutSection:"Apie",aboutVersionLabel:"Versija",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios sukūrė vienas aistringas kūrėjas su daug energijos ir labai mažai miego. Jei tau patinka mano darbas, maža žvaigždutė GitHub man jau labai padeda, o jei gali, mažas kavos puodelis palaiko projektą gyvą.",aboutDeveloperLabel:"Kūrėjas",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Pavaišink mane kava"}},lv:{cardName:"Helios",cardDescription:"☀️ Reāllaika 2.5D skats uz tavu māju ar sauli, laikapstākļiem, saules ražošanu, akumulatoru un tīklu, kā arī mestas ēnas un interaktīva laika josla",period:{rangeLabel:"Laika diapazons",forecast:"Prognoze",today:"Šodien",week:"nedēļa",month:"mēnesis",year:"gads"},cloudCover:{cloudLow:"Zems mākoņu segums",cloudMid:"Vidējs mākoņu segums",cloudHigh:"Augsts mākoņu segums"},editor:{locationSection:"Atrašanās vieta",homeLatitude:"Mājas platums",homeLongitude:"Mājas garums",locationHint:"Aizstāj mājas adresi, ko izmanto kā kartes centru. Atstāj abus laukus tukšus, lai izmantotu Home Assistant konfigurēto māju. Aizstāšana tiek piemērota tikai tad, kad ABI lauki ir iestatīti uz derīgām koordinātēm.",uiAndMapSection:"UI",autoRotate:"Kameras automātiskā rotācija",autoRotateHint:"Kad dažas sekundes esi neaktīvs, kamera lēni riņķo ap māju (apmēram 1.5°/s, pretēji saules šķietamajai kustībai). Vilkšana ar vienu pirkstu to nekavējoties aptur, un tā atsākas, tiklīdz atlaid. Izvairies no tā ļoti vecās ierīcēs: automātiskā rotācija piespiež renderēšanu katru sekundi.",autoRotateOn:"Ieslēgts",autoRotateOff:"Izslēgts",dataDisplaySection:"Entītijas un datu attēlojums",displayUpdateFrequency:"Grafika detalizācija",displayUpdateFrequencyHelp:"Cik punktu stundā grafiki zīmē. Paši dati vienmēr ir Home Assistant 5 minūšu statistika; tas tikai kontrolē, cik blīvi līkne tiek zīmēta: 1 = viens punkts stundā (gludākais, vieglākais renderēšanai), 6 = viens punkts ik pēc 10 minūtēm (pilna detalizācija, smagākais). Noklusējums 4 = punkts ik pēc 15 minūtēm. Samazini to vecākās vai lēnākās ierīcēs, lai samazinātu renderēšanas izmaksas. Prognozes līkne seko tam pašam tempam, tāpēc smalkāks iestatījums atklāj arī īsus ēnu kritumus (koks, kas pusstundu aizēno ražošanu), kuriem stundas līkne pāriet pāri.",valueDecimals:"Decimāldaļas",valueDecimalsHelp:"Decimāldaļu skaits, kas tiek parādīts katrā vērtības nolasījumā. Jauda vienmēr tiek rādīta kW un enerģija kWh; tas iestata precizitāti tām visām, lai mikroshēmas izskatītos vienveidīgi. No 0 līdz 3, noklusējums 1.",powerUnit:"Jaudas mērvienība",powerUnitHelp:"Mērvienība katram jaudas rādījumam kartītē (mikroshēmas, grafika rīka padomi). Enerģija tai arī seko, tāpēc kartīte paliek konsekventa: kW veido pāri ar kWh, W ar Wh.",irradianceUnit:"Saules konstantes mērvienība",irradianceUnitHelp:"Mērvienība saules konstantes (apstarojuma) rādījumam virs saules.",batterySign:"Akumulatora zīme",batterySignHelp:"Zīme, kas redzama uz akumulatora čipa. Pēc noklusējuma tas ir mīnuss lādēšanas laikā un pluss izlādes laikā. „Apgriezta“ tos apmaina. „Paslēpta“ rāda vērtību bez zīmes.",batterySignDefault:"Noklusējums",batterySignInverted:"Apgriezta",batterySignHidden:"Paslēpta",noUiMode:"Režīms bez UI",noUiModeHint:"Pēc dažām neaktivitātes sekundēm timeline un kartītes controls pakāpeniski izgaist. Jebkurš pieskāriens vai kustība tos atgriež. Lieliski piemērots wall display.",solarIrradianceEntity:"Saules starojuma entītija",solarIrradianceEntityHelp:"Izvēlies sensoru, kas ziņo par globālo īsviļņu starojumu W/m² (parasti Ecowitt / Davis / personīgā meteostacija). Kad tas ir iestatīts, tā pašreizējais stāvoklis un ierakstītāja vēsture aizstāj Open-Meteo dzīvajam un pagātnes starojumam visur, kur tas parādās (saules mikroshēmas skaitlis, PV diagrammas Y ass, saules loka krāsojums). Prognozes stundas paliek uz Open-Meteo, jo sensors nevar nest nākotnes vērtības.",buildingsSection:"Māja & ēkas",buildingsHint:'Lai karte blīvās pilsētu teritorijās paliktu raita, 3D tiek renderētas tikai ēkas konfigurētā rādiusa robežās ap māju. Pati māja paliek pilnīgi necaurspīdīga; tuvumā esošās ēkas tiek renderētas ar konfigurēto necaurspīdību, lai tās sniegtu pilsētas kontekstu, nekonkurējot ar datu pārklājumiem. Klastera rādiuss grupē piesaistītās palīgēkas (verandas, garāžas, šķūņus) "mājas" kopā.',displayRadius:"Attēlojuma rādiuss",displayRadiusHelp:"Rādiuss ap māju, kurā ēkas tiek iegūtas un zīmētas, līdz pat izbalējušā kartes diska malai. Samazini to, lai atvieglotu renderēšanu lēnā ierīcē; 0 rāda tikai māju.",buildingCount:"Ēku skaits",buildingCountHelp:"Maksimālais tuvumā esošo ēku skaits, ko zīmēt. Samazini to, lai atvieglotu renderēšanu lēnā ierīcē.",buildingRealSize:"Reālie ēku augstumi",buildingRealSizeOn:"Ieslēgts",buildingRealSizeOff:"Izslēgts",buildingRealSizeHint:"Ieslēgts: izmanto reālos OpenStreetMap augstumus (ierobežoti, lai kadrējums paliktu salasāms). Izslēgts: piešķir katrai ēkai to pašu fiksēto augstumu zemāk.",buildingHeight:"Ēkas augstums",buildingClusterRadius:"Mājas klastera rādiuss",buildingOpacity:"Apkārtnes necaurspīdība",buildingColor:"Ēkas krāsa",buildingColorHelp:"Pamattonis, kas tiek piemērots apkārtējām ēkām ainā.",shadowsSection:"Ēnas",shadowsEnabled:"Rādīt ēnas",shadowsEnabledOn:"Rādītas",shadowsEnabledOff:"Paslēptas",shadowsEnabledHint:"Ieslēdz/izslēdz zemes ēnas, ko ēkas met, saulei kustoties.",shadowOpacity:"Ēnu necaurspīdība",shadowOpacityHint:"Mesto zemes ēnu necaurspīdība.",resetSection:"Atiestatīt",resetSectionHint:"Apkopes rīki, lai dzēstu datus, ko karte ir lokāli saglabājusi kešatmiņā.",resetCacheButton:"Atiestatīt datu kešatmiņu",resetCacheWarning:"Brīdinājums: tas notīra kešatmiņā saglabātos Open-Meteo laikapstākļus un atmiņā esošo PV vēsturi KATRAI Helios kartei, kas atvērta šajā lapā. Precizētā prognoze zaudēs savas 5 dienu kalibrēšanas, līdz tās tiks atkārtoti iegūtas (dažas minūtes atkarībā no tava HA servera). Tavi dati Home Assistant iekšienē nekad netiek aiztikti.",resetCacheDone:"Kešatmiņa notīrīta ✓",aboutSection:"Par",aboutVersionLabel:"Versija",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios ir izveidojis viens kaislīgs izstrādātājs ar daudz enerģijas un ļoti maz miega. Ja tev patīk mans darbs, maza zvaigznīte GitHub jau man ļoti palīdz, un, ja vari, maza kafija uztur projektu dzīvu.",aboutDeveloperLabel:"Izstrādātājs",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Uzcienā mani ar kafiju"}},nb:{cardName:"Helios",cardDescription:"☀️ En 2.5D-visning i sanntid av hjemmet ditt med solen, været, solproduksjon, batteri og strømnett, pluss kastede skygger og en interaktiv tidslinje",period:{rangeLabel:"Tidsrom",forecast:"Prognose",today:"I dag",week:"uke",month:"måned",year:"år"},cloudCover:{cloudLow:"Lavt skydekke",cloudMid:"Middels skydekke",cloudHigh:"Høyt skydekke"},editor:{locationSection:"Plassering",homeLatitude:"Hjemmets breddegrad",homeLongitude:"Hjemmets lengdegrad",locationHint:"Overstyr hjemmeadressen som brukes som kartets midtpunkt. La begge feltene være tomme for å bruke hjemmet som er konfigurert i Home Assistant. Overstyringen brukes bare når BEGGE feltene er satt til gyldige koordinater.",uiAndMapSection:"UI",autoRotate:"Automatisk kamerarotasjon",autoRotateHint:"Når det er inaktivt i noen sekunder, sirkler kameraet sakte rundt hjemmet (omtrent 1.5°/s, motsatt av solens tilsynelatende bevegelse). Et dra med én finger setter den umiddelbart på pause, og den fortsetter når du slipper. Unngå det på svært gamle enheter: automatisk rotasjon tvinger en gjengivelse hvert sekund.",autoRotateOn:"På",autoRotateOff:"Av",dataDisplaySection:"Entiteter og datavisning",displayUpdateFrequency:"Grafdetaljer",displayUpdateFrequencyHelp:"Hvor mange punkter per time grafene tegner. Selve dataene er alltid Home Assistants 5-minutters statistikk; dette styrer bare hvor tett kurven plottes: 1 = ett punkt per time (jevnest, lettest å gjengi), 6 = ett punkt hvert 10. minutt (full detalj, tyngst). Standard 4 = ett punkt hvert 15. minutt. Senk det på eldre eller tregere enheter for å redusere gjengivelseskostnaden. Prognosekurven følger samme takt, så en finere innstilling viser også korte skyggedupp (et tre som skygger for produksjonen i en halvtime) som en timekurve hopper over.",valueDecimals:"Desimaler",valueDecimalsHelp:"Antall desimaler vist på hver verdiavlesning. Effekt vises alltid i kW og energi i kWh; dette setter presisjonen for dem alle slik at chipene ser ensartet ut. 0 til 3, standard 1.",powerUnit:"Effektenhet",powerUnitHelp:"Enhet for hver effektavlesning på kortet (chips, graftooltips). Energi følger den også, slik at kortet forblir konsistent: kW hører sammen med kWh, W med Wh.",irradianceUnit:"Enhet for solkonstanten",irradianceUnitHelp:"Enhet for avlesningen av solkonstanten (innstråling) over sola.",batterySign:"Batteritegn",batterySignHelp:"Tegn som vises på batterichipen. Standard er minus ved lading og pluss ved utlading. Omvendt bytter om på det. Skjult viser verdien uten tegn.",batterySignDefault:"Standard",batterySignInverted:"Omvendt",batterySignHidden:"Skjult",noUiMode:"Uten UI-modus",noUiModeHint:"Toner ut timeline og kontrollene på kortet etter noen sekunders inaktivitet. Et hvilket som helst trykk eller en bevegelse henter dem tilbake. Perfekt for en wall display.",solarIrradianceEntity:"Entitet for solirradians",solarIrradianceEntityHelp:"Velg en sensor som rapporterer global kortbølget irradians i W/m² (typisk Ecowitt / Davis / personlig værstasjon). Når den er satt, erstatter dens nåværende tilstand og opptakerhistorikk Open-Meteo for live- og fortidsirradiansen overalt hvor den vises (tall på solchipen, PV-diagrammets Y-akse, fargelegging av solbuen). Prognosetimer forblir på Open-Meteo siden en sensor ikke kan bære fremtidige verdier.",buildingsSection:"Hjem & bygninger",buildingsHint:'For å holde kortet flytende i tette byområder gjengis bare bygninger innenfor den konfigurerte radiusen rundt hjemmet i 3D. Hjemmet selv forblir helt ugjennomsiktig; nærliggende bygninger gjengis med den konfigurerte ugjennomsiktigheten slik at de gir urban kontekst uten å konkurrere med dataoverleggene. Klyngeradiusen grupperer tilknyttede uthus (verandaer, garasjer, skur) i "hjem"-settet.',displayRadius:"Visningsradius",displayRadiusHelp:"Radius rundt hjemmet der bygninger hentes og tegnes, helt ut til kanten av den falmede kartskiven. Senk den for å lette gjengivelsen på en treg enhet; 0 viser bare hjemmet.",buildingCount:"Antall bygninger",buildingCountHelp:"Maksimalt antall nærliggende bygninger å tegne. Senk det for å lette gjengivelsen på en treg enhet.",buildingRealSize:"Reelle bygningshøyder",buildingRealSizeOn:"På",buildingRealSizeOff:"Av",buildingRealSizeHint:"På: bruk reelle OpenStreetMap-høyder (begrenset for å holde rammen lesbar). Av: gi hver bygning samme faste høyde nedenfor.",buildingHeight:"Bygningshøyde",buildingClusterRadius:"Hjemmets klyngeradius",buildingOpacity:"Ugjennomsiktighet for omgivelser",buildingColor:"Bygningsfarge",buildingColorHelp:"Grunntone brukt på de omkringliggende bygningene i scenen.",shadowsSection:"Skygger",shadowsEnabled:"Vis skygger",shadowsEnabledOn:"Vist",shadowsEnabledOff:"Skjult",shadowsEnabledHint:"Slår av/på bakkeskyggene som bygningene kaster mens solen beveger seg.",shadowOpacity:"Skyggeugjennomsiktighet",shadowOpacityHint:"Ugjennomsiktighet for de kastede bakkeskyggene.",resetSection:"Tilbakestill",resetSectionHint:"Vedlikeholdsverktøy for å slette data som kortet har bufret lokalt.",resetCacheButton:"Tilbakestill databuffer",resetCacheWarning:"Advarsel: dette tømmer det bufrede Open-Meteo-været og PV-historikken i minnet for HVERT Helios-kort som er åpent på denne siden. Den forfinede prognosen mister sine 5 dagers kalibrering til de hentes igjen (noen minutter avhengig av HA-serveren din). Dataene dine inne i Home Assistant berøres aldri.",resetCacheDone:"Buffer tømt ✓",aboutSection:"Om",aboutVersionLabel:"Versjon",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios er bygget av én lidenskapelig utvikler, med masse energi og veldig lite søvn. Hvis du liker arbeidet mitt, hjelper en liten stjerne på GitHub meg allerede mye, og hvis du kan, holder en liten kaffe prosjektet i live.",aboutDeveloperLabel:"Utvikler",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Spander en kaffe"}},nl:{cardName:"Helios",cardDescription:"☀️ Een realtime 2.5D-weergave van je huis met de zon, het weer, de zonneproductie, de batterij en het net, plus geprojecteerde schaduwen en een interactieve tijdlijn",period:{rangeLabel:"Periode",forecast:"Voorspelling",today:"Vandaag",week:"week",month:"maand",year:"jaar"},cloudCover:{cloudLow:"Lage bewolking",cloudMid:"Middelhoge bewolking",cloudHigh:"Hoge bewolking"},editor:{locationSection:"Locatie",homeLatitude:"Breedtegraad van het huis",homeLongitude:"Lengtegraad van het huis",locationHint:"Overschrijft het thuisadres dat als middelpunt van de kaart wordt gebruikt. Laat beide velden leeg om het in Home Assistant geconfigureerde thuis te gebruiken. De overschrijving wordt alleen toegepast wanneer BEIDE velden geldige coördinaten bevatten.",uiAndMapSection:"UI",autoRotate:"Automatische camerarotatie",autoRotateHint:"Na een paar seconden inactiviteit draait de camera langzaam om het huis (ongeveer 1.5°/s, tegengesteld aan de schijnbare beweging van de zon). Een sleepbeweging met één vinger pauzeert het meteen en het hervat zodra je loslaat. Vermijd het op heel oude apparaten: de automatische rotatie forceert elke seconde een render.",autoRotateOn:"Aan",autoRotateOff:"Uit",dataDisplaySection:"Entiteiten en gegevensweergave",displayUpdateFrequency:"Grafiekdetail",displayUpdateFrequencyHelp:"Hoeveel punten per uur de grafieken tekenen. De gegevens zelf zijn altijd de 5-minutenstatistieken van Home Assistant; dit bepaalt alleen hoe dicht de curve wordt getekend: 1 = één punt per uur (het vloeiendst, het lichtst om te renderen), 6 = één punt per 10 minuten (volledig detail, het zwaarst). Standaard 4 = één punt per 15 minuten. Verlaag het op oudere of tragere apparaten om de renderkosten te beperken. De voorspellingscurve volgt hetzelfde tempo, dus een fijnere instelling laat ook de korte schaduwdips zien (een boom die de productie een half uur onderbreekt) waar een uurcurve overheen stapt.",valueDecimals:"Decimalen",valueDecimalsHelp:"Aantal decimalen dat bij elke waardeweergave wordt getoond. Vermogen wordt altijd in kW en energie in kWh getoond; dit stelt de precisie voor allemaal in zodat de chips uniform leesbaar zijn. 0 tot 3, standaard 1.",powerUnit:"Vermogenseenheid",powerUnitHelp:"Eenheid voor elke vermogensweergave op de kaart (chips, grafiektooltips). Energie volgt deze ook, zodat de kaart consistent blijft: kW hoort bij kWh, W bij Wh.",irradianceUnit:"Eenheid van de zonneconstante",irradianceUnitHelp:"Eenheid voor de weergave van de zonneconstante (instraling) boven de zon.",batterySign:"Batterijteken",batterySignHelp:"Teken dat op de batterijchip wordt getoond. Standaard is min tijdens opladen en plus tijdens ontladen. Omgekeerd wisselt dit om. Verborgen toont de waarde zonder teken.",batterySignDefault:"Standaard",batterySignInverted:"Omgekeerd",batterySignHidden:"Verborgen",noUiMode:"Geen UI-modus",noUiModeHint:"Laat na een paar seconden inactiviteit de timeline en de bediening op de kaart vervagen. Elke tik of beweging haalt ze terug. Ideaal voor een wall display.",solarIrradianceEntity:"Zonne-instralingsentiteit",solarIrradianceEntityHelp:"Kies een sensor die de globale kortgolvige instraling in W/m² meldt (typisch een Ecowitt- / Davis- / persoonlijk weerstation). Indien ingesteld vervangen de huidige toestand en de recordergeschiedenis Open-Meteo voor de live en historische instraling overal waar die verschijnt (getal op de zonchip, Y-as van de PV-grafiek, kleuring van de zonneboog). Voorspellingsuren blijven op Open-Meteo, want een sensor kan geen toekomstige waarden bevatten.",buildingsSection:"Huis & gebouwen",buildingsHint:'Om de kaart soepel te houden in dichtbebouwde stedelijke gebieden worden alleen gebouwen binnen de geconfigureerde straal rond het huis in 3D gerenderd. Het huis zelf blijft volledig dekkend; nabijgelegen gebouwen worden gerenderd met de geconfigureerde dekking zodat ze stedelijke context geven zonder met de gegevensoverlays te concurreren. De clusterstraal groepeert aangebouwde bijgebouwen (veranda\'s, garages, schuren) in de "huis"-groep.',displayRadius:"Weergavestraal",displayRadiusHelp:"Straal rond het huis waarbinnen gebouwen worden opgehaald en getekend, tot aan de rand van de vervaagde kaartschijf. Verlaag het om het renderen op een traag apparaat te verlichten; 0 toont alleen het huis.",buildingCount:"Aantal gebouwen",buildingCountHelp:"Maximumaantal nabijgelegen gebouwen om te tekenen. Verlaag het om het renderen op een traag apparaat te verlichten.",buildingRealSize:"Echte gebouwhoogtes",buildingRealSizeOn:"Aan",buildingRealSizeOff:"Uit",buildingRealSizeHint:"Aan: gebruik de echte OpenStreetMap-hoogtes (begrensd om de kadrering leesbaar te houden). Uit: geef elk gebouw dezelfde vaste hoogte hieronder.",buildingHeight:"Gebouwhoogte",buildingClusterRadius:"Clusterstraal huis",buildingOpacity:"Dekking van de omgeving",buildingColor:"Gebouwkleur",buildingColorHelp:"Basistint die op de omliggende gebouwen in de scène wordt toegepast.",shadowsSection:"Schaduwen",shadowsEnabled:"Schaduwen tonen",shadowsEnabledOn:"Getoond",shadowsEnabledOff:"Verborgen",shadowsEnabledHint:"Schakelt de grondschaduwen in of uit die de gebouwen werpen terwijl de zon beweegt.",shadowOpacity:"Schaduwdekking",shadowOpacityHint:"Dekking van de geworpen grondschaduwen.",resetSection:"Resetten",resetSectionHint:"Onderhoudstools om gegevens te wissen die de kaart lokaal in de cache heeft opgeslagen.",resetCacheButton:"Gegevenscache resetten",resetCacheWarning:"Let op: dit wist het in de cache opgeslagen Open-Meteo-weer en de PV-geschiedenis in het geheugen voor ELKE Helios-kaart die op deze pagina open staat. De verfijnde voorspelling verliest zijn 5 dagen kalibratie totdat ze opnieuw zijn opgehaald (een paar minuten afhankelijk van je HA-server). Je gegevens binnen Home Assistant worden nooit aangeraakt.",resetCacheDone:"Cache gewist ✓",aboutSection:"Over",aboutVersionLabel:"Versie",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios is gebouwd door één gepassioneerde ontwikkelaar, met veel energie en heel weinig slaap. Als je mijn werk leuk vindt, helpt een kleine ster op GitHub me al enorm, en als je kunt, houdt een kleine koffie het project levend.",aboutDeveloperLabel:"Ontwikkelaar",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},pl:{cardName:"Helios",cardDescription:"☀️ Widok 2.5D Twojego domu w czasie rzeczywistym ze słońcem, pogodą, produkcją solarną, baterią i siecią, a do tego rzucane cienie i interaktywna oś czasu",period:{rangeLabel:"Zakres czasu",forecast:"Prognoza",today:"Dzisiaj",week:"tydzień",month:"miesiąc",year:"rok"},cloudCover:{cloudLow:"Niskie zachmurzenie",cloudMid:"Średnie zachmurzenie",cloudHigh:"Wysokie zachmurzenie"},editor:{locationSection:"Lokalizacja",homeLatitude:"Szerokość geograficzna domu",homeLongitude:"Długość geograficzna domu",locationHint:"Zastępuje adres domu używany jako środek karty. Zostaw oba pola puste, aby użyć domu skonfigurowanego w Home Assistant. Zastąpienie jest stosowane tylko wtedy, gdy OBA pola mają ustawione prawidłowe współrzędne.",uiAndMapSection:"UI",autoRotate:"Automatyczny obrót kamery",autoRotateHint:"Po kilku sekundach bezczynności kamera powoli obraca się wokół domu (około 1.5°/s, w kierunku przeciwnym do pozornego ruchu słońca). Przeciągnięcie jednym palcem natychmiast ją wstrzymuje, a wznawia się, gdy puścisz. Unikaj na bardzo starych urządzeniach: automatyczny obrót wymusza renderowanie co sekundę.",autoRotateOn:"Włączony",autoRotateOff:"Wyłączony",dataDisplaySection:"Encje i wyświetlanie danych",displayUpdateFrequency:"Szczegółowość wykresu",displayUpdateFrequencyHelp:"Ile punktów na godzinę rysują wykresy. Same dane to zawsze 5-minutowe statystyki Home Assistant; to ustawienie kontroluje jedynie, jak gęsto rysowana jest krzywa: 1 = jeden punkt na godzinę (najgładsze, najlżejsze do renderowania), 6 = jeden punkt co 10 minut (pełen szczegół, najcięższe). Domyślnie 4 = punkt co 15 minut. Zmniejsz na starszych lub wolniejszych urządzeniach, aby obniżyć koszt renderowania. Krzywa prognozy podąża za tym samym rytmem, więc drobniejsze ustawienie pozwala też uchwycić krótkie spadki od cienia (drzewo zasłaniające produkcję przez pół godziny), które krzywa godzinowa pomija.",valueDecimals:"Miejsca dziesiętne",valueDecimalsHelp:"Liczba miejsc dziesiętnych pokazywanych przy każdej wartości. Moc jest zawsze w kW, a energia w kWh; to ustawia precyzję dla wszystkich, aby chipy wyglądały jednolicie. Od 0 do 3, domyślnie 1.",powerUnit:"Jednostka mocy",powerUnitHelp:"Jednostka dla każdego odczytu mocy na karcie (chipy, dymki wykresu). Energia też za nią podąża, aby karta pozostała spójna: kW łączy się z kWh, W z Wh.",irradianceUnit:"Jednostka stałej słonecznej",irradianceUnitHelp:"Jednostka odczytu stałej słonecznej (nasłonecznienia) nad słońcem.",batterySign:"Znak baterii",batterySignHelp:"Znak pokazywany na chipie baterii. Domyślnie minus podczas ładowania i plus podczas rozładowywania. Odwrócony zamienia je miejscami. Ukryty pokazuje wartość bez znaku.",batterySignDefault:"Domyślny",batterySignInverted:"Odwrócony",batterySignHidden:"Ukryty",noUiMode:"Tryb bez interfejsu",noUiModeHint:"Wygasza timeline i elementy sterujące na karcie po kilku sekundach bezczynności. Dowolne dotknięcie lub ruch przywraca je z powrotem. Idealne do ekranu naściennego.",solarIrradianceEntity:"Encja nasłonecznienia solarnego",solarIrradianceEntityHelp:"Wybierz czujnik raportujący globalne nasłonecznienie krótkofalowe w W/m² (typowo Ecowitt / Davis / własna stacja pogodowa). Po ustawieniu jego bieżący stan i historia z rejestratora zastępują Open-Meteo dla bieżącego i przeszłego nasłonecznienia wszędzie tam, gdzie się pojawia (liczba na chipie słońca, oś Y wykresu PV, kolorowanie łuku słonecznego). Godziny prognozy pozostają na Open-Meteo, ponieważ czujnik nie może mieć wartości z przyszłości.",buildingsSection:"Dom i budynki",buildingsHint:'Aby karta działała płynnie w gęsto zabudowanych terenach miejskich, w 3D renderowane są tylko budynki w skonfigurowanym promieniu wokół domu. Sam dom pozostaje w pełnej nieprzezroczystości; pobliskie budynki są renderowane ze skonfigurowaną przezroczystością, aby dawały kontekst miejski bez konkurowania z nakładkami danych. Promień grupowania łączy przylegające zabudowania (werandy, garaże, szopy) w zbiór "domu".',displayRadius:"Promień wyświetlania",displayRadiusHelp:"Promień wokół domu, w którym budynki są pobierane i rysowane, aż do krawędzi przygaszonego dysku mapy. Zmniejsz, aby odciążyć renderowanie na wolnym urządzeniu; 0 pokazuje tylko dom.",buildingCount:"Liczba budynków",buildingCountHelp:"Maksymalna liczba pobliskich budynków do narysowania. Zmniejsz, aby odciążyć renderowanie na wolnym urządzeniu.",buildingRealSize:"Rzeczywiste wysokości budynków",buildingRealSizeOn:"Włączone",buildingRealSizeOff:"Wyłączone",buildingRealSizeHint:"Włączone: użyj rzeczywistych wysokości OpenStreetMap (ograniczonych, aby kadr pozostał czytelny). Wyłączone: nadaj każdemu budynkowi tę samą stałą wysokość poniżej.",buildingHeight:"Wysokość budynku",buildingClusterRadius:"Promień grupowania domu",buildingOpacity:"Przezroczystość otoczenia",buildingColor:"Kolor budynków",buildingColorHelp:"Bazowy odcień stosowany do okolicznych budynków w scenie.",shadowsSection:"Cienie",shadowsEnabled:"Pokaż cienie",shadowsEnabledOn:"Pokazane",shadowsEnabledOff:"Ukryte",shadowsEnabledHint:"Przełącza cienie rzucane na ziemię przez budynki w miarę ruchu słońca.",shadowOpacity:"Przezroczystość cieni",shadowOpacityHint:"Przezroczystość rzucanych cieni na ziemi.",resetSection:"Reset",resetSectionHint:"Narzędzia konserwacyjne do usuwania danych, które karta zapisała lokalnie w pamięci podręcznej.",resetCacheButton:"Resetuj pamięć podręczną danych",resetCacheWarning:"Uwaga: to czyści pogodę Open-Meteo z pamięci podręcznej oraz historię PV w pamięci dla KAŻDEJ karty Helios otwartej na tej stronie. Dopracowana prognoza straci swoje 5 dni kalibracji, dopóki nie zostaną pobrane ponownie (kilka minut, zależnie od Twojego serwera HA). Twoje dane wewnątrz Home Assistant nigdy nie są naruszane.",resetCacheDone:"Pamięć podręczna wyczyszczona ✓",aboutSection:"O karcie",aboutVersionLabel:"Wersja",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios jest tworzony przez jednego pasjonata, z mnóstwem energii i bardzo małą ilością snu. Jeśli podoba Ci się moja praca, mała gwiazdka na GitHub już bardzo mi pomaga, a jeśli możesz, mała kawa utrzymuje projekt przy życiu.",aboutDeveloperLabel:"Deweloper",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Postaw mi kawę"}},pt:{cardName:"Helios",cardDescription:"☀️ Uma vista 2.5D em tempo real da tua casa com o sol, o tempo, a produção solar, a bateria e a rede, além de sombras projetadas e uma linha temporal interativa",period:{rangeLabel:"Período",forecast:"Previsão",today:"Hoje",week:"semana",month:"mês",year:"ano"},cloudCover:{cloudLow:"Nebulosidade baixa",cloudMid:"Nebulosidade média",cloudHigh:"Nebulosidade alta"},editor:{locationSection:"Localização",homeLatitude:"Latitude de casa",homeLongitude:"Longitude de casa",locationHint:"Substitui o endereço de casa usado como centro do cartão. Deixa ambos os campos vazios para usar a casa configurada no Home Assistant. A substituição só é aplicada quando AMBOS os campos contêm coordenadas válidas.",uiAndMapSection:"UI",autoRotate:"Rotação automática da câmara",autoRotateHint:"Após alguns segundos de inatividade, a câmara orbita lentamente em torno da casa (cerca de 1.5°/s, no sentido oposto ao movimento aparente do sol). Um arrasto com um dedo pausa-a de imediato e retoma assim que largares. Evita em dispositivos muito antigos: a rotação automática força um render a cada segundo.",autoRotateOn:"Ativada",autoRotateOff:"Desativada",dataDisplaySection:"Entidades e apresentação de dados",displayUpdateFrequency:"Detalhe do gráfico",displayUpdateFrequencyHelp:"Quantos pontos por hora os gráficos desenham. Os dados em si são sempre as estatísticas de 5 minutos do Home Assistant; isto só controla a densidade com que a curva é traçada: 1 = um ponto por hora (a mais suave, a mais leve de renderizar), 6 = um ponto a cada 10 minutos (detalhe máximo, a mais pesada). Predefinição 4 = um ponto a cada 15 minutos. Baixa-o em dispositivos antigos ou lentos para reduzir o custo de renderização. A curva de previsão segue a mesma cadência, por isso uma definição mais fina também revela as quedas curtas de sombra (uma árvore que corta a produção durante meia hora) que uma curva horária ignora.",valueDecimals:"Decimais",valueDecimalsHelp:"Número de decimais mostrado em cada leitura de valor. A potência é sempre mostrada em kW e a energia em kWh; isto define a precisão de todos para que os chips fiquem uniformes. De 0 a 3, predefinição 1.",powerUnit:"Unidade de potência",powerUnitHelp:"Unidade para cada leitura de potência no cartão (chips, dicas do gráfico). A energia também a segue, para que o cartão se mantenha consistente: kW combina com kWh, W com Wh.",irradianceUnit:"Unidade da constante solar",irradianceUnitHelp:"Unidade para a leitura da constante solar (irradiância) acima do sol.",batterySign:"Sinal da bateria",batterySignHelp:"Sinal mostrado no chip da bateria. A predefinição é menos ao carregar e mais ao descarregar. Invertido troca os dois. Oculto mostra o valor sem sinal.",batterySignDefault:"Predefinição",batterySignInverted:"Invertido",batterySignHidden:"Oculto",noUiMode:"Modo sem interface",noUiModeHint:"Esbate a timeline e os controlos do cartão após alguns segundos de inatividade. Qualquer toque ou movimento trá-los de volta. Ótimo para um ecrã de parede.",solarIrradianceEntity:"Entidade de irradiância solar",solarIrradianceEntityHelp:"Escolhe um sensor que reporte a irradiância global de onda curta em W/m² (típico de estações Ecowitt / Davis / meteorológicas pessoais). Quando definido, o seu estado atual e o histórico do recorder substituem o Open-Meteo para a irradiância ao vivo e passada em todo o lado onde aparece (número no chip do sol, eixo Y do gráfico FV, coloração do arco solar). As horas de previsão continuam no Open-Meteo, já que um sensor não pode ter valores futuros.",buildingsSection:"Casa e edifícios",buildingsHint:'Para manter o cartão fluido em zonas urbanas densas, só os edifícios dentro do raio configurado à volta da casa são renderizados em 3D. A casa em si mantém-se a opacidade total; os edifícios próximos são renderizados com a opacidade configurada para darem contexto urbano sem competir com as camadas de dados. O raio de agrupamento junta os anexos contíguos (varandas, garagens, alpendres) no grupo "casa".',displayRadius:"Raio de apresentação",displayRadiusHelp:"Raio à volta da casa no qual os edifícios são obtidos e desenhados, até à margem do disco do mapa esbatido. Baixa-o para aliviar a renderização num dispositivo lento; 0 mostra apenas a casa.",buildingCount:"Número de edifícios",buildingCountHelp:"Número máximo de edifícios próximos a desenhar. Baixa-o para aliviar a renderização num dispositivo lento.",buildingRealSize:"Alturas reais dos edifícios",buildingRealSizeOn:"Sim",buildingRealSizeOff:"Não",buildingRealSizeHint:"Sim: usa as alturas reais do OpenStreetMap (limitadas para manter um enquadramento legível). Não: dá a cada edifício a mesma altura fixa abaixo.",buildingHeight:"Altura dos edifícios",buildingClusterRadius:"Raio de agrupamento da casa",buildingOpacity:"Opacidade dos edifícios envolventes",buildingColor:"Cor dos edifícios",buildingColorHelp:"Tom de base aplicado aos edifícios envolventes na cena.",shadowsSection:"Sombras",shadowsEnabled:"Mostrar sombras",shadowsEnabledOn:"Mostradas",shadowsEnabledOff:"Ocultas",shadowsEnabledHint:"Ativa ou oculta as sombras projetadas no solo pelos edifícios à medida que o sol se move.",shadowOpacity:"Opacidade das sombras",shadowOpacityHint:"Opacidade das sombras projetadas no solo.",resetSection:"Repor",resetSectionHint:"Ferramentas de manutenção para apagar os dados que o cartão guardou em cache localmente.",resetCacheButton:"Repor a cache de dados",resetCacheWarning:"Atenção: isto limpa o tempo do Open-Meteo em cache e o histórico FV em memória de TODOS os cartões Helios abertos nesta página. A previsão afinada perderá os seus 5 dias de calibração até serem obtidos de novo (alguns minutos consoante o teu servidor HA). Os teus dados dentro do Home Assistant nunca são tocados.",resetCacheDone:"Cache limpa ✓",aboutSection:"Sobre",aboutVersionLabel:"Versão",aboutRepoCard:"Helios",aboutCoffeeMessage:"O Helios é construído por um único programador apaixonado, com muita energia e muito pouco sono. Se gostas do meu trabalho, uma pequena estrela no GitHub já me ajuda imenso, e se puderes, um pequeno café mantém o projeto vivo.",aboutDeveloperLabel:"Programador",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},ro:{cardName:"Helios",cardDescription:"☀️ O vedere 2.5D in timp real a casei tale cu soarele, vremea, productia solara, bateria si reteaua, plus umbre proiectate si o cronologie interactiva",period:{rangeLabel:"Interval de timp",forecast:"Prognoză",today:"Astazi",week:"saptamana",month:"luna",year:"an"},cloudCover:{cloudLow:"Nori josi",cloudMid:"Nori medii",cloudHigh:"Nori inalti"},editor:{locationSection:"Locatie",homeLatitude:"Latitudinea casei",homeLongitude:"Longitudinea casei",locationHint:"Inlocuieste adresa casei folosita drept centru al cardului. Lasa ambele campuri goale pentru a folosi casa configurata in Home Assistant. Inlocuirea se aplica doar atunci cand AMBELE campuri sunt setate la coordonate valide.",uiAndMapSection:"UI",autoRotate:"Rotire automata a camerei",autoRotateHint:"Dupa cateva secunde de inactivitate, camera se roteste lent in jurul casei (aproximativ 1.5°/s, in sens opus miscarii aparente a soarelui). O glisare cu un deget o opreste instantaneu, iar rotirea reia indata ce ridici degetul. Evit-o pe dispozitive foarte vechi: rotirea automata forteaza o redare in fiecare secunda.",autoRotateOn:"Pornit",autoRotateOff:"Oprit",dataDisplaySection:"Entitati si afisarea datelor",displayUpdateFrequency:"Detaliul graficului",displayUpdateFrequencyHelp:"Cate puncte pe ora deseneaza graficele. Datele in sine sunt intotdeauna statisticile de 5 minute ale Home Assistant; aceasta controleaza doar cat de dens este trasata curba: 1 = un punct pe ora (cel mai neted, cel mai usor de redat), 6 = un punct la fiecare 10 minute (detaliu complet, cel mai greu). Implicit 4 = un punct la fiecare 15 minute. Coboara-l pe dispozitive mai vechi sau mai lente pentru a reduce costul redarii. Curba de prognoza urmeaza aceeasi cadenta, asa ca o setare mai fina rezolva si scaderile scurte de umbra (un copac care taie productia o jumatate de ora) pe care o curba orara le sare.",valueDecimals:"Zecimale",valueDecimalsHelp:"Numarul de zecimale afisate la fiecare valoare. Puterea este intotdeauna in kW, iar energia in kWh; aceasta seteaza precizia pentru toate, astfel incat cipurile sa arate uniform. De la 0 la 3, implicit 1.",powerUnit:"Unitate de putere",powerUnitHelp:"Unitatea pentru fiecare citire a puterii de pe card (cipuri, indicii graficului). Energia o urmeaza si ea, astfel incat cardul ramane consecvent: kW se imperecheaza cu kWh, W cu Wh.",irradianceUnit:"Unitatea constantei solare",irradianceUnitHelp:"Unitatea pentru citirea constantei solare (iradiere) de deasupra soarelui.",batterySign:"Semnul bateriei",batterySignHelp:"Semnul afisat pe cipul bateriei. Implicit este minus la incarcare si plus la descarcare. Inversat le schimba intre ele. Ascuns afiseaza valoarea fara semn.",batterySignDefault:"Implicit",batterySignInverted:"Inversat",batterySignHidden:"Ascuns",noUiMode:"Mod fara interfata",noUiModeHint:"Estompeaza timeline-ul si controalele de pe card dupa cateva secunde de inactivitate. Orice atingere sau miscare le readuce. Ideal pentru un afisaj de perete.",solarIrradianceEntity:"Entitatea de iradianta solara",solarIrradianceEntityHelp:"Alege un senzor care raporteaza iradianta globala in unde scurte in W/m² (de regula o statie meteo Ecowitt / Davis / personala). Cand este setat, starea sa actuala si istoricul din recorder inlocuiesc Open-Meteo pentru iradianta live si trecuta peste tot unde apare (numarul de pe cipul soarelui, axa Y a graficului PV, colorarea arcului solar). Orele de prognoza raman pe Open-Meteo, deoarece un senzor nu poate purta valori viitoare.",buildingsSection:"Casa si cladiri",buildingsHint:'Pentru a pastra cardul fluid in zone urbane dense, doar cladirile aflate in raza configurata in jurul casei sunt redate in 3D. Casa in sine ramane la opacitate completa; cladirile din apropiere sunt redate cu opacitatea configurata, astfel incat ofera context urban fara a concura cu suprapunerile de date. Raza de grupare aduna anexele atasate (verande, garaje, soproane) in setul "casei".',displayRadius:"Raza de afisare",displayRadiusHelp:"Raza din jurul casei in care cladirile sunt preluate si desenate, pana la marginea discului hartii estompat. Coboara-o pentru a usura redarea pe un dispozitiv lent; 0 arata doar casa.",buildingCount:"Numarul de cladiri",buildingCountHelp:"Numarul maxim de cladiri din apropiere de desenat. Coboara-l pentru a usura redarea pe un dispozitiv lent.",buildingRealSize:"Inaltimi reale ale cladirilor",buildingRealSizeOn:"Pornit",buildingRealSizeOff:"Oprit",buildingRealSizeHint:"Pornit: foloseste inaltimile reale OpenStreetMap (plafonate pentru a pastra incadrarea lizibila). Oprit: da fiecarei cladiri aceeasi inaltime fixa de mai jos.",buildingHeight:"Inaltimea cladirii",buildingClusterRadius:"Raza de grupare a casei",buildingOpacity:"Opacitatea cladirilor din jur",buildingColor:"Culoarea cladirilor",buildingColorHelp:"Nuanta de baza aplicata cladirilor din jur in scena.",shadowsSection:"Umbre",shadowsEnabled:"Arata umbrele",shadowsEnabledOn:"Afisate",shadowsEnabledOff:"Ascunse",shadowsEnabledHint:"Comuta umbrele proiectate pe sol de cladiri pe masura ce soarele se misca.",shadowOpacity:"Opacitatea umbrelor",shadowOpacityHint:"Opacitatea umbrelor proiectate pe sol.",resetSection:"Resetare",resetSectionHint:"Instrumente de intretinere pentru a sterge datele pe care cardul le-a stocat local in cache.",resetCacheButton:"Reseteaza cache-ul de date",resetCacheWarning:"Atentie: aceasta sterge vremea Open-Meteo din cache si istoricul PV din memorie pentru FIECARE card Helios deschis pe aceasta pagina. Prognoza rafinata isi va pierde cele 5 zile de calibrare pana cand sunt preluate din nou (cateva minute, in functie de serverul tau HA). Datele tale din interiorul Home Assistant nu sunt niciodata atinse.",resetCacheDone:"Cache golit ✓",aboutSection:"Despre",aboutVersionLabel:"Versiune",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios este construit de un singur dezvoltator pasionat, cu multa energie si foarte putin somn. Daca iti place munca mea, o mica stea pe GitHub ma ajuta deja enorm, iar daca poti, o mica cafea tine proiectul in viata.",aboutDeveloperLabel:"Dezvoltator",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Cumpara-mi o cafea"}},ru:{cardName:"Helios",cardDescription:"☀️ 2.5D-вид твоего дома в реальном времени с солнцем, погодой, солнечной выработкой, батареей и сетью, плюс отбрасываемые тени и интерактивная временная шкала",period:{rangeLabel:"Период",forecast:"Прогноз",today:"Сегодня",week:"неделя",month:"месяц",year:"год"},cloudCover:{cloudLow:"Нижняя облачность",cloudMid:"Средняя облачность",cloudHigh:"Верхняя облачность"},editor:{locationSection:"Местоположение",homeLatitude:"Широта дома",homeLongitude:"Долгота дома",locationHint:"Переопредели адрес дома, используемый как центр карты. Оставь оба поля пустыми, чтобы использовать дом, заданный в Home Assistant. Переопределение применяется только тогда, когда ОБА поля содержат корректные координаты.",uiAndMapSection:"Интерфейс",autoRotate:"Авто-вращение камеры",autoRotateHint:"После нескольких секунд бездействия камера медленно облетает дом (около 1.5°/s, в направлении, противоположном видимому движению солнца). Перетаскивание одним пальцем мгновенно ставит вращение на паузу, и оно возобновляется, как только ты отпускаешь. Избегай этого на очень старых устройствах: авто-вращение заставляет перерисовывать кадр каждую секунду.",autoRotateOn:"Вкл",autoRotateOff:"Выкл",dataDisplaySection:"Сущности и отображение данных",displayUpdateFrequency:"Детализация графика",displayUpdateFrequencyHelp:"Сколько точек в час рисуют графики. Сами данные всегда берутся из 5-минутной статистики Home Assistant; это лишь управляет тем, насколько плотно строится кривая: 1 = одна точка в час (самая гладкая, самая лёгкая для отрисовки), 6 = одна точка каждые 10 минут (полная детализация, самая тяжёлая). По умолчанию 4 = точка каждые 15 минут. Понизь это значение на старых или медленных устройствах, чтобы снизить нагрузку при отрисовке. Кривая прогноза следует той же частоте, поэтому более тонкая настройка также проявляет короткие провалы от тени (дерево, перекрывающее выработку на полчаса), которые часовая кривая перешагивает.",valueDecimals:"Десятичные знаки",valueDecimalsHelp:"Количество десятичных знаков, показываемых в каждом значении. Мощность всегда показывается в kW, а энергия в kWh; этот параметр задаёт точность для всех них, чтобы чипы выглядели единообразно. От 0 до 3, по умолчанию 1.",powerUnit:"Единица мощности",powerUnitHelp:"Единица для каждого показания мощности на карточке (чипы, подсказки графика). Энергия тоже следует за ней, чтобы карточка оставалась согласованной: kW сочетается с kWh, W с Wh.",irradianceUnit:"Единица солнечной постоянной",irradianceUnitHelp:"Единица для показания солнечной постоянной (облучённости) над солнцем.",batterySign:"Знак батареи",batterySignHelp:"Знак, показываемый на чипе батареи. По умолчанию минус при заряде и плюс при разряде. Инвертированный меняет их местами. Скрытый показывает значение без знака.",batterySignDefault:"По умолчанию",batterySignInverted:"Инвертированный",batterySignHidden:"Скрытый",noUiMode:"Режим без интерфейса",noUiModeHint:"Приглушает timeline и элементы управления на карточке через несколько секунд бездействия. Любое касание или движение возвращает их. Отлично подходит для настенного дисплея.",solarIrradianceEntity:"Сущность солнечной облучённости",solarIrradianceEntityHelp:"Выбери датчик, сообщающий глобальную коротковолновую облучённость в W/m² (типичная метеостанция Ecowitt / Davis / личная). Когда он задан, его текущее состояние и история рекордера заменяют Open-Meteo для живой + прошлой облучённости везде, где она появляется (число на солнечном чипе, ось Y графика PV, окраска солнечной дуги). Часы прогноза остаются на Open-Meteo, так как датчик не может содержать будущие значения.",buildingsSection:"Дом и здания",buildingsHint:'Чтобы карта оставалась плавной в плотной городской застройке, в 3D отрисовываются только здания в пределах настроенного радиуса вокруг дома. Сам дом остаётся полностью непрозрачным; соседние здания отрисовываются с настроенной прозрачностью, чтобы давать городской контекст, не конкурируя с наложениями данных. Радиус кластера группирует пристроенные постройки (веранды, гаражи, сараи) в набор "дом".',displayRadius:"Радиус отображения",displayRadiusHelp:"Радиус вокруг дома, в котором здания загружаются и рисуются, вплоть до края размытого диска карты. Понизь его, чтобы облегчить отрисовку на медленном устройстве; 0 показывает только дом.",buildingCount:"Количество зданий",buildingCountHelp:"Максимальное число соседних зданий для отрисовки. Понизь его, чтобы облегчить отрисовку на медленном устройстве.",buildingRealSize:"Реальные высоты зданий",buildingRealSizeOn:"Вкл",buildingRealSizeOff:"Выкл",buildingRealSizeHint:"Вкл: использовать реальные высоты OpenStreetMap (ограниченные, чтобы кадр оставался читаемым). Выкл: задать каждому зданию одинаковую фиксированную высоту ниже.",buildingHeight:"Высота зданий",buildingClusterRadius:"Радиус кластера дома",buildingOpacity:"Прозрачность окружения",buildingColor:"Цвет зданий",buildingColorHelp:"Базовый оттенок, применяемый к окружающим зданиям в сцене.",shadowsSection:"Тени",shadowsEnabled:"Показывать тени",shadowsEnabledOn:"Показаны",shadowsEnabledOff:"Скрыты",shadowsEnabledHint:"Включает тени на земле, отбрасываемые зданиями по мере движения солнца.",shadowOpacity:"Прозрачность теней",shadowOpacityHint:"Прозрачность отбрасываемых на землю теней.",resetSection:"Сброс",resetSectionHint:"Инструменты обслуживания для очистки данных, кэшированных картой локально.",resetCacheButton:"Сбросить кэш данных",resetCacheWarning:"Внимание: это очищает кэшированную погоду Open-Meteo и историю PV в памяти для КАЖДОЙ карты Helios, открытой на этой странице. Уточнённый прогноз потеряет свои 5 дней калибровки, пока они не будут загружены снова (несколько минут в зависимости от твоего сервера HA). Твои данные внутри Home Assistant никогда не затрагиваются.",resetCacheDone:"Кэш очищен ✓",aboutSection:"О проекте",aboutVersionLabel:"Версия",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios создан одним увлечённым разработчиком, с большим количеством энергии и очень малым количеством сна. Если тебе нравится моя работа, маленькая звезда на GitHub уже очень помогает мне, а если можешь, маленький кофе поддержит проект на плаву.",aboutDeveloperLabel:"Разработчик",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},sk:{cardName:"Helios",cardDescription:"☀️ 2.5D pohľad na tvoj domov v reálnom čase so slnkom, počasím, solárnou výrobou, batériou a sieťou, plus vrhané tiene a interaktívna časová os",period:{rangeLabel:"Časový rozsah",forecast:"Predpoveď",today:"Dnes",week:"týždeň",month:"mesiac",year:"rok"},cloudCover:{cloudLow:"Nízka oblačnosť",cloudMid:"Stredná oblačnosť",cloudHigh:"Vysoká oblačnosť"},editor:{locationSection:"Poloha",homeLatitude:"Zemepisná šírka domova",homeLongitude:"Zemepisná dĺžka domova",locationHint:"Prepíše adresu domova použitú ako stred karty. Nechaj obe polia prázdne, aby sa použil domov nastavený v Home Assistant. Prepis sa použije len vtedy, keď sú OBE polia nastavené na platné súradnice.",uiAndMapSection:"UI",autoRotate:"Automatické otáčanie kamery",autoRotateHint:"Po niekoľkých sekundách nečinnosti kamera pomaly obieha okolo domova (približne 1.5°/s, opačne k zdanlivému pohybu slnka). Ťahanie jedným prstom ju okamžite pozastaví a obnoví sa, len čo prst zdvihneš. Na veľmi starých zariadeniach sa tomu vyhni: automatické otáčanie vynúti vykreslenie každú sekundu.",autoRotateOn:"Zapnuté",autoRotateOff:"Vypnuté",dataDisplaySection:"Entity a zobrazenie údajov",displayUpdateFrequency:"Detail grafu",displayUpdateFrequencyHelp:"Koľko bodov za hodinu grafy vykreslia. Samotné údaje sú vždy 5-minútové štatistiky Home Assistant; toto riadi len to, ako husto je krivka vykreslená: 1 = jeden bod za hodinu (najhladšie, najľahšie na vykreslenie), 6 = jeden bod každých 10 minút (plný detail, najnáročnejšie). Predvolené 4 = bod každých 15 minút. Zníž to na starších alebo pomalších zariadeniach, aby si znížil náročnosť vykresľovania. Krivka predpovede sleduje rovnaký rytmus, takže jemnejšie nastavenie rozlíši aj krátke poklesy tieňom (strom zatieňujúci výrobu na pol hodiny), ktoré hodinová krivka preskočí.",valueDecimals:"Desatinné miesta",valueDecimalsHelp:"Počet desatinných miest zobrazených pri každej hodnote. Výkon je vždy v kW a energia v kWh; toto nastaví presnosť pre všetky, aby čipy vyzerali jednotne. 0 až 3, predvolené 1.",powerUnit:"Jednotka výkonu",powerUnitHelp:"Jednotka pre každé zobrazenie výkonu na karte (čipy, popisy grafu). Energia ju tiež nasleduje, aby karta zostala konzistentná: kW sa páruje s kWh, W s Wh.",irradianceUnit:"Jednotka solárnej konštanty",irradianceUnitHelp:"Jednotka pre zobrazenie solárnej konštanty (ožiarenia) nad slnkom.",batterySign:"Znamienko batérie",batterySignHelp:"Znamienko zobrazené na čipe batérie. Predvolene je mínus pri nabíjaní a plus pri vybíjaní. Obrátené ich prehodí. Skryté zobrazí hodnotu bez znamienka.",batterySignDefault:"Predvolené",batterySignInverted:"Obrátené",batterySignHidden:"Skryté",noUiMode:"Režim bez rozhrania",noUiModeHint:"Po niekoľkých sekundách nečinnosti stlmí timeline a ovládacie prvky na karte. Akékoľvek ťuknutie alebo pohyb ich vráti späť. Skvelé pre nástennú obrazovku.",solarIrradianceEntity:"Entita slnečného ožiarenia",solarIrradianceEntityHelp:"Vyber senzor hlásiaci globálne krátkovlnné ožiarenie vo W/m² (typicky Ecowitt / Davis / vlastná meteostanica). Po nastavení jeho aktuálny stav a história z rekordéra nahradia Open-Meteo pre živé aj minulé ožiarenie všade, kde sa objavuje (číslo na čipe slnka, os Y grafu FV, vyfarbenie slnečného oblúka). Hodiny predpovede zostávajú na Open-Meteo, pretože senzor nemôže niesť budúce hodnoty.",buildingsSection:"Domov a budovy",buildingsHint:'Aby karta zostala plynulá v husto zastavaných mestských oblastiach, v 3D sa vykresľujú iba budovy v nastavenom polomere okolo domova. Samotný domov zostáva v plnej nepriehľadnosti; okolité budovy sa vykresľujú s nastavenou priehľadnosťou, takže poskytujú mestský kontext bez toho, aby súperili s dátovými vrstvami. Polomer zoskupovania spája priľahlé prístavby (verandy, garáže, kôlne) do skupiny "domova".',displayRadius:"Polomer zobrazenia",displayRadiusHelp:"Polomer okolo domova, v ktorom sa budovy načítavajú a vykresľujú, až po okraj stlmeného disku mapy. Zníž ho, aby si odľahčil vykresľovanie na pomalom zariadení; 0 zobrazí len domov.",buildingCount:"Počet budov",buildingCountHelp:"Maximálny počet okolitých budov na vykreslenie. Zníž ho, aby si odľahčil vykresľovanie na pomalom zariadení.",buildingRealSize:"Skutočné výšky budov",buildingRealSizeOn:"Zapnuté",buildingRealSizeOff:"Vypnuté",buildingRealSizeHint:"Zapnuté: použi skutočné výšky z OpenStreetMap (obmedzené, aby kompozícia zostala čitateľná). Vypnuté: daj každej budove rovnakú pevnú výšku nižšie.",buildingHeight:"Výška budovy",buildingClusterRadius:"Polomer zoskupovania domova",buildingOpacity:"Priehľadnosť okolia",buildingColor:"Farba budov",buildingColorHelp:"Základný odtieň použitý na okolité budovy v scéne.",shadowsSection:"Tiene",shadowsEnabled:"Zobraziť tiene",shadowsEnabledOn:"Zobrazené",shadowsEnabledOff:"Skryté",shadowsEnabledHint:"Prepína tiene vrhané budovami na zem, ako sa slnko pohybuje.",shadowOpacity:"Priehľadnosť tieňov",shadowOpacityHint:"Priehľadnosť vrhaných tieňov na zemi.",resetSection:"Reset",resetSectionHint:"Údržbové nástroje na vymazanie údajov, ktoré karta uložila lokálne do vyrovnávacej pamäte.",resetCacheButton:"Resetovať vyrovnávaciu pamäť údajov",resetCacheWarning:"Upozornenie: toto vymaže počasie Open-Meteo z vyrovnávacej pamäte a históriu FV v pamäti pre KAŽDÚ kartu Helios otvorenú na tejto stránke. Spresnená predpoveď stratí svojich 5 dní kalibrácie, kým sa znovu nenačítajú (pár minút podľa tvojho HA servera). Tvojich údajov vnútri Home Assistant sa to nikdy nedotkne.",resetCacheDone:"Vyrovnávacia pamäť vymazaná ✓",aboutSection:"O karte",aboutVersionLabel:"Verzia",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios vytvára jeden zanietený vývojár, s veľkou energiou a veľmi málom spánku. Ak sa ti moja práca páči, malá hviezdička na GitHub mi už veľmi pomáha, a ak môžeš, malá káva drží projekt nažive.",aboutDeveloperLabel:"Vývojár",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Kúp mi kávu"}},sl:{cardName:"Helios",cardDescription:"☀️ 2.5D pogled na tvoj dom v realnem času s soncem, vremenom, solarno proizvodnjo, baterijo in omrežjem, poleg tega vržene sence in interaktivna časovnica",period:{rangeLabel:"Časovni razpon",forecast:"Napoved",today:"Danes",week:"teden",month:"mesec",year:"leto"},cloudCover:{cloudLow:"Nizka oblačnost",cloudMid:"Srednja oblačnost",cloudHigh:"Visoka oblačnost"},editor:{locationSection:"Lokacija",homeLatitude:"Zemljepisna širina doma",homeLongitude:"Zemljepisna dolžina doma",locationHint:"Prepiše naslov doma, ki se uporablja kot središče kartice. Pusti obe polji prazni, da se uporabi dom, nastavljen v Home Assistant. Prepis se uporabi le, kadar sta OBE polji nastavljeni na veljavne koordinate.",uiAndMapSection:"UI",autoRotate:"Samodejno vrtenje kamere",autoRotateHint:"Po nekaj sekundah nedejavnosti kamera počasi kroži okoli doma (približno 1.5°/s, nasprotno navideznemu gibanju sonca). Poteg z enim prstom jo takoj zaustavi in se nadaljuje, ko spustiš. Izogibaj se mu na zelo starih napravah: samodejno vrtenje vsako sekundo prisili izris.",autoRotateOn:"Vklopljeno",autoRotateOff:"Izklopljeno",dataDisplaySection:"Entitete in prikaz podatkov",displayUpdateFrequency:"Podrobnost grafa",displayUpdateFrequencyHelp:"Koliko točk na uro izrišejo grafi. Sami podatki so vedno 5-minutne statistike Home Assistant; to nadzira le, kako gosto je narisana krivulja: 1 = ena točka na uro (najbolj gladko, najlažje za izris), 6 = ena točka vsakih 10 minut (polna podrobnost, najtežje). Privzeto 4 = točka vsakih 15 minut. Zniži na starejših ali počasnejših napravah, da zmanjšaš stroške izrisa. Krivulja napovedi sledi istemu ritmu, zato finejša nastavitev razloči tudi kratke padce zaradi sence (drevo, ki za pol ure zakrije proizvodnjo), ki jih urna krivulja preskoči.",valueDecimals:"Decimalna mesta",valueDecimalsHelp:"Število decimalnih mest, prikazanih pri vsaki vrednosti. Moč je vedno v kW in energija v kWh; to nastavi natančnost za vse, da so čipi videti enotni. 0 do 3, privzeto 1.",powerUnit:"Enota moči",powerUnitHelp:"Enota za vsak prikaz moči na kartici (čipi, namigi grafa). Energija ji tudi sledi, da kartica ostane usklajena: kW se ujema s kWh, W z Wh.",irradianceUnit:"Enota sončne konstante",irradianceUnitHelp:"Enota za prikaz sončne konstante (obsevanja) nad soncem.",batterySign:"Predznak baterije",batterySignHelp:"Predznak, prikazan na čipu baterije. Privzeto je minus med polnjenjem in plus med praznjenjem. Obrnjeno ju zamenja. Skrito prikaže vrednost brez predznaka.",batterySignDefault:"Privzeto",batterySignInverted:"Obrnjeno",batterySignHidden:"Skrito",noUiMode:"Način brez vmesnika",noUiModeHint:"Po nekaj sekundah nedejavnosti zbledi timeline in kontrolnike na kartici. Vsak dotik ali premik jih prikliče nazaj. Odlično za stenski zaslon.",solarIrradianceEntity:"Entiteta sončnega obsevanja",solarIrradianceEntityHelp:"Izberi senzor, ki poroča globalno kratkovalovno obsevanje v W/m² (običajno Ecowitt / Davis / osebna vremenska postaja). Ko je nastavljen, njegovo trenutno stanje in zgodovina iz snemalnika nadomestita Open-Meteo za živo in pretekto obsevanje povsod, kjer se pojavi (število na čipu sonca, os Y grafa PV, obarvanje sončnega loka). Ure napovedi ostanejo na Open-Meteo, saj senzor ne more nositi prihodnjih vrednosti.",buildingsSection:"Dom in stavbe",buildingsHint:'Da kartica ostane tekoča v gosto pozidanih mestnih območjih, se v 3D izrišejo le stavbe v nastavljenem polmeru okoli doma. Sam dom ostane pri polni neprosojnosti; bližnje stavbe se izrišejo z nastavljeno prosojnostjo, tako da dajejo mestni kontekst, ne da bi tekmovale s podatkovnimi prekrivami. Polmer združevanja združi prizidane pomožne stavbe (verande, garaže, lope) v skupino "doma".',displayRadius:"Polmer prikaza",displayRadiusHelp:"Polmer okoli doma, v katerem se stavbe pridobijo in narišejo, do roba zatemnjene plošče zemljevida. Zniži ga, da olajšaš izris na počasni napravi; 0 prikaže le dom.",buildingCount:"Število stavb",buildingCountHelp:"Največje število bližnjih stavb za izris. Zniži ga, da olajšaš izris na počasni napravi.",buildingRealSize:"Resnične višine stavb",buildingRealSizeOn:"Vklopljeno",buildingRealSizeOff:"Izklopljeno",buildingRealSizeHint:"Vklopljeno: uporabi resnične višine iz OpenStreetMap (omejene, da kadriranje ostane berljivo). Izklopljeno: vsaki stavbi daj enako fiksno višino spodaj.",buildingHeight:"Višina stavbe",buildingClusterRadius:"Polmer združevanja doma",buildingOpacity:"Prosojnost okolice",buildingColor:"Barva stavb",buildingColorHelp:"Osnovni odtenek, uporabljen za okoliške stavbe v prizoru.",shadowsSection:"Sence",shadowsEnabled:"Pokaži sence",shadowsEnabledOn:"Prikazano",shadowsEnabledOff:"Skrito",shadowsEnabledHint:"Preklaplja talne sence, ki jih stavbe mečejo, ko se sonce premika.",shadowOpacity:"Prosojnost senc",shadowOpacityHint:"Prosojnost vrženih senc na tleh.",resetSection:"Ponastavitev",resetSectionHint:"Vzdrževalna orodja za izbris podatkov, ki jih je kartica lokalno shranila v predpomnilnik.",resetCacheButton:"Ponastavi predpomnilnik podatkov",resetCacheWarning:"Opozorilo: to počisti predpomnjeno vreme Open-Meteo in zgodovino PV v pomnilniku za VSAKO kartico Helios, odprto na tej strani. Izboljšana napoved bo izgubila svojih 5 dni umerjanja, dokler ne bodo znova pridobljeni (nekaj minut, odvisno od tvojega strežnika HA). Tvojih podatkov v Home Assistant se to nikoli ne dotakne.",resetCacheDone:"Predpomnilnik počiščen ✓",aboutSection:"O kartici",aboutVersionLabel:"Različica",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios ustvarja en sam strasten razvijalec, z veliko energije in zelo malo spanja. Če ti je moje delo všeč, mi majhna zvezdica na GitHub že zelo pomaga, in če lahko, majhna kava ohranja projekt pri življenju.",aboutDeveloperLabel:"Razvijalec",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Plačaj mi kavo"}},sr:{cardName:"Helios",cardDescription:"☀️ 2.5D приказ твог дома у реалном времену са сунцем, временом, соларном производњом, батеријом и мрежом, плус бачене сенке и интерактивна временска трака",period:{rangeLabel:"Временски опсег",forecast:"Прогноза",today:"Данас",week:"недеља",month:"месец",year:"година"},cloudCover:{cloudLow:"Ниска облачност",cloudMid:"Средња облачност",cloudHigh:"Висока облачност"},editor:{locationSection:"Локација",homeLatitude:"Географска ширина дома",homeLongitude:"Географска дужина дома",locationHint:"Замењује адресу дома која се користи као центар картице. Остави оба поља празна да би се користио дом подешен у Home Assistant. Замена се примењује само када су ОБА поља постављена на исправне координате.",uiAndMapSection:"UI",autoRotate:"Аутоматска ротација камере",autoRotateHint:"После неколико секунди мировања камера полако кружи око дома (око 1.5°/s, супротно привидном кретању сунца). Превлачење једним прстом је одмах зауставља, а наставља се чим пустиш. Избегавај на веома старим уређајима: аутоматска ротација сваке секунде приморава исцртавање.",autoRotateOn:"Укључено",autoRotateOff:"Искључено",dataDisplaySection:"Ентитети и приказ података",displayUpdateFrequency:"Детаљи графика",displayUpdateFrequencyHelp:"Колико тачака по сату графици исцртавају. Сами подаци су увек 5-минутне статистике Home Assistant; ово контролише само колико густо се црта крива: 1 = једна тачка по сату (најглађе, најлакше за исцртавање), 6 = једна тачка сваких 10 минута (пуни детаљ, најтеже). Подразумевано 4 = тачка сваких 15 минута. Смањи на старијим или споријим уређајима да смањиш трошак исцртавања. Крива прогнозе прати исти ритам, па финије подешавање разлучује и кратке падове због сенке (дрво које на пола сата заклања производњу) које сатна крива прескочи.",valueDecimals:"Децимална места",valueDecimalsHelp:"Број децималних места приказаних уз сваку вредност. Снага је увек у kW, а енергија у kWh; ово поставља прецизност за све, да чипови изгледају уједначено. 0 до 3, подразумевано 1.",powerUnit:"Јединица снаге",powerUnitHelp:"Јединица за свако очитавање снаге на картици (чипови, савети графика). Енергија је прати, па картица остаје доследна: kW иде уз kWh, W уз Wh.",irradianceUnit:"Јединица соларне константе",irradianceUnitHelp:"Јединица за очитавање соларне константе (озрачења) изнад сунца.",batterySign:"Знак батерије",batterySignHelp:"Знак приказан на чипу батерије. Подразумевано је минус при пуњењу и плус при пражњењу. Обрнуто га мења. Сакривено приказује вредност без знака.",batterySignDefault:"Подразумевано",batterySignInverted:"Обрнуто",batterySignHidden:"Сакривено",noUiMode:"Режим без интерфејса",noUiModeHint:"Затамните timeline и контроле на картици након неколико секунди неактивности. Било који додир или померање их враћа. Одлично за wall display.",solarIrradianceEntity:"Ентитет сунчевог озрачења",solarIrradianceEntityHelp:"Одабери сензор који јавља глобално краткоталасно озрачење у W/m² (типично Ecowitt / Davis / лична метеоролошка станица). Када је постављен, његово тренутно стање и историја из снимача замењују Open-Meteo за уживо и прошло озрачење свуда где се појављује (број на чипу сунца, оса Y графика PV, бојење сунчевог лука). Сати прогнозе остају на Open-Meteo јер сензор не може носити будуће вредности.",buildingsSection:"Дом и зграде",buildingsHint:'Да би картица остала глатка у густо изграђеним урбаним подручјима, у 3D се исцртавају само зграде унутар постављеног радијуса око дома. Сам дом остаје у пуној непрозирности; оближње зграде исцртавају се са постављеном прозирношћу, тако да дају урбани контекст без такмичења са слојевима података. Радијус груписања окупља прислоњене помоћне зграде (веранде, гараже, шупе) у групу "дома".',displayRadius:"Радијус приказа",displayRadiusHelp:"Радијус око дома у којем се зграде преузимају и цртају, све до ивице избледелог диска карте. Смањи га да олакшаш исцртавање на спором уређају; 0 приказује само дом.",buildingCount:"Број зграда",buildingCountHelp:"Највећи број оближњих зграда за исцртавање. Смањи га да олакшаш исцртавање на спором уређају.",buildingRealSize:"Стварне висине зграда",buildingRealSizeOn:"Укључено",buildingRealSizeOff:"Искључено",buildingRealSizeHint:"Укључено: користи стварне висине из OpenStreetMap (ограничене да кадар остане читљив). Искључено: дај свакој згради исту фиксну висину испод.",buildingHeight:"Висина зграде",buildingClusterRadius:"Радијус груписања дома",buildingOpacity:"Прозирност околине",buildingColor:"Боја зграда",buildingColorHelp:"Основни тон примењен на околне зграде у сцени.",shadowsSection:"Сенке",shadowsEnabled:"Прикажи сенке",shadowsEnabledOn:"Приказано",shadowsEnabledOff:"Сакривено",shadowsEnabledHint:"Укључује или искључује сенке које зграде бацају на тло док се сунце креће.",shadowOpacity:"Прозирност сенки",shadowOpacityHint:"Прозирност бачених сенки на тлу.",resetSection:"Ресетовање",resetSectionHint:"Алати за одржавање за брисање података које је картица локално сачувала у кеш.",resetCacheButton:"Ресетуј кеш података",resetCacheWarning:"Упозорење: ово брише кеширано време Open-Meteo и историју PV у меморији за СВАКУ картицу Helios отворену на овој страници. Прочишћена прогноза изгубиће својих 5 дана калибрације док се поново не преузму (неколико минута зависно од твог HA сервера). Твоји подаци унутар Home Assistant никада се не дирају.",resetCacheDone:"Кеш обрисан ✓",aboutSection:"О картици",aboutVersionLabel:"Верзија",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios гради један страствени програмер, са пуно енергије и врло мало сна. Ако ти се свиђа мој рад, мала звездица на GitHub ми већ много помаже, а ако можеш, мала кафа одржава пројекат у животу.",aboutDeveloperLabel:"Програмер",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Части ме кафом"}},sv:{cardName:"Helios",cardDescription:"☀️ En 2.5D-vy i realtid av ditt hem med solen, vädret, solproduktion, batteri och elnät, plus kastade skuggor och en interaktiv tidslinje",period:{rangeLabel:"Tidsintervall",forecast:"Prognos",today:"Idag",week:"vecka",month:"månad",year:"år"},cloudCover:{cloudLow:"Låg molnighet",cloudMid:"Medelhög molnighet",cloudHigh:"Hög molnighet"},editor:{locationSection:"Plats",homeLatitude:"Hemmets latitud",homeLongitude:"Hemmets longitud",locationHint:"Ersätt hemadressen som används som kortets centrum. Lämna båda fälten tomma för att använda hemmet som är konfigurerat i Home Assistant. Ersättningen tillämpas endast när BÅDA fälten är inställda på giltiga koordinater.",uiAndMapSection:"UI",autoRotate:"Automatisk kamerarotation",autoRotateHint:"När det är inaktivt i några sekunder kretsar kameran långsamt runt hemmet (cirka 1.5°/s, motsatt solens skenbara rörelse). En dragning med ett finger pausar den omedelbart och den återupptas när du släpper. Undvik det på mycket gamla enheter: automatisk rotation tvingar en rendering varje sekund.",autoRotateOn:"På",autoRotateOff:"Av",dataDisplaySection:"Entiteter och datavisning",displayUpdateFrequency:"Grafdetaljer",displayUpdateFrequencyHelp:"Hur många punkter per timme graferna ritar. Själva datan är alltid Home Assistants 5-minuters statistik; detta styr bara hur tätt kurvan plottas: 1 = en punkt per timme (mjukast, lättast att rendera), 6 = en punkt var 10:e minut (full detalj, tyngst). Standard 4 = en punkt var 15:e minut. Sänk det på äldre eller långsammare enheter för att minska renderingskostnaden. Prognoskurvan följer samma takt, så en finare inställning visar även korta skuggdippar (ett träd som skuggar produktionen i en halvtimme) som en timkurva hoppar över.",valueDecimals:"Decimaler",valueDecimalsHelp:"Antal decimaler som visas på varje värdeutläsning. Effekt visas alltid i kW och energi i kWh; detta ställer in precisionen för dem alla så att chipsen ser enhetliga ut. 0 till 3, standard 1.",powerUnit:"Effektenhet",powerUnitHelp:"Enhet för varje effektutläsning på kortet (chips, grafverktygstips). Energin följer den också, så kortet förblir konsekvent: kW hör ihop med kWh, W med Wh.",irradianceUnit:"Enhet för solkonstant",irradianceUnitHelp:"Enhet för utläsningen av solkonstanten (irradians) ovanför solen.",batterySign:"Batteritecken",batterySignHelp:"Tecken som visas på batterichippet. Standard är minus vid laddning och plus vid urladdning. Inverterat vänder på det. Dolt visar värdet utan tecken.",batterySignDefault:"Standard",batterySignInverted:"Inverterat",batterySignHidden:"Dolt",noUiMode:"Läge utan gränssnitt",noUiModeHint:"Tona ned timeline och kontrollerna på kortet efter några sekunders inaktivitet. Vilken tryckning eller rörelse som helst tar tillbaka dem. Perfekt för en wall display.",solarIrradianceEntity:"Entitet för solirradians",solarIrradianceEntityHelp:"Välj en sensor som rapporterar global kortvågig irradians i W/m² (vanligtvis Ecowitt / Davis / personlig väderstation). När den är inställd ersätter dess aktuella tillstånd och inspelarhistorik Open-Meteo för live- och tidigare irradians överallt där den visas (siffra på solchippet, PV-diagrammets Y-axel, färgläggning av solbågen). Prognostimmar stannar på Open-Meteo eftersom en sensor inte kan bära framtida värden.",buildingsSection:"Hem & byggnader",buildingsHint:'För att hålla kortet flytande i tätbebyggda stadsområden renderas endast byggnader inom den konfigurerade radien runt hemmet i 3D. Hemmet självt förblir helt ogenomskinligt; närliggande byggnader renderas med den konfigurerade ogenomskinligheten så att de ger urban kontext utan att konkurrera med dataöverläggen. Klusterradien grupperar tillhörande uthus (verandor, garage, skjul) i "hem"-uppsättningen.',displayRadius:"Visningsradie",displayRadiusHelp:"Radie runt hemmet inom vilken byggnader hämtas och ritas, ända ut till kanten av den blekta kortskivan. Sänk den för att lätta renderingen på en långsam enhet; 0 visar bara hemmet.",buildingCount:"Antal byggnader",buildingCountHelp:"Maximalt antal närliggande byggnader att rita. Sänk det för att lätta renderingen på en långsam enhet.",buildingRealSize:"Verkliga byggnadshöjder",buildingRealSizeOn:"På",buildingRealSizeOff:"Av",buildingRealSizeHint:"På: använd verkliga OpenStreetMap-höjder (begränsade för att hålla bildramen läsbar). Av: ge varje byggnad samma fasta höjd nedan.",buildingHeight:"Byggnadshöjd",buildingClusterRadius:"Hemmets klusterradie",buildingOpacity:"Ogenomskinlighet för omgivning",buildingColor:"Byggnadsfärg",buildingColorHelp:"Grundton som tillämpas på de omgivande byggnaderna i scenen.",shadowsSection:"Skuggor",shadowsEnabled:"Visa skuggor",shadowsEnabledOn:"Visas",shadowsEnabledOff:"Dold",shadowsEnabledHint:"Slår på/av de markskuggor som byggnaderna kastar när solen rör sig.",shadowOpacity:"Skuggogenomskinlighet",shadowOpacityHint:"Ogenomskinlighet för de kastade markskuggorna.",resetSection:"Återställ",resetSectionHint:"Underhållsverktyg för att rensa data som kortet har cachat lokalt.",resetCacheButton:"Återställ datacache",resetCacheWarning:"Varning: detta rensar det cachade Open-Meteo-vädret och PV-historiken i minnet för VARJE Helios-kort som är öppet på denna sida. Den förfinade prognosen förlorar sina 5 dagars kalibrering tills de hämtas igen (några minuter beroende på din HA-server). Dina data inuti Home Assistant rörs aldrig.",resetCacheDone:"Cache rensad ✓",aboutSection:"Om",aboutVersionLabel:"Version",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios är byggt av en enda passionerad utvecklare, med massor av energi och väldigt lite sömn. Om du gillar mitt arbete hjälper en liten stjärna på GitHub mig redan mycket, och om du kan håller en liten kaffe projektet vid liv.",aboutDeveloperLabel:"Utvecklare",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Bjud mig på en kaffe"}},uk:{cardName:"Helios",cardDescription:"☀️ 2.5D-вид твого будинку в реальному часі з сонцем, погодою, сонячною генерацією, акумулятором і мережею, а також відкинутими тінями та інтерактивною шкалою часу",period:{rangeLabel:"Період",forecast:"Прогноз",today:"Сьогодні",week:"тиждень",month:"місяць",year:"рік"},cloudCover:{cloudLow:"Нижня хмарність",cloudMid:"Середня хмарність",cloudHigh:"Верхня хмарність"},editor:{locationSection:"Розташування",homeLatitude:"Широта будинку",homeLongitude:"Довгота будинку",locationHint:"Перевизнач адресу будинку, що використовується як центр карти. Залиш обидва поля порожніми, щоб використати будинок, налаштований у Home Assistant. Перевизначення застосовується лише тоді, коли ОБИДВА поля містять коректні координати.",uiAndMapSection:"Інтерфейс",autoRotate:"Автообертання камери",autoRotateHint:"Після кількох секунд бездіяльності камера повільно облітає будинок (приблизно 1.5°/s, у напрямку, протилежному видимому руху сонця). Перетягування одним пальцем миттєво ставить обертання на паузу, і воно відновлюється, щойно ти відпускаєш. Уникай цього на дуже старих пристроях: автообертання змушує перемальовувати кадр щосекунди.",autoRotateOn:"Увімк",autoRotateOff:"Вимк",dataDisplaySection:"Сутності та відображення даних",displayUpdateFrequency:"Деталізація графіка",displayUpdateFrequencyHelp:"Скільки точок на годину малюють графіки. Самі дані завжди беруться з 5-хвилинної статистики Home Assistant; це лише керує тим, наскільки щільно будується крива: 1 = одна точка на годину (найгладша, найлегша для відображення), 6 = одна точка кожні 10 хвилин (повна деталізація, найважча). За замовчуванням 4 = точка кожні 15 хвилин. Знизь це значення на старих чи повільних пристроях, щоб зменшити витрати на відображення. Крива прогнозу дотримується тієї ж частоти, тому тонше налаштування також виявляє короткі провали від тіні (дерево, що перекриває генерацію на пів години), які годинна крива переступає.",valueDecimals:"Десяткові знаки",valueDecimalsHelp:"Кількість десяткових знаків, що показуються в кожному значенні. Потужність завжди показується в kW, а енергія в kWh; цей параметр задає точність для всіх них, щоб чипи виглядали однаково. Від 0 до 3, за замовчуванням 1.",powerUnit:"Одиниця потужності",powerUnitHelp:"Одиниця для кожного показника потужності на карті (чипи, підказки графіка). Енергія також слідує за нею, тож карта залишається узгодженою: kW у парі з kWh, W з Wh.",irradianceUnit:"Одиниця сонячної сталої",irradianceUnitHelp:"Одиниця для показника сонячної сталої (опроміненості) над сонцем.",batterySign:"Знак батареї",batterySignHelp:"Знак, що показується на чипі батареї. За замовчуванням мінус під час заряджання і плюс під час розряджання. Інвертовано змінює його на протилежний. Приховано показує значення без знака.",batterySignDefault:"За замовчуванням",batterySignInverted:"Інвертовано",batterySignHidden:"Приховано",noUiMode:"Режим без інтерфейсу",noUiModeHint:"Затемнює timeline і елементи керування на картці через кілька секунд бездіяльності. Будь-який дотик чи рух повертає їх. Чудово підходить для wall display.",solarIrradianceEntity:"Сутність сонячної опроміненості",solarIrradianceEntityHelp:"Обери датчик, що повідомляє глобальну короткохвильову опроміненість у W/m² (типова метеостанція Ecowitt / Davis / особиста). Коли він заданий, його поточний стан та історія рекордера замінюють Open-Meteo для живої + минулої опроміненості скрізь, де вона з'являється (число на сонячному чипі, вісь Y графіка PV, забарвлення сонячної дуги). Години прогнозу залишаються на Open-Meteo, оскільки датчик не може містити майбутні значення.",buildingsSection:"Будинок і будівлі",buildingsHint:'Щоб карта залишалася плавною в щільній міській забудові, у 3D відображаються лише будівлі в межах налаштованого радіуса навколо будинку. Сам будинок залишається повністю непрозорим; сусідні будівлі відображаються з налаштованою прозорістю, щоб давати міський контекст, не конкуруючи з накладеннями даних. Радіус кластера групує прибудовані споруди (веранди, гаражі, сараї) у набір "будинок".',displayRadius:"Радіус відображення",displayRadiusHelp:"Радіус навколо будинку, в якому будівлі завантажуються та малюються, аж до краю розмитого диска карти. Знизь його, щоб полегшити відображення на повільному пристрої; 0 показує лише будинок.",buildingCount:"Кількість будівель",buildingCountHelp:"Максимальна кількість сусідніх будівель для відображення. Знизь її, щоб полегшити відображення на повільному пристрої.",buildingRealSize:"Реальні висоти будівель",buildingRealSizeOn:"Увімк",buildingRealSizeOff:"Вимк",buildingRealSizeHint:"Увімк: використовувати реальні висоти OpenStreetMap (обмежені, щоб кадр залишався читабельним). Вимк: задати кожній будівлі однакову фіксовану висоту нижче.",buildingHeight:"Висота будівель",buildingClusterRadius:"Радіус кластера будинку",buildingOpacity:"Прозорість оточення",buildingColor:"Колір будівель",buildingColorHelp:"Базовий відтінок, що застосовується до навколишніх будівель у сцені.",shadowsSection:"Тіні",shadowsEnabled:"Показувати тіні",shadowsEnabledOn:"Показані",shadowsEnabledOff:"Приховані",shadowsEnabledHint:"Вмикає тіні на землі, що відкидаються будівлями в міру руху сонця.",shadowOpacity:"Прозорість тіней",shadowOpacityHint:"Прозорість відкинутих на землю тіней.",resetSection:"Скидання",resetSectionHint:"Інструменти обслуговування для очищення даних, кешованих картою локально.",resetCacheButton:"Скинути кеш даних",resetCacheWarning:"Увага: це очищає кешовану погоду Open-Meteo та історію PV у пам'яті для КОЖНОЇ карти Helios, відкритої на цій сторінці. Уточнений прогноз втратить свої 5 днів калібрування, поки їх не буде завантажено знову (кілька хвилин залежно від твого сервера HA). Твої дані всередині Home Assistant ніколи не зачіпаються.",resetCacheDone:"Кеш очищено ✓",aboutSection:"Про проєкт",aboutVersionLabel:"Версія",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios створений одним захопленим розробником, з великою кількістю енергії та дуже малою кількістю сну. Якщо тобі подобається моя робота, маленька зірка на GitHub уже дуже допомагає мені, а якщо можеш, маленька кава підтримає проєкт на плаву.",aboutDeveloperLabel:"Розробник",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},is:{cardName:"Helios",cardDescription:"☀️ Rauntíma 2.5D-sýn af heimilinu þínu með sólinni, veðrinu, sólarframleiðslu, rafhlöðu og raforkukerfi, auk varpaðra skugga og gagnvirks tímaáss",period:{rangeLabel:"Tímabil",forecast:"Spá",today:"Í dag",week:"vika",month:"mánuður",year:"ár"},cloudCover:{cloudLow:"Lág skýjahula",cloudMid:"Miðlungs skýjahula",cloudHigh:"Há skýjahula"},editor:{locationSection:"Staðsetning",homeLatitude:"Breiddargráða heimilis",homeLongitude:"Lengdargráða heimilis",locationHint:"Hnekkja heimilisfanginu sem notað er sem miðja kortsins. Skildu bæði reitina eftir auða til að nota heimilið sem stillt er í Home Assistant. Hnekkingin er aðeins beitt þegar BÁÐIR reitir eru stilltir á gild hnit.",uiAndMapSection:"UI",autoRotate:"Sjálfvirkur snúningur myndavélar",autoRotateHint:"Þegar ekkert hefur gerst í nokkrar sekúndur, snýst myndavélin hægt um heimilið (um það bil 1.5°/s, andstætt sýnilegri hreyfingu sólarinnar). Að draga með einum fingri stöðvar hann samstundis og hann heldur áfram þegar þú sleppir. Forðastu hann á mjög gömlum tækjum: sjálfvirkur snúningur þvingar fram myndgerð á hverri sekúndu.",autoRotateOn:"Kveikt",autoRotateOff:"Slökkt",dataDisplaySection:"Eindir og birting gagna",displayUpdateFrequency:"Nákvæmni grafs",displayUpdateFrequencyHelp:"Hversu marga punkta á klukkustund gröfin teikna. Gögnin sjálf eru alltaf 5 mínútna tölfræði Home Assistant; þetta stýrir aðeins hversu þétt ferillinn er teiknaður: 1 = einn punktur á klukkustund (sléttast, léttast að myndgera), 6 = einn punktur á 10 mínútna fresti (full nákvæmni, þyngst). Sjálfgefið 4 = punktur á 15 mínútna fresti. Lækkaðu hann á eldri eða hægari tækjum til að minnka myndgerðarkostnað. Spáferillinn fylgir sama takti, svo fínni stilling sýnir einnig stuttar skuggadýfur (tré sem skyggir á framleiðsluna í hálftíma) sem klukkustundarferill stígur yfir.",valueDecimals:"Aukastafir",valueDecimalsHelp:"Fjöldi aukastafa sem birtir eru á hverjum gildislestri. Afl er alltaf sýnt í kW og orka í kWh; þetta stillir nákvæmnina fyrir þau öll svo flögurnar lesist samræmt. 0 til 3, sjálfgefið 1.",powerUnit:"Afleining",powerUnitHelp:"Eining fyrir hverja aflmælingu á kortinu (flögur, ábendingar á grafi). Orkan fylgir henni líka, svo kortið haldist samræmt: kW parast við kWh, W við Wh.",irradianceUnit:"Eining sólfastans",irradianceUnitHelp:"Eining fyrir mælingu sólfastans (geislunar) fyrir ofan sólina.",batterySign:"Formerki rafhlöðu",batterySignHelp:"Formerki sem birt er á rafhlöðuflögunni. Sjálfgefið er mínus við hleðslu og plús við afhleðslu. Snúið víxlar því. Falið sýnir gildið án formerkis.",batterySignDefault:"Sjálfgefið",batterySignInverted:"Snúið",batterySignHidden:"Falið",noUiMode:"Án viðmóts",noUiModeHint:"Deyfir timeline og stýringar á spjaldinu eftir nokkrar sekúndur af aðgerðaleysi. Hvaða snerting eða hreyfing sem er kallar þau fram aftur. Frábært fyrir wall display.",solarIrradianceEntity:"Eind fyrir sólargeislun",solarIrradianceEntityHelp:"Veldu skynjara sem skráir hnattræna stuttbylgjugeislun í W/m² (venjulega Ecowitt / Davis / persónuleg veðurstöð). Þegar hann er stilltur koma núverandi staða hans og upptökuferill í stað Open-Meteo fyrir rauntíma- og fortíðargeislunina alls staðar þar sem hún birtist (tala á sólarflögunni, Y-ás PV-grafsins, litun sólarbogans). Spástundir haldast á Open-Meteo þar sem skynjari getur ekki borið framtíðargildi.",buildingsSection:"Heimili & byggingar",buildingsHint:'Til að halda kortinu lipru á þéttbýlum svæðum eru aðeins byggingar innan stillta radíusins umhverfis heimilið myndgerðar í 3D. Heimilið sjálft helst í fullri ógagnsæi; nálægar byggingar eru myndgerðar með stilltu ógagnsæi svo þær veiti borgarsamhengi án þess að keppa við gagnayfirlögin. Klasaradíusinn flokkar áfastar útibyggingar (verandir, bílskúra, skúra) í "heimilis"-mengið.',displayRadius:"Birtingarradíus",displayRadiusHelp:"Radíus umhverfis heimilið þar sem byggingar eru sóttar og teiknaðar, allt að jaðri dofnaða kortskífunnar. Lækkaðu hann til að létta myndgerð á hægu tæki; 0 sýnir aðeins heimilið.",buildingCount:"Fjöldi bygginga",buildingCountHelp:"Hámarksfjöldi nálægra bygginga sem teikna á. Lækkaðu hann til að létta myndgerð á hægu tæki.",buildingRealSize:"Raunverulegar hæðir bygginga",buildingRealSizeOn:"Kveikt",buildingRealSizeOff:"Slökkt",buildingRealSizeHint:"Kveikt: notaðu raunverulegar OpenStreetMap hæðir (takmarkaðar til að halda römmun læsilegri). Slökkt: gefðu hverri byggingu sömu föstu hæð hér að neðan.",buildingHeight:"Hæð byggingar",buildingClusterRadius:"Klasaradíus heimilis",buildingOpacity:"Ógagnsæi umhverfis",buildingColor:"Litur byggingar",buildingColorHelp:"Grunntónn sem beitt er á byggingarnar í kring í senunni.",shadowsSection:"Skuggar",shadowsEnabled:"Sýna skugga",shadowsEnabledOn:"Sýndir",shadowsEnabledOff:"Faldir",shadowsEnabledHint:"Kveikir/slekkur á jarðskuggunum sem byggingarnar varpa eftir því sem sólin færist.",shadowOpacity:"Ógagnsæi skugga",shadowOpacityHint:"Ógagnsæi varpaðra jarðskugga.",resetSection:"Endurstilla",resetSectionHint:"Viðhaldsverkfæri til að eyða gögnum sem kortið hefur vistað staðbundið í skyndiminni.",resetCacheButton:"Endurstilla gagnaskyndiminni",resetCacheWarning:"Aðvörun: þetta hreinsar skyndiminnisvistaða Open-Meteo veðrið og PV-ferilinn í minni fyrir HVERT Helios-kort sem opið er á þessari síðu. Fínstillta spáin tapar 5 daga kvörðun sinni þar til þeir eru sóttir aftur (nokkrar mínútur eftir HA-þjóninum þínum). Gögnin þín inni í Home Assistant eru aldrei snert.",resetCacheDone:"Skyndiminni hreinsað ✓",aboutSection:"Um",aboutVersionLabel:"Útgáfa",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios er smíðað af einum ástríðufullum forritara, með mikla orku og mjög lítinn svefn. Ef þér líkar verkið mitt hjálpar lítil stjarna á GitHub mér nú þegar mikið, og ef þú getur, heldur lítill kaffibolli verkefninu á lífi.",aboutDeveloperLabel:"Forritari",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Bjóddu mér upp á kaffi"}}},Ke=Ge;function pickTranslations(e){if(!e)return Ke;const t=e.toLowerCase();if(qe[t])return qe[t];const i=t.split("-")[0];return qe[i]?qe[i]:Ke}function pxPerMetreFor(e,t=19){return 256*2**t/(40075016.686*Math.cos(e*be))}function lonLatToTile$1(e,t,i){const n=2**i,r=t*be;return[(e+180)/360*n,(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n]}var Ze=i$6`
    :host
    {
        display: block;
        height:  100%;
        /*  Shared chip/surface drop shadow, so every floating pill and themed plate reads at the same depth. */
        --helios-shadow-chip: 0 1px 3px var(--shadow-color);
    }

    ha-card
    {
        position: relative;
        overflow: hidden;
        /*  Background follows the HA theme; the basemap disc fades into it at its edges. */
        background: var(--ha-card-background, var(--card-background-color, #fff));
        /*  Clip the backdrop to the padding box so it stops inside the border instead of painting a
            corner outside HA's frame. */
        background-clip: padding-box;
        /*  Container-query host so the kiosk breakpoint reacts to the card's own width, not the viewport
            (which would mis-fire with several cards side by side). */
        container-type: inline-size;
        container-name: helios-card;
        /*  border-radius stays because overflow:hidden clips the full-bleed map to it. */
        border-radius: var(--ha-card-border-radius, 12px);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        height:     100%;
        width:      100%;
        /*  Floor for layouts that give no explicit height (vertical-stack, panel, some grids): without it
            height:100% collapses to the children's intrinsic height and the map area vanishes. Kept in step
            with the 4-row grid minimum (~248 px) so the sections view can shrink the card that small; layouts
            passing a taller height override this, and going this small is the user's timeline compromise. */
        min-height: 240px;
        /*  Stacking context so absolute z-index children stay scoped to the card and don't escape above
            HA chrome on scroll. */
        isolation: isolate;
    }

    /*  Auto-height sizing. The map, HUD and timeline are all position:absolute, so the card has no in-flow
        content and would collapse to min-height under any layout that gives no explicit height (sections
        "auto" mode, vertical-stack, panel). This flow spacer gives the card its natural 480 px height there.
        A layout passing an explicit height (fixed sections rows, a set panel height) OVERRIDES this content
        height, and overflow:hidden clips the spacer, so the card still shrinks freely down to min_rows. */
    ha-card::before
    {
        content: '';
        display: block;
        height: 480px;
        pointer-events: none;
    }

    #map-container
    {
        /*  Absolute + inset so the container fills the ha-card via containing-block dimensions (which
            respect min-height); a percentage height collapses to 0 under Masonry. Hosts the renderer's
            ground holder + scene SVG. overflow:hidden clips the tilted basemap canvas (which extends past
            the frame at low pitch). No CSS perspective property here: the ground carries its own perspective() in
            its transform (see SceneCamera.groundTransform), so it projects EXACTLY like the overlays' project3, and
            the flat scene SVG stays out of any 3D context (keeps the buildings aligned with the basemap). */
        position: absolute;
        /*  Bleed 1 px under the border (re-clipped by overflow:hidden) to cover the anti-alias seam at
            the rounded corners. */
        inset: -1px;
        overflow: hidden;
        /*  z-index 1 keeps the container (and home prism) above the ground guide layer (z 0) yet below every
            HUD overlay (z 4+). */
        z-index: 1;
    }

    /*  Ground holder: tilted basemap canvas + edge fade, driven by a CSS 3D transform (rotateX = pitch,
        rotateZ = bearing) written each frame. preserve-3d is REQUIRED: without it, at some pitch angles the
        3D-transformed ground canvas composites ABOVE the flat sibling scene-svg and hides the buildings. */
    .scene-ground-holder
    {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        pointer-events: none;
    }
    /*  Basemap canvas, painted from OpenFreeMap vector tiles (ground-render.ts). Positioned by the renderer's
        transform-origin + transform; sized in JS. Light/dark is two painted palettes, so there is no CSS
        filter: a theme flip repaints the canvas from its cached vector features. */
    .ground
    {
        position: absolute;
        top: 0;
        left: 0;
    }
    /*  Edge fade: same size + transform as the ground, a radial gradient transparent out to GROUND_FADE_START
        (88%) then dissolving to the card background, turning the square canvas into a soft disc. How FAR the
        ground reaches is set by GROUND_RADIUS (the canvas size); this only softens the rim. */
    .ground-fade
    {
        position: absolute;
        top: 0;
        left: 0;
        will-change: transform;
        pointer-events: none;
        background: radial-gradient(
            circle closest-side at 50% 50%,
            transparent 0%,
            transparent ${r$5(88)}%,
            var(--ha-card-background, var(--card-background-color, #fff)) 100%
        );
    }
    /*  Screen-space scene SVG: cast shadows + extruded buildings repainted every frame.
        Full-size overlay above the ground, click-transparent (the HUD SVGs own their pointer events). */
    .scene-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    }
    /*  Camera-locked cursor: default cursor when rotation is disabled, so the scene doesn't advertise an
        interaction that doesn't exist. */
    ha-card.camera-locked #map-container
    {
        cursor: default !important;
    }


    /*  ============================================================
        HUD chips: ONE shared box recipe for every floating pill so they
        match in height, width, padding and font. Only the distinct bits
        (border-colour, z-index, pointer behaviour, active-glow, per-chip
        states) live in the per-chip rules below; don't re-declare the box
        geometry per chip.
        ============================================================ */
    .pv-pct-label,
    .battery-pct-label,
    .grid-label,
    .group-label,
    .solar-pct-label,
    .home-pill
    {
        position: absolute;
        transform: translate(-50%, -50%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        box-sizing: border-box;
        /*  Fixed width so every chip is identical; content centres within it. */
        width: 96px;
        padding: 3px 10px;
        border: 2px solid;
        border-radius: 999px;
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        box-shadow: var(--helios-shadow-chip);
        /*  Chips land at fractional pixels (50% anchor + -50% translate), so geometric precision +
            antialiased smoothing keeps the glyphs sharp. */
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }

    /*  PV production chip: pill tinted in the production colour (--pv-leader-color, set inline). Shares the
        fixed width so the leader gap stays identical however wide the value reads. */
    .pv-pct-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
    }

    /*  Shared icon recipe for the value chips (PV / battery / grid / cloud / sun). The home pill's icon is
        coloured differently, so it keeps its own rule below. */
    .pv-pct-label ha-icon,
    .battery-pct-label ha-icon,
    .grid-label ha-icon,
    .group-label ha-icon,
    .solar-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Re-targetable chips: clicking one points the bottom chart at that metric. Base chips are
        display-only; [role="button"] re-enables events and out-specifies the base rule. */
    .pv-pct-label[role="button"],
    .battery-pct-label[role="button"],
    .grid-label[role="button"],
    .group-label[role="button"],
    .solar-pct-label[role="button"]
    {
        pointer-events: auto;
        cursor: pointer;
    }
    /*  Active-target glow. It lives on a ::after pseudo so it can FADE via opacity: box-shadow doesn't
        transition reliably between transparent and color-mix on WebKit, but opacity always does. --chip-glow
        carries each chip's metric colour; the pseudo holds the blurred halo, opacity 0 at rest, 1 while active. */
    .pv-pct-label      { --chip-glow: var(--pv-leader-color, var(--energy-solar-color, #ff9800)); }
    .battery-pct-label { --chip-glow: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac)); }
    .grid-label        { --chip-glow: var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2)); }
    .group-label       { --chip-glow: var(--group-color, var(--primary-color, #03a9f4)); }
    .solar-pct-label   { --chip-glow: var(--solar-color, var(--amber-color, #ffc107)); }
    .home-pill         { --chip-glow: var(--helios-consumption-color, #4caf50); }

    .pv-pct-label::after,
    .battery-pct-label::after,
    .grid-label::after,
    .group-label::after,
    .solar-pct-label::after,
    .home-pill::after
    {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        box-shadow: 0 0 12px 1px color-mix(in srgb, var(--chip-glow, transparent) 90%, transparent);
        opacity: 0;
        /*  Fade synced to the home prism's grow animation (HOME_GROW_MS) so the chip's glow and the house
            settle together on a selection. */
        transition: opacity ${r$5(300)}ms ease;
    }
    .pv-pct-label.is-chart-active::after,
    .battery-pct-label.is-chart-active::after,
    .grid-label.is-chart-active::after,
    .group-label.is-chart-active::after,
    .solar-pct-label.is-chart-active::after,
    .home-pill.is-chart-active::after
    {
        opacity: 1;
    }

    /*  ============================================================
        Per-chip detail panel (scene mode). Double-tapping the active
        chip opens this compact, vertical readout top-right, tinted in
        the selection colour (--detail-accent, set inline). Icons only,
        values in the card's configured unit. Kept narrow so it never
        crowds a small card.
        ============================================================ */
    .detail-panel
    {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 40;
        display: flex;
        flex-direction: column;
        gap: 2px;
        box-sizing: border-box;
        /*  Fixed width: the panel never reflows with content; long device friendly names ellipsise instead. */
        width: 160px;
        padding: 6px 10px;
        border: 2px solid var(--detail-accent, var(--primary-color, #03a9f4));
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        box-shadow: var(--helios-shadow-chip);
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
        -webkit-font-smoothing: antialiased;
    }
    .detail-panel .dp-row
    {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .detail-panel .dp-row ha-icon
    {
        --mdc-icon-size: 16px;
        flex: 0 0 auto;
        color: var(--detail-accent, var(--primary-color, #03a9f4));
    }
    .detail-panel .dp-row span
    {
        flex: 1 1 auto;
        text-align: right;
    }
    /*  Per-device group rows: a left-aligned name (ellipsised) then the right-aligned total. */
    .detail-panel .dp-row-device .dp-label
    {
        flex: 1 1 auto;
        /*  min-width:0 lets a flex child shrink below its content so the ellipsis actually engages. */
        min-width: 0;
        text-align: left;
        /*  Regular weight (the panel is 600 by default): the name is a label, the value stays the emphasis. */
        font-weight: 400;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .detail-panel .dp-row-device .dp-value
    {
        flex: 0 0 auto;
        text-align: right;
        margin-left: 10px;
    }

    /*  Predicted PV chip when scrubbing into the future: the value is modelled, not measured, so the
        chip dims and a leading "~" (set by render) signals "estimate". */
    .pv-pct-label.is-predicted
    {
        opacity: 0.55;
        font-style: italic;
    }

    /*  Battery SoC and Power chips, same compact pill recipe as the PV chip. */
    .battery-pct-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
    }

    /*  Grid chip, same pill recipe. Shows the active flow only; border follows the inline
        --grid-leader-color (blue importing, purple exporting), icon + value flip with it. */
    .grid-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2));
    }
    /*  Monitoring-group chip, same pill recipe; border in the group's colour. A small numbered disc carries the
        group id, placed on the chip's OUTER corner (away from the home) so it never sits over the lead's bead. */
    .group-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--group-color, var(--primary-color, #03a9f4));
    }
    /*  Group pastille glyph shown when the group has no configured icon: its number, sized + weighted like the
        chip icon it stands in for (the chip border already carries the group colour). */
    .group-label .group-glyph-num
    {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: inherit;
    }
    /*  Full-size overlay SVGs for the home-cluster leaders (grid, PV to home, battery, groups); each hosts
        its own coloured path(s) below. */
    .grid-leader-svg,
    .pv-home-leader-svg,
    .battery-leader-svg,
    .group-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    /*  Group leader: a thin static line from the home pill down to the group chip, in the group's colour. */
    .group-leader-line
    {
        stroke-width: 2;
        stroke-linecap: round;
        fill: none;
    }
    /*  Grid leader; stroke + bead fill from the inline colour, so one path serves both import
        (blue) and export (purple). */
    .grid-leader-line
    {
        stroke-width: 2;
        stroke-linecap: round;
        fill: none;
    }

    /*  PV to home leader: vertical dashed line from the PV chip down to the home, in the PV colour. z 5,
        below the chip cluster so the dashes pass behind the chips. */
    .pv-home-leader-line
    {
        stroke: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        stroke-width: 2;
        stroke-opacity: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  Moving bead riding a leader at a speed proportional to live flow, like HA's energy-distribution
        card. Shared by the PV to home, battery, monitoring-group and sun to PV ray beads. */
    .pv-home-leader-bead,
    .battery-leader-bead,
    .group-leader-bead,
    .solar-svg .solar-ray-bead
    {
        opacity: 0.95;
        stroke: var(--primary-text-color, #212121);
        stroke-width: 1;
        paint-order: stroke fill;
    }



    /*  Battery leaders. SoC and power leaders share a solid L-shaped path with a rounded bend. The power
        leader carries a bead at a speed proportional to |P|, its path flipped inline when discharging so
        travel matches the flow. The SoC leader is static: SoC is a level, not a flow. */
    .battery-leader-line
    {
        stroke: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        stroke-width: 2;
        stroke-opacity: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
    }

    /*  Solar overlay split in two passes so chips never occlude the live sun while the night part still
        reads as background: .solar-svg-back paints below-horizon dots below the chips (z 4),
        .solar-svg-front paints the above-horizon arc + ray + sun disc above them (z 7). */
    .solar-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        /* Daylight fade via the --solar-daylight variable (0..1, set inline). */
        opacity: var(--solar-daylight, 1);
        transition: opacity 600ms ease-out;
    }
    /*  Central home pill at the projected home centre. Every chip leader docks against its border so
        the home reads as the single energy hub, like HA's Energy distribution card. */
    .home-pill
    {
        z-index: 9;
        flex-direction: row;
        justify-content: center;
        /*  Home == consumption: matches the consumption green used by its chart. */
        color: var(--helios-consumption-color, #4caf50);
        border-color: var(--helios-consumption-color, #4caf50);
        /*  Clickable: the home is the consumption chip, retargeting the bottom chart to home usage. */
        pointer-events: auto;
        cursor: pointer;
        /*  Keep the mask fade and ease the hover glow in/out. */
        transition: opacity 0.35s ease, box-shadow 0.2s ease;
    }
    /*  Neutral home ring: shown in place of the home pill when the home chip is hidden. A hollow stadium (same 2 px
        border as the chips) with a transparent centre so the 2.5D home shows through it. Its height matches the
        leads' vertical dock (2 x HOME_PILL_HALF_HEIGHT_PX = 28 in scene-hud-controller) so every leader still meets
        its top/bottom edge; the width is kept compact. Purely a contact point; non-interactive. */
    .home-ring
    {
        position: absolute;
        transform: translate(-50%, -50%);
        box-sizing: border-box;
        width: 50px;
        height: 28px;
        border: 2px solid var(--home-ring-color, var(--primary-color, #4caf50));
        border-radius: 999px;
        background: transparent;
        z-index: 9;
        pointer-events: none;
    }
    /*  Light glow on home hover; the hover state is driven from the hitbox by the card. Active consumption target
        uses the shared ::after glow like every other chip (fades via opacity). */
    .home-pill.is-hovered
    {
        box-shadow: var(--helios-shadow-chip),
                    0 0 7px 1px color-mix(in srgb, var(--helios-consumption-color, #4caf50) 28%, transparent);
    }
    .home-pill ha-icon
    {
        --mdc-icon-size: 16px;
        /*  Home glyph in the text ink, not the blue pill border colour. */
        color: var(--primary-text-color, #212121);
        display: inline-flex;
        align-items: center;
    }
    /*  Live home-consumption value; inherits the shared chip font so it matches the other chips' text. */
    .home-pill-usage
    {
        color: var(--primary-text-color, #212121);
    }

    .solar-svg-back        { z-index: 4; }
    /*  Above-horizon arc and sun disc in two depth passes around the home cluster: far half (z 5) behind
        the chips/pill (passes behind the home), near half (arc z 11, disc z 12) over the top. W/m² chip
        (z 13) paints last. */
    .solar-svg-front-far  { z-index: 5; }
    .solar-svg-front-near { z-index: 11; }
    .solar-svg-sun-far    { z-index: 5;  }
    .solar-svg-sun-near   { z-index: 12; }
    /*  Sun to PV ray + bead on their own SVG below the chips (z 8) so the chip background occludes the ray
        endpoint at the chip border. */
    .solar-ray-svg        { z-index: 7;  }

    /*  Arc: first pass a dark outline for legibility on light basemaps, second pass the sun colour on top.
        Stroke widths set inline per segment. */
    .solar-svg .solar-arc-outline { stroke: rgba(0, 0, 0, 0.35); stroke-linecap: round; }
    .solar-svg .solar-arc-segment { stroke-linecap: round; }

    /*  Below-horizon segments as round dots (dasharray "0 N" + round linecap = true circles) so the
        underground leg reads without colour cues; stroke alpha halved vs the day arc so it recedes. */
    .solar-svg .solar-arc-night
    {
        stroke-linecap: round;
        stroke-dasharray: 0 8;
        stroke-opacity: 0.45;
    }
    .solar-svg .solar-arc-night.solar-arc-outline
    {
        stroke-opacity: 0.25;
    }

    /*  Incidence ray: dashes flow sun to home at a speed proportional to live irradiance. 2 px, matching
        the home cluster's leaders. A soft amber glow gives the beam more presence; it feathers with
        daylight (--solar-daylight, set on the svg) so it fades to nothing at dusk. */
    .solar-svg .solar-ray
    {
        stroke-width: 2;
        stroke-dasharray: 5 5;
        stroke-opacity: 0.55;
        stroke-linecap: round;
        /*  Two-stop amber halo (tight bright core + wide soft bloom) so the thin dashed beam actually glows.
            No daylight factor here: the parent .solar-svg already fades the whole layer by --solar-daylight,
            so folding it in again would attenuate the glow twice (daylight²) and wash it out. */
        filter:
            drop-shadow(0 0 3px rgba(255, 193, 7, 0.95))
            drop-shadow(0 0 9px rgba(255, 193, 7, 0.7));
        animation: solar-ray-flow var(--sun-flow-duration, 30s) linear infinite;
    }

    @keyframes solar-ray-flow
    {
        from { stroke-dashoffset: 0;  }
        to   { stroke-dashoffset: -10; }
    }

    /*  Sunrise / sunset marker: glyph + local time pinned just outside the arc at the horizon crossing,
        centred on its computed point. Sun-coloured, click-transparent. */
    .sun-cross-marker
    {
        position: absolute;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        color: var(--sun-cross-color, #ffc107);
        pointer-events: none;
        /*  Same layer as the far arc (z 5) it sits on, so the value chips (z 8) stay on top. */
        z-index: 5;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    }
    .sun-cross-marker ha-icon
    {
        --mdc-icon-size: 18px;
        width: 18px;
        height: 18px;
    }
    .sun-cross-marker span
    {
        font-size: var(--ha-font-size-xs, 11px);
        font-weight: var(--ha-font-weight-medium, 500);
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }

    /*  Solar irradiance label pinned above the live sun. Anchors above the sun via a -100% vertical
        translate (not the shared -50%) and sits higher in the stack. */
    .solar-pct-label
    {
        transform: translate(-50%, -100%);
        pointer-events: none;
        /*  Above the arc-front lines (z 11) so a segment never crosses the W/m² readout; the sun disc
            (z 12) still paints on top. */
        z-index: 13;
        color: var(--primary-text-color, #212121);
        /*  Configured irradiance colour (--solar-color, set inline), else the HA amber token so it stays distinct
            from the PV production chip (orange). */
        border-color: var(--solar-color, var(--amber-color, var(--warning-color, #ffc107)));
    }


    /*  ============================================================
        Dark theme, opt-in via \`card-theme: dark\`. Affects only the chrome
        (chips, charts, cursors, labels, leaders, tooltips); the basemap
        keeps its own colours. Chip plates flip white to near-black, text/
        borders go light-grey, chart hairlines flip to white-on-dark at the
        same opacities. User-coloured fills, the scrub blue and the live
        tooltip plate already read on dark, so they're left alone.
        ============================================================ */

    /*  Solar arc outline: the light skin paints a black halo for legibility on bright basemaps; in dark
        mode that would vanish into the map, so paint a faint white halo instead. */
    ha-card.theme-dark .solar-svg .solar-arc-outline
    {
        stroke: rgba(255, 255, 255, 0.45);
    }


    /*  Animation perf hooks:
        1. .helios-paused (set by the card's IntersectionObserver when scrolled off-screen) pauses every
           CSS animation; SMIL <animateMotion> is paused in parallel via svg.pauseAnimations().
        2. prefers-reduced-motion disables every animation + transition at the OS level. */
    :host(.helios-paused) *,
    :host(.helios-paused) *::before,
    :host(.helios-paused) *::after
    {
        animation-play-state: paused !important;
    }

    @media (prefers-reduced-motion: reduce)
    {
        *, *::before, *::after
        {
            animation-duration:         0ms !important;
            animation-iteration-count:  1   !important;
            transition-duration:        0ms !important;
        }
    }

    /* "No UI" mode: the timeline + on-card controls fade out after an idle delay and reappear on any input
       (driven by the data-ui-hidden host attribute; see _uiHidden / noUiDelayMs). The reduced-motion block
       above drops the fade to an instant show/hide. */
    .time-bar,
    .tb-band
    {
        transition: opacity 1000ms ease;
    }
    :host([data-ui-hidden]) .time-bar,
    :host([data-ui-hidden]) .tb-band
    {
        opacity: 0;
        pointer-events: none;
    }



`,Ye=i$6`
    /*  Timeline, pinned to the bottom of the card. The whole bar accepts pointer events for scrub.
        Slides out below the card edge (transform) instead of fading when hidden. */
    .time-bar
    {
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: transform;
        position: absolute;
        /*  Flush on top of the period-mode band (pinned at the bottom, 33px tall), no gap. */
        bottom: 33px;
        /*  Full width, flush to the card edges. Not translateX(-50%): that transform promotes the bar into a
            compositor layer and rasterises the inner SVG charts at fractional resolution (blur). */
        left: 0;
        right: 0;
        width: auto;
        /*  Own stacking layer at the top of the card so the sun arc, home glow and overlay chips never
            cross over it during auto-rotate. */
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        cursor: grab;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    }

    .time-bar:active
    {
        cursor: grabbing;
    }

    /*  Shared themed-plate surface for the chart stack and the period band: same background + drop shadow. No
        border-radius: both are full-width and flush at the bottom of the card, forming one continuous bar. */
    .tb-chart-stack,
    .tb-band
    {
        background: var(--card-background-color, #ffffff);
        border-radius: 0;
        box-shadow: var(--helios-shadow-chip);
    }

    /*  Chart + day-label footer composite read as one instrument with a hairline divider between them;
        overflow:hidden clips both children to the rounded corners. */
    .tb-chart-stack
    {
        position: relative;
        /*  border-box like .tb-band below: the 2 px border draws INSIDE so the chart stack and the period
            band keep the exact same outer width (both span card - 16px). Without it the border adds outside
            and the stack reads wider than the band. */
        box-sizing: border-box;
        /*  Only a top divider (neutral themed), no side/bottom border: the bar is flush full-width at the
            bottom of the card. */
        border-top: 2px solid var(--divider-color, var(--ha-card-border-color, rgba(0, 0, 0, 0.12)));
        overflow: hidden;
    }
    .tb-chart-card
    {
        position: relative;
        /*  Height scales with container width (cqw): 36 px floor on a small tile, 72 px ceiling on a
            kiosk. Both charts share this expression so they stay equal height. */
        height: clamp(36px, 8cqw, 72px);
        overflow: hidden;
    }
    .hc-chart-svg
    {
        display: block;
        width: 100%;
        height: 100%;
    }
    /*  Grow the curves up from the baseline when the chart re-targets or the period changes (the SVG is
        keyed on both, so it re-mounts and replays), matching HA's 500 ms grow. Separators + hover guide
        sit outside this group so they don't stretch; fill-box anchors the scale at the baseline. */
    .hc-chart-grow
    {
        transform-box: fill-box;
        transform-origin: bottom;
        animation: hc-chart-grow 500ms ease-out;
    }
    @keyframes hc-chart-grow
    {
        from { transform: scaleY(0); }
        to   { transform: scaleY(1); }
    }
    @media (prefers-reduced-motion: reduce)
    {
        .hc-chart-grow { animation: none; }
    }
    /*  Editor preview rebuilds the card on every keystroke; skip the intro grow so it doesn't replay. */
    ha-card.helios-edit .hc-chart-grow { animation: none; }

    /*  Stroke-only outline over the filled area so peaks read cleanly where the gradient fades. 0.7 px
        hairline: a wider stroke self-overlaps on high-variation days and smudges dense regions. */
    .hc-chart-line
    {
        fill: none;
        stroke-width: 0.7;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
        opacity: 0.95;
        pointer-events: none;
    }

    /*  PV prediction line: overlays the observed chart past "now" from pv-peak-kwp scaled by the
        clear-sky model. Stroke colour computed theme-aware in charts.ts. */
    .hc-chart-predicted
    {
        stroke-dasharray: 4 3;
        stroke-width: 1;
    }

    /*  Dotted day separators at midnight boundaries, 0.55 alpha. Flips with the theme via
        --rgb-primary-text-color. */
    .hc-day-sep
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        stroke-width: 1.2;
        stroke-dasharray: 2 2.5;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }


    /*  Live cursor: thin "where now is" line spanning the chart. Wide + opaque enough to stay readable
        through the future-mask wash, but subtle as a passive reference. */
    .tb-cursor-now
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.5);
        border-radius: 999px;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 4;
    }
    /*  Scrub cursor: a thin solid brand-blue stroke spanning the chart, no arrow or handle. */
    .tb-cursor-sel
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1.5px;
        background: var(--primary-color, #03a9f4);
        border-radius: 999px;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 4;
        box-shadow: 0 0 4px rgba(var(--rgb-primary-color), 0.4);
    }

    /*  Hover guide: vertical line at the pointer's X. Same dotted recipe as the day separators but
        more opaque so it reads as interactive focus, not ambient structure. */
    .hc-hover-guide
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        stroke-width: 1;
        stroke-dasharray: 2 2;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }

    /*  Per-curve hover dot at the interpolated Y of each series. Stroked in the primary text colour
        so it reads as a circled marker on both themes. */
    .hc-hover-dot
    {
        stroke: var(--primary-text-color, #212121);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }
    /*  Hover dot as an absolutely-positioned HTML element, not SVG: the chart SVG uses
        preserveAspectRatio="none", which stretches <circle> dots into ovals. CSS-pixel dots stay round.
        Position derived from the hoverX/W, hoverY/H ratios since card and SVG share the content area. */
    .hc-hover-dot-html
    {
        position: absolute;
        /*  6 px filled disc, matching the moving beads on the chip leaders. */
        width: 6px;
        height: 6px;
        border-radius: 50%;
        box-sizing: border-box;
        border: 1px solid var(--primary-text-color, #212121);
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 5;
    }

    /*  Wrapper hosting the tooltip body. Carries the horizontal positioning (left + translateX) so its
        children slide together on scrub; bottom + margin lift the stack into the gap above the chart. */
    .tb-hover-tooltip-wrapper
    {
        position: absolute;
        bottom: 100%;
        margin-bottom: 10px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        z-index: 30;
    }
    /*  Frame + padding match HA Energy chart tooltips so it reads as native HA chrome. */
    .tb-hover-tooltip
    {
        position: relative;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 4px;
        padding: 6px 8px;
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.16), 0 1px 4px 0 rgba(0, 0, 0, 0.06);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        font-size: var(--ha-font-size-s, 12px);
        line-height: 1.25;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        min-width: 120px;
        align-self: stretch;
    }

    /*  Time heading at the top of the tooltip: clock glyph + bold tabular numerals with a hairline
        separator under it, so the time reads as a heading above the data rows. */
    .tb-hover-tooltip-time
    {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0.3px;
        padding-bottom: 4px;
        margin-bottom: 4px;
    }
    .tb-hover-tooltip-time-icon,
    .tb-hover-tooltip-icon
    {
        --mdc-icon-size: 14px;
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        line-height: 1;
        color: var(--primary-text-color, #212121);
        --mdc-icon-color: var(--primary-text-color, #212121);
    }
    .tb-hover-tooltip-time-label
    {
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }
    /*  Exact scrubbed instant (date + time, HA format), pushed to the tooltip's top-right so a coarse axis
        label still pins the precise moment. */
    .tb-hover-tooltip-exact
    {
        margin-left: auto;
        font-weight: var(--ha-font-weight-normal, 400);
        font-variant-numeric: tabular-nums;
        opacity: 0.7;
        white-space: nowrap;
    }
    .tb-hover-tooltip-row
    {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 1px 0;
    }

    /*  Entity / metric name between the glyph and the value; truncated so a long friendly name can't
        widen the tooltip. The value keeps flex:1 + right-align so it stays flush right. */
    .tb-hover-tooltip-name
    {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 170px;
        opacity: 0.85;
    }
    .tb-hover-tooltip-value
    {
        flex: 1;
        text-align: right;
        padding-left: 10px;
    }

    /*  Per-source breakdown rows under the aggregate PV row on multi-source installs. Indented + smaller
        so they read as children of the headline; the colour pastille mirrors the per-source curve. */
    .tb-hover-tooltip-row-sub
    {
        font-size: var(--ha-font-size-xs, 11px);
        opacity: 0.78;
        padding-left: 4px;
    }
    .tb-hover-tooltip-dot
    {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        display: inline-block;
    }
    .tb-hover-tooltip-sublabel
    {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
    }

    /*  LIVE chip at the top-right of the scrub tooltip. Outline recipe (transparent backdrop + primary
        border + glyph) so it reads on both themes without clashing with the tooltip background. The dot
        pulses, mirroring HA Energy's live-data vocabulary. */
    .tb-hover-tooltip-live-chip
    {
        /*  Last flex child of the time row, pushed right via margin-left: auto; the parent's
            align-items: center vertically aligns it with the clock glyph + time label, no absolute math. */
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 0 6px 0 4px;
        height: 18px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-color, #03a9f4);
        border: 1px solid var(--primary-color, #03a9f4);
        border-radius: 3px;
        font-size: inherit;
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0.4px;
        text-transform: uppercase;
        line-height: 1;
        /*  Own GPU layer via translateZ so the chip gets a pixel-snapped grid independent of the
            wrapper's fractional translateX; otherwise the text + border antialias blurry on high-DPI. */
        transform: translateZ(0);
        backface-visibility: hidden;
        /*  Fade in/out via opacity (rendered every tooltip pass) instead of popping. */
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.16s ease-out;
    }
    .tb-hover-tooltip-live-chip.is-visible
    {
        opacity: 1;
    }
    .tb-hover-tooltip-live-chip-dot
    {
        --mdc-icon-size: 12px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        animation: tb-hover-tooltip-live-pulse 1.4s ease-in-out infinite;
    }
    .tb-hover-tooltip-live-chip-label
    {
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }
    @keyframes tb-hover-tooltip-live-pulse
    {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
    }

    /*  Scrub tail: vertical dotted line at the scrub X in the gap above the chart card. Positioned
        independently of the tooltip so it stays on the scrub line when the tooltip slides to clear the
        edges. Painted via repeating-linear-gradient so the magnet-snap variant can flow the dots (a
        dashed border can't be animated). */
    .tb-hover-tooltip-tail
    {
        position: absolute;
        bottom: 100%;
        width: 1.5px;
        height: 10px;
        /*  Default cursor paints in the primary text colour, un-animated, as a quiet scrub cue. The
            brand-blue + flow animation only kicks in in the magnet zone (.is-magnet-snap below). */
        background-image: repeating-linear-gradient(
            to bottom,
            var(--primary-text-color, #212121) 0,
            var(--primary-text-color, #212121) 2px,
            transparent 2px,
            transparent 4px
        );
        transform: translateX(-50%);
        pointer-events: none;
        /*  Above the tooltip (z 30) and chart-card decoration so the animated cursor stays visible. */
        z-index: 1001;
    }
    /*  Magnet-snap variant: brand-blue dots flowing upward to signal "release here to return to live".
        Flow runs bottom-to-top because "now" is the forward edge above the viewport. */
    .tb-hover-tooltip-tail.is-magnet-snap
    {
        background-image: repeating-linear-gradient(
            to bottom,
            var(--primary-color, #03a9f4) 0,
            var(--primary-color, #03a9f4) 2px,
            transparent 2px,
            transparent 4px
        );
        animation: tb-hover-tooltip-tail-flow 0.5s linear infinite;
    }
    @keyframes tb-hover-tooltip-tail-flow
    {
        from { background-position: 0 0; }
        to   { background-position: 0 -4px; }
    }

    /*  tb-hover-tooltip flips with the theme via --card-background-color etc., no dark override. */


    /*  Future-mask wash: from "now" to the right edge, over the curves and night zones but below the
        cursors (z 4). Card background at moderate alpha lightens both in one pass without redoubling on
        overlap. */
    .hc-future-mask
    {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        pointer-events: none;
        z-index: 3;
        /*  color-mix on transparent keeps the wash translucent on every theme so the predicted PV curve
            stays visible; a bare var(--card-background-color) goes opaque in dark mode and hides it. */
        background: color-mix(in srgb, var(--card-background-color, #ffffff) 55%, transparent);
    }


    .hc-night-zone
    {
        position: absolute;
        top: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 3;
        /*  Night-slice wash: slightly darker in light themes (lighter in dark, rule below), no hatch or
            border, so dusk/dawn read as one calm band that keeps the curves legible. */
        background: rgba(0, 0, 0, 0.06);
    }
    ha-card.theme-dark .hc-night-zone
    {
        background: rgba(255, 255, 255, 0.08);
    }


    /*  Day strip: a bordered bar with one centred label per visible day and a vertical separator at
        each midnight. Frame recipe matches the chart cards so the stack reads as one instrument. */
    .tb-day-strip
    {
        position: relative;
        height: 18px;
        box-sizing: border-box;
        /*  Footer band of the chart stack: frame lives on .tb-chart-stack, so here we only draw the
            hairline separating labels from the chart above (like the HA timeline footer). */
        border-top: var(--ha-border-width-sm, 1px) solid
            var(--divider-color, rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.12));
        overflow: hidden;
        pointer-events: none;
    }
    /*  Timeline label positioned on its model fraction: inline left anchors the fraction, the translate
        centres the text over it. */
    .tb-day-strip-date
    {
        position: absolute;
        top: 0;
        bottom: 0;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        padding: 0 1px;
        box-sizing: border-box;
        color: var(--primary-text-color, #212121);
        /*  Match an HA tile card's entity-value text (body font, --ha-font-size-s, normal weight) so the
            timeline's axis labels read as native HA chrome. */
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: var(--ha-font-size-xs, 11px);
        line-height: 14px;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        z-index: 2;
        font-weight: var(--ha-font-weight-normal, 400);
    }

    /*  Today's label carries more weight so it reads as the present alongside the now-cursor. */
    .tb-day-strip-date.is-today
    {
        font-weight: var(--ha-font-weight-medium, 500);
    }

    /*  Period-mode band: a separate strip below the timeline with its own card frame (same 8 px gutters,
        radius and themed border as the timeline card). Pinned to the bottom; the timeline sits above it.
        pointer-events: auto, but the band stays transparent to map rotation. */
    .tb-band
    {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 33px;
        z-index: 1000;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        /*  The band stays full-width + flush; a small inner padding just gives the buttons some breathing room. */
        padding: 3px 8px;
        /*  Only a top divider (between the timeline above and the band); no side/bottom border. */
        border-top: var(--ha-border-width-sm, 1px) solid
            var(--divider-color, var(--ha-card-border-color, rgba(0, 0, 0, 0.12)));
        pointer-events: auto;
        touch-action: none;
    }
    /*  Period selector: a full-width segmented control filling the band (equal segments). */
    .tb-period-selector
    {
        display: flex;
        flex: 1;
        gap: 4px;
        pointer-events: auto;
    }
    .tb-band .tb-period-seg
    {
        flex: 1;
    }
    .tb-period-seg
    {
        appearance: none;
        -webkit-appearance: none;
        border: 0;
        outline: 0;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 6px;
        background: transparent;
        color: var(--secondary-text-color, #727272);
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: clamp(9px, 6cqw, 11px);
        line-height: 16px;
        letter-spacing: 0;
        font-weight: var(--ha-font-weight-medium, 500);
        white-space: nowrap;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.15s, color 0.15s;
    }
    .tb-period-seg:hover
    {
        /*  HA's canonical quiet-row hover fill, so a button highlights exactly like a hovered HA card/list
            row; the rgba overlay is the token fallback. */
        background: var(--ha-color-fill-neutral-quiet-hover, rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08));
        color: var(--primary-text-color, #212121);
    }
    .tb-period-seg.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .tb-period-seg.is-on:hover  { background: var(--dark-primary-color, #0288d1); }

    /*  Vertical separator at each between-day boundary, dotted to match the chart's day separators.
        None at the outer edges since the strip border closes those. */
    .tb-day-strip-sep
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        z-index: 1;
        background-image: repeating-linear-gradient(
            to bottom,
            rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.30) 0,
            rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.30) 1.5px,
            transparent                                          1.5px,
            transparent                                          4px
        );
    }

    /*  Dark theme (opt-in via \`card-theme: dark\`): flip the chart day separators to
        white-on-dark at the same opacity. The chart card, cursors and tooltip plate
        flip via their --card-background-color / --rgb-primary-text-color recipes. */
    ha-card.theme-dark .hc-day-sep
    {
        stroke: rgba(255, 255, 255, 0.55);
    }

    /*  Kiosk breakpoint: above 900 px card width the text bumps one size step up so the chips,
        day-strip and W/m² readout stay legible from across the room. On-map geometry is scaled separately
        by the engine. Keyed on the container query so it flips on the card's own width, not the
        viewport's. */
    @container helios-card (min-width: 900px)
    {
        .tb-day-strip-date
        {
            font-size: clamp(8px, 5.5cqw, var(--ha-font-size-xs, 11px));
        }
        .tb-hover-tooltip
        {
            font-size: var(--ha-font-size-s, 13px);
        }
    }

`,hexByte=(e,t)=>parseInt(e.slice(t,t+2),16);function mixHex(e,t,i){let n="#";for(let r=1;r<7;r+=2){const s=hexByte(e,r);n+=Math.round(s+(hexByte(t,r)-s)*i).toString(16).padStart(2,"0")}return n}function formatLocalisedNumber(e,t,i,n=!1){if(!isFinite(t))return n?"0":(0).toFixed(i);const r=n?.5:.5*10**-i;Math.abs(t)<r&&(t=0);const s=e?.locale?.language??e?.language??void 0,l=n?{maximumFractionDigits:0}:{minimumFractionDigits:i,maximumFractionDigits:i};try{return new Intl.NumberFormat(s,l).format(t)}catch(L){return n?Math.round(t).toString():t.toFixed(i)}}function haUseAmPm(e){const t=e?.time_format;if("12"===t)return!0;if("24"===t)return!1;const i="language"===t?e?.language:void 0;try{const e=/* @__PURE__ */(new Date).toLocaleString(i);return e.includes("AM")||e.includes("PM")}catch(L){return!1}}function formatWithHaLocale(e,t,i){const n=e?.locale,r={...i,hour12:haUseAmPm(n)};try{return new Intl.DateTimeFormat(n?.language,r).format(t)}catch(L){return new Intl.DateTimeFormat(void 0,r).format(t)}}function formatPower(e,t,i,n,r=!1){const s=r?t>0?"+":t<0?"-":"":"",l=r?Math.abs(t):t;return"W"===n?`${s}${formatLocalisedNumber(e,Math.round(l),0)} W`:`${s}${formatLocalisedNumber(e,l/1e3,i)} kW`}function formatPowerKw(e,t,i,n=!1,r="kW"){return formatPower(e,t,i,r,n)}function formatIrradiance(e,t,i,n){const r=Math.max(0,t);return"kW/m²"===n?`${formatLocalisedNumber(e,r/1e3,i)} kW/m²`:`${Math.round(r)} W/m²`}function formatEnergyKwh(e,t,i,n="kW"){return"W"===n?`${formatLocalisedNumber(e,Math.round(1e3*t),0)} Wh`:`${formatLocalisedNumber(e,t,i)} kWh`}function parseNumericState(e){if("number"==typeof e)return Number.isFinite(e)?e:null;if("string"!=typeof e)return null;const t=e.trim();if(""===t)return null;const i=parseFloat(t.replace(",","."));return Number.isFinite(i)?i:null}function pvNormalizeToWatts(e,t){const i=(t||"").toLowerCase();return"kw"===i?1e3*e:"mw"===i?1e6*e:"w"===i?e:0}function formatEntityValue(e,t,i,n,r="kW"){const s=(i||"").trim(),l=s.toLowerCase();if("w"===l||"kw"===l||"mw"===l)return formatPower(e,pvNormalizeToWatts(t,i),n,r);if("wh"===l||"kwh"===l||"mwh"===l)return formatEnergyKwh(e,function energyToKwh(e,t){switch((t||"").trim().toLowerCase()){case"wh":return e/1e3;case"mwh":return 1e3*e;default:return e}}(t,i),n,r);const d=formatLocalisedNumber(e,t,n);return s?`${d} ${s}`:d}function lerpHexToward(e,t,i){return mixHex(e,t,clamp(i,0,1))}function uiColorVar(e,t){return`--${(e??"").trim()||t}-color`}function cssHex(e,t,i){if(!e)return i;const n=getComputedStyle(e).getPropertyValue(t).trim();if(/^#[0-9a-f]{6}$/i.test(n))return n;if(/^#[0-9a-f]{3}$/i.test(n))return"#"+n.slice(1).split("").map(e=>e+e).join("");const r=n.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);if(r){const h=e=>Math.max(0,Math.min(255,Math.round(parseFloat(e)))).toString(16).padStart(2,"0");return"#"+h(r[1])+h(r[2])+h(r[3])}return i}function isDarkFromCss(e){try{const t=cssHex(e,"--primary-background-color","#ffffff");return(.299*hexByte(t,1)+.587*hexByte(t,3)+.114*hexByte(t,5))/255<.5}catch(L){}return!1}var rgbXyz=e=>{const t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},xyzLab=e=>e>.008856452?e**(1/3):e/$e+Me,xyzRgb=e=>255*(e<=.00304?12.92*e:1.055*e**(1/2.4)-.055),labXyz=e=>e>.206896552?e*e*e:$e*(e-Me);var Je=/* @__PURE__ */new Map;function energySolarColor(e,t,i){if(e&&getComputedStyle(e).getPropertyValue(`--energy-solar-color-${i}`).trim())return cssHex(e,`--energy-solar-color-${i}`,"#ff9800");const n=cssHex(e,"--energy-solar-color","#ff9800");if(!i)return n;const r=`${n}|${t}|${i}`;let s=Je.get(r);if(void 0===s){const e=function rgbToLab([e,t,i]){const n=rgbXyz(e),r=rgbXyz(t),s=rgbXyz(i),l=xyzLab((.4124564*n+.3575761*r+.1804375*s)/ze),d=xyzLab((.2126729*n+.7151522*r+.072175*s)/1),c=116*d-16;return[c<0?0:c,500*(l-d),200*(d-xyzLab((.0193339*n+.119192*r+.9503041*s)/xe))]}(function hexToRgb(e){return[hexByte(e,1),hexByte(e,3),hexByte(e,5)]}(n));s=function labToHex([e,t,i]){let n=(e+16)/116,r=n+t/500,s=n-i/200;n=1*labXyz(n),r=ze*labXyz(r),s=xe*labXyz(s);const l=Math.round(xyzRgb(3.2404542*r-1.5371385*n-.4985314*s)),d=Math.round(xyzRgb(-.969266*r+1.8760108*n+.041556*s)),c=Math.round(xyzRgb(.0556434*r-.2040259*n+1.0572252*s)),h=e=>Math.min(255,Math.max(0,e)).toString(16).padStart(2,"0");return"#"+h(l)+h(d)+h(c)}([e[0]+(t?18:-18)*i,e[1],e[2]]),Je.set(r,s)}return s}function deviceColorByIndex(e,t){return cssHex(e,`--graph-color-${t+1}`,cssHex(e,"--color-"+(t%54+1),"#8a8a8a"))}var ENERGY_COLOR_sun=e=>ve,ENERGY_COLOR_cloud=e=>cssHex(e,"--secondary-text-color","#727272");function unionChangeMeters(e){return[...e.solarStatEnergyFroms,...e.gridStatEnergyFroms,...e.gridStatEnergyTos,...e.batteryStatEnergyTos,...e.batteryStatEnergyFroms]}var Xe={solarStatRates:[],solarStatEnergyFroms:[],gridStatRates:[],gridStatEnergyFroms:[],gridStatEnergyTos:[],batteryStatRates:[],batteryStatEnergyFroms:[],batteryStatEnergyTos:[],batteryStatSocs:[],batterySourcesWithoutRate:0,invertedRateEntities:[],solarForecastEntryIds:[],gridName:"",batteryName:"",devices:[]};async function fetchEnergyPrefs(e){if(e.hass?.callWS)try{e._energyDefaults=function parseEnergyPrefs(e){const t={solarStatRates:[],solarStatEnergyFroms:[],gridStatRates:[],gridStatEnergyFroms:[],gridStatEnergyTos:[],batteryStatRates:[],batteryStatEnergyFroms:[],batteryStatEnergyTos:[],batteryStatSocs:[],batterySourcesWithoutRate:0,invertedRateEntities:[],solarForecastEntryIds:[],gridName:"",batteryName:"",devices:[]},i=Array.isArray(e?.energy_sources)?e.energy_sources:[];for(const n of i){if(!n||"object"!=typeof n)continue;const e=String(n.type??"").toLowerCase();if("solar"===e){pushStrings(n.stat_energy_from,t.solarStatEnergyFroms);const e=pickFirstString(n.stat_rate);e&&t.solarStatRates.push(e);const i=n.config_entry_solar_forecast;if(Array.isArray(i))for(const n of i)"string"!=typeof n||""===n.trim()||t.solarForecastEntryIds.includes(n.trim())||t.solarForecastEntryIds.push(n.trim());else"string"!=typeof i||""===i.trim()||t.solarForecastEntryIds.includes(i.trim())||t.solarForecastEntryIds.push(i.trim())}else if("grid"===e){t.gridName||(t.gridName=pickFirstString(n.name)??""),pushStrings(n.stat_energy_from,t.gridStatEnergyFroms),pushStrings(n.stat_energy_to,t.gridStatEnergyTos);for(const i of asRecordArray(n.flow_from))pushStrings(i.stat_energy_from,t.gridStatEnergyFroms);for(const i of asRecordArray(n.flow_to))pushStrings(i.stat_energy_to,t.gridStatEnergyTos);const e=pickFirstString(n.stat_rate);if(e)t.gridStatRates.push(e);else for(const i of collectPowerConfigRates(n.power_config,"grid"))t.gridStatRates.push(i.entity),i.inverted&&t.invertedRateEntities.push(i.entity)}else if("battery"===e){t.batteryName||(t.batteryName=pickFirstString(n.name)??""),pushStrings(n.stat_energy_from,t.batteryStatEnergyFroms),pushStrings(n.stat_energy_to,t.batteryStatEnergyTos);const e=pickFirstString(n.stat_soc);e&&t.batteryStatSocs.push(e);const i=collectPowerConfigRates(n.power_config,"battery");if(i.length>0)for(const n of i)t.batteryStatRates.push(n.entity),n.inverted&&t.invertedRateEntities.push(n.entity);else{const e=pickFirstString(n.stat_rate);e?(t.batteryStatRates.push(e),t.invertedRateEntities.push(e)):t.batterySourcesWithoutRate+=1}}}return(Array.isArray(e?.device_consumption)?e.device_consumption:[]).forEach((e,i)=>{if(!e||"object"!=typeof e)return;const n=e,r=pickFirstString(n.stat_consumption);r&&t.devices.push({statConsumption:r,statRate:pickFirstString(n.stat_rate)??"",name:pickFirstString(n.name)??"",includedInStat:pickFirstString(n.included_in_stat)??"",index:i})}),t}(await callWS(e.hass,{type:"energy/get_prefs"})),e._energyDefaultsLoaded=!0,e.requestUpdate()}catch(L){e._energyDefaultsLoaded=!0}}function subscribeEnergyPrefs(e){if(e.hass?.connection&&!e._energyPrefsUnsub){fetchEnergyPrefs(e);try{e._energyPrefsUnsub=e.hass.connection.subscribeEvents(()=>fetchEnergyPrefs(e),"energy_preferences_updated")}catch(L){}}}function unsubscribeEnergyPrefs(e){if(e._energyPrefsUnsub){try{e._energyPrefsUnsub()}catch(L){}e._energyPrefsUnsub=void 0}}var Qe=new Le(25e3);async function refreshHaDailyTotals(e){const t=await async function fetchTodayKwhChange(e,t){if(0===t.length)return null;if(!e.hass?.callWS)return null;const i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const n=/* @__PURE__ */new Date,r=`${i.getFullYear()}-${i.getMonth()}-${i.getDate()}|${[...t].sort().join("|")}`,s=`dt:${r}`;return Qe.get(r,async()=>{try{const r=await callWS(e.hass,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:n.toISOString(),statistic_ids:t,period:"day",types:["change"],units:{energy:"kWh"}});let l=0,d=!1;for(const e of t){const t=r?.[e];if(Array.isArray(t))for(const e of t){const t="number"==typeof e?.change?e.change:null;null!==t&&(l+=t,d=!0)}}return d?(saveDurable(s,l),l):null}catch(L){return loadDurable(s,fe)}})}(e,e._energyDefaults.solarStatEnergyFroms);null!==t&&t!==e._haSolarTodayKwh&&(e._haSolarTodayKwh=t,e.requestUpdate())}function collectPowerConfigRates(e,t){if(!e||"object"!=typeof e)return[];const i=e,n=[],r=pickFirstString(i.stat_rate);r&&n.push({entity:r,inverted:"battery"===t});const s=pickFirstString(i.stat_rate_inverted);if(s&&n.push({entity:s,inverted:"grid"===t}),n.length>0)return n;const l=pickFirstString(i.stat_rate_from);l&&n.push({entity:l,inverted:"battery"===t});const d=pickFirstString(i.stat_rate_to);return d&&n.push({entity:d,inverted:"grid"===t}),n}function pushStrings(e,t){if("string"==typeof e&&""!==e.trim()){const i=e.trim();t.includes(i)||t.push(i)}else if(Array.isArray(e))for(const i of e)pushStrings(i,t)}var asRecordArray=e=>Array.isArray(e)?e.filter(e=>!!e&&"object"==typeof e):[];function pickFirstString(e){if("string"==typeof e&&""!==e.trim())return e.trim();if(Array.isArray(e))for(const t of e)if("string"==typeof t&&""!==t.trim())return t.trim();return null}var et=class{constructor(){this._key="",this._fetching=!1}run(e,t){this._fetching||e===this._key||(this._key=e,this._fetching=!0,t().finally(()=>{this._fetching=!1}))}reset(){this._key="",this._fetching=!1}};function sumLiveWatts(e,t,i){let n=0,r=!1;for(const s of t){const t=e?.states?.[s];if(!t)continue;const l=parseNumericState(t.state);if(null===l)continue;const d=pvNormalizeToWatts(l,String(t.attributes?.unit_of_measurement??"").trim());n+=i?.includes(s)?-d:d,r=!0}return{watts:n,any:r}}function quantizedAnchorMs(e){return Math.floor(Date.now()/e)*e}function resolvePvLiveEntity(e){return e.solarStatRates[0]??""}function formatPvValue(e,t,i,n,r="kW"){return formatEntityValue(e,t,i,n,r)}var tt=new Le(ke);function resolveBatteryEntities(e){return{powerEntity:e.batteryStatRates[0]??e.batteryStatEnergyFroms[0]??e.batteryStatEnergyTos[0]??null,socEntity:e.batteryStatSocs[0]??null}}function batteryLiveIsBucketSourced(e){return!(e.batteryStatRates.length>0&&0===e.batterySourcesWithoutRate)}function refreshBattery(e){if(!e.hass)return;const{powerEntity:t,socEntity:i}=resolveBatteryEntities(e._energyDefaults);if(!t&&!i)return null!==e._batterySoc&&(e._batterySoc=null),null!==e._batteryPower&&(e._batteryPower=null),""!==e._batteryPowerUnit&&(e._batteryPowerUnit=""),null!==e._batterySocHistory&&(e._batterySocHistory=null),e._batterySocPerBankHistory.length>0&&(e._batterySocPerBankHistory=[]),void(e._batteryFetchKey="");const n=e._energyDefaults.batteryStatSocs,{soc:r,power:s,unit:l}=function computeBatteryLive(e,t){let i=null;const n=t.batteryStatSocs;if(n.length>0){let t=0,r=0;for(const i of n){const n=e.states?.[i],s=n?parseNumericState(n.state):null;null!==s&&(t+=s,r+=1)}r>0&&(i=Math.max(0,Math.min(100,t/r)))}let r=null,s="";if(!batteryLiveIsBucketSourced(t)){const{watts:i,any:n}=sumLiveWatts(e,t.batteryStatRates,t.invertedRateEntities);n&&(r=i,s="W")}return{soc:i,power:r,unit:s}}(e.hass,e._energyDefaults);if(r!==e._batterySoc&&(e._batterySoc=r),s!==e._batteryPower&&(e._batteryPower=s),l!==e._batteryPowerUnit&&(e._batteryPowerUnit=l),function fetchBatteryChangeSeries(e){const t=e._energyDefaults.batteryStatEnergyTos,i=e._energyDefaults.batteryStatEnergyFroms;if(0===t.length&&0===i.length)return;const n=localMidnightMinusDays(e._periodPastDays),r=changeRefreshAnchorMs(),s=[...unionChangeMeters(e._energyDefaults)].sort(),l=`${s.join(",")}|${n}|${r}`;e._batteryChangeFetch.run(l,()=>fetchChangeById(e.hass,s,n,r,e._storeFetchPeriod).then(n=>{if(null===n)return;const r=t.length>0?mergeChangeSeries(n,t):null,s=i.length>0?mergeChangeSeries(n,i):null;null!==r&&(e._batteryChargeChangeSeries=r),null!==s&&(e._batteryDischargeChangeSeries=s),e.requestUpdate()}))}(e),!e._timeRange||e._batteryFetching)return;if(0===n.length)return;const d=e._timeRange.start,c=quantizedAnchorMs(ke),u=/* @__PURE__ */new Date(c-216e5),p=d<u?d:u,g=Math.floor(e._timeRange.end.getTime()/ke)*ke,m=`${p.getTime()}|${u.getTime()}|${g}`,f=[...n].sort(),b=`${f.join(",")}@${m}`;if(b===e._batteryFetchKey)return;e._batteryFetchKey=b;const v=`bsoc:${e._storeFetchPeriod}|${f.join(",")}`;e._batteryFetching=!0,tt.get(b,()=>async function fetchBatterySoc(e,t,i,n,r,s,l){if(!e?.callWS)return null;if(0===t.length)return null;try{const d=/* @__PURE__ */new Date,c=r>d?d:r;if(i>=c&&n>=c)return{merged:{times:[],values:[]},perBank:[]};const u={},p=await callWS(e,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:c.toISOString(),statistic_ids:t,period:s,types:["mean","state"],units:{energy:"kWh",power:"W"}});if(t.some(e=>Array.isArray(p?.[e])&&p[e].length>0))for(const e of t)u[e]=parseBatteryStats(p?.[e]??[]);else{const i=await callWS(e,{type:"history/history_during_period",start_time:n.toISOString(),end_time:c.toISOString(),entity_ids:t,minimal_response:!0,no_attributes:!0,significant_changes_only:!0});for(const e of t)u[e]=parseRawBatteryHistory(i?.[e]??[])}const g=t.map(e=>u[e]??{times:[],values:[]}),m=function aggregateBatterySocLkcf(e){const clamp=e=>Math.max(0,Math.min(100,e));if(0===e.length)return{times:[],values:[]};if(1===e.length){const t=e[0];return{times:t.times,values:t.values.map(clamp)}}const t=/* @__PURE__ */new Set;for(const s of e)for(const e of s.times)t.add(e.getTime());const i=Array.from(t).sort((e,t)=>e-t),n=new Array(e.length).fill(-1),r=[];for(const s of i){let t=0,i=0;for(let r=0;r<e.length;r++){const l=e[r];let d=n[r];for(;d+1<l.times.length&&l.times[d+1].getTime()<=s;)d++;n[r]=d,d>=0&&isFinite(l.values[d])&&(t+=clamp(l.values[d]),i++)}r.push(0===i?NaN:t/i)}return{times:i.map(e=>new Date(e)),values:r}}(g);return saveDurableSeries(l,m),{merged:m,perBank:g}}catch(d){return warnOnce("battery-soc-fetch","battery SoC fetch failed; showing cached data until it recovers"),{merged:loadDurableSeries(l,864e5)??{times:[],values:[]},perBank:[]}}}(e.hass,f,p,u,e._timeRange.end,e._storeFetchPeriod,v)).then(t=>{e._batterySocHistory=t?.merged??{times:[],values:[]},e._batterySocPerBankHistory=t?.perBank??[]}).finally(()=>{e._batteryFetching=!1})}function parseRawBatteryHistory(e){const t=[],i=[];for(const n of e??[]){const e="string"==typeof n?.s?n.s:"string"==typeof n?.state?n.state:null;if(null===e||"unavailable"===e||"unknown"===e||""===e)continue;const r=parseFloat(e);if(!isFinite(r))continue;let s=null;"number"==typeof n?.lu?s=/* @__PURE__ */new Date(1e3*n.lu):"string"==typeof n?.last_updated?s=new Date(n.last_updated):"string"==typeof n?.last_changed&&(s=new Date(n.last_changed)),s&&!isNaN(s.getTime())&&(t.push(s),i.push(r))}return{times:t,values:i}}function parseBatteryStats(e){const t=[],i=[];for(const n of e??[]){const e=parseStatBoundaryLoose(n?.start),r=parseStatBoundaryLoose(n?.end);if(null===e)continue;let s=n?.mean,l=!1;if(null==s&&(s=n?.state,l=!0),null==s)continue;const d="number"==typeof s?s:parseFloat(String(s));if(!isFinite(d))continue;const c=l?r??e:null!==r?(e+r)/2:e;t.push(new Date(c)),i.push(d)}return{times:t,values:i}}var it=new Le(we);function refreshIrradiance(e){const t=String(e.config?.["solar-irradiance-entity"]??"").trim();if(!t||!e.hass)return null!==e._irradianceHistory&&(e._irradianceHistory=null),e._irradianceFetchKey="",void e._engine?.setSolarIrradianceSamples(null);if(pushIrradianceToEngine(e),!e._timeRange||e._irradianceFetching)return;const i=e._timeRange.start,n=quantizedAnchorMs(we),r=/* @__PURE__ */new Date(n-216e5),s=i<r?r:i,l=Math.floor(e._timeRange.end.getTime()/we)*we,d=`${t}@${s.getTime()}|${l}`;if(d===e._irradianceFetchKey)return;e._irradianceFetchKey=d;const c=`irr:${t}`;e._irradianceFetching=!0,it.get(d,()=>async function fetchIrradiance(e,t,i,n,r){if(!e?.callWS)return null;try{const s=/* @__PURE__ */new Date,l=n>s?s:n;if(i>=l)return{times:[],values:[]};let d={times:[],values:[]};const c=await callWS(e,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:l.toISOString(),statistic_ids:[t],period:"5minute",types:["mean"]}),u=(c&&c[t])??[];if(u.length>0)d=function parseIrradianceStats(e){const t=[],i=[];for(const n of e??[]){const e=parseStatBoundaryLoose(n?.start),r=parseStatBoundaryLoose(n?.end);if(null===e)continue;const s=n?.mean;if(null==s)continue;const l="number"==typeof s?s:parseFloat(String(s));if(!isFinite(l)||l<0)continue;const d=null!==r?(e+r)/2:e;t.push(new Date(d)),i.push(l)}return{times:t,values:i}}(u);else{const n=await callWS(e,{type:"history/history_during_period",start_time:i.toISOString(),end_time:l.toISOString(),entity_ids:[t],minimal_response:!0,no_attributes:!0,significant_changes_only:!0});d=function parseRawIrradianceHistory(e){const t=[],i=[];let n=null;for(const r of e){const e=r?.s??r?.state;if(null==e||"unavailable"===e||"unknown"===e||""===e)continue;const s=parseFloat(String(e));if(!isFinite(s)||s<0)continue;let l=null;const d=r?.lu??r?.lc??r?.last_updated??r?.last_changed??null;if("number"==typeof d)l=new Date(d>1e12?d:1e3*d);else if("string"==typeof d){const e=Number(d);l=Number.isFinite(e)&&e>1e9?new Date(e>1e12?e:1e3*e):new Date(d)}l&&!isNaN(l.getTime())||null===n||(l=new Date(n)),l&&!isNaN(l.getTime())&&(n=l.getTime(),t.push(l),i.push(s))}return{times:t,values:i}}((n&&n[t])??[])}return saveDurableSeries(r,d),d}catch(s){return warnOnce("irradiance-fetch","irradiance fetch failed; showing cached data until it recovers"),loadDurableSeries(r,fe)}}(e.hass,t,s,e._timeRange.end,c)).then(t=>{e._irradianceHistory=t??{times:[],values:[]},pushIrradianceToEngine(e)}).finally(()=>{e._irradianceFetching=!1})}var at=/* @__PURE__ */new WeakMap;function pushIrradianceToEngine(e){if(!e._engine)return;const t=String(e.config?.["solar-irradiance-entity"]??"").trim();if(!t||!e.hass)return e._engine.setSolarIrradianceSamples(null),void at.delete(e);const i=e._irradianceHistory,n=e.hass.states?.[t],r=at.get(e);if(r&&r.histRef===i&&r.stateRef===n&&r.entity===t)return;const s=[];if(i)for(let l=0;l<i.times.length;l++)s.push({time:i.times[l],wm2:i.values[l]});if(n){const e=parseFloat(n.state);if(isFinite(e)&&e>=0){const t=n.last_updated?new Date(n.last_updated):/* @__PURE__ */new Date;s.push({time:t,wm2:e})}}e._engine.setSolarIrradianceSamples(s.length>0?s:null),at.set(e,{histRef:i,stateRef:n,entity:t})}var ot=class{constructor(){this.bearingDeg=180,this.tiltDeg=50,this.pxPerMetre=1,this.centreX=0,this.centreY=0,this.hasViewport=!1,this._cosB=Math.cos(180*be),this._sinB=Math.sin(180*be),this._cosT=Math.cos(50*be),this._sinT=Math.sin(50*be)}setPose(e,t){this.bearingDeg=e,this.tiltDeg=Math.min(65,Math.max(0,t))}setViewport(e,t){const i=this.tiltDeg*be,n=this.bearingDeg*be;this.centreX=e/2,this.centreY=t/2,this.hasViewport=!0,this._cosB=Math.cos(n),this._sinB=Math.sin(n),this._cosT=Math.cos(i),this._sinT=Math.sin(i)}project3(e,t,i){const n=e*this.pxPerMetre,r=-t*this.pxPerMetre,s=i*this.pxPerMetre,l=n*this._cosB-r*this._sinB,d=n*this._sinB+r*this._cosB,c=d*this._sinT+s*this._cosT,u=Ce/Math.max(Ce-c,180);return{x:this.centreX+l*u,y:this.centreY+(d*this._cosT-s*this._sinT)*u,depth:c}}project(e,t,i){const n=this.project3(e,t,i);return[n.x,n.y]}groundTransform(e,t){return{transformOrigin:`${e}px ${t}px`,transform:`translate(${(this.centreX-e).toFixed(2)}px, ${(this.centreY-t).toFixed(2)}px) perspective(1200px) rotateX(${this.tiltDeg}deg) rotateZ(${this.bearingDeg}deg)`}}};function zigzag(e){return e%2==0?e/2:-(e+1)/2}var nt=class{constructor(e){this.buf=e,this.pos=0}get end(){return this.buf.length}varint(){let e=0,t=0;for(;;){const i=this.buf[this.pos++];if(e+=i%128*2**t,i<128)return e;t+=7}}bytes(){const e=this.varint(),t=this.buf.subarray(this.pos,this.pos+e);return this.pos+=e,t}string(){return(new TextDecoder).decode(this.bytes())}float(){const e=new DataView(this.buf.buffer,this.buf.byteOffset+this.pos,4).getFloat32(0,!0);return this.pos+=4,e}double(){const e=new DataView(this.buf.buffer,this.buf.byteOffset+this.pos,8).getFloat64(0,!0);return this.pos+=8,e}skip(e){switch(e){case 0:this.varint();break;case 1:this.pos+=8;break;case 2:{const e=this.varint();this.pos+=e;break}case 5:this.pos+=4;break;default:throw new Error(`mvt: unknown wire type ${e} at pos ${this.pos}`)}}};function readValue(e){const t=e.varint(),i=e.pos+t;let n="";for(;e.pos<i;){const t=e.varint();switch(Math.floor(t/8)){case 1:n=e.string();break;case 2:n=e.float();break;case 3:n=e.double();break;case 4:case 5:n=e.varint();break;case 6:n=zigzag(e.varint());break;case 7:n=e.varint()?1:0;break;default:e.skip(t%8)}}return n}function decodeGeometry(e){const t=[];let i=[],n=0,r=0,s=0;for(;s<e.length;){const l=e[s++],d=l%8,c=Math.floor(l/8);if(1===d){i.length&&t.push(i),i=[];for(let t=0;t<c;t++)n+=zigzag(e[s]),s++,r+=zigzag(e[s]),s++,i.push([n,r])}else if(2===d)for(let t=0;t<c;t++)n+=zigzag(e[s]),s++,r+=zigzag(e[s]),s++,i.push([n,r])}return i.length&&t.push(i),t}function readFeature(e,t,i){const n=e.varint(),r=e.pos+n;let s=0,l=[],d=[];for(;e.pos<r;){const t=e.varint(),i=Math.floor(t/8),n=t%8;3===i?s=e.varint():2===i?l=readPacked(e):4===i?d=readPacked(e):e.skip(n)}const c={};for(let u=0;u+1<l.length;u+=2){const e=t[l[u]],n=i[l[u+1]];void 0!==e&&void 0!==n&&(c[e]=n)}return{type:s,rings:decodeGeometry(d),tags:c}}function readPacked(e){const t=e.varint(),i=e.pos+t,n=[];for(;e.pos<i;)n.push(e.varint());return n}function readLayer(e){const t=e.varint(),i=e.pos+t;let n="",r=4096;const s=[],l=[],d=[];for(;e.pos<i;){const t=e.varint(),i=t%8;switch(Math.floor(t/8)){case 1:n=e.string();break;case 2:d.push({pos:e.pos}),e.skip(i);break;case 3:s.push(e.string());break;case 4:l.push(readValue(e));break;case 5:r=e.varint();break;default:e.skip(i)}}const c=[];for(const u of d)e.pos=u.pos,c.push(readFeature(e,s,l));return e.pos=i,{name:n,extent:r,features:c}}function decodeVectorTile(e){const t=new nt(e),i=[];for(;t.pos<t.end;){const e=t.varint(),n=e%8;3===Math.floor(e/8)?i.push(readLayer(t)):t.skip(n)}return i}var rt="",st=0;async function fetchWithWatchdog(e,t){const i=new AbortController,onAbort=()=>i.abort();t?.aborted&&i.abort(),t?.addEventListener("abort",onAbort);const n=setTimeout(()=>i.abort(),1e4);try{return await fetch(e,{referrerPolicy:"no-referrer",signal:i.signal})}finally{clearTimeout(n),t?.removeEventListener("abort",onAbort)}}async function resolveTemplate(e){if(rt&&Date.now()-st<2592e6)return rt;const t=await fetchWithWatchdog("https://tiles.openfreemap.org/planet",e);if(!t.ok)return null;const i=await t.json(),n=Array.isArray(i.tiles)?i.tiles[0]:void 0;return"string"==typeof n&&n.includes("{z}")?(rt=n,st=Date.now(),n):null}function lonLatToTile(e,t,i){const n=2**i,r=t*be;return{x:(e+180)/360*n,y:(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n}}function tilePixelToLonLat(e,t,i,n,r,s){const l=2**s,d=t+n/r;return{lon:(e+i/r)/l*360-180,lat:180*Math.atan(Math.sinh(Math.PI*(1-2*d/l)))/Math.PI}}function ringHeight(e){const t=e.render_height;return"number"==typeof t&&Number.isFinite(t)&&t>0?t:null}function ringSignedArea(e){let t=0;for(let i=0;i<e.length;i++){const n=(i+1)%e.length;t+=e[i][0]*e[n][1]-e[n][0]*e[i][1]}return t}var lt=new Set(["water","waterway","landcover","landuse","park","transportation","aeroway","boundary","building"]);var dt=["land","water","wood","grass","sand","wetland","ice","landuse","roadMajor","roadMinor","roadCasing","path","rail","building","boundary"];function defaultGroundPalette(e){return e?{land:"#2a2f3a",water:"#33445f",wood:"#2c3730",grass:"#313d33",sand:"#3a3730",wetland:"#2d3838",ice:"#39404a",landuse:"#2e3340",roadMajor:"#454c5e",roadMinor:"#3a4152",roadCasing:"#20242e",path:"#3c4354",rail:"#4a5060",building:"#333a48",boundary:"#5a4a63"}:{land:"#f3f0e9",water:"#a3c9ef",wood:"#c6d8b4",grass:"#d7e7c4",sand:"#e9e1c9",wetland:"#d2dec9",ice:"#e7eef1",landuse:"#ece7dd",roadMajor:"#ffffff",roadMinor:"#ffffff",roadCasing:"#cbc3b2",path:"#e2d4b6",rail:"#b6b6bf",building:"#e2dacd",boundary:"#c1a3c1"}}var ct={motorway:16,trunk:14,primary:12,secondary:10,tertiary:8,minor:6,residential:6,unclassified:6,living_street:5,pedestrian:5,service:4,track:3,path:2,footway:2,cycleway:2,steps:2},ut=.4;function landcoverKey(e){return/wood|forest|tree/.test(e)?"wood":/sand|beach|dune/.test(e)?"sand":/wetland|marsh|mangrove|bog|swamp/.test(e)?"wetland":/ice|glacier|snow/.test(e)?"ice":"grass"}function landuseKey(e){return/wood|forest/.test(e)?"wood":/park|pitch|playground|recreation|golf|garden|grass|meadow|cemetery|farm|orchard|vineyard/.test(e)?"grass":"landuse"}function addPath(e,t,i){for(const n of t.lonLat){const[r,s]=i(n[0][0],n[0][1]);e.moveTo(r,s);for(let t=1;t<n.length;t++){const[r,s]=i(n[t][0],n[t][1]);e.lineTo(r,s)}t.line||e.closePath()}}function groundTint(e,t){const i=mixHex(e,"#0e1420",.62),n=mixHex(e,"#2a2445",.45),r=mixHex(e,"#7a3f1e",.28),s=mixHex(e,"#fff2d8",.16);return t<-8?i:t<0?mixHex(i,n,(t+8)/8):t<6?mixHex(n,r,t/6):t<25?mixHex(r,s,(t-6)/19):s}function paint(e,t,i,n,r,s,l){const d=function tintPalette(e,t){const i={};for(const n of dt)i[n]=groundTint(e[n],t);return i}(s.palette,l),hide=e=>s.hidden.has(e);e.clearRect(0,0,t,t),hide("land")||(e.fillStyle=d.land,e.fillRect(0,0,t,t)),e.lineJoin="round",e.lineCap="round";const fillFeature=(t,i)=>{const r=new Path2D;addPath(r,t,n),e.fillStyle=i,e.fill(r,"evenodd")},strokeFeature=(t,i,r)=>{const s=new Path2D;addPath(s,t,n),e.strokeStyle=i,e.lineWidth=r,e.stroke(s)};for(const u of i){if(u.line||"landcover"!==u.layer)continue;const e=landcoverKey(u.cls);hide(e)||fillFeature(u,d[e])}for(const u of i){if(u.line||"landuse"!==u.layer)continue;const e=landuseKey(u.cls);hide(e)||fillFeature(u,d[e])}if(!hide("grass"))for(const u of i)u.line||"park"!==u.layer||fillFeature(u,d.grass);if(!hide("roadCasing"))for(const u of i)u.line||"aeroway"!==u.layer||fillFeature(u,d.roadCasing);if(!hide("water")){for(const e of i)e.line||"water"!==e.layer||fillFeature(e,d.water);for(const e of i){if(!e.line||"waterway"!==e.layer)continue;const t=("stream"===e.cls||"ditch"===e.cls||"drain"===e.cls?1.4:3)*r*ut;strokeFeature(e,d.water,Math.max(1,t))}}const c=i.filter(e=>e.line&&"transportation"===e.layer&&"rail"!==e.cls&&!/^path|footway|cycleway|steps|track/.test(e.cls)),rank=e=>ct[e]??6;c.sort((e,t)=>rank(e.cls)-rank(t.cls));const roadWidth=e=>(ct[e]??6)*r*ut;if(!hide("roadCasing"))for(const u of c)strokeFeature(u,d.roadCasing,roadWidth(u.cls)+1.4*r*ut);for(const u of c){const e=rank(u.cls)>=8?"roadMajor":"roadMinor";hide(e)||strokeFeature(u,d[e],roadWidth(u.cls))}if(e.setLineDash([Math.max(2,r),Math.max(2,r)]),!hide("path"))for(const u of i)u.line&&"transportation"===u.layer&&/^path|footway|cycleway|steps|track/.test(u.cls)&&strokeFeature(u,d.path,Math.max(1,2*r*ut));if(!hide("rail"))for(const u of i)u.line&&"transportation"===u.layer&&"rail"===u.cls&&strokeFeature(u,d.rail,Math.max(1,3*r*ut));if(e.setLineDash([]),!hide("building"))for(const u of i)u.line||"building"!==u.layer||fillFeature(u,d.building);if(!hide("boundary")){e.setLineDash([Math.max(3,2*r),Math.max(3,2*r)]);for(const e of i)e.line&&"boundary"===e.layer&&strokeFeature(e,d.boundary,Math.max(1,1.2*r*ut));e.setLineDash([])}}async function buildVectorGround(e,t,i,n,r){const[s,l]=lonLatToTile$1(t,e,19),d=Math.floor(s)-5,c=Math.floor(l)-5,u=2816,p=256*(s-d),g=256*(l-c),m=pxPerMetreFor(e,19),f=await async function fetchGroundVector(e,t,i,n){const r=await resolveTemplate(n);if(!r)return null;const s=De*Math.cos(e*be),l=i/De,d=i/s,c=lonLatToTile(t-d,e+l,14),u=lonLatToTile(t+d,e-l,14),p=Math.floor(c.x),g=Math.floor(u.x),m=Math.floor(c.y),f=Math.floor(u.y),b=[];let v=!1;for(let w=p;w<=g;w++)for(let e=m;e<=f;e++){const t=r.replace("{z}",String(14)).replace("{x}",String(w)).replace("{y}",String(e));try{const i=await fetchWithWatchdog(t,n);if(!i.ok)throw new Error(String(i.status));const r=new Uint8Array(await i.arrayBuffer());v=!0;for(const t of decodeVectorTile(r))if(lt.has(t.name))for(const i of t.features){if(1===i.type)continue;const n=2===i.type,r=n?2:3,s=i.rings.filter(e=>e.length>=r).map(i=>i.map(([i,n])=>{const r=tilePixelToLonLat(w,e,i,n,t.extent,14);return[r.lon,r.lat]}));s.length&&b.push({layer:t.name,cls:String(i.tags.class??""),line:n,lonLat:s})}}catch(y){if("AbortError"===y?.name&&n?.aborted)throw y}}return v?b:null}(e,t,1408/m*1.15,r)??[],b=document.createElement("canvas");b.width=u,b.height=u,b.className="ground";const v=b.getContext("2d"),toPx=(e,t)=>{const[i,n]=lonLatToTile$1(e,t,19);return[256*(i-d),256*(n-c)]},repaint=(e,t)=>{v&&paint(v,u,f,toPx,m,e,t)};repaint(i,n);const y=document.createElement("div");return y.className="ground-fade",y.style.width="2816px",y.style.height="2816px",{ground:{el:b,fade:y,homeX:p,homeY:g,size:u},repaint:repaint}}function buildingColor(e,t){if(t<-6)return mixHex(e,"#0a0e1a",.85);const i=mixHex(e,"#0a0e1a",.85),n=mixHex(e,"#2a2540",.55),r=mixHex(e,"#5a3220",.35);return t<0?mixHex(i,n,(t+6)/6):t<6?mixHex(n,r,t/6):t<20?mixHex(r,e,(t-6)/14):e}function tintedRgba(e,t,i){const n=buildingColor(e,t);return`rgba(${hexByte(n,1)},${hexByte(n,3)},${hexByte(n,5)},${i})`}var arcColor=(e,t)=>e<=0?"#3a4a63":e<12?mixHex(t,"#ff6a00",.5):t;function pointsAttr(e){return e.map(e=>`${e[0].toFixed(1)},${e[1].toFixed(1)}`).join(" ")}function distanceToHome(e){if(function pointInPolygon(e,t,i){let n=!1;for(let r=0,s=i.length-1;r<i.length;s=r++){const[l,d]=i[r],[c,u]=i[s];d>t!=u>t&&e<(c-l)*(t-d)/(u-d)+l&&(n=!n)}return n}(0,0,e))return 0;let t=1/0;for(let i=0,n=e.length-1;i<e.length;n=i++){const[r,s]=e[n],l=e[i][0]-r,d=e[i][1]-s,c=l*l+d*d,u=c?Math.max(0,Math.min(1,(-r*l-s*d)/c)):0;t=Math.min(t,Math.hypot(r+u*l,s+u*d))}return t}function cacheKey$1(e,t){return`helios-bld3:${e.toFixed(4)}:${t.toFixed(4)}`}async function fetchRawBuildings(e,t,i){const n=e,r=t,s=Math.round(500),l=cacheKey$1(n,r);try{const e=localStorage.getItem(l),t=e?JSON.parse(e):null;if(t?.buildings?.length&&Date.now()-t.time<2592e6)return t.buildings}catch(L){}const d=await async function fetchOfmBuildingRings(e,t,i,n){const r=await resolveTemplate(n);if(!r)return null;const s=De*Math.cos(e*be),l=i/De,d=i/s,c=lonLatToTile(t-d,e+l,14),u=lonLatToTile(t+d,e-l,14),p=Math.floor(c.x),g=Math.floor(u.x),m=Math.floor(c.y),f=Math.floor(u.y),b=[];let v=!1;for(let w=p;w<=g;w++)for(let e=m;e<=f;e++){const t=r.replace("{z}",String(14)).replace("{x}",String(w)).replace("{y}",String(e));try{const i=await fetchWithWatchdog(t,n);if(!i.ok)throw new Error(String(i.status));const r=decodeVectorTile(new Uint8Array(await i.arrayBuffer())).find(e=>"building"===e.name);if(v=!0,r)for(const t of r.features){const i=ringHeight(t.tags);for(const n of t.rings)n.length<3||ringSignedArea(n)<=0||b.push({lonLat:n.map(([t,i])=>{const n=tilePixelToLonLat(w,e,t,i,r.extent,14);return[n.lon,n.lat]}),heightM:i})}}catch(y){if("AbortError"===y?.name&&n?.aborted)throw y}}return v?b:null}(n,r,s,i);if(null===d)return null;const c=function parseOfmBuildings(e,t,i,n){const r=De,s=De*Math.cos(t*be),l=[],d=/* @__PURE__ */new Set,c=n+250;for(const{lonLat:u,heightM:p}of e){let e=0,g=0;for(const[n,l]of u)e+=(n-i)*s,g+=(l-t)*r;if(Math.hypot(e/u.length,g/u.length)>c)continue;const m=u.map(([e,n])=>[(e-i)*s,(n-t)*r]),f=m.length-1;if(m.length>1&&m[0][0]===m[f][0]&&m[0][1]===m[f][1]&&m.pop(),m.length<3)continue;let b=0;for(let t=0;t<m.length;t++){const e=(t+1)%m.length;b+=m[t][0]*m[e][1]-m[e][0]*m[t][1]}b<0&&m.reverse();let v=0,y=0;for(const[t,i]of m)v+=t,y+=i;v/=m.length,y/=m.length;const w=distanceToHome(m);if(w>n)continue;const _=`${v.toFixed(1)}|${y.toFixed(1)}|${p??"n"}|${m.length}`;d.has(_)||(d.add(_),l.push({footprint:m,centerX:v,centerY:y,distanceM:w,osmHeightM:p}))}return l.sort((e,t)=>e.distanceM-t.distanceM),l.slice(0,100)}(d,n,r,s);if(c.length){try{localStorage.setItem(l,JSON.stringify({time:Date.now(),buildings:c}))}catch(L){}return c}return[]}function simplifyFootprint(e){const t=e.length;if(t<4)return e;const i=[];for(let n=0;n<t;n++){const r=e[(n+t-1)%t],s=e[n],l=e[(n+1)%t],d=l[0]-r[0],c=l[1]-r[1],u=(s[0]-r[0])*c-(s[1]-r[1])*d;Math.abs(u)/(Math.hypot(d,c)||1)>.05&&i.push(s)}return i.length>=3?i:e}function convexHull(e){if(e.length<3)return e.slice();const t=e.slice().sort((e,t)=>e[0]-t[0]||e[1]-t[1]),cross=(e,t,i)=>(t[0]-e[0])*(i[1]-e[1])-(t[1]-e[1])*(i[0]-e[0]),i=[];for(const r of t){for(;i.length>=2&&cross(i[i.length-2],i[i.length-1],r)<=0;)i.pop();i.push(r)}const n=[];for(let r=t.length-1;r>=0;r--){const e=t[r];for(;n.length>=2&&cross(n[n.length-2],n[n.length-1],e)<=0;)n.pop();n.push(e)}return i.pop(),n.pop(),i.concat(n)}var prefersReducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,ht=class{constructor(e,t={}){this.camera=new ot,this._groundAltitude=45,this._groundToken=0,this._buildings=[],this._sun={azimuth:0,altitude:0},this._growth=1,this._home={growth:1},this._homeRaf=0,this._palette={home:"#488fc2",neighbor:"#cccccc",shadow:"#000000",shadowOpacity:.32,neighborOpacity:.25},this._redrawScheduled=!1,this._rafToken=0,this._growthRaf=0,this._alive=!0,this._obsW=-1,this._obsH=-1,this._container=e,t.shadow&&(this._palette.shadow=t.shadow),null!=t.shadowOpacity&&(this._palette.shadowOpacity=t.shadowOpacity),this._groundHolder=document.createElement("div"),this._groundHolder.className="scene-ground-holder",this._sceneSvg=document.createElementNS("http://www.w3.org/2000/svg","svg"),this._sceneSvg.setAttribute("class","scene-svg"),e.appendChild(this._groundHolder),e.appendChild(this._sceneSvg),this._resizeObserver=new ResizeObserver(e=>{const t=e[e.length-1]?.contentRect;if(!t)return;const i=Math.round(t.width),n=Math.round(t.height);i===this._obsW&&n===this._obsH||(this._obsW=i,this._obsH=n,this.scheduleRedraw())}),this._resizeObserver.observe(e);const i=e.clientWidth,n=e.clientHeight;i>0&&n>0&&this.camera.setViewport(i,n)}async setLocation(e,t,i){this.camera.pxPerMetre=pxPerMetreFor(e);const n=++this._groundToken,r=await buildVectorGround(e,t,i,this._groundAltitude);this._alive&&n===this._groundToken&&(this._groundStyleCur=i,this._ground=r.ground,this._groundRepaint=r.repaint,this._groundHolder.replaceChildren(r.ground.el,r.ground.fade),this.scheduleRedraw())}setGroundStyle(e){this._groundStyleCur=e,this._groundRepaint&&(this._groundRepaint(e,this._groundAltitude),this.scheduleRedraw())}setGroundAltitude(e){this._groundAltitude=e,this._groundRepaint&&this._groundStyleCur&&(this._groundRepaint(this._groundStyleCur,e),this.scheduleRedraw())}setBuildings(e){this._buildings=e,this.scheduleRedraw()}setSun(e,t){this._sun={azimuth:e,altitude:t},this.scheduleRedraw()}setGrowth(e){this._growth=Math.max(0,Math.min(1,e))}animateGrowth(){if(this._growthRaf&&(cancelAnimationFrame(this._growthRaf),this._growthRaf=0),prefersReducedMotion())return this._growth=1,void this.scheduleRedraw();this._growth=0,this.scheduleRedraw();const e=performance.now(),tick=t=>{if(!this._alive)return void(this._growthRaf=0);const i=Math.min(1,(t-e)/500);this._growth=1-(1-i)**3,this.scheduleRedraw(),this._growthRaf=i<1?requestAnimationFrame(tick):0};this._growthRaf=requestAnimationFrame(tick)}setPalette(e){this._palette={...this._palette,...e},this.scheduleRedraw()}setHome(e){this._home={color:e,growth:this._home.growth??1},this.scheduleRedraw()}animateHomeTo(e){if(this._homeRaf&&(cancelAnimationFrame(this._homeRaf),this._homeRaf=0),!this._home.color||prefersReducedMotion())return this._home={color:e,growth:1},void this.scheduleRedraw();const t=220,i=performance.now(),tick=n=>{if(!this._alive)return void(this._homeRaf=0);const r=n-i;if(r<t){const e=r/t;this._home={...this._home,growth:1-e*e*e}}else{if(!(r<520))return this._home={color:e,growth:1},this.scheduleRedraw(),void(this._homeRaf=0);{const i=(r-t)/300;this._home={color:e,growth:1-(1-i)**3}}}this.scheduleRedraw(),this._homeRaf=requestAnimationFrame(tick)};this._homeRaf=requestAnimationFrame(tick)}setCameraBearing(e){this.camera.setPose(e,this.camera.tiltDeg),this.scheduleRedraw()}setCameraPitch(e){this.camera.setPose(this.camera.bearingDeg,e),this.scheduleRedraw()}getCameraBearing(){return this.camera.bearingDeg}getCameraPitch(){return this.camera.tiltDeg}scheduleRedraw(){!this._redrawScheduled&&this._alive&&(this._redrawScheduled=!0,this._rafToken=requestAnimationFrame(()=>{this._redrawScheduled=!1,this._draw()}))}_draw(){if(!this._alive)return;const e=this._container.clientWidth||0,t=this._container.clientHeight||0;if(0===e||0===t)return;if(this.camera.setViewport(e,t),this._ground){const{transform:e,transformOrigin:t}=this.camera.groundTransform(this._ground.homeX,this._ground.homeY);this._ground.el.style.transformOrigin=t,this._ground.el.style.transform=e,this._ground.fade.style.transformOrigin=t,this._ground.fade.style.transform=e}this._sceneSvg.setAttribute("viewBox",`0 0 ${e} ${t}`);const i=this._sun.altitude,n=this._buildings;this._sceneSvg.innerHTML=function renderShadows(e,t,i,n,r){const s=Math.min(1,i.altitude/10);if(s<=0)return"";const l=(i.azimuth+180)*be;let d="",c="",u=0;for(const p of t){if(e.project3(p.centerX,p.centerY,0).depth>=1020)continue;const t=Math.min(p.height/Math.tan(i.altitude*be),50),r=Math.sin(l)*t,s=Math.cos(l)*t,g=p.footprint.map(t=>e.project(t[0],t[1],0)),m=p.footprint.map(t=>e.project(t[0]+r,t[1]+s,0));let f=0,b=0;for(const e of g)f+=e[0],b+=e[1];let v=0,y=0;for(const e of m)v+=e[0],y+=e[1];const w=g.length||1;let _=v/w-f/w,H=y/w-b/w;const j=Math.hypot(_,H)||1;_/=j,H/=j;let z=g[0],M=-1/0;for(const e of g){const t=e[0]*_+e[1]*H;t>M&&(M=t,z=e)}let $=m[0],C=-1/0;for(const e of m){const t=e[0]*_+e[1]*H;t>C&&(C=t,$=e)}const D=`hsh${u}`;u+=1,d+=`<linearGradient id="${D}" gradientUnits="userSpaceOnUse" x1="${z[0].toFixed(1)}" y1="${z[1].toFixed(1)}" x2="${$[0].toFixed(1)}" y2="${$[1].toFixed(1)}"><stop offset="0" stop-color="${n}" stop-opacity="1"/><stop offset="1" stop-color="${n}" stop-opacity="0"/></linearGradient>`,c+=`<polygon points="${pointsAttr(convexHull([...g,...m]))}" fill="url(#${D})"/>`}return c?`<defs>${d}</defs><g opacity="${(r*s).toFixed(3)}">${c}</g>`:""}(this.camera,n,this._sun,this._palette.shadow,this._palette.shadowOpacity)+function renderBuildings(e,t,i,n,r,s=.25,l={}){const d=t.map((t,i)=>{const n=e.project3(t.centerX,t.centerY,0);let r=-1/0;for(const s of t.footprint){const t=e.project3(s[0],s[1],0).depth;t>r&&(r=t)}return{index:i,depth:r,cameraZ:n.depth}}).filter(e=>e.cameraZ<1020).sort((e,t)=>e.depth-t.depth),c=buildingColor(n.neighbor,i),u=mixHex(c,"#000000",.18),p=mixHex(c,"#000000",.3),g=[],m=[];for(const{index:v}of d){const s=t[v],d=s.isHome?m:g,f=simplifyFootprint(s.footprint),b=s.height*r*(s.isHome?l.growth??1:1),y=s.isHome?tintedRgba(mixHex(l.color??n.home,"#000000",.22),i,.9):u,w=f.map(t=>e.project(t[0],t[1],0)),_=f.map(t=>e.project(t[0],t[1],b)),H=l.color??n.home,j=s.isHome?tintedRgba(mixHex(H,"#ffffff",.18),i,.92):c;let z=p;if(s.isHome){const e=mixHex(l.color??n.home,"#ffffff",.5);z=`rgba(${hexByte(e,1)},${hexByte(e,3)},${hexByte(e,5)},0.1)`}const M=s.isHome?1:.4;for(let t=0;t<w.length;t++){const i=(t+1)%w.length,n=w[t],r=w[i],s=_[i],l=_[t];if(n[0]*r[1]-r[0]*n[1]+(r[0]*s[1]-s[0]*r[1])+(s[0]*l[1]-l[0]*s[1])+(l[0]*n[1]-n[0]*l[1])>=0)continue;const c=`<polygon points="${pointsAttr([n,r,s,l])}" fill="${y}" stroke="${z}" stroke-width="${M}"/>`,u=Math.max(e.project3(f[t][0],f[t][1],0).depth,e.project3(f[i][0],f[i][1],0).depth,e.project3(f[t][0],f[t][1],b).depth,e.project3(f[i][0],f[i][1],b).depth);d.push({depth:u,svg:c})}let $=-1/0;for(const t of f){const i=e.project3(t[0],t[1],b).depth;i>$&&($=i)}d.push({depth:$,svg:`<polygon points="${pointsAttr(_)}" fill="${j}" stroke="${z}" stroke-width="${s.isHome?1:.6}"/>`})}g.sort((e,t)=>e.depth-t.depth);const f=Math.max(0,Math.min(1,s)).toFixed(3),b=g.length?`<g opacity="${f}">${g.map(e=>e.svg).join("")}</g>`:"";return m.sort((e,t)=>e.depth-t.depth),b+m.map(e=>e.svg).join("")}(this.camera,n,i,this._palette,this._growth,this._palette.neighborOpacity,this._home),this.onAfterDraw?.()}cleanup(){this._alive=!1,this._resizeObserver?.disconnect(),this._resizeObserver=void 0,this._rafToken&&(cancelAnimationFrame(this._rafToken),this._rafToken=0),this._growthRaf&&(cancelAnimationFrame(this._growthRaf),this._growthRaf=0),this._homeRaf&&(cancelAnimationFrame(this._homeRaf),this._homeRaf=0),this._groundHolder.remove(),this._sceneSvg.remove()}},pt=null,gt=null;function getSunPosition(e,t,i){const n=`${e.getTime()}|${t.toFixed(6)}|${i.toFixed(6)}`;if(n===pt&&null!==gt)return gt;const r=Math.PI/180,s=e.getUTCHours()+e.getUTCMinutes()/60+e.getUTCSeconds()/3600,l=Math.floor((e.getTime()-Date.UTC(e.getUTCFullYear(),0,0))/fe),d=23.45*Math.sin(r*(360/365)*(l-81)),c=r*(360/365)*(l-81);let u=15*(s+i/15+(9.87*Math.sin(2*c)-7.53*Math.cos(c)-1.5*Math.sin(c))/60-12);u=((u+180)%360+360)%360-180;const p=Math.sin(r*t)*Math.sin(r*d)+Math.cos(r*t)*Math.cos(r*d)*Math.cos(r*u),g=Math.asin(Math.max(-1,Math.min(1,p)))/r,m=Math.cos(g*r),f=m>1e-4?(Math.sin(r*d)-Math.sin(r*t)*p)/(Math.cos(r*t)*m):0;let b=Math.acos(Math.max(-1,Math.min(1,f)))/r;u>0&&(b=360-b);const v={altitude:g,azimuth:b};return pt=n,gt=v,v}function computePvPower(e,t,i,n){return Math.min(100,computeIrradianceWm2(e,t,i,n)/10)}function computeIrradianceWm2(e,t,i,n){const r=getSunPosition(e,t,i).altitude;if(r<=0)return 0;const s=Math.PI/180,l=Math.sin(r*s),d=1098*l*Math.exp(-.059/l),c=1-.75*(Math.max(0,Math.min(100,n))/100)**3.4;return Math.max(0,d*c)}function medianOfNumbers(e){const t=[];for(const n of e)null==n||Number.isNaN(n)||t.push(n);if(0===t.length)return null;t.sort((e,t)=>e-t);const i=Math.trunc(t.length/2);return t.length%2==0?(t[i-1]+t[i])/2:t[i]}var mt=/* @__PURE__ */new Map;function cacheKey(e,t,i){return`helios-weather-cache:${i}:${e.toFixed(3)},${t.toFixed(3)}`}var ft=["shortwave_radiation_instant","cloud_cover_low","cloud_cover_mid","cloud_cover_high"];function readSeries(e,t,i){const n=e?.hourly?.[t];if(Array.isArray(n))return n.map(e=>null==e||Number.isNaN(e)?null:Number(e));const r=[];for(const d of i){const i=e?.hourly?.[`${t}_${d}`];Array.isArray(i)&&r.push(i.map(e=>null==e||Number.isNaN(e)?null:Number(e)))}if(0===r.length)return[];const s=Math.max(...r.map(e=>e.length)),l=new Array(s);for(let d=0;d<s;d++)l[d]=medianOfNumbers(r.map(e=>e[d]));return l}var fillCloud=e=>e.map(e=>null==e?0:e);async function fetchHomePointData(e,t,i,n,r){const s=Number(e.toFixed(3)),l=Number(t.toFixed(3)),d=function readCache(e,t,i){try{const n=window.localStorage?.getItem(cacheKey(e,t,i));if(!n)return null;const r=JSON.parse(n);if(Date.now()-r.storedAt>27e5)return null;if(new Date(r.storedAt).toDateString()!==/* @__PURE__ */(new Date).toDateString())return null;const s=r.payload;return s&&!Array.isArray(s)&&Array.isArray(s.times)?{lat:s.lat,lon:s.lon,times:s.times.map(e=>new Date(e)),cloudCover:s.cloudCover??[],cloudLow:s.cloudLow??[],cloudMid:s.cloudMid??[],cloudHigh:s.cloudHigh??[],shortwave:s.shortwave??[]}:null}catch{return null}}(s,l,n);if(d)return d;const c=cacheKey(s,l,n),u=mt.get(c);if(u)return u;const p=(async()=>{const e=function pickModelsForLocation(e,t,i){if("standard"===i)return["best_match"];const n="ecmwf_ifs025";return e>=41.3&&e<=51.2&&t>=-5.5&&t<=8.5?["meteofrance_seamless",n]:e>=49.5&&e<=61&&t>=-10.5&&t<=2?["ukmo_seamless",n]:e>=46&&e<=56&&t>=5&&t<=22?["dwd_icon_seamless",n]:e>=36.5&&e<=47&&t>=10&&t<=18.5?["italia_meteo_arpae_icon_2i",n]:e>=54.5&&e<=71.5&&t>=4&&t<=32?["metno_seamless",n]:e>=24.5&&e<=49.5&&t>=-125&&t<=-66.5?["gfs_seamless",n]:e>=33&&e<=39&&t>=124.5&&t<=132?["kma_seamless",n]:e>=24&&e<=46&&t>=122&&t<=146?["jma_seamless",n]:e>=-47.5&&e<=-10&&t>=112&&t<=179?["bom_access_global",n]:[n,"gfs_seamless"]}(s,l,n);let t=`https://api.open-meteo.com/v1/forecast?latitude=${s.toFixed(3)}&longitude=${l.toFixed(3)}&hourly=${ft.join(",")}&models=${e.join(",")}&past_days=5&forecast_days=3&timezone=auto`;void 0!==i&&(t+=`&elevation=${i.toFixed(0)}`);try{const i=await fetch(t,{signal:r});if(!i.ok){if(429===i.status){const e=/* @__PURE__ */new Error("Open-Meteo rate limit (HTTP 429)");throw e.status=429,e}return null}const c=await i.json(),u=Array.isArray(c)?c[0]:c,p=(u?.hourly?.time??[]).map(e=>new Date(e)),g=fillCloud(readSeries(u,"cloud_cover_low",e)),m=fillCloud(readSeries(u,"cloud_cover_mid",e)),f=fillCloud(readSeries(u,"cloud_cover_high",e)),b={lat:s,lon:l,times:p,cloudCover:g.map((e,t)=>{const i=Math.max(0,Math.min(100,e??0)),n=Math.max(0,Math.min(100,m[t]??0)),r=Math.max(0,Math.min(100,f[t]??0));return Math.min(100,i+.6*n+.2*r)}),cloudLow:g,cloudMid:m,cloudHigh:f,shortwave:(d=readSeries(u,"shortwave_radiation_instant",e),d.map(e=>null==e?-1:e))};return function writeCache(e,t,i,n){try{const r={storedAt:Date.now(),payload:{lat:n.lat,lon:n.lon,times:n.times.map(e=>e.toISOString()),cloudCover:n.cloudCover,cloudLow:n.cloudLow,cloudMid:n.cloudMid,cloudHigh:n.cloudHigh,shortwave:n.shortwave}};window.localStorage?.setItem(cacheKey(e,t,i),JSON.stringify(r))}catch{}}(s,l,n,b),b}catch(c){if(c&&"object"==typeof c&&429===c.status)throw c;return null}var d})();mt.set(c,p);try{return await p}finally{mt.delete(c)}}function resolveWeatherAtTime(e,t){const i={cloudCover:0,cloudLow:0,cloudMid:0,cloudHigh:0,shortwave:-1};if(!e||!e.times.length)return i;const n=function findHourIndex(e,t){if(!e.length)return 0;const i=t.getTime();let n=0,r=Math.abs(e[0].getTime()-i);for(let s=1;s<e.length;s++){const t=Math.abs(e[s].getTime()-i);if(t<r)r=t,n=s;else if(t>r)break}return n}(e.times,t);return n<0||n>=e.times.length?i:{cloudCover:e.cloudCover[n]??0,cloudLow:e.cloudLow[n]??0,cloudMid:e.cloudMid[n]??0,cloudHigh:e.cloudHigh[n]??0,shortwave:e.shortwave[n]??-1}}function clusterScaleRamp(e,t){if(!Number.isFinite(e)||e<=0)return 1;return e<=600?1:e>=1200?t:1+(t-1)*(e-600)/600}var bt=/* @__PURE__ */new Map,vt=6e5;var yt=class HeliosEngine{_clearWeatherTimer(){void 0!==this._weatherTimer&&(window.clearInterval(this._weatherTimer),window.clearTimeout(this._weatherTimer),this._weatherTimer=void 0)}setSolarIrradianceSamples(e){if(!e||0===e.length){if(null===this._sensorIrradianceSamples)return;return this._sensorIrradianceSamples=null,this._arcInputsCache=void 0,void this._renderForCurrentSelection()}const t=[];for(const n of e){const e=n.time.getTime();isFinite(e)&&(!isFinite(n.wm2)||n.wm2<0||t.push({tMs:e,wm2:n.wm2}))}t.sort((e,t)=>e.tMs-t.tMs);const i=t.length>0?t:null;this._sensorSamplesEqual(this._sensorIrradianceSamples,i)||(this._sensorIrradianceSamples=i,this._arcInputsCache=void 0,this._renderForCurrentSelection())}_sensorSamplesEqual(e,t){if(e===t)return!0;if(null===e||null===t)return!1;if(e.length!==t.length)return!1;for(let i=0;i<e.length;i++){if(e[i].tMs!==t[i].tMs)return!1;if(e[i].wm2!==t[i].wm2)return!1}return!0}_sensorIrradianceAt(e){const t=this._sensorIrradianceSamples;if(!t||0===t.length)return null;const i=e.getTime();let n=-1,r=Number.POSITIVE_INFINITY;for(let s=0;s<t.length;s++){const e=Math.abs(t[s].tMs-i);if(e<r)r=e,n=s;else if(e>r)break}return n<0||r>HeliosEngine.SENSOR_IRRADIANCE_WINDOW_MS?null:t[n].wm2}_cameraPoseStorageKey(){const e=this.cacheKey.trim();return e?`helios:camera-pose:${e}`:`helios:camera-pose:${Math.round(1e3*this.homeLat)/1e3}:${Math.round(1e3*this.homeLon)/1e3}`}_readStoredPose(){try{const e=window.localStorage.getItem(this._cameraPoseStorageKey());if(!e)return null;const t=JSON.parse(e);if(t&&"object"==typeof t)return t}catch{}return null}_writeStoredPose(e){try{window.localStorage.setItem(this._cameraPoseStorageKey(),JSON.stringify(e))}catch{}}_initialBearing(){const e=this._readStoredPose(),t=e&&"number"==typeof e.bearing?e.bearing:NaN,i=Number(this.cfg["camera-bearing-deg"]),n=Number.isFinite(t)?t:i;return Number.isFinite(n)?(n%360+360)%360:this.homeLat>=0?180:0}_initialPitch(){const e=this._readStoredPose(),t=e&&"number"==typeof e.pitch?e.pitch:NaN,i=Number(this.cfg["camera-pitch-deg"]),n=Number.isFinite(t)?t:i;return Number.isFinite(n)?Math.max(0,Math.min(65,n)):50}isCameraLocked(){return!0===this.cfg["camera-locked"]}persistCameraPose(){this._renderer&&this._writeStoredPose({bearing:this._renderer.getCameraBearing(),pitch:this._renderer.getCameraPitch()})}setHomeAppearance(e,t){this._renderer&&(t?this._renderer.animateHomeTo(e):this._renderer.setHome(e))}getCameraZoom(){return 18}_startAutoRotateLoop(){if(void 0!==this._autoRotateRaf||!this._renderer)return;this._autoRotateLastFrame=performance.now(),this._autoRotateLastUserAction=0,this._autoRotateBearing=this._renderer.getCameraBearing();const tick=e=>{const t=this._renderer;if(!t)return void(this._autoRotateRaf=void 0);if(this._paused)return void(this._autoRotateRaf=void 0);const i=Math.max(0,e-this._autoRotateLastFrame)/1e3;this._autoRotateLastFrame=e;const n=Date.now()-this._autoRotateLastUserAction,r=!0===this.cfg["auto-rotate-enabled"],s=this.isCameraLocked();r&&!s?(n>=5e3?((void 0===this._autoRotateBearing||n-5e3<16)&&(this._autoRotateBearing=t.getCameraBearing()),this._autoRotateBearing-=4*i,t.setCameraBearing(this._autoRotateBearing)):this._autoRotateBearing=t.getCameraBearing(),this._autoRotateRaf=requestAnimationFrame(tick)):this._autoRotateRaf=void 0};this._autoRotateRaf=requestAnimationFrame(tick)}constructor(e,t,i,n,r=!1,s=""){this._fetchLat=0,this._fetchLon=0,this._mapReady=!1,this._homeHourlyData=null,this._selectedTime=null,this._lastAtmosphereAlt=-999,this._lastGroundAlt=-999,this._rateLimitStreak=0,this._otherErrorStreak=0,this._obsW=-1,this._obsH=-1,this._paused=!1,this._sensorIrradianceSamples=null,this.cacheKey="",this._autoRotateLastFrame=0,this._autoRotateLastUserAction=0,this._buildingsData=null,this._buildingsRaw=null,this._buildingsFetchDone=!1,this._buildingsLocKey="",this._grown=!1,this._cachedCanvasCssW=0,this._cachedCanvasCssH=0,this.homeLat=i[1],this.homeLon=i[0],this.homeElevation="number"==typeof n&&Number.isFinite(n)?n:void 0,this.cfg={...t},this._editMode=r,this.cacheKey=s,this._fetchLat=this.homeLat,this._fetchLon=this.homeLon,this._initMapInstance(e)}_initMapInstance(e){this._container=e,this._renderer=new ht(e,{shadow:"#000000",shadowOpacity:this._shadowOpacity()}),this._renderer.setCameraBearing(this._initialBearing()),this._renderer.setCameraPitch(this._initialPitch()),this._resolvePalette(),this._renderer.onAfterDraw=()=>{this.onMapTransform?.()},this._resizeObserver=new ResizeObserver(e=>{const t=e[e.length-1]?.contentRect;if(!t)return;const i=Math.round(t.width),n=Math.round(t.height);i===this._obsW&&n===this._obsH||(this._obsW=i,this._obsH=n,this._cachedCanvasCssW=t.width||this._cachedCanvasCssW,this._cachedCanvasCssH=t.height||this._cachedCanvasCssH,this._arcScaleMemo=void 0)}),this._resizeObserver.observe(e),this._cachedCanvasCssW=e.clientWidth||this._cachedCanvasCssW,this._cachedCanvasCssH=e.clientHeight||this._cachedCanvasCssH,this._bootstrapRenderer(),e.style.touchAction="none",e.style.userSelect="none",e.style.webkitUserSelect="none";let t=!1,i=0,n=0,r=null;const onDown=s=>{if(("mouse"!==s.pointerType||0===s.button)&&null===r&&!this.isCameraLocked()){s.preventDefault(),t=!0,r=s.pointerId,i=s.clientX,n=s.clientY,this._autoRotateLastUserAction=Date.now();try{e.setPointerCapture(s.pointerId)}catch(L){}}},onMove=e=>{if(!t||!this._renderer||e.pointerId!==r)return;const s=e.clientX-i,l=e.clientY-n;i=e.clientX,n=e.clientY,this._autoRotateLastUserAction=Date.now(),this._renderer.setCameraBearing(this._renderer.getCameraBearing()-.35*s);const d=Math.max(0,Math.min(65,this._renderer.getCameraPitch()-.3*l));this._renderer.setCameraPitch(d)},onEnd=i=>{if(i.pointerId===r){t=!1,r=null;try{e.releasePointerCapture(i.pointerId)}catch(L){}this.persistCameraPose()}},onDragStart=e=>{e.preventDefault()};e.addEventListener("pointerdown",onDown),e.addEventListener("pointermove",onMove),e.addEventListener("pointerup",onEnd),e.addEventListener("pointercancel",onEnd),e.addEventListener("dragstart",onDragStart),this._dragRotateHandlers={canvas:e,onDown:onDown,onMove:onMove,onEnd:onEnd,onDragStart:onDragStart},this._refreshWeather()}async _bootstrapRenderer(){const e=this._renderer;if(e){try{await e.setLocation(this.homeLat,this.homeLon,this._groundStyle())}catch(t){}this._renderer===e&&this._onRendererReady()}}_startSkyTimer(){window.clearInterval(this._skyTimer),this._skyTimer=window.setInterval(()=>{this._paused||this._refreshShadowsAndAtmosphere()},6e4)}_onRendererReady(){this._renderer&&(this._mapReady=!0,this._applyBuildings(),this._ensureBuildings(),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere(),this._startSkyTimer(),this._startAutoRotateLoop(),this._homeHourlyData&&this._renderForCurrentSelection())}_resolveMapColor(e,t){return/^(#|rgb)/i.test(e)?e:cssHex(this._container,`--${e}-color`,t)}_groundStyle(){const e=!!this._container&&isDarkFromCss(this._container),t=mapThemeMode(this.cfg);if("custom"===t){const t=defaultGroundPalette(e),i={...t},n=/* @__PURE__ */new Set;for(const e of dt){const r=mapLayerColor(this.cfg,e);r&&(i[e]=this._resolveMapColor(r,t[e])),mapLayerVisible(this.cfg,e)||n.add(e)}return{palette:i,hidden:n}}return{palette:defaultGroundPalette("dark"===t||"light"!==t&&e),hidden:/* @__PURE__ */new Set}}_resolvePalette(){this._renderer?.setPalette({home:cssHex(this._container,"--energy-grid-consumption-color","#488fc2"),neighbor:this._buildingColor(),shadow:cssHex(this._container,"--shadow-color","#000000"),shadowOpacity:this._shadowsEnabled()?this._shadowOpacity():0,neighborOpacity:this._buildingOpacity()}),this._renderer?.setGroundStyle(this._groundStyle())}_shadowsEnabled(){return!1!==this.cfg["shadows-enabled"]}_shadowOpacity(){const e=Number(this.cfg["shadow-opacity"]);return Number.isFinite(e)?Math.max(0,Math.min(1,e)):.32}_getWeatherAtTime(e){return resolveWeatherAtTime(this._homeHourlyData,e)}getTimelineRange(){return this._getTimeRange()}setPeriodDays(e,t){this._periodPastDays=e,this._periodFutureDays=t}_getTimeRange(){const e=this._periodPastDays??2,t=this._periodFutureDays??1,i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const n=i.getTime()-e*fe,r=i.getTime()+(t+1)*fe;return{start:new Date(n),end:new Date(r)}}_renderForCurrentSelection(){if(!this._renderer)return;const e=this._selectedTime??/* @__PURE__ */new Date,t=this._getWeatherAtTime(e),i=computePvPower(e,this.homeLat,this.homeLon,t.cloudCover);let n=-1;t.shortwave>=0&&(n=Math.max(0,Math.min(100,t.shortwave/1e3*100)));const r=this._sensorIrradianceAt(e),s=null!==r?Math.max(0,Math.min(100,r/1e3*100)):-1;let l,d;s>=0?(l=s,d="sensor"):n>=0?(l=n,d="shortwave"):(l=i,d="haurwitz"),this.onWeatherUpdate?.({cloudCover:t.cloudCover,cloudLow:t.cloudLow,cloudMid:t.cloudMid,cloudHigh:t.cloudHigh,timeRange:this._getTimeRange(),isLiveTime:null===this._selectedTime,pvPower:l,pvPowerHaurwitz:i,pvPowerShortwave:n,irradianceSource:d})}_buildingRadiusMeters(){return function displayRadiusM(e){return resolveClampedInt(e,"display-radius",200,0,500)}(this.cfg)}_buildingOpacity(){const e=Number(this.cfg["building-opacity"]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):.5}_buildingClusterRadiusMeters(){const e=Number(this.cfg["building-cluster-radius"]);return!Number.isFinite(e)||e<0?0:Math.min(100,e)}_buildingColor(){return cssHex(this._container,uiColorVar(function buildingColorToken(e){const t=e?.["building-color"];return("string"==typeof t?t.trim():"")||"grey"}(this.cfg),"grey"),"#9e9e9e")}_buildingsLocationKey(){return`${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}`}_ensureBuildings(){if(!this._renderer)return;const e=this._buildingsLocationKey();if(this._buildingsRaw&&this._buildingsLocKey===e)return void this._applyBuildings();const t=function sharedBuildingsCacheGet(e){const t=bt.get(e);return t?Date.now()-t.ts>18e5?(bt.delete(e),null):t.data:null}(e);if(t)return this._buildingsRaw=t,this._buildingsFetchDone=!0,this._buildingsLocKey=e,this._applyBuildings(),this._lastAtmosphereAlt=-999,void this._refreshShadowsAndAtmosphere();this._buildingsAbort?.abort(),this._clearBuildingsRetry();const i=new AbortController;this._buildingsAbort=i,fetchRawBuildings(this.homeLat,this.homeLon,i.signal).then(t=>{if(!i.signal.aborted&&this._renderer){if(null===t)return this._buildingsFetchDone=!0,this._scheduleBuildingsRetry(),void this._applyBuildings();this._buildingsRaw=t,this._buildingsFetchDone=!0,this._buildingsLocKey=e,bt.set(e,{data:t,ts:Date.now()}),this._applyBuildings(),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere()}}).catch(()=>{})}forceBuildingsRefetch(){!function clearBuildingsLocationCache(e,t){try{localStorage.removeItem(cacheKey$1(e,t))}catch(L){}}(this.homeLat,this.homeLon),bt.delete(this._buildingsLocationKey()),this._buildingsRaw=null,this._buildingsFetchDone=!1,this._buildingsLocKey="",this._clearBuildingsRetry(),this._ensureBuildings()}_scheduleBuildingsRetry(){void 0===this._buildingsRetryTimer&&(this._buildingsRetryTimer=window.setTimeout(()=>{this._buildingsRetryTimer=void 0,this._renderer&&this._ensureBuildings()},3e5))}_clearBuildingsRetry(){void 0!==this._buildingsRetryTimer&&(window.clearTimeout(this._buildingsRetryTimer),this._buildingsRetryTimer=void 0)}_applyBuildings(){if(this._renderer){if(null===this._buildingsRaw&&!this._buildingsFetchDone)return this._buildingsData=[],void this._pushRenderableSources();var e;this._buildingsData=function interpretBuildings(e,t){if(0===e.length)return[{footprint:[[-5,-4],[5,-4],[5,4],[-5,4]],height:6,isHome:!0,centerX:0,centerY:0}];let i=e.filter(e=>e.distanceM<=t.radiusM);0===i.length&&(i=[e[0]]),i=i.slice(0,Math.max(0,t.count)),0===i.length&&(i=[e[0]]);const n=i.map(e=>({footprint:e.footprint,height:t.realSize?Math.min(25,e.osmHeightM??6):t.fixedHeightM,isHome:!1,centerX:e.centerX,centerY:e.centerY}));n[0].isHome=!0;const r=n[0],s=Math.max(0,t.clusterRadiusM);if(s>0)for(let l=0;l<n.length;l++){if(0===l)continue;const e=n[l].centerX-r.centerX,t=n[l].centerY-r.centerY;Math.hypot(e,t)<=s&&(n[l].isHome=!0)}return n}(this._buildingsRaw??[],{radiusM:this._buildingRadiusMeters(),count:(e=this.cfg,resolveClampedInt(e,"building-count",50,10,100)),realSize:buildingRealSize(this.cfg),fixedHeightM:buildingFixedHeightM(this.cfg),clusterRadiusM:this._buildingClusterRadiusMeters()}),this._pushRenderableSources()}}_pushRenderableSources(){if(!this._renderer)return;const e=this._buildingsData??[];this._renderer.setBuildings(e),e.length&&!this._grown&&(this._grown=!0,this._editMode||this._renderer.animateGrowth())}_refreshShadowsAndAtmosphere(){if(!this._renderer)return;const{altitude:e,azimuth:t}=getSunPosition(this._selectedTime??/* @__PURE__ */new Date,this.homeLat,this.homeLon);Math.abs(e-this._lastAtmosphereAlt)<1.5||(this._lastAtmosphereAlt=e,this._renderer.setPalette({shadowOpacity:this._shadowsEnabled()?this._shadowOpacity():0}),this._renderer.setSun(t,e),Math.abs(e-this._lastGroundAlt)>=4&&(this._lastGroundAlt=e,this._renderer.setGroundAltitude(e)))}async _refreshWeather(e,t){const i=e??this.homeLat,n=t??this.homeLon;this._fetchAbortController?.abort(),this._fetchAbortController=new AbortController;const r=this._fetchAbortController.signal;this._clearWeatherTimer();try{const e="high";this._homeHourlyData=await fetchHomePointData(i,n,this.homeElevation,e,r),this._renderForCurrentSelection(),this._rateLimitStreak=0,this._otherErrorStreak=0,null!==this._selectedTime||this._paused||(this._weatherTimer=window.setInterval(()=>this._refreshWeather(this._fetchLat,this._fetchLon),vt))}catch(s){if("AbortError"===s.name)return;if(this.onWeatherUpdate?.({cloudCover:0,cloudLow:0,cloudMid:0,cloudHigh:0,timeRange:this._getTimeRange(),isLiveTime:null===this._selectedTime,pvPower:0,pvPowerHaurwitz:0,pvPowerShortwave:-1,irradianceSource:"haurwitz"}),this._paused)return;let e;429===s.status?(e=_e[Math.min(this._rateLimitStreak,_e.length-1)],this._rateLimitStreak++,this._weatherTimer=window.setTimeout(()=>this._refreshWeather(this._fetchLat,this._fetchLon),e)):(e=Se[Math.min(this._otherErrorStreak,Se.length-1)],this._otherErrorStreak++,this._weatherTimer=window.setTimeout(()=>this._refreshWeather(this._fetchLat,this._fetchLon),e))}}resetDataCache(){const e=function clearWeatherCache(){let e=0;try{const t=window.localStorage;if(!t)return 0;const i=[];for(let e=0;e<t.length;e++){const n=t.key(e);n&&n.startsWith("helios-weather-cache:")&&i.push(n)}for(const n of i)t.removeItem(n),e++}catch(L){}return e}();return this._homeHourlyData=null,this._refreshWeather(this._fetchLat,this._fetchLon),e}setPaused(e){this._paused!==e&&(this._paused=e,e?(void 0!==this._skyTimer&&(window.clearInterval(this._skyTimer),this._skyTimer=void 0),this._clearWeatherTimer()):(this._refreshShadowsAndAtmosphere(),this._startAutoRotateLoop(),this._startSkyTimer(),void 0===this._weatherTimer&&this._refreshWeather(this._fetchLat,this._fetchLon)))}isPaused(){return this._paused}isViewportReady(){return this._renderer?.camera.hasViewport??!1}setHome(e,t){e===this.homeLat&&t===this.homeLon||(this.homeLat=e,this.homeLon=t,this._fetchLat=e,this._fetchLon=t,this._renderer?.setLocation(e,t,this._groundStyle()),this._ensureBuildings(),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere(),this._refreshWeather(e,t))}projectHomeLabelLayout(){if(!this._renderer)return null;const e=this._projectScenePoint(this.homeLon,this.homeLat,0);if(!e)return null;const t=this._heliosScale(),i=84*t,n=60*t,r=28*this._clusterLiftScale(),s=e.y-r,l=e.x,d=s-n,c=e.x+i,u=s-n/2,p=e.x-i,g=s+n/2,m=s+n;return{pvLabel:{x:l,y:d},batteryLabel:{x:c,y:u},gridLabel:{x:p,y:s-n/2},groupLabels:[{x:p,y:g},{x:p,y:m},{x:c,y:g},{x:c,y:m}],home:{x:e.x,y:s}}}_heliosScale(){return clusterScaleRamp(Math.min(this._cachedCanvasCssW||1/0,this._cachedCanvasCssH||1/0),1.6)}_clusterLiftScale(){return clusterScaleRamp(Math.min(this._cachedCanvasCssW||1/0,this._cachedCanvasCssH||1/0),2.4)}_sunArcScale(){const e=this._cachedCanvasCssW,t=this._cachedCanvasCssH,i=Math.min(e||1/0,t||1/0),n=this._renderer?this.getCameraZoom():-1,r=this._arcScaleMemo;if(r&&r.w===e&&r.h===t&&r.zoom===n)return r.scale;let s=function steppedArcScale(e){if(!Number.isFinite(e)||e<=0)return 1;const t=600,i=.72;return e<=360?i:e<t?i+.28*(e-360)/240:e>=1200?2.2:1+(2.2-1)*(e-t)/600}(i);if(this._renderer&&Number.isFinite(i)&&i>0){const e=Math.PI/180,t=De,n=De*Math.cos(this.homeLat*e),r=60,l=this._projectScenePoint(this.homeLon,this.homeLat,0);if(l){let e=0;for(let i=0;i<8;i++){const s=i/8*2*Math.PI,d=r*Math.sin(s),c=r*Math.cos(s),u=this._projectScenePoint(this.homeLon+d/n,this.homeLat+c/t,0);if(!u)continue;const p=Math.hypot(u.x-l.x,u.y-l.y);p>e&&(e=p)}const d=e/r;if(d>0){const e=.41*i/d;s=Math.max(.72,Math.min(e/40,6))}}}return this._arcScaleMemo={w:e,h:t,zoom:n,scale:s},s}getSunArcScale(){return this._sunArcScale()}_projectScenePoint(e,t,i){if(!this._renderer)return null;const n=De,r=De*Math.cos(this.homeLat*Math.PI/180),s=(e-this.homeLon)*r,l=(t-this.homeLat)*n;return this._renderer.camera.project3(s,l,i)}projectSunScene(e){if(!this._renderer)return null;const t=this._projectScenePoint(this.homeLon,this.homeLat,0);if(!t)return null;const i=new Date(e);i.setHours(0,0,0,0);const n=9e5,r=this._homeHourlyData?(()=>this._getWeatherAtTime(e)?.cloudCover??0)():0,s=i.getTime(),l=Math.round(r),d=Math.round(100*this._sunArcScale());let c=this._arcInputsCache;if(!c||c.dayStartMs!==s||c.cloudPctInt!==l||c.scaleKey!==d){const e=[];for(let t=0;t<96;t++){const i=new Date(s+t*n),l=this._sunSpherePoint(i);if(!l){e.push(null);continue}const d=this._sensorIrradianceAt(i),c=null!==d?d:computeIrradianceWm2(i,this.homeLat,this.homeLon,r);e.push({lon:l.lon,lat:l.lat,altitudeM:l.altitudeM,altitudeDeg:l.altitudeDeg,wm2:c,belowHorizon:l.altitudeM<0})}c={dayStartMs:s,cloudPctInt:l,scaleKey:d,samples:e},this._arcInputsCache=c}const u=[];for(let M=0;M<96;M++){const e=c.samples[M];if(!e)continue;const t=this._projectScenePoint(e.lon,e.lat,e.altitudeM);t&&u.push({x:t.x,y:t.y,depth:t.depth,altitude:e.altitudeDeg,belowHorizon:e.belowHorizon})}const p=this._sunSpherePoint(e),g=getSunPosition(e,this.homeLat,this.homeLon).altitude,m=this._sensorIrradianceAt(e),f=null!==m?m:computeIrradianceWm2(e,this.homeLat,this.homeLon,r);let b=null;p&&(b=this._projectScenePoint(p.lon,p.lat,p.altitudeM)),b||(b={...t,depth:t.depth});let v=1/0,y=-1/0;for(const M of u)M.depth<v&&(v=M.depth),M.depth>y&&(y=M.depth);b.depth<v&&(v=b.depth),b.depth>y&&(y=b.depth);const w=y-v||1,nearnessOf=e=>(e-v)/w,_=u.map(e=>({x:e.x,y:e.y,altitude:e.altitude,nearness:nearnessOf(e.depth),belowHorizon:e.belowHorizon})),H=function daylightRamp(e,t){return e>=6?1:e<=-6?t:t+(e+6)/12*(1-t)}(g,.25);let j=null,z=null;for(let M=1;M<c.samples.length;M++){const e=c.samples[M-1],t=c.samples[M];if(!e||!t)continue;const i=e.altitudeDeg<ye,r=t.altitudeDeg<ye;if(i===r)continue;const l=e.altitudeDeg-ye,d=t.altitudeDeg-ye-l,u=Math.abs(d)<1e-6?.5:-l/d,p=Math.max(0,Math.min(1,u)),g=e.lon+(t.lon-e.lon)*p,m=e.lat+(t.lat-e.lat)*p,f=this._projectScenePoint(g,m,0);if(!f)continue;const b=this._projectScenePoint(e.lon,e.lat,e.altitudeM),v=this._projectScenePoint(t.lon,t.lat,t.altitudeM),y=b&&v?Math.atan2(v.y-b.y,v.x-b.x):0,w=new Date(s+(M-1+p)*n),_={x:f.x,y:f.y,angleRad:y,time:w};i&&!r?j=_:!i&&r&&(z=_)}return{arc:_,sun:{x:b.x,y:b.y,irradiance:f,altitude:g,nearness:nearnessOf(b.depth)},home:{x:t.x,y:t.y},daylight:H,sunrise:j,sunset:z}}_sunSpherePoint(e){return function sunSpherePoint(e,t,i,n){const r=getSunPosition(e,t,i),s=r.altitude*be,l=r.azimuth*be,d=40*n,c=d*Math.cos(s)*Math.sin(l),u=d*Math.cos(s)*Math.cos(l),p=d*Math.sin(s),g=De;return{lon:i+c/(De*Math.cos(t*be)),lat:t+u/g,altitudeM:p,altitudeDeg:r.altitude}}(e,this.homeLat,this.homeLon,this._sunArcScale())}setSelectedTime(e){this._selectedTime=e,null===e?(this._clearWeatherTimer(),this._paused||(this._weatherTimer=window.setInterval(()=>this._refreshWeather(this._fetchLat,this._fetchLon),vt))):this._clearWeatherTimer(),this._mapReady&&(this._lastAtmosphereAlt=-999,this._renderForCurrentSelection(),this._refreshShadowsAndAtmosphere())}getTimelineSeries(){const e=this._homeHourlyData;if(!e||!e.times.length)return null;const t=e.times.map((t,i)=>{const n=this._sensorIrradianceAt(e.times[i]);if(null!==n)return n;const r=e.shortwave[i]??-1;return r>=0?r:10*computePvPower(e.times[i],this.homeLat,this.homeLon,e.cloudCover[i]??0)}),i=e.times.map((t,i)=>e.cloudLow[i]??0),n=e.times.map((t,i)=>e.cloudMid[i]??0),r=e.times.map((t,i)=>e.cloudHigh[i]??0);return{times:e.times.slice(),irradiance:t,cloudLow:i,cloudMid:n,cloudHigh:r}}updateConfig(e){const t=this._buildingRadiusMeters(),i=this._shadowOpacity(),n=this._shadowsEnabled(),r=!0===this.cfg["auto-rotate-enabled"],s=this.isCameraLocked();this.cfg={...e};const l=!0===this.cfg["auto-rotate-enabled"],d=this.isCameraLocked();if(!l||d||r&&!s||!this._renderer||this._startAutoRotateLoop(),s!==d&&this._renderer&&(this._writeStoredPose({bearing:this._renderer.getCameraBearing(),pitch:this._renderer.getCameraPitch()}),this._renderer.scheduleRedraw()),!this._renderer)return;const c=this._buildingRadiusMeters();this._ensureBuildings(),c!==t&&(this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere());const u=this._shadowOpacity(),p=this._shadowsEnabled();this._resolvePalette(),u===i&&p===n||(this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere()),this._renderer.scheduleRedraw(),this._homeHourlyData&&this._mapReady&&this._renderForCurrentSelection()}cleanup(){if(this._clearWeatherTimer(),window.clearInterval(this._skyTimer),this._fetchAbortController?.abort(),this._buildingsAbort?.abort(),this._clearBuildingsRetry(),this._arcInputsCache=void 0,this._resizeObserver?.disconnect(),void 0!==this._autoRotateRaf&&(cancelAnimationFrame(this._autoRotateRaf),this._autoRotateRaf=void 0),this._dragRotateHandlers){const e=this._dragRotateHandlers;e.canvas.removeEventListener("pointerdown",e.onDown),e.canvas.removeEventListener("pointermove",e.onMove),e.canvas.removeEventListener("pointerup",e.onEnd),e.canvas.removeEventListener("pointercancel",e.onEnd),e.canvas.removeEventListener("dragstart",e.onDragStart)}this._buildingsData=null,this._buildingsRaw=null,this._buildingsFetchDone=!1,this._buildingsLocKey="",this._homeHourlyData=null,this._dragRotateHandlers=void 0;try{this._renderer?.cleanup()}catch(L){}this._renderer=void 0,this._mapReady=!1}};function nearlyEq(e,t){return Math.abs(e-t)<=.25}function pointEq(e,t){return e===t||!(!e||!t)&&(nearlyEq(e.x,t.x)&&nearlyEq(e.y,t.y))}function refreshHud(e){if(e._engine&&!e._engine.isViewportReady())return;const t=e._engine?.projectHomeLabelLayout()??null;(function labelLayoutEq(e,t){return e===t||!(!e||!t)&&pointEq(e.pvLabel,t.pvLabel)&&pointEq(e.batteryLabel,t.batteryLabel)&&pointEq(e.gridLabel,t.gridLabel)&&e.groupLabels.length===t.groupLabels.length&&e.groupLabels.every((e,i)=>pointEq(e,t.groupLabels[i]))&&pointEq(e.home,t.home)})(e._labelLayout,t)||(e._labelLayout=t);const i=e._selectedTime??e._now,n=e._engine?e._engine.projectSunScene(i):null;(function sunSceneEq(e,t){if(e===t)return!0;if(!e||!t)return!1;if(!nearlyEq(e.daylight,t.daylight))return!1;if(!pointEq(e.home,t.home))return!1;if(!nearlyEq(e.sun.x,t.sun.x)||!nearlyEq(e.sun.y,t.sun.y)||!nearlyEq(e.sun.altitude,t.sun.altitude))return!1;if(e.arc.length!==t.arc.length)return!1;for(let i=0;i<e.arc.length;i++){const n=e.arc[i],r=t.arc[i];if(n.belowHorizon!==r.belowHorizon)return!1;if(!nearlyEq(n.x,r.x)||!nearlyEq(n.y,r.y))return!1}return!(null===e.sunrise!=(null===t.sunrise)||e.sunrise&&t.sunrise&&(!nearlyEq(e.sunrise.x,t.sunrise.x)||!nearlyEq(e.sunrise.y,t.sunrise.y))||null===e.sunset!=(null===t.sunset)||e.sunset&&t.sunset&&(!nearlyEq(e.sunset.x,t.sunset.x)||!nearlyEq(e.sunset.y,t.sunset.y)))})(e._sunScene,n)||(e._sunScene=n)}function flowDuration(e,t,i=.4){if(!isFinite(e)||e<=0)return 30;const n=1-Math.min(1,e/t);return 30-(30-i)*(1-n*n*n)}yt.SENSOR_IRRADIANCE_WINDOW_MS=18e5;var kt=["solar-irradiance-entity","display-radius","building-cluster-radius","building-count","building-real-size","building-height","building-opacity","auto-rotate-enabled","camera-locked"];function parseConfigCoord(e){if("number"==typeof e)return isFinite(e)?e:null;if("string"==typeof e){const t=e.trim();if(""===t)return null;const i=Number(t);return isFinite(i)?i:null}return null}var wt=/* @__PURE__ */new WeakMap,_t=null;function getHomeCoords(e,t){const i=t?.config,n=window.__heliosLocationOverride;if(e){const t=wt.get(e);if(t&&t.hassCfg===i&&t.overrideId===n)return t.result}else if(_t&&_t.hassCfg===i&&_t.overrideId===n)return _t.result;const r=function _resolveHomeCoords(e,t,i){if(i&&"number"==typeof i.lat&&"number"==typeof i.lon&&isFinite(i.lat)&&isFinite(i.lon))return{lat:i.lat,lon:i.lon};const n=parseConfigCoord(e?.["home-latitude"]),r=parseConfigCoord(e?.["home-longitude"]);if(null!==n&&null!==r&&n>=-90&&n<=90&&r>=-180&&r<=180)return{lat:n,lon:r};const s=t?.latitude,l=t?.longitude;return"number"!=typeof s||"number"!=typeof l?null:{lat:s,lon:l}}(e,i,n),s={hassCfg:i,overrideId:n,result:r};return e?wt.set(e,s):_t=s,r}var St=/* @__PURE__ */new WeakMap;function computeConfigSig(e){if(!e)return"";const t=St.get(e);if(void 0!==t)return t;const i=kt.map(t=>`${t}=${e[t]??""}`).join("|");return St.set(e,i),i}function initEngine(e){e._initInflight=!0,function scheduleEngineInit(e){requestAnimationFrame(()=>{const t=e;if(!t.isConnected)return void(e._initInflight=!1);const i=t.shadowRoot?.getElementById("map-container");if(!i||!e.config||!e.hass?.config)return void(e._initInflight=!1);const n=getHomeCoords(e.config,e.hass);if(!n)return void(e._initInflight=!1);const{lat:r,lon:s}=n,l=e.hass.config.elevation;e._engine=new yt(i,e.config,[s,r],l,!0===e.preview,e.effectiveCacheId?.()??""),function wireEngineCallbacks(e){if(!e._engine)return;e.requestUpdate(),e._engine.onWeatherUpdate=t=>{e._cloudCover=t.cloudCover,e._timeRange=t.timeRange,e._isLiveMode=t.isLiveTime,e._chartSeries=e._engine?.getTimelineSeries()??null,refreshHud(e)};let t=null;e._engine.onMapTransform=()=>{e._engine?.isPaused()||null===t&&(t=requestAnimationFrame(()=>{t=null,refreshHud(e)}))}}(e),e._engine.setPeriodDays(e._periodPastDays,e._periodFutureDays),e._timeRange||(e._timeRange=e._engine.getTimelineRange()),e._initInflight=!1})}(e)}function startOfDay(e){const t=new Date(e);return t.setHours(0,0,0,0),t}function addDays(e,t){const i=new Date(e);return i.setDate(i.getDate()+t),i}function resolveRangeMs(e){if(!e)return null;const t=e.start.getTime(),i=e.end.getTime(),n=i-t;return n>0?{startMs:t,endMs:i,rangeMs:n}:null}function addWeeks(e,t){return addDays(e,7*t)}function addMonths(e,t){const i=new Date(e);return i.setMonth(i.getMonth()+t),i}function startOfISOWeek(e){const t=startOfDay(e);return addDays(t,-(t.getDay()+6)%7)}function startOfMonth(e){const t=new Date(e);return t.setHours(0,0,0,0),t.setDate(1),t}function buildTimelineModel(e,t,i=7){const n=t.getTime()-e.getTime()||1,r=n/fe;let s,l,d,c,u;if(r<=2.05){s="intraday";const t=n/me,r=[1,2,3,4,6,12].find(e=>t/e<=i)??12,p=Math.ceil((e.getHours()+e.getMinutes()/60+.001)/r)*r;l=new Date(startOfDay(e).getTime()+p*me),d=e=>new Date(e.getTime()+r*me),c=null,u="boundary"}else r<=14.05?(s="days",l=addDays(startOfDay(e),1),d=e=>addDays(e,1),c=e=>startOfDay(e),u="centered"):r<=120.05?(s="weeks",l=startOfISOWeek(addWeeks(e,1)),d=e=>addWeeks(e,1),c=e=>startOfISOWeek(e),u="boundary"):(s="months",l=startOfMonth(addMonths(e,1)),d=e=>addMonths(e,1),c=e=>startOfMonth(e),u="centered");const p="days"===s?Math.max(i,16):i,thin=e=>{const t=Math.max(1,Math.ceil(e.length/p));return e.filter((e,i)=>i%t===0)},g=[];for(let v=l,y=0;v.getTime()<t.getTime()&&y<500;y++){const t=(v.getTime()-e.getTime())/n;t>0&&t<1&&g.push({frac:t,date:new Date(v)}),v=d(v)}let m,f=thin(g);if("boundary"===u)m=f;else{const i=[];let r=c(e);for(let s=0;r.getTime()<t.getTime()&&s<500;s++){const s=d(r),l=s.getTime()-r.getTime()||1;if(Math.min(s.getTime(),t.getTime())-Math.max(r.getTime(),e.getTime())>=.99*l){const t=((r.getTime()+s.getTime())/2-e.getTime())/n;i.push({frac:t,date:new Date(r)})}r=s}m=thin(i)}"months"===s&&(f=m.map(t=>({frac:(t.date.getTime()-e.getTime())/n,date:t.date})).filter(e=>e.frac>0&&e.frac<1));const b=[];if(r>1.05&&r<=8){let i=addDays(startOfDay(e),1);for(let r=0;i.getTime()<t.getTime()&&r<64;r++){const t=(i.getTime()-e.getTime())/n;t>0&&t<1&&b.push(t),i=addDays(i,1)}}return{kind:s,start:e,end:t,separators:f,labels:m,dayBoundaries:b}}function findSunCrossing(e,t,i,n,r){const s=36e5;let l=getSunPosition(new Date(i),e,t).altitude,d=0,c=0,u=!1;for(let p=i+s;p<=n;p+=s){const i=getSunPosition(new Date(p),e,t).altitude;if("rising"===r&&l<=0&&i>0){d=p-s,c=p,u=!0;break}if("setting"===r&&l>0&&i<=0){d=p-s,c=p,u=!0;break}l=i}if(!u)return null;for(let p=0;p<12;p++){const i=(d+c)/2;"rising"===r==getSunPosition(new Date(i),e,t).altitude>0?c=i:d=i}/* @__PURE__ */
return new Date((d+c)/2)}var Ht=null;function renderTimelineNightZones(e){const t=function computeNightIntervals(e){const t=resolveRangeMs(e._timeRange);if(!t)return[];const i=getHomeCoords(e.config,e.hass);if(!i)return[];const{startMs:n,endMs:r,rangeMs:s}=t,l=`${n}|${r}|${i.lat.toFixed(4)}|${i.lon.toFixed(4)}`;if(Ht&&Ht.key===l)return Ht.out;const d=[],c=new Date(n);c.setHours(0,0,0,0),c.setDate(c.getDate()-1);const u=r+864e5;for(;c.getTime()<=u;){const e=c.getTime(),t=e+864e5,n=findSunCrossing(i.lat,i.lon,e,t,"rising"),r=findSunCrossing(i.lat,i.lon,e,t,"setting");n&&d.push({ms:n.getTime(),kind:"sunrise"}),r&&d.push({ms:r.getTime(),kind:"sunset"}),c.setDate(c.getDate()+1)}d.sort((e,t)=>e.ms-t.ms);const p=[];let g=null,m=!1;for(const b of d)"sunset"===b.kind?g=b.ms:(null!==g?(p.push({startMs:g,endMs:b.ms}),g=null):m||p.push({startMs:-1/0,endMs:b.ms}),m=!0);null!==g&&p.push({startMs:g,endMs:1/0});const f=[];for(const b of p){const e=Math.max(b.startMs,n),t=Math.min(b.endMs,r);t>e&&f.push({startPct:(e-n)/s*100,endPct:(t-n)/s*100})}return Ht={key:l,out:f},f}(e);return 0===t.length?K:B`
        ${t.map(e=>B`
            <div
                class="hc-night-zone"
                style="left:${e.startPct.toFixed(2)}%; width:${(e.endPct-e.startPct).toFixed(2)}%"
            ></div>
        `)}
    `}var jt={irradiance:{colorKey:"chip-irradiance-color",iconKey:"chip-irradiance-icon",uiColorDefault:"amber",colorVar:"",fallbackHex:ve,defaultIcon:"mdi:weather-sunny"},production:{colorKey:"chip-production-color",iconKey:"chip-production-icon",uiColorDefault:"orange",colorVar:"--energy-solar-color",fallbackHex:"#ff9800",defaultIcon:"mdi:solar-power"},gridImport:{colorKey:"chip-grid-import-color",iconKey:"chip-grid-import-icon",uiColorDefault:"blue",colorVar:"--energy-grid-consumption-color",fallbackHex:"#488fc2",defaultIcon:"mdi:transmission-tower-export"},gridExport:{colorKey:"chip-grid-export-color",iconKey:"chip-grid-export-icon",uiColorDefault:"deep-purple",colorVar:"--energy-grid-return-color",fallbackHex:"#8353d1",defaultIcon:"mdi:transmission-tower-import"},batteryCharge:{colorKey:"chip-battery-charge-color",iconKey:"chip-battery-charge-icon",uiColorDefault:"pink",colorVar:"--energy-battery-in-color",fallbackHex:"#f06292",defaultIcon:"mdi:battery-charging"},batteryDischarge:{colorKey:"chip-battery-discharge-color",iconKey:"chip-battery-discharge-icon",uiColorDefault:"teal",colorVar:"--energy-battery-out-color",fallbackHex:"#4db6ac",defaultIcon:"mdi:battery"},home:{colorKey:"chip-home-color",iconKey:"chip-home-icon",uiColorDefault:"primary",colorVar:"--primary-color",fallbackHex:"#4caf50",defaultIcon:"mdi:home"}};function chipSlotColor(e,t,i){const n=function chipSlotBaseColor(e,t){const i=jt[t];return i.colorVar?cssHex(e,i.colorVar,i.fallbackHex):i.fallbackHex}(e,i),r=t?.[jt[i].colorKey],s="string"==typeof r?r.trim():"";return s?/^(#|rgb)/i.test(s)?s:cssHex(e,`--${s}-color`,n):n}function chipSlotIcon(e,t,i){const n=e?.[jt[t].iconKey];return("string"==typeof n?n.trim():"")||i||jt[t].defaultIcon}async function fetchHaSolarForecast(e){if(e.hass?.callWS&&!(e._haSolarForecastFetching||e._haSolarForecastLoaded&&Date.now()-(e._haSolarForecastFetchedAt??0)<3e5)){e._haSolarForecastFetchedAt=Date.now(),e._haSolarForecastFetching=!0;try{const t=await async function fetchHeliosSeries(e){const t=e._energyDefaults?.solarForecastEntryIds??[];if(0===t.length)return null;const i=new Date(localMidnightMinusDays(e._periodPastDays)).toISOString(),n=new Date(localMidnightMinusDays(-(e._periodFutureDays+1))).toISOString(),r=await Promise.all(t.map(t=>callWS(e.hass,{type:"helios_forecast/series",entry_id:t,start:i,end:n}).then(e=>e?.points??null).catch(()=>null))),s=/* @__PURE__ */new Map;let l=!1;for(const d of r)if(Array.isArray(d)){l=!0;for(const e of d){const t=Date.parse(e.t);Number.isFinite(t)&&"number"==typeof e.pv_w&&Number.isFinite(e.pv_w)&&s.set(t,(s.get(t)??0)+e.pv_w)}}return l?[...s.entries()].map(([e,t])=>({tMs:e,w:t})).sort((e,t)=>e.tMs-t.tMs):null}(e);e._haSolarForecast=null!==t?t:function mergeSolarForecast(e){if(!e||"object"!=typeof e)return[];const t=/* @__PURE__ */new Map;for(const l of Object.keys(e)){const i=e[l]?.wh_hours;if(i&&"object"==typeof i)for(const e of Object.keys(i)){const n=Date.parse(e);if(!Number.isFinite(n))continue;const r=i[e];"number"==typeof r&&Number.isFinite(r)&&t.set(n,(t.get(n)??0)+r)}}const i=[...t.entries()].map(([e,t])=>({tMs:e,wh:t})).sort((e,t)=>e.tMs-t.tMs),n=[];for(let l=1;l<i.length;l++){const e=i[l].tMs-i[l-1].tMs;Number.isFinite(e)&&e>0&&n.push(e)}let r=me;if(n.length>0){n.sort((e,t)=>e-t);const e=n[Math.floor(n.length/2)];Number.isFinite(e)&&e>0&&(r=e)}const s=me/r;return i.map(e=>({tMs:e.tMs,w:e.wh*s}))}(await callWS(e.hass,{type:"energy/solar_forecast"})),e._haSolarForecastLoaded=!0,e.requestUpdate()}catch(L){e._haSolarForecastLoaded=!0}finally{e._haSolarForecastFetching=!1}}}function forecastWattsAt(e,t){if(0===e.length)return null;let i=0,n=e.length-1,r=-1;for(;i<=n;){const s=Math.trunc((i+n)/2);e[s].tMs<=t?(r=s,i=s+1):n=s-1}if(r<0)return null;const s=e[r],l=e[r+1];if(l&&l.tMs-s.tMs<=54e5&&l.tMs>s.tMs){const e=(t-s.tMs)/(l.tMs-s.tMs),i=e<0?0:e>1?1:e;return s.w+(l.w-s.w)*i}return t>=s.tMs+36e5?null:s.w}function forecastAverageWatts(e,t,i){if(0===e.length||i<=t)return null;const n=18e5;let r=0,s=0;for(let l=t+9e5;l<i;l+=n){const t=forecastWattsAt(e,l);r+=null!==t&&Number.isFinite(t)?Math.max(0,t):0,s++}return s>0?r/s:null}function bucketForMs(e,t,i,n){if(t<e)return-1;const r=Math.floor((t-e)/i);return r>=n?-1:r}function interpolateNullGaps(e){const t=e.length;let i=0;for(;i<t;){if(null!==e[i]){i++;continue}let n=i;for(;n<t&&null===e[n];)n++;const r=i>0?e[i-1]:null,s=n<t?e[n]:null;if(null===r&&null===s)return;if(null===r)for(let t=i;t<n;t++)e[t]=s;else{if(null===s){for(let n=i;n<t;n++)e[n]=r;return}{const t=n-i+1;for(let l=i;l<n;l++){const n=(l-i+1)/t;e[l]=r+(s-r)*n}}}i=n}}function interpolatePastOnly(e,t,i,n,r){const s=bucketForMs(t,i,n,r),l=Math.min(r,s<0?0:s+1);if(l>0){const t=e.slice(0,l);interpolateNullGaps(t);for(let i=0;i<l;i++)e[i]=t[i]}}function buildGridChange(e,t,i,n,r){const s=changeSeriesToWatts(e,t,i,n,r);for(let l=0;l<s.length;l++){const e=s[l];null!==e&&e<0&&(s[l]=0)}return interpolatePastOnly(s,t,r,i,n),s}function changeSig(e){const t=e?.length??0;if(0===t)return"0";const i=e[t-1];return`${t}.${i.endMs}.${i.kwh.toFixed(3)}`}function computeDataVersion(e){const t=/* @__PURE__ */(new Date).toDateString(),i=modeBucketsPerHour(e._timelineMode,e.config),n=`${e._timelineMode}.${e._periodPastDays}.${e._periodFutureDays}`,r=e._chartSeries,s=r?.times.length??0;return`d${t}|w${n}|c${i}|s${0===s?"0":`${s}.${r.times[s-1].getTime()}.${r.irradiance[s-1]??0}`}|pv${changeSig(e._pvChangeSeries)}|bc${changeSig(e._batteryChargeChangeSeries)}|bd${changeSig(e._batteryDischargeChangeSeries)}|gi${changeSig(e._gridImportChangeSeries)}|ge${changeSig(e._gridExportChangeSeries)}|f${e._haSolarForecast?.length??0}`}function buildUnifiedStore(e){const t=modeBucketsPerHour(e._timelineMode,e.config),i=24*t,n=e._periodPastDays,r=n+1+e._periodFutureDays,s=r*i,l=me/t,d={bucketsPerHour:t,bucketsTotal:s,stepMs:l},c=function storeOriginMs(e){return localMidnightMinusDays(e)}(n),u=c+r*fe,p=Date.now(),g=function buildIrradiance(e,t,i,n){const r=new Array(n.bucketsTotal).fill(null),s=e._chartSeries;if(!s||0===s.times.length)return r;const l=new Array(n.bucketsTotal).fill(0),d=new Array(n.bucketsTotal).fill(0);for(let c=0;c<s.times.length;c++){const e=s.times[c].getTime();if(e<t||e>=i)continue;const r=s.irradiance?.[c];if("number"!=typeof r||!Number.isFinite(r)||r<0)continue;const u=bucketForMs(t,e,n.stepMs,n.bucketsTotal);u<0||(l[u]+=r,d[u]+=1)}for(let c=0;c<n.bucketsTotal;c++)d[c]>0&&(r[c]=l[c]/d[c]);return interpolateNullGaps(r),r}(e,c,u,d),m=function buildProduction(e,t,i,n){const r=changeSeriesToWatts(e._pvChangeSeries,t,n.stepMs,n.bucketsTotal,i);for(let s=0;s<r.length;s++){const e=r[s];null!==e&&e<0&&(r[s]=0)}return interpolatePastOnly(r,t,i,n.stepMs,n.bucketsTotal),r}(e,c,p,d),f=function buildForecast(e,t,i,n){const r=new Array(n.bucketsTotal).fill(null),s=e._haSolarForecast;if(!s||0===s.length)return r;const l=n.stepMs>me;for(let d=0;d<n.bucketsTotal;d++){const e=t+d*n.stepMs,c=e+n.stepMs/2;if(c<t||c>=i)continue;const u=l?forecastAverageWatts(s,e,e+n.stepMs):forecastWattsAt(s,c);null!==u&&Number.isFinite(u)&&(r[d]=Math.max(0,u))}return r}(e,c,u,d),b=function buildBattery(e,t,i,n){const r=changeSeriesToWatts(e._batteryChargeChangeSeries,t,n.stepMs,n.bucketsTotal,i),s=changeSeriesToWatts(e._batteryDischargeChangeSeries,t,n.stepMs,n.bucketsTotal,i),l=new Array(n.bucketsTotal).fill(null);for(let d=0;d<n.bucketsTotal;d++){const e=r[d],t=s[d];null===e&&null===t||(l[d]=Math.max(0,e??0)-Math.max(0,t??0))}return interpolatePastOnly(l,t,i,n.stepMs,n.bucketsTotal),l}(e,c,p,d),v=buildGridChange(e._gridImportChangeSeries,c,d.stepMs,d.bucketsTotal,p),y=buildGridChange(e._gridExportChangeSeries,c,d.stepMs,d.bucketsTotal,p);return{storeStartMs:c,storeEndMs:u,bucketsPerHour:t,bucketsPerDay:i,bucketsTotal:s,stepMs:l,builtAtMs:p,dataVersion:computeDataVersion(e),irradiance:g,production:m,forecast:f,battery:b,gridImport:v,gridExport:y}}function valueAt(e,t,i){if(i<t.storeStartMs||i>=t.storeEndMs)return null;const n=(i-t.storeStartMs)/t.stepMs-.5,r=Math.max(0,Math.min(t.bucketsTotal-1,Math.floor(n))),s=Math.max(0,Math.min(t.bucketsTotal-1,r+1)),l=e[r],d=e[s];if(null===l&&null===d)return null;if(null===l)return d;if(null===d)return l;return l+(d-l)*Math.max(0,Math.min(1,n-r))}function sliceForRange(e,t,i){const n=Math.max(e.storeStartMs,t),r=Math.min(e.storeEndMs,i);if(r<=n)return{times:[],production:[],forecast:[]};const s=e.stepMs,l=Math.floor((n-e.storeStartMs)/s),d=[],c=[],u=[];for(let p=e.storeStartMs+l*s+s/2;p<r;p+=s)p<n||(d.push(new Date(p)),c.push(valueAt(e.production,e,p)),u.push(valueAt(e.forecast,e,p)));return{times:d,production:c,forecast:u}}function groupDevices(e,t,i){const n=monitoringGroups(e),r=hiddenDevices(e);return t.devices.filter(e=>""!==e.statConsumption&&n.get(e.statConsumption)===i&&!r.has(e.statConsumption))}function deviceName(e,t){return t.name||String(e?.states?.[t.statConsumption]?.attributes?.friendly_name??"")||t.statConsumption}function deviceIcon(e,t){const i=e?.states?.[t.statConsumption]?.attributes?.icon;return"string"==typeof i&&i||"mdi:flash"}function deviceWindowKwh(e,t,i){if(!e)return 0;let n=0;for(const r of e){const e=(r.startMs+r.endMs)/2;e>=t&&e<=i&&isFinite(r.kwh)&&(n+=Math.abs(r.kwh))}return n}function refreshDeviceConsumption(e){if(!e.hass)return;const t=function groupedDevices(e,t){const i=monitoringGroups(e),n=hiddenDevices(e);return t.devices.filter(e=>""!==e.statConsumption&&i.has(e.statConsumption)&&!n.has(e.statConsumption))}(e.config,e._energyDefaults).map(e=>e.statConsumption);if(0===t.length)return void(e._deviceChangeSeries.size>0&&(e._deviceChangeSeries=/* @__PURE__ */new Map,e.requestUpdate()));const i=localMidnightMinusDays(e._periodPastDays),n=changeRefreshAnchorMs(),r=[...t].sort(),s=`${r.join(",")}|${i}|${n}`;e._deviceChangeFetch.run(s,()=>fetchChangeById(e.hass,r,i,n,e._storeFetchPeriod).then(t=>{if(null===t)return;const i=/* @__PURE__ */new Map;for(const e of r){const n=mergeChangeSeries(t,[e]);null!==n&&i.set(e,n)}e._deviceChangeSeries=i,e.requestUpdate()}))}function interpAt(e,t,i){const n=Math.min(e.length,t.length);if(0===n)return NaN;if(i<=e[0].getTime())return isFinite(t[0])?t[0]:NaN;if(i>=e[n-1].getTime()){const e=t[n-1];return isFinite(e)?e:NaN}let r=0,s=n-1;for(;s-r>1;){const t=Math.trunc((r+s)/2);e[t].getTime()<=i?r=t:s=t}const l=e[r].getTime(),d=e[s].getTime(),c=t[r],u=t[s];if(!isFinite(c)||!isFinite(u))return NaN;const p=d-l;return p<=0?u:c+(u-c)*(i-l)/p}function pvValueAtTime(e,t,i){const n=wattsAtFromChangeSeries(i?e._pvChangeSeriesPerEntity.get(i)??null:e._pvChangeSeries,t);if(null!==n)return{value:Math.max(0,n),unit:"W",isPredicted:!1};if(i)return{value:NaN,unit:"W",isPredicted:!1};const r=e._unifiedStore;if(r){const i=valueAt(r.forecast,r,t);if(null!==i&&i>0){const n=getHomeCoords(e.config,e.hass);return n&&getSunPosition(new Date(t),n.lat,n.lon).altitude<=0?{value:0,unit:"W",isPredicted:!0}:{value:Math.max(0,i),unit:"W",isPredicted:!0}}}return{value:NaN,unit:"W",isPredicted:!1}}function renderBottomChart(e){const t=e._chartTarget??"production";return"production"===t?function renderPvChart(e){const t=e,i=e._timeRange,n=1e3,r=100;if(!i)return B`<svg class="hc-chart-svg" viewBox="0 0 ${n} ${r}" preserveAspectRatio="none"></svg>`;const s=i.start.getTime(),l=i.end.getTime()-s;if(l<=0)return B`<svg class="hc-chart-svg" viewBox="0 0 ${n} ${r}" preserveAspectRatio="none"></svg>`;const d=chipSlotColor(t,e.config,"production"),c=chartIsDark(e)?lerpHexToward(d,"#ffffff",.55):lerpHexToward(d,"#000000",.35),u=i.end.getTime(),p=buildTimelineModel(i.start,i.end).dayBoundaries.map(e=>e*n),g=e._unifiedStore,m=g?sliceForRange(g,s,u):null,xOf=e=>(e.getTime()-s)/l*n,f=[];if(m)for(let E=0;E<m.times.length;E++){const e=m.production[E];null!==e&&isFinite(e)&&f.push({t:m.times[E],v:e})}const b=[];if(m)for(let E=0;E<m.times.length;E++){const e=m.forecast[E];null===e||!isFinite(e)||e<=0||b.push({t:m.times[E],v:e})}let v=1;for(const E of f)E.v>v&&(v=E.v);for(const E of b)E.v>v&&(v=E.v);const yOf=e=>r-90*Math.max(0,Math.min(1,e/v)),y=f.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`);let w="",_="";if(y.length>=2){const e=xOf(f[0].t),t=xOf(f[f.length-1].t);w=`M ${e},100 L ${y.join(" L ")} L ${t},100 Z`,_=`M ${y.join(" L ")}`}const H=e._pvChangeSeriesPerEntity.size>1?Array.from(e._pvChangeSeriesPerEntity.keys()):[],j=[];if(H.length>1&&f.length>=2){const t=e,i=chartIsDark(e),n=H.length,r=f.length,s=[];for(let d=0;d<n;d++){const t=H[d],i=new Array(r).fill(0);for(let n=0;n<r;n++){const r=pvValueAtTime(e,f[n].t.getTime(),t).value;i[n]=isFinite(r)&&r>0?r:0}s.push(i)}const l=new Array(r).fill(0);for(let e=0;e<n;e++){const d=[],c=[];for(let t=0;t<r;t++){let i=0;for(let e=0;e<n;e++)i+=s[e][t];const r=i>0?s[e][t]/i:0,u=l[t],p=u+r*f[t].v;l[t]=p,d.push(`${xOf(f[t].t).toFixed(2)},${yOf(p).toFixed(2)}`),c.push(`${xOf(f[t].t).toFixed(2)},${yOf(u).toFixed(2)}`)}j.push({color:energySolarColor(t,i,e),path:`M ${d.join(" L ")} L ${c.reverse().join(" L ")} Z`})}}let z="";b.length>=2&&(z=`M ${b.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`).join(" L ")}`);const M=e._chartHoverPct;let $=0,C=NaN,D=NaN,A=!1;if(null!==M&&M>=0&&M<=100){$=M/100*n;const e=s+M/100*l,t=f.length>0?f[f.length-1].t.getTime():-1/0;if(f.length>=1&&e<=t){const t=interpAt(f.map(e=>e.t),f.map(e=>e.v),e);isFinite(t)&&(C=yOf(Math.max(0,t)))}if(b.length>=1){const t=interpAt(b.map(e=>e.t),b.map(e=>e.v),e);isFinite(t)&&(D=yOf(Math.max(0,t)))}A=isFinite(C)||isFinite(D)}const R=[];if(A&&null!==M&&j.length>0){const t=s+M/100*l,i=interpAt(f.map(e=>e.t),f.map(e=>e.v),t);if(isFinite(i)&&i>0){const n=H.map(i=>{const n=pvValueAtTime(e,t,i).value;return isFinite(n)&&n>0?n:0}),r=n.reduce((e,t)=>e+t,0);if(r>0){let t=0;for(let s=0;s<H.length;s++)t+=n[s]/r,R.push({y:yOf(t*i),color:energySolarColor(e,chartIsDark(e),s)})}}}return B`
        <svg
            class="hc-chart-svg"
            viewBox="0 0 ${n} ${r}"
            preserveAspectRatio="none"
        >
            ${p.map(e=>G`
                <line
                    class="hc-day-sep"
                    x1="${e.toFixed(2)}" y1="0"
                    x2="${e.toFixed(2)}" y2="${r}"
                ></line>
            `)}
            <g class="hc-chart-grow">
                ${j.length>0?j.map(e=>G`
                        <path
                            d="${e.path}"
                            fill="${e.color}"
                            fill-opacity="0.55"
                        ></path>
                    `):w?G`
                        <path
                            d="${w}"
                            fill="${d}"
                            fill-opacity="0.25"
                        ></path>
                    `:K}
                ${_?G`
                    <path
                        class="hc-chart-line"
                        d="${_}"
                        stroke="${d}"
                    ></path>
                `:K}
                ${z?G`
                    <path
                        class="hc-chart-line hc-chart-predicted"
                        d="${z}"
                        stroke="${c}"
                    ></path>
                `:K}
            </g>
            ${A?G`
                <line
                    class="hc-hover-guide"
                    x1="${$.toFixed(2)}" y1="0"
                    x2="${$.toFixed(2)}" y2="${r}"
                ></line>
            `:K}
        </svg>
        ${A&&isFinite(C)?B`
            <div class="hc-hover-dot-html" style="left: ${($/n*100).toFixed(2)}%; top: ${(C/r*100).toFixed(2)}%; background: ${d};"></div>
        `:K}
        ${A&&isFinite(D)?B`
            <div class="hc-hover-dot-html" style="left: ${($/n*100).toFixed(2)}%; top: ${(D/r*100).toFixed(2)}%; background: ${c};"></div>
        `:K}
        ${R.map(e=>B`
            <div class="hc-hover-dot-html" style="left: ${($/n*100).toFixed(2)}%; top: ${(e.y/r*100).toFixed(2)}%; background: ${e.color};"></div>
        `)}
    `}(e):function renderTargetChart(e,t){const i=e,n=e._unifiedStore,r=e._timeRange,s=1e3,l=100;if(!n||!r)return B`<svg class="hc-chart-svg" viewBox="0 0 ${s} ${l}" preserveAspectRatio="none"></svg>`;const d=r.start.getTime(),c=r.end.getTime(),u=c-d;if(u<=0)return B`<svg class="hc-chart-svg" viewBox="0 0 ${s} ${l}" preserveAspectRatio="none"></svg>`;const xOf=e=>(e-d)/u*s,toPts=(e,t)=>{const i=[];for(let r=0;r<e.length;r++){const s=e[r];if(null===s||!isFinite(s))continue;const l=n.storeStartMs+(r+.5)*n.stepMs;l<d||l>c||i.push({t:l,v:t?t(s):s})}return i},sum=e=>e.reduce((e,t)=>e+t.v,0);let p,g=0,m=null;if("consumption"===t){const t=[];for(let e=0;e<n.production.length;e++){const i=n.production[e],r=n.gridImport[e],s=n.gridExport[e],l=n.battery[e];if(null===i&&null===r&&null===s&&null===l)continue;const u=n.storeStartMs+(e+.5)*n.stepMs;if(u<d||u>c)continue;const p=consumptionLoad(i??0,r??0,s??0,l??0);t.push({t:u,v:p})}p=[{pts:t,color:chipSlotColor(i,e.config,"home")}]}else if("grid"===t){const t=toPts(n.gridImport),r=toPts(n.gridExport);p=[{pts:t,color:chipSlotColor(i,e.config,"gridImport")},{pts:r,color:chipSlotColor(i,e.config,"gridExport")}]}else if("battery"===t){const t=toPts(n.battery,e=>Math.max(0,e)),r=toPts(n.battery,e=>Math.max(0,-e));p=[{pts:t,color:chipSlotColor(i,e.config,"batteryCharge")},{pts:r,color:chipSlotColor(i,e.config,"batteryDischarge")}];let s=0;for(const e of p)for(const t of e.pts)t.v>s&&(s=t.v);const l=e._batterySocPerBankHistory.length>0?e._batterySocPerBankHistory:e._batterySocHistory?[e._batterySocHistory]:[];if(l.length>0){const t=s>0?s/100:1,r=chipSlotColor(i,e.config,"batteryCharge"),u=chipSlotColor(i,e.config,"batteryDischarge"),f=cssHex(i,"--secondary-text-color","#9e9e9e"),flowColorAt=(e,t)=>{const i=Math.floor(((e+t)/2-n.storeStartMs)/n.stepMs),s=i>=0&&i<n.battery.length?n.battery[i]:null;return null===s||Math.abs(s)<5?f:s>0?r:u},b=[];for(const e of l){const i=[];for(let l=0;l<e.times.length;l++){const n=e.times[l].getTime();if(n<d||n>c)continue;const r=e.values[l];void 0!==r&&isFinite(r)&&i.push({t:n,v:Math.max(0,Math.min(100,r))*t})}if(i.length<2)continue;b.push(i);const n=i.length-1,r=[];for(let e=0;e<n;e++)r.push(flowColorAt(i[e].t,i[e+1].t));let s=0;for(let e=1;e<=n;e++)e!==n&&r[e]===r[s]||(p.push({pts:i.slice(s,e+1),color:r[s],lineOnly:!0,dashed:!0,noHoverDot:!0}),s=e)}b.length>0&&(m={banks:b,flowColorAt:flowColorAt}),g=s>0?s:100}}else if("battery-soc"===t){const t=e._batterySocHistory,n=[];if(t)for(let e=0;e<t.times.length;e++){const i=t.times[e].getTime();if(i<d||i>c)continue;const r=t.values[e];void 0!==r&&isFinite(r)&&n.push({t:i,v:r})}p=[{pts:n,color:chipSlotColor(i,e.config,"batteryDischarge")}],g=100}else isGroupTarget(t)?p=groupDevices(e.config,e._energyDefaults,groupOfTarget(t)).map(t=>({pts:toPts(changeSeriesToWatts(e._deviceChangeSeries.get(t.statConsumption)??null,n.storeStartMs,n.stepMs,n.bucketsTotal,Date.now()),e=>Math.abs(e)),color:deviceColorByIndex(i,t.index)})):(p=[{pts:toPts(n.irradiance),color:chipSlotColor(i,e.config,"irradiance")}],g=1e3);let f=g;if(f<=0){f=1;for(const e of p)for(const t of e.pts)t.v>f&&(f=t.v)}const b=10,yOf=e=>l-Math.max(0,Math.min(1,e/f))*(l-b),v=p.map(e=>{if(e.pts.length<2)return{area:"",line:"",color:e.color,dashed:!!e.dashed,total:sum(e.pts)};const t=e.pts.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`),i=xOf(e.pts[0].t),n=xOf(e.pts[e.pts.length-1].t);return{area:e.lineOnly?"":`M ${i},${l} L ${t.join(" L ")} L ${n},${l} Z`,line:`M ${t.join(" L ")}`,color:e.color,dashed:!!e.dashed,total:sum(e.pts)}}),y=[];let w=null,_=null;if("irradiance"===t&&e._chartSeries){const t=e._chartSeries,n=[];for(let e=0;e<t.times.length;e++){const i=t.times[e].getTime();if(i<d||i>c)continue;const r=t.cloudLow[e],s=t.cloudMid[e],l=t.cloudHigh[e];(isFinite(r)||isFinite(s)||isFinite(l))&&n.push({t:i,lo:isFinite(r)?Math.max(0,r):0,mi:isFinite(s)?Math.max(0,s):0,hi:isFinite(l)?Math.max(0,l):0})}if(n.length>=2){const yOfPct=e=>l-Math.max(0,Math.min(1,e/100))*(l-b),e=[{pick:e=>e.lo,color:lerpHexToward(ENERGY_COLOR_cloud(i),"#ffffff",.55)},{pick:e=>e.mi,color:ENERGY_COLOR_cloud(i)},{pick:e=>e.hi,color:lerpHexToward(ENERGY_COLOR_cloud(i),"#000000",.5)}],t=new Array(n.length).fill(0);for(const i of e){const e=[],r=[];for(let s=0;s<n.length;s++){const l=t[s],d=l+i.pick(n[s]);t[s]=d,e.push(`${xOf(n[s].t).toFixed(2)},${yOfPct(d).toFixed(2)}`),r.push(`${xOf(n[s].t).toFixed(2)},${yOfPct(l).toFixed(2)}`)}y.push({area:`M ${e.join(" L ")} L ${r.reverse().join(" L ")} Z`,color:i.color})}w={bands:n,yOfPct:yOfPct,colors:e.map(e=>e.color)}}}let H="";if("irradiance"===t&&n){const e=sliceForRange(n,d,c),t=[];let i=0;for(let n=0;n<e.times.length;n++){const r=e.forecast[n];null===r||!isFinite(r)||r<=0||(t.push({t:e.times[n],v:r}),r>i&&(i=r))}if(t.length>=2&&i>0){const yOfF=e=>l-Math.max(0,Math.min(1,e/i))*(l-b);H=`M ${t.map(e=>`${xOf(e.t.getTime()).toFixed(2)},${yOfF(e.v).toFixed(2)}`).join(" L ")}`,_={pts:t.map(e=>({t:e.t.getTime(),v:e.v})),yOf:yOfF}}}const j=chartIsDark(e),z=chipSlotColor(i,e.config,"irradiance"),M=j?lerpHexToward(z,"#ffffff",.75):lerpHexToward(z,"#000000",.55),$=buildTimelineModel(r.start,r.end).dayBoundaries.map(e=>e*s),C=e._chartHoverPct;let D=0,A=!1;const R=[];if(null!==C&&C>=0&&C<=100){D=C/100*s;const e=d+C/100*u;for(const t of p){if(t.pts.length<1||t.noHoverDot)continue;const i=interpAt(t.pts.map(e=>new Date(e.t)),t.pts.map(e=>e.v),e);isFinite(i)&&(R.push({y:yOf(Math.max(0,i)),color:t.color}),A=!0)}if(m)for(const t of m.banks){if(t.length<1)continue;const i=interpAt(t.map(e=>new Date(e.t)),t.map(e=>e.v),e);isFinite(i)&&(R.push({y:yOf(Math.max(0,i)),color:m.flowColorAt(e,e)}),A=!0)}if(_&&_.pts.length>=1){const t=interpAt(_.pts.map(e=>new Date(e.t)),_.pts.map(e=>e.v),e);isFinite(t)&&t>0&&(R.push({y:_.yOf(t),color:M}),A=!0)}if(w&&w.bands.length>=1){const t=w.bands.map(e=>new Date(e.t)),i=interpAt(t,w.bands.map(e=>e.lo),e),n=interpAt(t,w.bands.map(e=>e.mi),e),r=interpAt(t,w.bands.map(e=>e.hi),e),s=[isFinite(i)?i:0,(isFinite(i)?i:0)+(isFinite(n)?n:0),(isFinite(i)?i:0)+(isFinite(n)?n:0)+(isFinite(r)?r:0)],l=[isFinite(i),isFinite(n),isFinite(r)];for(let e=0;e<3;e++)l[e]&&(R.push({y:w.yOfPct(s[e]),color:w.colors[e]}),A=!0)}}return B`
        <svg class="hc-chart-svg" viewBox="0 0 ${s} ${l}" preserveAspectRatio="none">
            ${$.map(e=>G`
                <line class="hc-day-sep" x1="${e.toFixed(2)}" y1="0" x2="${e.toFixed(2)}" y2="${l}"></line>
            `)}
            <g class="hc-chart-grow">
                ${v.map(e=>e.area?G`
                    <path d="${e.area}" fill="${e.color}" fill-opacity="0.22"></path>
                `:K)}
                ${v.map(e=>e.line?G`
                    <path class="hc-chart-line" d="${e.line}" stroke="${e.color}" stroke-dasharray="${e.dashed?"4 3":"none"}"></path>
                `:K)}
                ${y.map(e=>G`
                    <path d="${e.area}" fill="${e.color}" fill-opacity="0.35"></path>
                `)}
                <!--  Forecast silhouette drawn LAST so it reads as a ghosted reference on top of the target's
                      own fill + the cloud overlay, instead of being buried under them.  -->
                ${H?G`
                    <path class="hc-chart-line hc-chart-predicted" d="${H}" stroke="${M}" stroke-width="2" fill="none"></path>
                `:K}
            </g>
            ${A?G`
                <line class="hc-hover-guide" x1="${D.toFixed(2)}" y1="0" x2="${D.toFixed(2)}" y2="${l}"></line>
            `:K}
        </svg>
        ${R.map(e=>B`
            <div class="hc-hover-dot-html" style="left: ${(D/s*100).toFixed(2)}%; top: ${(e.y/l*100).toFixed(2)}%; background: ${e.color};"></div>
        `)}
    `}(e,t)}function chartAccentColor(e){const t=e,i=e._chartTarget??"production";if("production"===i)return chipSlotColor(t,e.config,"production");if("consumption"===i)return chipSlotColor(t,e.config,"home");if("irradiance"===i)return chipSlotColor(t,e.config,"irradiance");if("battery-soc"===i)return chipSlotColor(t,e.config,"batteryDischarge");if(isGroupTarget(i))return function groupColorHex(e,t,i){const n=cssHex(e,`--graph-color-${i}`,Ae[(i-1)%Ae.length]),r=monitoringGroupColorToken(t,i);return r?/^(#|rgb)/i.test(r)?r:cssHex(e,`--${r}-color`,n):n}(t,e.config,groupOfTarget(i));const n=e._unifiedStore,r=e._timeRange;if(!n||!r)return chipSlotColor(t,e.config,"grid"===i?"gridImport":"batteryDischarge");const s=r.start.getTime(),l=r.end.getTime(),sumArr=(e,t)=>{let i=0;for(let r=0;r<e.length;r++){const d=e[r];if(null===d||!isFinite(d))continue;const c=n.storeStartMs+(r+.5)*n.stepMs;c<s||c>l||(i+=t?t(d):d)}return i};return"grid"===i?sumArr(n.gridImport)>=sumArr(n.gridExport)?chipSlotColor(t,e.config,"gridImport"):chipSlotColor(t,e.config,"gridExport"):sumArr(n.battery,e=>Math.max(0,e))>=sumArr(n.battery,e=>Math.max(0,-e))?chipSlotColor(t,e.config,"batteryCharge"):chipSlotColor(t,e.config,"batteryDischarge")}function renderTimelineDayLabels(e){if(!e._timeRange)return K;const{start:t,end:i}=e._timeRange,n=buildTimelineModel(t,i),r=n.labels.filter(e=>e.frac>.02&&e.frac<.98),s=n.separators.filter(e=>e.frac>.02&&e.frac<.98),l=/* @__PURE__ */new Date;l.setHours(0,0,0,0);return B`
        <div class="tb-day-strip">
            ${s.map(e=>B`
                <div class="tb-day-strip-sep" style="left:${(100*e.frac).toFixed(2)}%"></div>
            `)}
            ${r.map(t=>B`
                <span
                    class="tb-day-strip-date ${(e=>"days"===n.kind&&e.getTime()===l.getTime())(t.date)?"is-today":""}"
                    style="left:${(100*t.frac).toFixed(2)}%"
                >${function formatTimelineLabel(e,t,i){const n=i?.language||void 0,r="intraday"===e?{hour:"2-digit",minute:"2-digit"}:"days"===e?{weekday:"short"}:"weeks"===e?{day:"numeric",month:"short"}:{month:"short"};try{return new Intl.DateTimeFormat(n,r).format(t)}catch(L){return new Intl.DateTimeFormat(void 0,r).format(t)}}(n.kind,t.date,e.hass)}</span>
            `)}
        </div>
    `}function renderTimelineHoverTooltip(e){const t=resolveRangeMs(e._timeRange),i=e._chartSeries;if(!t)return K;const{startMs:n,rangeMs:r}=t,s=e._chartHoverPct;if(null===s||s<0||s>100)return K;const l=s,d=n+l/100*r,c=i?interpAt(i.times,i.irradiance,d):NaN,u=i?interpAt(i.times,i.cloudLow,d):NaN,p=i?interpAt(i.times,i.cloudMid,d):NaN,g=i?interpAt(i.times,i.cloudHigh,d):NaN,m=pvValueAtTime(e,d),f=e._chartTarget??"production",b=e._unifiedStore,v=b?valueAt(b.gridImport,b,d)??NaN:NaN,y=b?valueAt(b.gridExport,b,d)??NaN:NaN,w=b?valueAt(b.battery,b,d)??NaN:NaN,_=b?valueAt(b.production,b,d)??NaN:NaN,H=b?valueAt(b.forecast,b,d)??NaN:NaN,j=isFinite(_)||isFinite(v)||isFinite(y)||isFinite(w),z=consumptionLoad(isFinite(_)?_:0,isFinite(v)?v:0,isFinite(y)?y:0,isFinite(w)?w:0),M=e._batterySocHistory?interpAt(e._batterySocHistory.times,e._batterySocHistory.values,d):NaN,$=valueDecimals(e.config),C=powerUnit(e.config),D=irradianceUnit(e.config),kw=t=>formatPower(e.hass,t,$,C),A=e._pvChangeSeriesPerEntity,R=A.size>1?Array.from(A.keys()):[],E=[];for(let B=0;B<R.length;B++){const t=R[B],i=pvValueAtTime(e,d,t);if(!isFinite(i.value))continue;const n=formatPower(e.hass,pvNormalizeToWatts(i.value,i.unit),$,C);E.push({id:t,label:solarSourceName(e,B),valueText:n,colorIdx:B})}const T=isFinite(m.value),O=String(e.hass?.language??"").toLowerCase().startsWith("fr")?"Prévision":"Forecast",L=targetLabel(e,f),P=pickTranslations(e.hass?.language).cloudCover,F=function gridImportName(e){return e._energyDefaults.gridName||statFriendly(e,e._energyDefaults.gridStatEnergyFroms)}(e),I=function gridExportName(e){return e._energyDefaults.gridName||statFriendly(e,e._energyDefaults.gridStatEnergyTos)}(e),U=function batteryChargeName(e){return e._energyDefaults.batteryName||statFriendly(e,e._energyDefaults.batteryStatEnergyTos)}(e),W=function batteryDischargeName(e){return e._energyDefaults.batteryName||statFriendly(e,e._energyDefaults.batteryStatEnergyFroms)}(e),G=e,q=isGroupTarget(f)?groupDevices(e.config,e._energyDefaults,groupOfTarget(f)).map(t=>{const i=wattsAtFromChangeSeries(e._deviceChangeSeries.get(t.statConsumption)??null,d);return{w:null===i?NaN:Math.abs(i),color:deviceColorByIndex(G,t.index),name:deviceName(e.hass,t),icon:deviceIcon(e.hass,t)}}):[],Z=ENERGY_COLOR_cloud(G),Y=lerpHexToward(Z,"#ffffff",.55),J=lerpHexToward(Z,"#000000",.5),X=chipSlotColor(G,e.config,"irradiance"),Q=chartIsDark(e)?lerpHexToward(X,"#ffffff",.75):lerpHexToward(X,"#000000",.55),ee=(e._batterySocPerBankHistory.length>0?e._batterySocPerBankHistory:e._batterySocHistory?[e._batterySocHistory]:[]).map(e=>interpAt(e.times,e.values,d)),te=targetLabel(e,"battery-soc"),ie=!isFinite(w)||Math.abs(w)<5?cssHex(G,"--secondary-text-color","#9e9e9e"):chipSlotColor(G,e.config,w>0?"batteryCharge":"batteryDischarge"),ae=new Date(d),oe=e.hass?.language||void 0,ne=r/fe,re=ne<=2.05?{hour:"2-digit",minute:"2-digit"}:ne<=14.05?{weekday:"short",hour:"2-digit",minute:"2-digit"}:{weekday:"short",day:"numeric",month:"short"},se=new Intl.DateTimeFormat(oe,re).format(ae),le=new Date(ae);le.setHours(0,0,0,0);const de=/* @__PURE__ */new Date;de.setHours(0,0,0,0);const ce=le.getTime()===de.getTime(),ue=d>Date.now();let he=function computeDailyKwhTotals(e){const t=/* @__PURE__ */new Map;if(!e._timeRange)return t;const{start:i,end:n}=e._timeRange,r=i.getTime(),s=n.getTime(),dayKey=e=>{const t=new Date(e);return t.setHours(0,0,0,0),t.getTime()},l=e._pvChangeSeries;if(l&&l.length>0){const e=new Date(r);for(e.setHours(0,0,0,0);e.getTime()<s;){const i=e.getTime(),n=new Date(e);n.setDate(n.getDate()+1);const r=sumChangeForDay(l,i,n.getTime());null!==r&&t.set(i,Math.max(0,r)),e.setTime(n.getTime())}}const d=e._unifiedStore;if(d){const e=Date.now(),i=d.stepMs/me;for(let n=0;n<d.bucketsTotal;n++){const l=d.storeStartMs+(n+.5)*d.stepMs;if(l<r||l>s)continue;if(l<e)continue;const c=d.forecast[n];if(null===c||!isFinite(c)||c<=0)continue;const u=dayKey(l);t.set(u,(t.get(u)??0)+c*i/1e3)}}return t}(e).get(le.getTime());ce&&!ue&&"number"==typeof e._haSolarTodayKwh&&isFinite(e._haSolarTodayKwh)&&(he=e._haSolarTodayKwh);const pe=ue&&void 0!==he&&isFinite(he)&&he>=.05,ge=void 0!==he&&isFinite(he)&&he>=.05?formatEnergyKwh(e.hass,he,$,C):"",be=Date.now(),ve=be>=n&&be<=n+r&&Math.abs(l-(be-n)/r*100)<=1.2,ye=(e.hass?.language||"").toLowerCase().startsWith("fr")?"Retour au live":"Back to live";return B`
        <div
            class="tb-hover-tooltip-tail ${ve?"is-magnet-snap":""}"
            style="left:${l.toFixed(2)}%"
        ></div>
        <div
            class="tb-hover-tooltip-wrapper"
            style="left:${l.toFixed(2)}%; transform: translateX(-${l.toFixed(2)}%)"
        >
            <div class="tb-hover-tooltip">
                <div class="tb-hover-tooltip-time">
                    <ha-icon class="tb-hover-tooltip-time-icon" icon="mdi:clock-outline"></ha-icon>
                    <span class="tb-hover-tooltip-time-label">${se}</span>
                    <span
                        class="tb-hover-tooltip-live-chip ${ve?"is-visible":""}"
                        aria-label=${ye}
                        aria-hidden=${ve?"false":"true"}
                    >
                        <ha-icon class="tb-hover-tooltip-live-chip-dot" icon="mdi:circle-medium"></ha-icon>
                        <span class="tb-hover-tooltip-live-chip-label">${"Live"}</span>
                    </span>
                    <span class="tb-hover-tooltip-exact">${function formatHaDateTime(e,t){return formatWithHaLocale(e,t,{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}(e.hass,ae)}</span>
                </div>
                ${"production"===f?B`
                    ${pe&&ge?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${Q}" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-name">${O}</span>
                            <span class="tb-hover-tooltip-value">${ge}</span>
                        </div>
                    `:K}
                    ${T?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${m.isPredicted?Q:chipSlotColor(G,e.config,"production")}" icon=${m.isPredicted?"mdi:crystal-ball":chipSlotIcon(e.config,"production","mdi:solar-power")}></ha-icon>
                            <span class="tb-hover-tooltip-name">${m.isPredicted?O:L}</span>
                            <span class="tb-hover-tooltip-value">${formatPower(e.hass,pvNormalizeToWatts(m.value,m.unit),$,C)}</span>
                        </div>
                    `:K}
                    ${!m.isPredicted&&isFinite(H)&&H>0?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${Q}" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-name">${O}</span>
                            <span class="tb-hover-tooltip-value">${kw(H)}</span>
                        </div>
                    `:K}
                    ${E.map(t=>B`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${energySolarColor(e,chartIsDark(e),t.colorIdx)}"></span>
                            <span class="tb-hover-tooltip-sublabel">${t.label}</span>
                            <span class="tb-hover-tooltip-value">${t.valueText}</span>
                        </div>
                    `)}
                `:K}
                ${"consumption"===f&&j?B`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(G,e.config,"home")}" icon=${chipSlotIcon(e.config,"home","mdi:home-lightning-bolt")}></ha-icon>
                        <span class="tb-hover-tooltip-name">${L}</span>
                        <span class="tb-hover-tooltip-value">${kw(z)}</span>
                    </div>
                `:K}
                ${"grid"===f?B`
                    ${isFinite(v)&&v>=1?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(G,e.config,"gridImport")}" icon=${chipSlotIcon(e.config,"gridImport","mdi:transmission-tower-export")}></ha-icon>
                            <span class="tb-hover-tooltip-name">${F}</span>
                            <span class="tb-hover-tooltip-value">${kw(v)}</span>
                        </div>
                    `:K}
                    ${isFinite(y)&&y>=1?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(G,e.config,"gridExport")}" icon=${chipSlotIcon(e.config,"gridExport","mdi:transmission-tower-import")}></ha-icon>
                            <span class="tb-hover-tooltip-name">${I}</span>
                            <span class="tb-hover-tooltip-value">${kw(y)}</span>
                        </div>
                    `:K}
                `:K}
                ${"battery"===f?B`
                    ${isFinite(w)&&w>=1?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(G,e.config,"batteryCharge")}" icon=${chipSlotIcon(e.config,"batteryCharge","mdi:battery-arrow-up")}></ha-icon>
                            <span class="tb-hover-tooltip-name">${U}</span>
                            <span class="tb-hover-tooltip-value">${kw(w)}</span>
                        </div>
                    `:K}
                    ${isFinite(w)&&w<=-1?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(G,e.config,"batteryDischarge")}" icon=${chipSlotIcon(e.config,"batteryDischarge","mdi:battery-arrow-down")}></ha-icon>
                            <span class="tb-hover-tooltip-name">${W}</span>
                            <span class="tb-hover-tooltip-value">${kw(-w)}</span>
                        </div>
                    `:K}
                    ${ee.map((e,t)=>isFinite(e)?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ie}" icon="mdi:battery"></ha-icon>
                            <span class="tb-hover-tooltip-name">${te}${ee.length>1?` ${t+1}`:""}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,e)))} %</span>
                        </div>
                    `:K)}
                `:K}
                ${"battery-soc"===f&&isFinite(M)?B`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(G,e.config,"batteryDischarge")}" icon="mdi:battery"></ha-icon>
                        <span class="tb-hover-tooltip-name">${L}</span>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,M)))} %</span>
                    </div>
                `:K}
                ${isGroupTarget(f)?q.map(e=>isFinite(e.w)?B`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${e.color}" icon=${e.icon}></ha-icon>
                        <span class="tb-hover-tooltip-name">${e.name}</span>
                        <span class="tb-hover-tooltip-value">${kw(e.w)}</span>
                    </div>
                `:K):K}
                ${"irradiance"===f&&isFinite(c)?B`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(G,e.config,"irradiance")}" icon=${chipSlotIcon(e.config,"irradiance","mdi:white-balance-sunny")}></ha-icon>
                        <span class="tb-hover-tooltip-name">${L}</span>
                        <span class="tb-hover-tooltip-value">${formatIrradiance(e.hass,c,$,D)}</span>
                    </div>
                `:K}
                ${"irradiance"===f&&isFinite(H)&&H>0?B`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${Q}" icon="mdi:crystal-ball"></ha-icon>
                        <span class="tb-hover-tooltip-name">${O}</span>
                        <span class="tb-hover-tooltip-value">${kw(H)}</span>
                    </div>
                `:K}
                ${"irradiance"===f?B`
                    ${isFinite(g)?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${J}" icon="mdi:format-vertical-align-top"></ha-icon>
                            <span class="tb-hover-tooltip-name">${P.cloudHigh}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,g)))} %</span>
                        </div>
                    `:K}
                    ${isFinite(p)?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${Z}" icon="mdi:format-vertical-align-center"></ha-icon>
                            <span class="tb-hover-tooltip-name">${P.cloudMid}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,p)))} %</span>
                        </div>
                    `:K}
                    ${isFinite(u)?B`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${Y}" icon="mdi:format-vertical-align-bottom"></ha-icon>
                            <span class="tb-hover-tooltip-name">${P.cloudLow}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,u)))} %</span>
                        </div>
                    `:K}
                `:K}
            </div>
        </div>
    `}var zt=["group-1","group-2","group-3","group-4"];function groupTarget(e){return`group-${e}`}function isGroupTarget(e){return"string"==typeof e&&e.startsWith("group-")}function groupOfTarget(e){return isGroupTarget(e)?Number(e.slice(6)):0}function statFriendly(e,t){const i=t[0];return i?String(e.hass?.states?.[i]?.attributes?.friendly_name??i):""}function solarSourceName(e,t){const i=e._energyDefaults.solarStatEnergyFroms[t];return i?String(e.hass?.states?.[i]?.attributes?.friendly_name??i):`PV ${t+1}`}var xt={production:"Production",consumption:"Consumption",grid:"Grid",battery:"Battery","battery-soc":"Battery charge",irradiance:"Irradiance"},Mt={production:"Production",consumption:"Consommation",grid:"Réseau",battery:"Batterie","battery-soc":"Charge batterie",irradiance:"Irradiance"};function targetLabel(e,t){const i=String(e.hass?.language??"").toLowerCase();if(isGroupTarget(t)){const n=groupOfTarget(t);return monitoringGroupName(e.config,n)||`${i.startsWith("fr")?"Groupe":"Group"} ${n}`}return(i.startsWith("fr")?Mt:xt)[t]}var chartIsDark=e=>!!e.hass?.themes?.darkMode,$t=96;function slotOf(e){return Math.min(95,Math.floor(4*serverHourFrac(e)))}function fillGaps(e){const t=e.length;if(!e.some(e=>Number.isFinite(e)))return new Array(t).fill(0);const i=e.slice();for(let n=0;n<t;n++){if(Number.isFinite(i[n]))continue;let r=1;for(;!Number.isFinite(e[((n-r)%t+t)%t]);)r++;let s=1;for(;!Number.isFinite(e[(n+s)%t]);)s++;const l=e[((n-r)%t+t)%t];i[n]=l+(e[(n+s)%t]-l)*(r/(r+s))}return i}function expandHourly(e,t){const i=new Array(96);for(let n=0;n<96;n++){const r=Math.max(0,e[Math.floor(n/4)]??0);i[n]=t?r/4:r}return i}function binSlotSum(e,t){const i=new Array($t).fill(0),n=e.stepMs/me,r=9e5;for(let s=0;s<e.bucketsTotal;s++){const l=t[s];if(null===l||!isFinite(l))continue;const d=Math.max(0,l)*n/1e3,c=e.storeStartMs+s*e.stepMs,u=c+e.stepMs;for(let t=c;t<u;){const n=Math.floor(t/r)*r+r,s=Math.min(u,n);i[slotOf(t)]+=d*((s-t)/e.stepMs),t=s}}return i}function buildPeriodData(e,t){if(e._periodHourly)return function buildPeriodDataHourly(e,t){const data=(e,t)=>({unit:e,layers:t}),oneE=e=>({values:expandHourly(e,!0)}),oneA=e=>({values:expandHourly(e,!1)});switch(e){case"production":return data("energy",t.pv.map(e=>oneE(e)));case"consumption":return data("energy",[oneE(t.consumption)]);case"grid":return data("energy",[oneE(t.gridImport),oneE(t.gridExport)]);case"battery":return data("energy",[oneE(t.batteryDischarge),oneE(t.batteryCharge)]);case"battery-soc":return data("percent",[oneA(t.soc)]);default:return data("energy",[])}}(t,e._periodHourly);const i=e._unifiedStore,data=(e,t)=>({unit:e,layers:t});if(modeBucketsPerHour(e._timelineMode,e.config)<1)return data("energy",[]);if("production"===t){if(!i)return data("energy",[]);const t=Date.now(),n=i.stepMs/me,r=9e5,s=e._energyDefaults.solarStatEnergyFroms,l=s.length>=2&&s.every(t=>e._pvChangeSeriesPerEntity.has(t)),d=l?s:s.slice(0,1),c=l?s.map(n=>changeSeriesToWatts(e._pvChangeSeriesPerEntity.get(n)??null,i.storeStartMs,i.stepMs,i.bucketsTotal,t)):1===s.length?[changeSeriesToWatts(e._pvChangeSeries,i.storeStartMs,i.stepMs,i.bucketsTotal,t)]:[],u=d.map(()=>new Array($t).fill(0));for(let e=0;e<i.bucketsTotal&&!(i.storeStartMs+(e+.5)*i.stepMs>t);e++){const t=i.storeStartMs+e*i.stepMs,s=t+i.stepMs;for(let l=0;l<d.length;l++){const d=c[l]?.[e];if(null==d||!(d>0))continue;const p=d*n/1e3;for(let e=t;e<s;){const t=Math.floor(e/r)*r+r,n=Math.min(s,t);u[l][slotOf(e)]+=p*((n-e)/i.stepMs),e=n}}}return data("energy",d.map((e,t)=>({values:u[t]})))}if("battery-soc"===t){const t=e._batterySocHistory,i=new Array($t).fill(0),n=new Array($t).fill(0);if(t)for(let e=0;e<t.times.length;e++){const r=t.values[e];if(!isFinite(r))continue;const s=slotOf(t.times[e].getTime());i[s]+=r,n[s]+=1}return data("percent",[{values:fillGaps(i.map((e,t)=>n[t]?e/n[t]:NaN))}])}if(!i)return data("energy",[]);let n;if("grid"===t)n=[{series:i.gridImport},{series:i.gridExport}];else if("battery"===t){const e=i.battery.map(e=>null===e?null:Math.max(0,e));n=[{series:i.battery.map(e=>null===e?null:Math.max(0,-e))},{series:e}]}else{const e=new Array(i.bucketsTotal).fill(null);for(let t=0;t<i.bucketsTotal;t++){const n=i.production[t],r=i.gridImport[t],s=i.gridExport[t],l=i.battery[t];null===n&&null===r&&null===s&&null===l||(e[t]=consumptionLoad(n??0,r??0,s??0,l??0))}n=[{series:e}]}return data("energy",n.map(e=>({values:binSlotSum(i,e.series)})))}function hourlyOf(e,t){const i=new Array(24).fill(0);for(let n=0;n<24;n++){let r=0;for(let t=0;t<4;t++)r+=Math.max(0,e[4*n+t]??0);i[n]=t?r:r/4}return i}function layerPeriodTotal(e,t){const i="energy"===t.unit,n=hourlyOf(e.values,i);let r=0;for(let s=0;s<24;s++)r+=Math.max(0,n[s]);return i?r:r/24}function buildMetrics(e,t){const i=e._timeRange;if(!i)return[];const n=i.start.getTime(),r=i.end.getTime();if(r<=n)return[];const s=e.hass,l=valueDecimals(e.config),d=powerUnit(e.config),c=irradianceUnit(e.config),u=function windowDays(e,t){return Math.max(1,Math.round((t-e)/fe))}(n,r),energy=e=>formatEnergyKwh(s,e,l,d);if("irradiance"===t){const t=e._unifiedStore,irr=e=>formatIrradiance(s,e,l,c),i=[];if(t){const e=function aggWatts(e,t,i,n){let r=0,s=0,l=0;for(let d=0;d<t.length;d++){const c=t[d];if(null===c||!isFinite(c))continue;const u=e.storeStartMs+(d+.5)*e.stepMs;u<i||u>n||(c>r&&(r=c),s+=c,l++)}return{peak:r,avg:l?s/l:0,count:l}}(t,t.irradiance,n,r);i.push({icon:"mdi:trending-up",value:irr(e.peak)},{icon:"mdi:approximately-equal",value:irr(e.avg)})}return i}if(isGroupTarget(t))return groupDevices(e.config,e._energyDefaults,groupOfTarget(t)).map(t=>({label:deviceName(e.hass,t),value:energy(deviceWindowKwh(e._deviceChangeSeries.get(t.statConsumption),n,r))}));const p=buildPeriodData(e,t);if("battery-soc"===t){const e=function socStats(e){const t=e.layers[0];if(!t)return null;const i=hourlyOf(t.values,!1);let n=1/0,r=0,s=0,l=0;for(const d of i)isFinite(d)&&(d<n&&(n=d),d>r&&(r=d),s+=d,l++);return l?{min:n,avg:s/l,max:r}:null}(p);if(!e)return[];const pct=e=>`${Math.round(e)} %`;return[{icon:"mdi:arrow-down",value:pct(e.min)},{icon:"mdi:approximately-equal",value:pct(e.avg)},{icon:"mdi:arrow-up",value:pct(e.max)}]}if(!p.layers.length)return[];if("grid"===t){const t=layerPeriodTotal(p.layers[0],p),i=p.layers[1]?layerPeriodTotal(p.layers[1],p):0,n=t-i,r=`${n<0?"-":""}${energy(Math.abs(n))}`;return[{icon:chipSlotIcon(e.config,"gridImport","mdi:transmission-tower-import"),value:energy(t)},{icon:chipSlotIcon(e.config,"gridExport","mdi:transmission-tower-export"),value:energy(i)},{icon:"mdi:scale-balance",value:r},{icon:"mdi:calendar-today",value:energy(t/u)}]}if("battery"===t){const t=layerPeriodTotal(p.layers[0],p),i=p.layers[1]?layerPeriodTotal(p.layers[1],p):0;return[{icon:chipSlotIcon(e.config,"batteryCharge","mdi:battery-arrow-down"),value:energy(i)},{icon:chipSlotIcon(e.config,"batteryDischarge","mdi:battery-arrow-up"),value:energy(t)}]}const g=function periodTotal(e){return e.layers.reduce((t,i)=>t+layerPeriodTotal(i,e),0)}(p);return[{icon:"mdi:sigma",value:energy(g)},{icon:"mdi:calendar-today",value:energy(g/u)}]}function tick(e){const t=/* @__PURE__ */new Date,i=e._now;if(t.getMinutes()===i.getMinutes()&&t.getHours()===i.getHours()&&t.getDate()===i.getDate()&&t.getMonth()===i.getMonth()&&t.getFullYear()===i.getFullYear())return;const n=t.getDate()!==i.getDate()||t.getMonth()!==i.getMonth()||t.getFullYear()!==i.getFullYear();if(e._now=t,n&&e._engine){const t=e._engine.getTimelineRange();t&&(e._timeRange=t),e._chartSeries=e._engine.getTimelineSeries()??e._chartSeries}refreshHud(e)}function applyTimelinePointer(e,t){if(!e._timeRange)return;const i=t.currentTarget.getBoundingClientRect(),n=Math.max(0,Math.min(1,(t.clientX-i.left)/i.width)),r=e._timeRange.end.getTime()-e._timeRange.start.getTime(),s=e._timeRange.start.getTime()+n*r,l=Date.now(),d=e._timeRange.start.getTime(),c=e._timeRange.end.getTime();if(l>=d&&l<=c){const n=(l-d)/r,s=i.left+n*i.width,c=t.clientX;if(Math.abs(c-s)<=8)return void(e._isLiveMode&&null===e._selectedTime||(e._selectedTime=null,e._isLiveMode=!0,e._chartHoverPct=null,e._engine?.setSelectedTime(null)))}const u=new Date(s);e._selectedTime&&e._selectedTime.getTime()===u.getTime()||(e._selectedTime=u,e._isLiveMode=!1,e._chartHoverPct=100*n,e._engine?.setSelectedTime(u))}function nextGuardState(e,t){const i=function evaluateGuardHours(e){const t=new Array(e.length).fill(!1);let i=0;for(let l=0;l<e.length;l++){const{exportKwh:n,minW:r}=e[l];null!==n&&null!==r&&(n<=.1||n>=25||(i++,r>-Math.max(50,.2*n*1e3)&&(t[l]=!0)))}const n=[...t];for(let l=0;l<e.length;l++){if(!n[l])continue;const exculpates=t=>{if(t<0||t>=e.length||n[t])return!1;const i=e[t].minW;return null!==i&&i<-50};(exculpates(l-1)||exculpates(l+1))&&(t[l]=!1)}let r=0,s=-2;for(let l=0;l<e.length;l++)t[l]&&l>s+1&&(r++,s=l);return{contradictions:r,realExportHours:i}}(t);if("flagged"!==e.status)return i.contradictions>=3?{...e,status:"flagged",cleanEvals:0}:{...e,status:"healthy"};if(i.contradictions>0)return{...e,cleanEvals:0};if(0===i.realExportHours)return e;const n=e.cleanEvals+1;return n>=3?{...e,status:"healthy",cleanEvals:0}:{...e,cleanEvals:n}}function refreshGridGuard(e){const t=e._energyDefaults,i=t?.gridStatRates??[],n=t?.gridStatEnergyTos??[],r=`${[...i].sort().join(",")}|${[...n].sort().join(",")}`,s=e._gridGuard;if(r!==s.entityKey)return void(e._gridGuard={status:"unknown",cleanEvals:0,fetchKey:"",fetching:!1,entityKey:"",entityKey:r});if(1!==i.length||0===n.length||!e.hass?.callWS)return;if(s.fetching)return;const l=`${r}|${Math.floor(Date.now()/je)*je}`;if(l===s.fetchKey)return;s.fetchKey=l,s.fetching=!0;const d=Date.now(),c=d-864e5,u=i[0],p=t?.invertedRateEntities.includes(u)??!1;Promise.all([callWS(e.hass,{type:"recorder/statistics_during_period",start_time:new Date(c).toISOString(),end_time:new Date(d).toISOString(),statistic_ids:n,period:"hour",types:["change"],units:{energy:"kWh"}}),callWS(e.hass,{type:"recorder/statistics_during_period",start_time:new Date(c).toISOString(),end_time:new Date(d).toISOString(),statistic_ids:[u],period:"hour",types:["min","max"],units:{power:"W"}})]).then(([t,i])=>{const s=function buildGuardHours(e,t,i,n,r){const s=/* @__PURE__ */new Map,slot=e=>{let t=s.get(e);return t||(t={exportKwh:null,minW:null},s.set(e,t)),t};for(const l of i)for(const t of e?.[l]??[]){const e=parseStatBoundary(t?.start),i="number"==typeof t?.change&&Number.isFinite(t.change)?t.change:null;if(null===e||null===i)continue;const n=slot(e);n.exportKwh=(n.exportKwh??0)+i}for(const l of t?.[n]??[]){const e=parseStatBoundary(l?.start);if(null===e)continue;const t=r?"number"==typeof l?.max&&Number.isFinite(l.max)?-l.max:null:"number"==typeof l?.min&&Number.isFinite(l.min)?l.min:null;null!==t&&(slot(e).minW=t)}return[...s.entries()].sort((e,t)=>e[0]-t[0]).map(([,e])=>e)}(t,i,n,u,p),d=nextGuardState(e._gridGuard,s);if(d!==e._gridGuard){const t=d.status!==e._gridGuard.status;d.fetchKey=l,d.entityKey=r,e._gridGuard=d,t&&e.requestUpdate()}}).catch(()=>{}).finally(()=>{e._gridGuard.fetching=!1})}function applyGridSlot(e,t,i,n){const r=null===i?null:Math.max(0,i);"import"===t?(e._gridImportValue!==r&&(e._gridImportValue=r),e._gridImportUnit!==n&&(e._gridImportUnit=n)):(e._gridExportValue!==r&&(e._gridExportValue=r),e._gridExportUnit!==n&&(e._gridExportUnit=n))}function refreshGrid(e){if(!e.hass)return null!==e._gridImportValue&&(e._gridImportValue=null),""!==e._gridImportUnit&&(e._gridImportUnit=""),null!==e._gridExportValue&&(e._gridExportValue=null),void(""!==e._gridExportUnit&&(e._gridExportUnit=""));fetchGridChangeSeries(e,"import"),fetchGridChangeSeries(e,"export"),refreshGridGuard(e);const t=e._energyDefaults?.gridStatRates??[];t.length>0&&"flagged"!==e._gridGuard.status?function readStatRates(e,t){const{watts:i,any:n}=sumLiveWatts(e.hass,t,e._energyDefaults?.invertedRateEntities);if(!n)return;!function applyGridSplit(e,t){t>=0?(applyGridSlot(e,"import",t,"W"),applyGridSlot(e,"export",null,"")):(applyGridSlot(e,"import",null,""),applyGridSlot(e,"export",-t,"W"))}(e,i)}(e,t):(applyGridSlot(e,"import",null,""),applyGridSlot(e,"export",null,""))}function fetchGridChangeSeries(e,t){const i=e._energyDefaults;if(!i)return;const n="import"===t?i.gridStatEnergyFroms:i.gridStatEnergyTos;if(0===n.length)return;const r=localMidnightMinusDays(e._periodPastDays),s=changeRefreshAnchorMs(),l=[...unionChangeMeters(i)].sort(),d=`${l.join(",")}|${r}|${s}`;("import"===t?e._gridImportFetch:e._gridExportFetch).run(d,()=>fetchChangeById(e.hass,l,r,s,e._storeFetchPeriod).then(i=>{if(null===i)return;const r=mergeChangeSeries(i,n);null!==r&&("import"===t?e._gridImportChangeSeries=r:e._gridExportChangeSeries=r),e.requestUpdate()}))}function formatGridValue(e,t,i,n,r="kW"){return null===t?"":formatEntityValue(e,t,i,n,r)}var Ct,Dt,At=i$6`
    .editor
    {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title
    {
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        margin-top: 10px;
        padding-bottom: 4px;
        border-bottom: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
    }

    /*  Collapsible section. Native <details>/<summary> so open/closed state needs no JS and is
        keyboard-accessible. Default triangle replaced by a custom ::before chevron so the row matches a
        .section-title heading. margin-top separates siblings; first child gets none (editor pads its
        own top). */
    details.advanced-section
    {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 24px;
    }
    details.advanced-section:first-child { margin-top: 0; }
    details.advanced-section > summary
    {
        list-style: none;
        cursor: pointer;
        user-select: none;
    }
    details.advanced-section > summary::-webkit-details-marker { display: none; }
    details.advanced-section > summary.section-title-collapse
    {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        padding-bottom: 6px;
        border-bottom: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.18));
    }
    details.advanced-section > summary.section-title-collapse::before
    {
        content: '▸';
        display: inline-block;
        font-size: 10px;
        line-height: 1;
        transition: transform 120ms ease-out;
    }
    details.advanced-section[open] > summary.section-title-collapse::before
    {
        transform: rotate(90deg);
    }
    /*  Per-section icon between the chevron and label; inherits the section title's tint. */
    .section-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        margin-right: 2px;
        flex-shrink: 0;
    }

    /*  Help-text margins stack with the section's 14 px flex gap: field-to-help 22 px, help-to-next-field
        34 px (1.5x ratio), so the help reads as attached to the field above it. .hint adds italics. */

    /*  Measured-only status lines (one per configured energy family). */
    .live-status
    {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 6px 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
    }
    .live-status ha-icon
    {
        --mdc-icon-size: 18px;
        flex: none;
    }
    .live-status.is-ok ha-icon   { color: var(--success-color, #4caf50); }
    .live-status.is-warn ha-icon { color: var(--warning-color, #ff9800); }
    .live-status.is-info ha-icon { color: var(--secondary-text-color, #727272); }
    /*  Standalone jump to Home Assistant's Energy config: shown once under the status section and under the
        groups hint, on its own line with a little breathing room above. */
    .live-config-link-row
    {
        margin-top: 10px;
    }
    .live-status-link
    {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-color, #03a9f4);
        text-decoration: none;
    }
    .live-status-link:hover { text-decoration: underline; }
    .live-status-link ha-icon
    {
        --mdc-icon-size: 15px;
        color: var(--primary-color, #03a9f4);
    }

    /*  Always-visible live-data status, pinned above the collapsible sections (its own title, no <details>).
        Its title matches the collapsible sections' flex row so the icon centres on the text (a bare
        .section-title block would baseline-align the icon and sit it too high). */
    .live-data-panel { margin-bottom: 4px; }
    .live-data-panel > .section-title
    {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 0;
    }

    .field-help,
    .hint
    {
        font-size: var(--ha-font-size-xs, 11px);
        color: var(--secondary-text-color, #727272);
        margin: 8px 0 20px 0;
    }
    .hint { font-style: italic; }

    .field-help a       { color: var(--primary-color, #03a9f4); text-decoration: none; }
    .field-help a:hover { text-decoration: underline; }
    .hint a
    {
        color: var(--primary-color, #03a9f4);
        text-decoration: none;
        font-style: normal;
        font-weight: var(--ha-font-weight-medium, 500);
    }
    .hint a:hover { text-decoration: underline; }

    .field
    {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        position: relative;
    }

    /*  Extra gap between two consecutive fields with no help text between them (e.g. the lat/lon pair).
        Only fires when both siblings are .field, so help-separated rows are unaffected. */
    .field + .field
    {
        margin-top: 8px;
    }

    /*  Stacked variant for controls too wide to share a row with their label (e.g. ha-entity-picker). */
    .field.field-block
    {
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
    }

    .field.field-block .label             { flex: none; }
    .field.field-block ha-entity-picker   { width: 100%; }

    .label
    {
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
        flex: 1;
    }

    input[type="number"]
    {
        width: 180px;
        padding: 6px 8px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: var(--ha-border-radius-sm, 4px);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 13px);
    }

    /*  Two-button toggle, sized to match the other inputs for right-edge alignment. */
    .segmented-toggle
    {
        display: inline-flex;
        width: 180px;
        border-radius: var(--ha-border-radius-md, 6px);
        overflow: hidden;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
        background: var(--card-background-color, #fff);
    }

    .seg-option
    {
        flex: 1;
        padding: 7px 10px;
        background: transparent;
        color: var(--primary-text-color, #212121);
        border: none;
        cursor: pointer;
        font-size: var(--ha-font-size-s, 13px);
        font-family: inherit;
        transition: background 0.15s, color 0.15s;
    }

    .seg-option + .seg-option
    {
        border-left: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
    }

    .seg-option:hover:not(.active)
    {
        background: var(--secondary-background-color, rgba(0,0,0,0.04));
    }

    .seg-option.active
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #fff);
    }

    /*  Map theme mode toggle: full width, the four options sharing the row equally, with a gap before the
        per-layer blocks below. */
    .map-mode-toggle
    {
        display: flex;
        width: 100%;
        margin-bottom: var(--ha-space-4, 16px);
    }
    .map-mode-toggle .seg-option
    {
        flex: 1;
        text-align: center;
    }

    /*  Slider variant for ranged values so an out-of-range number can't be entered. Value shown right of
        the track. */
    .slider-row
    {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: 180px;
    }

    .slider-row input[type="range"]
    {
        flex: 1;
        min-width: 0;
        accent-color: var(--primary-color, #03a9f4);
    }

    .slider-value
    {
        font-variant-numeric: tabular-nums;
        font-size: var(--ha-font-size-s, 12px);
        color: var(--secondary-text-color, #727272);
        min-width: 44px;
        text-align: right;
    }

    /*  Reset section: warning stacked above the button so the destructive-action explanation is read
        before the click target. Button right-aligned to match the +Add affordance; danger border + label
        reinforces "this empties data". */
    .reset-warning
    {
        font-size: var(--ha-font-size-xs, 11px);
        line-height: 1.4;
        color: var(--secondary-text-color, #5f6368);
        opacity: 0.85;
        margin-bottom: 8px;
    }
    /*  Shared action button (reset cache / reset options / …): icon + label, tinted by --btn-color (set inline),
        full width so every action button reads as one consistent row. The filled variant inverts to a solid fill
        for a destructive confirm. */
    .action-btn
    {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        /*  Fixed width (fits the longest label), right-aligned so every action button lines up on the right edge. */
        width: 260px;
        max-width: 100%;
        margin-left: auto;
        margin-right: 0;
        box-sizing: border-box;
        white-space: nowrap;
        text-decoration: none;
        background: transparent;
        border: var(--ha-border-width-sm, 1px) solid var(--btn-color, var(--error-color, #ef4444));
        color: var(--btn-color, var(--error-color, #ef4444));
        border-radius: var(--ha-border-radius-sm, 4px);
        padding: 8px 12px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        margin-top: 8px;
    }
    .action-btn ha-icon
    {
        --mdc-icon-size: 18px;
        flex: 0 0 auto;
    }
    .action-btn:hover
    {
        background: color-mix(in srgb, var(--btn-color, #ef4444) 8%, transparent);
    }
    .action-btn:focus-visible
    {
        outline: 2px solid var(--btn-color, #ef4444);
        outline-offset: 2px;
    }
    /*  Filled state (e.g. an armed destructive confirm): solid --btn-color fill so it reads clearly. */
    .action-btn-filled,
    .action-btn-filled:hover
    {
        background: var(--btn-color, var(--error-color, #ef4444));
        color: var(--text-primary-color, #fff);
    }
    /*  Disabled field (a dependent control kept visible but inert, e.g. the No-UI delay when the mode is off). */
    .field-disabled
    {
        opacity: 0.45;
    }
    .field-disabled input
    {
        cursor: not-allowed;
    }

    /*  About section pinned at the editor bottom. Compact rows styled as a soft credits footer, not a
        config section. */
    .about-row
    {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 4px 0;
    }
    .about-row + .about-row { padding-top: 4px; }
    .about-row:first-of-type { padding-top: 8px; }
    .about-label
    {
        font-weight: var(--ha-font-weight-medium, 500);
        color: var(--secondary-text-color, #71717a);
        font-size: var(--ha-font-size-s, 13px);
    }
    /*  Identity rows: label-left, content-right (from about-row's flex container); variants below tune the
        right side (link, plain value, version chip). */
    .about-row-value
    {
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, inherit));
        font-size: var(--ha-font-size-m, 14px);
        font-weight: var(--ha-font-weight-medium, 500);
        color: var(--primary-text-color, #18181b);
        text-align: right;
    }
    .about-row-link
    {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, inherit));
        font-size: var(--ha-font-size-m, 14px);
        font-weight: var(--ha-font-weight-medium, 500);
        color: var(--primary-color, #3b82f6);
        text-decoration: none;
    }
    .about-row-link:hover { text-decoration: underline; }
    .about-row-link ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
    }
    /*  Version chip styled as a link to the matching GitHub release page. */
    .about-version-link
    {
        font-weight: var(--ha-font-weight-bold, 700);
        color: var(--primary-text-color, #18181b);
    }
    .about-version-link:hover { text-decoration: underline; }
    .about-block
    {
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .about-paragraph
    {
        margin: 0;
        font-size: var(--ha-font-size-s, 13px);
        line-height: 1.45;
        color: var(--secondary-text-color, #52525b);
    }
    .about-coffee
    {
        margin-top: 18px;
        padding-top: 14px;
        border-top: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    /*  Device list: one row per dashboard-tracked device, colour dot + name on the left, the group pill and the
        show/hide toggle on the right. Framed as a soft card so the list reads as a distinct block within the
        section. */
    .device-list
    {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
        margin-bottom: 16px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: var(--ha-border-radius-md, 6px);
        overflow: hidden;
    }
    .device-row
    {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
    }
    .device-row + .device-row
    {
        border-top: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.08));
    }
    /*  Device icon tinted in the entity's dashboard colour (set inline), standing in for the old colour dot. */
    .device-icon
    {
        flex: none;
        --mdc-icon-size: 20px;
    }
    .device-row.is-hidden .device-icon,
    .device-row.is-hidden .device-group
    {
        opacity: 0.5;
    }
    .device-name
    {
        flex: 1;
        min-width: 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    /*  When a device is hidden, its row dims. */
    .device-row.is-hidden .device-name
    {
        opacity: 0.5;
    }
    /*  Icon-only state toggles, HA-style: no button chrome. The icon carries the state through colour alone: normal
        text colour when active, the dimmed "disabled" colour when inactive. */
    .device-toggle
    {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        background: none;
        color: var(--disabled-text-color, #bdbdbd);
        cursor: pointer;
        transition: color 0.15s, opacity 0.15s;
        --mdc-icon-size: 22px;
    }
    .device-toggle.active
    {
        color: var(--primary-text-color, #212121);
    }
    .device-toggle:hover:not(:disabled)
    {
        color: var(--primary-color, #03a9f4);
    }
    .device-toggle:disabled
    {
        opacity: 0.4;
        cursor: default;
    }
    .device-toggle:focus-visible
    {
        outline: 2px solid var(--primary-color, #03a9f4);
        outline-offset: 2px;
        border-radius: var(--ha-border-radius-sm, 4px);
    }
    /*  Monitoring-group pill: a small circle showing the group number (1..4) filled in the group's colour, or an
        X in a dim outlined circle for "No group". Click cycles No group -> 1 -> ... -> 4 -> No group. */
    .device-group
    {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 50%;
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
        background: none;
        color: var(--disabled-text-color, #bdbdbd);
        font-size: var(--ha-font-size-xs, 12px);
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: color 0.15s, background 0.15s, border-color 0.15s;
        --mdc-icon-size: 16px;
    }
    .device-group.active
    {
        color: #fff;
        border-color: transparent;
        background: var(--group-pill-color, var(--primary-color, #03a9f4));
    }
    .device-group:hover
    {
        border-color: var(--primary-color, #03a9f4);
    }
    .device-group:focus-visible
    {
        outline: 2px solid var(--primary-color, #03a9f4);
        outline-offset: 2px;
    }
    /*  One group's identity in a framed block: line 1 = badge + name, line 2 = colour + icon pickers (each half). */
    .group-block
    {
        margin-bottom: 8px;
        padding: 8px 10px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: var(--ha-border-radius-md, 6px);
    }
    /*  Breathing room after the last group block before the next field (solar-irradiance entity). */
    .group-block:last-of-type
    {
        margin-bottom: 16px;
    }
    .group-line
    {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .group-line + .group-line
    {
        margin-top: 8px;
    }
    .group-name-badge
    {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        color: #fff;
        font-size: var(--ha-font-size-xs, 12px);
        font-weight: 700;
        line-height: 1;
        background: var(--group-pill-color, var(--primary-color, #03a9f4));
    }
    .group-name-badge ha-icon
    {
        --mdc-icon-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .group-name-input
    {
        flex: 1 1 auto;
        min-width: 0;
        box-sizing: border-box;
        padding: 6px 8px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.2));
        border-radius: var(--ha-border-radius-sm, 4px);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 13px);
        font-family: inherit;
    }
    .group-name-input:focus
    {
        outline: none;
        border-color: var(--primary-color, #03a9f4);
    }
    /*  Chip box (Chips & colours): the chip's name grows to push the on/off toggle to the right edge; the small
        direction label sits before grid/battery's two colour pickers. */
    .chip-box-name
    {
        flex: 1 1 auto;
        min-width: 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
    }
    /*  Chip box body row: an icon picker + a colour picker sharing the width 50/50 (each state gets its own row
        for grid/battery). flex-basis 0 + equal grow makes them the same width regardless of intrinsic content. */
    .chip-body .chip-picker
    {
        flex: 1 1 0;
        min-width: 0;
        width: 0;
    }
    .device-empty
    {
        font-size: var(--ha-font-size-xs, 11px);
        color: var(--secondary-text-color, #727272);
        padding: 4px 0;
    }
`;function __decorateMetadata(e,t){if("object"==typeof Reflect&&"function"==typeof Reflect.metadata)return Reflect.metadata(e,t)}function __decorate(e,t,i,n){var r,s=arguments.length,l=s<3?t:null===n?n=Object.getOwnPropertyDescriptor(t,i):n;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)l=Reflect.decorate(e,t,i,n);else for(var d=e.length-1;d>=0;d--)(r=e[d])&&(l=(s<3?r(l):s>3?r(t,i,l):r(t,i))||l);return s>3&&l&&Object.defineProperty(t,i,l),l}var Rt={land:"Background",water:"Water",wood:"Woodland",grass:"Greenery",sand:"Sand",wetland:"Wetland",ice:"Ice & snow",landuse:"Built-up land",roadMajor:"Major roads",roadMinor:"Minor roads",roadCasing:"Road outline",path:"Paths & tracks",rail:"Railways",building:"Buildings",boundary:"Boundaries"},Et=(Ct=class HeliosCardEditor extends le{constructor(...e){super(...e),this._cfg={},this._pickerReady=!1,this._colorNonce=0,this._openSection=null,this._sliderDebounce=/* @__PURE__ */new Map,this._energyDefaults=Xe,this._energyDefaultsLoaded=!1,this._gridGuard={status:"unknown",cleanEvals:0,fetchKey:"",fetching:!1,entityKey:""},this._onSectionToggleEvt=e=>{const t=e.currentTarget.dataset.section;t&&this._onSectionToggle(t,e)},this._onNumFieldChange=e=>{const t=e.currentTarget.dataset.key;t&&this._numField(t,e)},this._onNumSliderInput=e=>{const t=e.currentTarget.dataset.key;t&&this._numSlider(t,e)},this._onEntityValueChanged=e=>{const t=e.currentTarget.dataset.key;if(!t)return;const i=e.detail.value,n=null==i||""===i,r=n?void 0:i;n&&this._colorNonce++,(this._cfg[t]??void 0)!==(r??void 0)&&this._update(t,r)},this._onBoolToggleClick=e=>{const t=e.currentTarget,i=t.dataset.key;i&&this._update(i,"true"===t.dataset.value)},this._onDeviceToggleClick=e=>{const t=e.currentTarget.dataset.stat;if(!t)return;const i=this._cfg["hidden-devices"],n=Array.isArray(i)?i.filter(e=>"string"==typeof e):[],r=n.includes(t)?n.filter(e=>e!==t):[...n,t];this._update("hidden-devices",r.length?r:void 0)},this._onDeviceGroupClick=e=>{const t=e.currentTarget.dataset.stat;if(!t)return;const i=monitoringGroups(this._cfg),n=(i.get(t)??0)+1,r=n>4?0:n,s={};for(const[l,d]of i)l!==t&&(s[l]=d);r>=1&&(s[t]=r),this._update("monitoring-groups",Object.keys(s).length?s:void 0)},this._solarIrradianceEntityFilter=e=>{if(!e||!e.attributes)return!1;if("irradiance"===e.attributes.device_class)return!0;const t=String(e.attributes.unit_of_measurement??"").trim();return"W/m²"===t||"W/m2"===t},this._onMapModeClick=e=>{const t=e.currentTarget.dataset.value;if(!t||t===mapThemeMode(this._cfg))return;const i={...this._cfg};if("auto"===t?delete i["map-theme-mode"]:i["map-theme-mode"]=t,"custom"===t){const e=defaultGroundPalette(isDarkFromCss(this));for(const t of dt){const n=mapColorKey(t);i[n]||(i[n]=e[t])}}this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i}})),this._cfg=i},this._onGroupNameChanged=e=>{const t=e.currentTarget;t.dataset.group&&this._updateGroupMap("monitoring-group-names",t.dataset.group,t.value.trim())},this._onGroupColorChanged=e=>{e.stopPropagation();const t=e.currentTarget.dataset.group;if(!t)return;const i="string"==typeof e.detail.value?e.detail.value:"";""===i&&this._colorNonce++,this._updateGroupMap("monitoring-group-colors",t,i)},this._onGroupIconChanged=e=>{e.stopPropagation();const t=e.currentTarget.dataset.group;t&&this._updateGroupMap("monitoring-group-icons",t,"string"==typeof e.detail.value?e.detail.value:"")},this._onGroupVisibleClick=e=>{const t=e.currentTarget,i=t.dataset.group;if(!i)return;const n=this._cfg["monitoring-group-hidden"],r=n&&"object"==typeof n&&!Array.isArray(n)?{...n}:{};"true"===t.dataset.value?delete r[i]:r[i]=!0,this._update("monitoring-group-hidden",Object.keys(r).length?r:void 0)},this._resetFeedback=null,this._optionsResetArmed=!1,this._optionsResetFeedback=null}disconnectedCallback(){super.disconnectedCallback(),unsubscribeEnergyPrefs(this);for(const e of this._sliderDebounce.values())window.clearTimeout(e);this._sliderDebounce.clear();for(const e of[this._resetFeedbackTimer,this._optionsResetConfirmTimer,this._optionsResetFeedbackTimer])void 0!==e&&window.clearTimeout(e);this._resetFeedbackTimer=void 0,this._optionsResetConfirmTimer=void 0,this._optionsResetFeedbackTimer=void 0}setConfig(e){if(this._cfg={...e},Dt.LEGACY_KEYS.some(e=>e in this._cfg)&&setTimeout(()=>{if(!this.isConnected)return;const e={...this._cfg};let t=!1;for(const i of Dt.LEGACY_KEYS)i in e&&(delete e[i],t=!0);t&&(this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:e}})),this._cfg=e)},0),!this._cfg["cache-id"]){const e=`c${Date.now().toString(36)}${Math.floor(1e9*Math.random()).toString(36)}`;setTimeout(()=>{this.isConnected&&(this._cfg["cache-id"]||this._update("cache-id",e))},0)}}connectedCallback(){super.connectedCallback(),this._ensureEntityPicker(),subscribeEnergyPrefs(this)}async _ensureEntityPicker(){if(!this._pickerReady)if("undefined"!=typeof customElements&&customElements.get("ha-entity-picker"))this._pickerReady=!0;else try{const e=window;if("function"==typeof e.loadCardHelpers){const t=await e.loadCardHelpers();if(t?.createCardElement){const e=(await t.createCardElement({type:"entities",entities:[]}))?.constructor;"function"==typeof e?.getConfigElement&&await e.getConfigElement()}}"undefined"!=typeof customElements&&await Promise.race([customElements.whenDefined("ha-entity-picker"),new Promise(e=>{setTimeout(e,Dt.PICKER_LOAD_TIMEOUT_MS)})])}catch(e){}finally{this._pickerReady=!0}}_t(){return pickTranslations(this.hass?.language)}updated(){this.hass&&refreshGridGuard(this),this._pruneStaleDeviceIds()}_pruneStaleDeviceIds(){if(!this._energyDefaultsLoaded)return;const e=this._energyDefaults.devices;if(0===e.length)return;const t=new Set(e.map(e=>e.statConsumption)),i=["hidden-devices"],n={...this._cfg};let r=!1;for(const l of i){const e=this._cfg[l];if(!Array.isArray(e))continue;const i=e.filter(e=>"string"==typeof e&&t.has(e));i.length!==e.length&&(r=!0,i.length?n[l]=i:delete n[l])}const s=this._cfg["monitoring-groups"];if(s&&"object"==typeof s&&!Array.isArray(s)){const e={};let i=!1;for(const[n,r]of Object.entries(s))t.has(n)&&"number"==typeof r?e[n]=r:i=!0;i&&(r=!0,Object.keys(e).length?n["monitoring-groups"]=e:delete n["monitoring-groups"])}r&&(this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:n}})),this._cfg=n)}_liveStatusLine(e,t,i){return B`
            <div class="live-status ${e?"is-ok":t?"is-warn":"is-info"}">
                <ha-icon icon=${e?"mdi:check-circle":t?"mdi:alert-circle":"mdi:information-outline"}></ha-icon>
                <span>${i}</span>
            </div>
        `}_energyConfigLink(){return B`
            <a class="live-status-link" href="/config/energy/dashboard" target="_blank" rel="noopener noreferrer">
                <ha-icon icon="mdi:open-in-new"></ha-icon>
                <span>${this._t().editor.openEnergyConfig??"Open Energy configuration"}</span>
            </a>
        `}_renderLiveDataStatus(e){if(!this._energyDefaultsLoaded)return K;const t=this._energyDefaults,i=t.solarStatEnergyFroms.length>0,n=t.gridStatEnergyFroms.length>0||t.gridStatEnergyTos.length>0,r=t.batteryStatEnergyFroms.length>0||t.batteryStatEnergyTos.length>0,s="flagged"===this._gridGuard.status,l=t.solarStatRates.length>0,d=t.gridStatRates.length>0&&!s,c=!batteryLiveIsBucketSourced(t),u=(i||n||r)&&(!i||l)&&(!n||d)&&(!r||c);return B`
            <div class="live-data-panel">
                <div class="section-title"><ha-icon class="section-icon" icon="mdi:list-status"></ha-icon>${e.editor.liveDataTitle??"Configuration status"}</div>
                <div class="hint">${e.editor.liveDataIntro??"Live chips show measured sensors only. Each family needs the optional live power sensor of its energy dashboard source; curves and totals always come from your meters."}</div>

                ${i?this._liveStatusLine(l,!1,l?e.editor.liveSolarOk??"Solar: live power sensor detected.":e.editor.liveSolarMissing??"Solar: no live power sensor, the production chip stays hidden. Add one under Settings > Dashboards > Energy > Solar panels."):this._liveStatusLine(!1,!1,e.editor.liveSolarAbsent??"Solar: not set up in your Energy dashboard. Add solar panels there to get the production chip.")}

                ${n?this._liveStatusLine(d,s,s?e.editor.liveGridMiswired??"Grid: the live power sensor contradicts your meters (it seems to measure a single direction). The chips stay hidden; configure a signed sensor or the Two sensors mode.":d?e.editor.liveGridOk??"Grid: live power sensor detected.":e.editor.liveGridMissing??"Grid: no live power sensor, the import/export chips stay hidden. Add one under Settings > Dashboards > Energy > Grid."):this._liveStatusLine(!1,!1,e.editor.liveGridAbsent??"Grid: not set up in your Energy dashboard. Add the grid there to get the import and export chips.")}

                ${r?this._liveStatusLine(c,!1,c?e.editor.liveBatteryOk??"Battery: live power sensors cover every battery.":e.editor.liveBatteryMissing??"Battery: live power missing on at least one battery, the power chip stays hidden. Add the power sensor(s) under Settings > Dashboards > Energy > Battery."):this._liveStatusLine(!1,!1,e.editor.liveBatteryAbsent??"Battery: not set up in your Energy dashboard. Add a battery there to get the charge and discharge chip.")}

                ${this._liveStatusLine(u,!1,u?e.editor.liveHomeOk??"Home consumption: shown, derived from the live families above.":e.editor.liveHomeNote??"Home consumption: appears once every configured family above has its live sensor.")}

                <div class="live-config-link-row">${this._energyConfigLink()}</div>
            </div>
        `}_update(e,t){const i={...this._cfg};void 0===t?delete i[e]:i[e]=t,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i}})),this._cfg=i}_numField(e,t){const i=t.target.value.trim();if(""===i)return void this._update(e,void 0);const n=parseFloat(i);isFinite(n)&&this._update(e,n)}_numSlider(e,t){const i=parseFloat(t.target.value);if(!isFinite(i))return;this._cfg={...this._cfg,[e]:i};const n=String(e),r=this._sliderDebounce.get(n);void 0!==r&&window.clearTimeout(r);const s=window.setTimeout(()=>{this._sliderDebounce.delete(n),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._cfg}}))},Dt.SLIDER_COMMIT_DELAY_MS);this._sliderDebounce.set(n,s)}_onSectionToggle(e,t){const i=t.currentTarget;i.open?(this._openSection=e,requestAnimationFrame(()=>{i.scrollIntoView({behavior:"smooth",block:"start"})})):this._openSection===e&&(this._openSection=null)}_fmtNum(e,t){return t>=1?String(Math.round(e)):e.toFixed(2)}_renderToggle(e,t,i,n,r,s=!1){const l=this._cfg,d=s?!1!==l[e]:!0===l[e],c=this._t();return B`
                <div class="field">
                    <span class="label">${t}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${d?"active":""}"
                            data-key=${e} data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${n??c.editor.autoRotateOn}</button>
                        <button
                            type="button"
                            class="seg-option ${d?"":"active"}"
                            data-key=${e} data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${r??c.editor.autoRotateOff}</button>
                    </div>
                </div>
                ${i?B`<div class="hint">${i}</div>`:K}`}_renderColorPicker(e,t,i,n){const r=this._cfg;return B`
                <div class="field field-block">
                    <span class="label">${t}</span>
                    ${this._pickerReady?B`
                        ${ge(this._colorNonce,B`<ha-selector
                            .hass=${this.hass}
                            .selector=${{ui_color:{default_color:n}}}
                            .value=${String(r[e]??n)}
                            data-key=${e}
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>`)}
                    `:K}
                </div>
                ${i?B`<div class="field-help">${i}</div>`:K}`}_renderSelect(e,t,i,n,r){const s=this._cfg;return B`
                <div class="field field-block">
                    <span class="label">${t}</span>
                    ${this._pickerReady?B`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{select:{mode:"box",options:i}}}
                            .value=${String(s[e]??n)}
                            data-key=${e}
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    `:K}
                </div>
                <div class="field-help">${r}</div>`}_renderSlider(e,t,i,n,r,s,l="",d=!1){const c=this._cfg[e]??s;return B`
                <label class="field ${d?"field-disabled":""}">
                    <span class="label">${t}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${i}
                            max=${n}
                            step=${r}
                            .value=${String(c)}
                            ?disabled=${d}
                            data-key=${e}
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c),r)}${l}</span>
                    </div>
                </label>`}_renderActionButton(e){const t="action-btn "+(e.filled?"action-btn-filled":""),i=B`<ha-icon icon=${e.icon}></ha-icon><span>${e.label}</span>`;return void 0!==e.href?B`<a class=${t} style="--btn-color:${e.color}" href=${e.href} target="_blank" rel="noopener noreferrer">${i}</a>`:B`<button type="button" class=${t} style="--btn-color:${e.color}" @click=${e.onClick}>${i}</button>`}_renderAboutLink(e,t,i){return B`
                <div class="about-row">
                    <span class="about-label" aria-hidden="true"></span>
                    <a class="about-row-link" href=${i} target="_blank" rel="noopener noreferrer">
                        <ha-icon icon=${e}></ha-icon>
                        <span>${t}</span>
                    </a>
                </div>`}_deviceName(e){return e.name||this.hass?.states?.[e.statConsumption]?.attributes?.friendly_name||e.statConsumption}_deviceIcon(e){const t=this.hass?.states?.[e.statConsumption]?.attributes?.icon;return"string"==typeof t&&t||"mdi:flash"}_orderedDevices(){return[...this._energyDefaults.devices].sort((e,t)=>e.index-t.index||this._deviceName(e).localeCompare(this._deviceName(t),void 0,{sensitivity:"base"}))}_renderDeviceList(e){const t=this._orderedDevices(),i=hiddenDevices(this._cfg),n=monitoringGroups(this._cfg);return B`
            <div class="hint">${e.editor.devicesEnergyNote??"These are the individual devices currently set up in your Home Assistant Energy dashboard. The eye shows or hides each one everywhere, and the pill assigns it to a group."}</div>
            <div class="live-config-link-row">${this._energyConfigLink()}</div>
            ${0===t.length?B`<div class="device-empty">${e.editor.hiddenDevicesEmpty??"No individual devices are tracked in your Energy dashboard yet. Add device consumption there to control them here."}</div>`:B`<div class="device-list">
                    ${t.map(t=>this._renderDeviceRow(t,i,n,e))}
                </div>`}
        `}_renderMapSection(e){const t=mapThemeMode(this._cfg),i=e.mapConfig,opt=(e,i)=>B`
            <button type="button" class="seg-option ${t===e?"active":""}" data-value=${e} @click=${this._onMapModeClick}>${i}</button>`;return B`
            <div class="field-help">${i?.intro??"The basemap is drawn from OpenStreetMap vector tiles. Auto follows your theme, Dark / Light force one, Custom lets you set every colour and hide any layer."}</div>
            <div class="segmented-toggle map-mode-toggle">
                ${opt("auto",i?.modeAuto??"Auto")}
                ${opt("dark",i?.modeDark??"Dark")}
                ${opt("light",i?.modeLight??"Light")}
                ${opt("custom",i?.modeCustom??"Custom")}
            </div>
            ${"custom"===t?dt.map(t=>this._renderMapLayerBlock(e,t)):K}`}_mapLayerLabel(e,t){return e.mapConfig?.[t]??Rt[t]}_renderMapLayerBlock(e,t){const i=mapLayerVisible(this._cfg,t),n=mapLayerColor(this._cfg,t)||defaultGroundPalette(isDarkFromCss(this))[t];return B`
                <div class="group-block">
                    <div class="group-line">
                        <span class="group-name-badge" style="--group-pill-color:${/^(#|rgb)/i.test(n)?n:`var(--${n}-color, #888)`}"></span>
                        <span class="chip-box-name">${this._mapLayerLabel(e,t)}</span>
                        <div class="segmented-toggle">
                            <button type="button" class="seg-option ${i?"active":""}" data-key=${mapShowKey(t)} data-value="true" @click=${this._onBoolToggleClick}>${e.editor.autoRotateOn}</button>
                            <button type="button" class="seg-option ${i?"":"active"}" data-key=${mapShowKey(t)} data-value="false" @click=${this._onBoolToggleClick}>${e.editor.autoRotateOff}</button>
                        </div>
                    </div>
                    ${this._pickerReady?B`
                        <div class="group-line chip-body">
                            ${ge(this._colorNonce,B`<ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ui_color:{}}}
                                .value=${n}
                                data-key=${mapColorKey(t)}
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>`)}
                        </div>`:K}
                </div>`}_renderChipsSection(e){return B`
            <div class="hint">${e.editor.chipsIntro??"Show or hide each entity, and pick its icon and colour. The home follows the selected chip, or your primary colour by default."}</div>
            ${this._renderChipBox(e.editor.chipIrradiance??"Irradiance display","chip-irradiance-visible",["irradiance"])}
            ${this._renderChipBox(e.editor.chipProduction??"Production display","chip-production-visible",["production"])}
            ${this._renderChipBox(e.editor.chipGrid??"Grid display","chip-grid-visible",["gridImport","gridExport"])}
            ${this._renderChipBox(e.editor.chipBattery??"Battery display","chip-battery-visible",["batteryCharge","batteryDischarge"])}
            ${this._renderChipBox(e.editor.chipHome??"Home consumption display","chip-home-visible",["home"])}
            ${Array.from({length:4},(e,t)=>t+1).map(t=>this._renderGroupChipBox(e,t))}
        `}_renderChipBox(e,t,i){const n=this._cfg,r=chipVisible(this._cfg,t),s=this._t();return B`
                <div class="group-block">
                    <div class="group-line">
                        <span class="group-name-badge" style="--group-pill-color:${chipSlotColor(this,this._cfg,i[0])}"><ha-icon icon=${chipSlotIcon(this._cfg,i[0])}></ha-icon></span>
                        <span class="chip-box-name">${e}</span>
                        <div class="segmented-toggle">
                            <button type="button" class="seg-option ${r?"active":""}" data-key=${t} data-value="true" @click=${this._onBoolToggleClick}>${s.editor.autoRotateOn}</button>
                            <button type="button" class="seg-option ${r?"":"active"}" data-key=${t} data-value="false" @click=${this._onBoolToggleClick}>${s.editor.autoRotateOff}</button>
                        </div>
                    </div>
                    ${this._pickerReady?i.map(e=>{const t=jt[e];return B`
                        <div class="group-line chip-body">
                            <ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{icon:{}}}
                                .value=${chipSlotIcon(this._cfg,e)}
                                data-key=${t.iconKey}
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>
                            ${ge(this._colorNonce,B`<ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ui_color:{default_color:t.uiColorDefault}}}
                                .value=${String(n[t.colorKey]??t.uiColorDefault)}
                                data-key=${t.colorKey}
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>`)}
                        </div>`}):K}
                </div>`}_renderGroupChipBox(e,t){const i=groupChipVisible(this._cfg,t),n=monitoringGroupColor(this._cfg,t),r=monitoringGroupIcon(this._cfg,t);return B`
                <div class="group-block">
                    <div class="group-line">
                        <span class="group-name-badge" style="--group-pill-color:${n}">${r?B`<ha-icon icon=${r}></ha-icon>`:B`${t}`}</span>
                        <input
                            class="group-name-input"
                            type="text"
                            .value=${monitoringGroupName(this._cfg,t)}
                            placeholder=${`${e.editor.group??"Group"} ${t}`}
                            data-group=${String(t)}
                            @change=${this._onGroupNameChanged}
                        />
                        <div class="segmented-toggle">
                            <button type="button" class="seg-option ${i?"active":""}" data-group=${String(t)} data-value="true" @click=${this._onGroupVisibleClick}>${e.editor.autoRotateOn}</button>
                            <button type="button" class="seg-option ${i?"":"active"}" data-group=${String(t)} data-value="false" @click=${this._onGroupVisibleClick}>${e.editor.autoRotateOff}</button>
                        </div>
                    </div>
                    ${this._pickerReady?B`
                        <div class="group-line chip-body">
                            <ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{icon:{}}}
                                .value=${monitoringGroupIcon(this._cfg,t)||void 0}
                                data-group=${String(t)}
                                @value-changed=${this._onGroupIconChanged}
                            ></ha-selector>
                            ${ge(this._colorNonce,B`<ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ui_color:{}}}
                                .value=${monitoringGroupColorToken(this._cfg,t)||deviceColorByIndex(this,t-1)}
                                data-group=${String(t)}
                                @value-changed=${this._onGroupColorChanged}
                            ></ha-selector>`)}
                        </div>
                    `:K}
                </div>`}_updateGroupMap(e,t,i){const n=this._cfg[e],r=n&&"object"==typeof n&&!Array.isArray(n)?{...n}:{};i?r[t]=i:delete r[t],this._update(e,Object.keys(r).length?r:void 0)}_renderDeviceRow(e,t,i,n){const r=e.statConsumption,s=this._deviceName(e),l=deviceColorByIndex(this,e.index),d=!t.has(r),c=i.get(r)??0;return B`
            <div class="device-row ${d?"":"is-hidden"}">
                <ha-icon class="device-icon" icon=${this._deviceIcon(e)} style="color:${l}"></ha-icon>
                <span class="device-name">${s}</span>
                <button
                    type="button"
                    class="device-group ${c?"active":""}"
                    style=${c?`--group-pill-color:${monitoringGroupColor(this._cfg,c)}`:""}
                    data-stat=${r}
                    aria-label=${n.editor.deviceGroupLabel??"Monitoring group"}
                    title=${c?`${n.editor.group??"Group"} ${c}`:n.editor.noGroup??"No group"}
                    @click=${this._onDeviceGroupClick}
                >
                    ${c?(()=>{const e=monitoringGroupIcon(this._cfg,c);return e?B`<ha-icon icon=${e}></ha-icon>`:B`<span class="device-group-num">${c}</span>`})():B`<ha-icon icon="mdi:close"></ha-icon>`}
                </button>
                <button
                    type="button"
                    class="device-toggle ${d?"active":""}"
                    data-stat=${r}
                    aria-pressed=${d?"true":"false"}
                    aria-label=${n.editor.deviceVisibilityLabel??"Show device"}
                    @click=${this._onDeviceToggleClick}
                >
                    <ha-icon icon=${d?"mdi:eye":"mdi:eye-off"}></ha-icon>
                </button>
            </div>
        `}render(){const e=this._cfg,t=this._t(),i=this.hass?.config?.latitude,n=this.hass?.config?.longitude,r="number"==typeof i&&isFinite(i)?String(i):"52.379",s="number"==typeof n&&isFinite(n)?String(n):"4.900";return B`
            <div class="editor">

                ${this._renderLiveDataStatus(t)}

                <details class="advanced-section" data-section="location" ?open=${"location"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map-marker"></ha-icon>${t.editor.locationSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.homeLatitude}</span>
                    <input
                        type="number"
                        min="-90"
                        max="90"
                        step="any"
                        placeholder=${r}
                        .value=${null!=e["home-latitude"]?String(e["home-latitude"]):""}
                        data-key="home-latitude"
                        @change=${this._onNumFieldChange}
                    />
                </label>
                <label class="field">
                    <span class="label">${t.editor.homeLongitude}</span>
                    <input
                        type="number"
                        min="-180"
                        max="180"
                        step="any"
                        placeholder=${s}
                        .value=${null!=e["home-longitude"]?String(e["home-longitude"]):""}
                        data-key="home-longitude"
                        @change=${this._onNumFieldChange}
                    />
                </label>
                <div class="hint">${t.editor.locationHint}</div>

                </details>

                <details class="advanced-section" data-section="map" ?open=${"map"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:tune"></ha-icon>${t.editor.uiAndMapSection}</summary>
                ${this._renderToggle("show-timeline",t.editor.showTimeline??"Show timeline",t.editor.showTimelineHint??"Show the timeline and the period selector below the scene. Off keeps just the scene.",void 0,void 0,!0)}
                ${this._renderToggle("show-detail-panel",t.editor.showDetailPanel??"Show additional info",t.editor.showDetailPanelHint??"Allow the per-chip mini-panel (aggregated metrics) to open top-right when a chip is tapped. Off never shows it.",void 0,void 0,!0)}
                ${this._renderToggle("show-sun-times",t.editor.showSunTimes??"Show sunrise / sunset times",t.editor.showSunTimesHint??"Show the sunrise and sunset times and their markers at the feet of the solar arc.",void 0,void 0,!0)}
                ${this._renderToggle("auto-hide-ui",t.editor.noUiMode??"No UI mode",t.editor.noUiModeHint??"Fade the timeline and the on-card controls after a few seconds of inactivity. Any tap or move brings them back. Great for a wall display.")}
                ${this._renderSlider("no-ui-delay",t.editor.noUiDelay??"Idle delay before hiding",0,10,1,5," s",!0!==e["auto-hide-ui"])}
                <div class="field-help">${t.editor.noUiDelayHint??"Seconds of inactivity before the timeline and controls fade away in No UI mode. 0 keeps the UI hidden permanently. Only used when No UI mode is on."}</div>
                ${this._renderToggle("auto-rotate-enabled",t.editor.autoRotate,t.editor.autoRotateHint)}
                ${this._renderToggle("camera-locked",t.editor.lockRotation??"Lock rotation",t.editor.lockRotationHint??"Set the viewing angle directly in the preview (drag to rotate and tilt the scene), then turn on the lock to freeze it: drag-to-rotate and the idle auto-orbit are disabled, keeping the angle you set.")}

                </details>

                <details class="advanced-section" data-section="mapconfig" ?open=${"mapconfig"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map"></ha-icon>${t.mapConfig?.section??"Map configuration"}</summary>
                ${this._renderMapSection(t)}
                </details>

                <details class="advanced-section" data-section="chips" ?open=${"chips"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:palette-swatch-outline"></ha-icon>${t.editor.chipsSection??"Entity display"}</summary>
                ${this._renderChipsSection(t)}
                </details>

                <details class="advanced-section" data-section="groups" ?open=${"groups"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:select-group"></ha-icon>${t.editor.groupsConfigTitle??"Group configuration"}</summary>
                ${this._renderDeviceList(t)}
                </details>

                <details class="advanced-section" data-section="sensors" ?open=${"sensors"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:sun-wireless-outline"></ha-icon>${t.editor.optionalSensors??"Optional sensors"}</summary>
                <div class="field field-block">
                    <span class="label">${t.editor.solarIrradianceEntity}</span>
                    ${this._pickerReady?B`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass=${this.hass}
                            .value=${String(e["solar-irradiance-entity"]??"")}
                            .includeDomains=${["sensor","input_number"]}
                            .entityFilter=${this._solarIrradianceEntityFilter}
                            data-key="solar-irradiance-entity"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-entity-picker>
                    `:K}
                </div>
                <div class="field-help">${t.editor.solarIrradianceEntityHelp}</div>
                </details>

                <details class="advanced-section" data-section="dataDisplay" ?open=${"dataDisplay"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gauge"></ha-icon>${t.editor.dataDisplaySection}</summary>
                ${this._renderSlider("display-update-frequency-per-hour",t.editor.displayUpdateFrequency,1,6,1,4," / h")}
                <div class="field-help">${t.editor.displayUpdateFrequencyHelp}</div>
                ${this._renderSlider("value-decimals",t.editor.valueDecimals??"Value decimals",0,3,1,1)}
                <div class="field-help">${t.editor.valueDecimalsHelp??"Number of decimals shown on every value (power in kW, energy in kWh). 0 to 3."}</div>
                ${this._renderSelect("power-unit",t.editor.powerUnit??"Power unit",[{value:"kW",label:"kW"},{value:"W",label:"W"}],"kW",t.editor.powerUnitHelp??"Unit for every power readout on the card. Energy always stays in kWh.")}
                ${this._renderSelect("irradiance-unit",t.editor.irradianceUnit??"Solar constant unit",[{value:"W/m²",label:"W/m²"},{value:"kW/m²",label:"kW/m²"}],"W/m²",t.editor.irradianceUnitHelp??"Unit for the solar constant (irradiance) readout.")}
                ${this._renderSelect("battery-sign",t.editor.batterySign??"Battery sign",[{value:"default",label:t.editor.batterySignDefault??"Default"},{value:"inverted",label:t.editor.batterySignInverted??"Inverted"},{value:"hidden",label:t.editor.batterySignHidden??"Hidden"}],"default",t.editor.batterySignHelp??"Sign shown on the battery chip: default (minus while charging), inverted (plus while charging), or hidden.")}
                </details>

                <details class="advanced-section" data-section="buildings" ?open=${"buildings"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:office-building-outline"></ha-icon>${t.editor.buildingsSection}</summary>
                ${this._renderSlider("display-radius",t.editor.displayRadius??"Display radius",0,500,10,200," m")}
                <div class="hint">${t.editor.displayRadiusHelp??"Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device; 0 shows just the home."}</div>
                ${this._renderSlider("building-count",t.editor.buildingCount??"Building count",10,100,5,50)}
                <div class="hint">${t.editor.buildingCountHelp??"Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device."}</div>
                ${this._renderToggle("building-real-size",t.editor.buildingRealSize??"Real building heights",t.editor.buildingRealSizeHint??"On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below.",t.editor.buildingRealSizeOn??"On",t.editor.buildingRealSizeOff??"Off",!0)}
                ${!1===e["building-real-size"]?this._renderSlider("building-height",t.editor.buildingHeight??"Building height",3,10,.5,6," m"):K}
                ${this._renderSlider("building-cluster-radius",t.editor.buildingClusterRadius,0,100,1,0," m")}
                <div class="hint">${t.editor.buildingClusterRadiusHelp??"Radius around the home within which attached outbuildings (verandas, garages, sheds) are treated as part of the home: they render at the home's full opacity and colour instead of as faded neighbours. 0 keeps only the main building."}</div>
                ${this._renderSlider("building-opacity",t.editor.buildingOpacity,0,1,.05,.5)}
                <div class="hint">${t.editor.buildingsHint}</div>
                ${this._renderColorPicker("building-color",t.editor.buildingColor,t.editor.buildingColorHelp,"grey")}

                </details>

                <details class="advanced-section" data-section="shadows" ?open=${"shadows"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gradient-vertical"></ha-icon>${t.editor.shadowsSection}</summary>
                ${this._renderToggle("shadows-enabled",t.editor.shadowsEnabled,t.editor.shadowsEnabledHint,t.editor.shadowsEnabledOn,t.editor.shadowsEnabledOff,!0)}

                ${this._renderSlider("shadow-opacity",t.editor.shadowOpacity,0,1,.05,.32)}
                <div class="hint">${t.editor.shadowOpacityHint}</div>

                </details>


                <details class="advanced-section" data-section="reset" ?open=${"reset"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:refresh"></ha-icon>${t.editor.resetSection}</summary>
                    <div class="hint">${t.editor.resetSectionHint}</div>
                    <div class="hint reset-warning">${t.editor.resetCacheWarning}</div>
                    ${this._renderActionButton({icon:"mdi:database-refresh-outline",label:this._resetFeedback??t.editor.resetCacheButton,color:"var(--error-color, #ef4444)",onClick:this._onResetCacheClick.bind(this)})}
                    <div class="hint reset-warning">${t.editor.resetOptionsWarning??"Warning: this resets ALL of this card's options to their defaults (chip visibility, colours and icons, group names/colours/icons, buildings, shadows, units and every other setting). Your Home Assistant data is untouched, but your customisation is cleared. Click again to confirm."}</div>
                    ${this._renderActionButton({icon:"mdi:cog-refresh-outline",label:this._optionsResetFeedback??(this._optionsResetArmed?t.editor.resetOptionsConfirm??"Click again to confirm":t.editor.resetOptionsButton??"Reset options to defaults"),color:"var(--error-color, #ef4444)",onClick:this._onResetOptionsClick.bind(this),filled:this._optionsResetArmed})}
                </details>

                <details class="advanced-section about-section" data-section="about" ?open=${"about"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:information-outline"></ha-icon>${t.editor.aboutSection}</summary>
                    <!-- Identity + links column: one .about-row line per item, label left and value (or icon link)
                         right. -->
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutVersionLabel}</span>
                        <a class="about-row-link about-version-link"
                           href="https://github.com/ReikanYsora/Helios/releases/tag/v${"2026.8.0-b3"}"
                           target="_blank" rel="noopener noreferrer"
                        >${"2026.8.0-b3"}</a>
                    </div>
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutDeveloperLabel}</span>
                        <span class="about-row-value">ReikanYsora (Jérôme CREMOUX)</span>
                    </div>
                    ${this._renderAboutLink("mdi:web","helios-ha.org","https://helios-ha.org")}
                    ${this._renderAboutLink("mdi:linkedin",t.editor.aboutDeveloperLinkedIn,"https://www.linkedin.com/in/jerome-cremoux/")}
                    ${this._renderAboutLink("mdi:github",t.editor.aboutRepoCard,"https://github.com/ReikanYsora/Helios")}
                    <div class="about-block about-coffee">
                        <p class="about-paragraph">${t.editor.aboutCoffeeMessage}</p>
                        ${this._renderActionButton({icon:"mdi:coffee",label:t.editor.aboutCoffeeLink,color:"#ffcc00",href:"https://www.buymeacoffee.com/reikanysora"})}
                    </div>
                </details>

            </div>
        `}_onResetCacheClick(){try{window.dispatchEvent(new CustomEvent("helios-data-cache-reset"))}catch(L){}const e=this._t();this._resetFeedback=e.editor.resetCacheDone,void 0!==this._resetFeedbackTimer&&window.clearTimeout(this._resetFeedbackTimer),this._resetFeedbackTimer=window.setTimeout(()=>{this._resetFeedback=null},Dt.RESET_FEEDBACK_MS)}_onResetOptionsClick(){if(!this._optionsResetArmed)return this._optionsResetArmed=!0,void 0!==this._optionsResetConfirmTimer&&window.clearTimeout(this._optionsResetConfirmTimer),void(this._optionsResetConfirmTimer=window.setTimeout(()=>{this._optionsResetArmed=!1},4e3));this._optionsResetArmed=!1,void 0!==this._optionsResetConfirmTimer&&window.clearTimeout(this._optionsResetConfirmTimer);const e=this._cfg,t={};for(const n of Dt.LOVELACE_KEYS)void 0!==e[n]&&(t[n]=e[n]);this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:t}})),this._cfg=t;const i=this._t();this._optionsResetFeedback=i.editor.resetOptionsDone??"Options reset ✓",void 0!==this._optionsResetFeedbackTimer&&window.clearTimeout(this._optionsResetFeedbackTimer),this._optionsResetFeedbackTimer=window.setTimeout(()=>{this._optionsResetFeedback=null},Dt.RESET_FEEDBACK_MS)}},Dt=Ct,Ct.SLIDER_COMMIT_DELAY_MS=250,Ct.PICKER_LOAD_TIMEOUT_MS=8e3,Ct.RESET_FEEDBACK_MS=2e3,Ct.LEGACY_KEYS=["custom-power-entity","custom-energy-entity","custom-entity","custom-entity-icon","custom-entity-color"],Ct.LOVELACE_KEYS=["type","view_layout","grid_options","layout_options"],Ct.styles=At,Ct);__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],Et.prototype,"hass",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_cfg",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_pickerReady",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_colorNonce",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_openSection",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_energyDefaults",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_energyDefaultsLoaded",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_resetFeedback",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_optionsResetArmed",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Et.prototype,"_optionsResetFeedback",void 0),Et=Dt=__decorate([t$2("helios-card-editor")],Et);var Tt=pickTranslations("undefined"!=typeof navigator?navigator.language:"en");window.customCards=window.customCards||[];{const e={type:"helios-card",name:Tt.cardName,description:Tt.cardDescription,preview:!0},t=window.customCards.findIndex(e=>"helios-card"===e.type);t>=0?window.customCards[t]=e:window.customCards.push(e)}var Ot=/* @__PURE__ */new Set;{const e="__heliosBannerPrinted",t=window;t[e]||(t[e]=!0,console.info("%c☀ HELIOS%c v2026.8.0-b3","background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px 0 0 4px;font-weight:bold;","background:#1f2937;color:#f59e0b;padding:2px 8px;border-radius:0 4px 4px 0;font-weight:bold;"))}{const e=window;e.setHeliosLocation||(e.setHeliosLocation=(t,i)=>{if(!("number"!=typeof t||"number"!=typeof i||!isFinite(t)||!isFinite(i)||t<-90||t>90||i<-180||i>180)){e.__heliosLocationOverride={lat:t,lon:i};for(const e of Ot)e.invalidateLocation()}}),e.clearHeliosLocation||(e.clearHeliosLocation=()=>{if(e.__heliosLocationOverride){e.__heliosLocationOverride=void 0;for(const e of Ot)e.invalidateLocation()}})}function nudgeToHomePill(e,t,i,n,r,s){const l=e-i,d=t-n,c=Math.max(0,r-s);if(Math.abs(l)<=c)return{x:e,y:n+(d>=0?1:-1)*s};const u=i+(l>=0?1:-1)*c,p=e-u,g=t-n,m=Math.sqrt(p*p+g*g)||1;return{x:u+s*p/m,y:n+s*g/m}}window.addEventListener("helios-data-cache-reset",()=>{for(const e of Ot)e.resetDataCache()});var Lt,Pt=1.5,Ft=class{constructor(e){this.host=e,this._gridLeaderColor="var(--energy-grid-consumption-color, #488fc2)",this._batteryLeaderColor="var(--energy-battery-out-color, #4db6ac)"}_nudgeToHomePill(e,t,i,n){return nudgeToHomePill(e,t,i,n,38,14)}_buildLPathToHome(e,t,i){if(!e)return"";const n=e.home.x,r=e.home.y,s=n>t?1:-1,l=r>i?1:-1,d=t+22*s,c=i,u=n-13*s,p=r-14*l,g=Math.min(12,Math.abs(u-d)/2,Math.abs(p-c)/2),m=u-s*g,f=c+l*g;return`M ${d.toFixed(1)},${c.toFixed(1)} L ${m.toFixed(1)},${c.toFixed(1)} Q ${u.toFixed(1)},${c.toFixed(1)} ${u.toFixed(1)},${f.toFixed(1)} L ${u.toFixed(1)},${p.toFixed(1)}`}_buildLPath(e,t,i,n,r){const s=i>e?1:-1,l=n>t?1:-1,d=Math.min(12,Math.abs(i-e)/2,Math.abs(n-t)/2);if(r){const r=n-l*d,c=e+s*d;return`M ${e.toFixed(1)},${t.toFixed(1)} L ${e.toFixed(1)},${r.toFixed(1)} Q ${e.toFixed(1)},${n.toFixed(1)} ${c.toFixed(1)},${n.toFixed(1)} L ${i.toFixed(1)},${n.toFixed(1)}`}const c=i-s*d,u=t+l*d;return`M ${e.toFixed(1)},${t.toFixed(1)} L ${c.toFixed(1)},${t.toFixed(1)} Q ${i.toFixed(1)},${t.toFixed(1)} ${i.toFixed(1)},${u.toFixed(1)} L ${i.toFixed(1)},${n.toFixed(1)}`}_buildVerticalLeadFromHome(e,t,i){const n=e.home.y+14;return`M ${t.toFixed(1)},${n.toFixed(1)} L ${t.toFixed(1)},${i.toFixed(1)}`}_renderSunCrossing(e,t,i,n){if(!e)return K;const r=e.x-t.x,s=e.y-t.y,l=Math.hypot(r,s)||1,d=e.x+r/l*22,c=e.y+s/l*22,u=function formatHaTime(e,t){return formatWithHaLocale(e,t,{hour:"numeric",minute:"2-digit"})}(this.host.hass,e.time);return B`
            <div
                class="sun-cross-marker"
                style="left:${d.toFixed(1)}px; top:${c.toFixed(1)}px; --sun-cross-color:${n}"
            >
                <ha-icon icon=${i}></ha-icon>
                <span>${u}</span>
            </div>
        `}render(){const e=null!==getHomeCoords(this.host.config,this.host.hass),t=!1!==this.host._interactive,i=this.host._labelLayout,n=this.host.config,r=chipVisible(n,"chip-irradiance-visible"),s=chipVisible(n,"chip-production-visible"),l=chipVisible(n,"chip-grid-visible"),d=chipVisible(n,"chip-battery-visible"),c=chipSlotColor(this.host,n,"irradiance"),u=!chipVisible(n,"chip-home-visible"),p=resolvePvLiveEntity(this.host._energyDefaults),g=chipSlotColor(this.host,n,"production"),m=!this.host._isLiveMode&&null!==this.host._selectedTime,f=m&&this.host._selectedTime.getTime()>Date.now()+6e4,b=""!==p&&null!==i?m?function pvRateAtTime(e,t){const i=wattsAtFromChangeSeries(e._pvChangeSeries,t.getTime());return null===i?null:{value:Math.max(0,i),unit:"W"}}(this.host,this.host._selectedTime):null!==this.host._pvCurrent?function currentPvRate(e){const t=e._energyDefaults.solarStatRates;if(0===t.length)return null;const{watts:i,any:n}=sumLiveWatts(e.hass,t);return n?{value:Math.max(0,i),unit:"W"}:null}(this.host):null:null;let v=null;if(f&&""!==p&&null!==i&&this.host._unifiedStore){const e=valueAt(this.host._unifiedStore.forecast,this.host._unifiedStore,this.host._selectedTime.getTime());null!==e&&e>0&&(v={value:e,unit:"W"})}const y=f&&null!==v,w=y?v:b,_=e&&s&&null!==i&&""!==p&&null!==w&&(!f||y)&&(!m||w.value>0),H=valueDecimals(this.host.config),j=powerUnit(this.host.config),z=irradianceUnit(this.host.config),M=_?(y?"~ ":"")+formatPvValue(this.host.hass,w.value,w.unit,H,j):"",$=null!==b?pvNormalizeToWatts(b.value,b.unit):0,C=flowDuration($,5e3,.5),D=!($>0),A=resolveBatteryEntities(this.host._energyDefaults),R=null!==A.socEntity,E=null!==A.powerEntity,T=!this.host._isLiveMode&&null!==this.host._selectedTime,O=T&&this.host._selectedTime.getTime()>Date.now()+6e4,L=T&&!O?this.host._selectedTime.getTime():null,P=null!==L?wattsAtFromChangeSeries(this.host._gridImportChangeSeries,L):this.host._gridImportValue,F=null!==L?wattsAtFromChangeSeries(this.host._gridExportChangeSeries,L):this.host._gridExportValue,I=null===P?null:Math.max(0,P),U=null===F?null:Math.max(0,F),W=null!==L?"W":this.host._gridImportUnit,q=null!==L?"W":this.host._gridExportUnit,Z=T?function batterySampleAtTime(e,t){if(!e||0===e.times.length)return null;const i=t.getTime(),n=e.times[0].getTime(),r=e.times[e.times.length-1].getTime();if(i<n||i>r+6e4)return null;let s=e.times.length-1;for(let l=0;l<e.times.length;l++)if(e.times[l].getTime()>i){s=l-1;break}return s<0&&(s=0),e.values[s]}(this.host._batterySocHistory,this.host._selectedTime):this.host._batterySoc;let Y;if(T){const e=this.host._selectedTime.getTime(),t=wattsAtFromChangeSeries(this.host._batteryChargeChangeSeries,e),i=wattsAtFromChangeSeries(this.host._batteryDischargeChangeSeries,e);Y=null===t&&null===i?null:Math.max(0,t??0)-Math.max(0,i??0)}else Y=this.host._batteryPower;const J=T?"W":this.host._batteryPowerUnit,X=e&&null!==i&&!O&&R&&null!==Z,Q=e&&null!==i&&!O&&E&&null!==Y,ee=(X||Q)&&d,te=X?`${Math.round(Z)} %`:"",ie=Q?function formatBatteryPower(e,t,i,n,r="kW",s="default"){const l=pvNormalizeToWatts(t,i);return"hidden"===s?formatPowerKw(e,Math.abs(l),n,!1,r):formatPowerKw(e,"inverted"===s?-l:l,n,!0,r)}(this.host.hass,-Y,J,H,j,function batterySign(e){const t=e?.["battery-sign"];return"inverted"===t||"hidden"===t?t:"default"}(this.host.config)):"",ae=f||null===w?null:pvNormalizeToWatts(w.value,w.unit),oe=null!==I||null!==U?(I??0)-(U??0):null,ne=Q?Y:null,re=this.host._energyDefaults,se=T||(0===re.solarStatEnergyFroms.length||null!==ae)&&(0===re.gridStatEnergyFroms.length&&0===re.gridStatEnergyTos.length||null!==oe)&&(0===re.batteryStatEnergyFroms.length&&0===re.batteryStatEnergyTos.length||null!==ne)?null===ae&&null===oe&&null===ne?null:Math.max(0,(ae??0)+(oe??0)-(ne??0)):null,le=e&&null!==i&&!O&&null!==se,de=le?formatGridValue(this.host.hass,se,"W",H,j):"",ce=Q&&Y>0,ue=Q&&Y<0,he=chipSlotColor(this.host,n,"batteryCharge"),pe=chipSlotColor(this.host,n,"batteryDischarge"),ge=ce?he:pe;this._batteryLeaderColor=ge;const me=Q?Math.abs(pvNormalizeToWatts(Y,J)):0,fe=Q&&me<5,be=flowDuration(me,5e3),ve=i?.batteryLabel.x??0,ye=i?.batteryLabel.y??0,ke=chipSlotIcon(n,ce?"batteryCharge":"batteryDischarge",function batteryLevelIcon(e,t){if(null===e||!isFinite(e))return"mdi:battery";const i=clamp(10*Math.round(e/10),0,100);return t?i>=100?"mdi:battery-charging-100":i<=0?"mdi:battery-charging-outline":`mdi:battery-charging-${i}`:i>=100?"mdi:battery":i<=0?"mdi:battery-outline":`mdi:battery-${i}`}(X?Z:null,ce)),we=Q?ie:te,_e=ye-4.2,Se=!!(i&&ce&&_)?ye+4.2:ye,He=i&&ee&&ue?this._buildLPathToHome(i,ve,Se):"",je=i&&ee&&!ue?this._buildLPathToHome(i,ve,Se):"",ze=i&&ce&&_?this._buildLPath(i.pvLabel.x+14,i.pvLabel.y+11,ve-30,_e,!0):"",xe=this._buildLPathToHome(i,i?.gridLabel.x??0,i?.gridLabel.y??0),Me=[.32,.44,.6799999999999999,.56],$e=i?.gridLabel.x??0,Ce=i?.batteryLabel.x??0,De=i?.home.x??0,Ae=i?.groupLabels[0]?.y??0,Re=i?.groupLabels[1]?.y??0,Ee=this.host._isLiveMode||null===this.host._selectedTime?null:this.host._selectedTime.getTime(),Te=i&&!f?function activeGroups(e,t){const i=[];for(let n=1;n<=4;n++)groupDevices(e,t,n).length>0&&i.push(n);return i}(this.host.config,this.host._energyDefaults).filter(e=>groupChipVisible(n,e)):[],Oe=Te.length,Le=i?Te.map((e,t)=>{let n,r,s=!1;if(1===Oe)n={x:De,y:Re},r=this._buildVerticalLeadFromHome(i,De,n.y);else if(4===Oe){const e=t<2;n={x:e?$e:Ce,y:t%2==0?Ae:Re};const s=e?n.x+48:n.x-48,l=i.home.x+96*(Me[t]-.5),d=i.home.y+14;r=this._buildLPath(l,d,s,n.y,!0)}else t<2?(n={x:0===t?$e:Ce,y:Ae},r=this._buildLPathToHome(i,n.x,n.y),s=!0):(n={x:De,y:Re},r=this._buildVerticalLeadFromHome(i,De,n.y));const l=null!==Ee?function groupPowerWAt(e,t,i){let n=0,r=!1;for(const s of groupDevices(e.config,e._energyDefaults,t)){const t=wattsAtFromChangeSeries(e._deviceChangeSeries.get(s.statConsumption)??null,i);null!==t&&(n+=t,r=!0)}return r?n:null}(this.host,e,Ee):function groupLivePowerW(e,t){const i=groupDevices(e.config,e._energyDefaults,t).map(e=>e.statRate).filter(e=>""!==e);if(0===i.length)return null;const{watts:n,any:r}=sumLiveWatts(e.hass,i);return r?n:null}(this.host,e),d=monitoringGroupColor(this.host.config,e),c=monitoringGroupIcon(this.host.config,e),u=null===l?0:Math.abs(l);return{g:e,anchor:n,leadPath:r,reverse:s,watts:l,color:d,icon:c,beadDur:u<5?null:flowDuration(u,5e3)}}):[],Pe=null!==I?Math.abs(pvNormalizeToWatts(I,W)):0,Fe=null!==U?Math.abs(pvNormalizeToWatts(U,q)):0,proportionalBeadDur=(e,t)=>{const i=Math.max(e,1);return Math.min(8,Math.max(1.2,1.2*t/i))},Ie=Pe<5?null:proportionalBeadDur(Pe,5e3),Ue=Fe<5?null:proportionalBeadDur(Fe,1e3),We=(I??0)>=(U??0),Ne=chipSlotColor(this.host,n,"gridImport"),Be=chipSlotColor(this.host,n,"gridExport"),Ve=We?Ne:Be;this._gridLeaderColor=Ve;const Ge=We?Ie:Ue,qe=this.host._sunScene,Ke=e&&null!==qe&&qe.arc.length>=2,Ze=ENERGY_COLOR_sun(this.host),Ye=function darkenHex(e,t){const i=1-clamp(t,0,1),h=e=>Math.round(e*i).toString(16).padStart(2,"0");return`#${h(hexByte(e,1))}${h(hexByte(e,3))}${h(hexByte(e,5))}`}(Ze,.2),Je=Ke?function buildArcSegments(e,t){const i=[];for(let n=0;n<e.length-1;n++){const r=e[n],s=e[n+1];i.push({x1:r.x,y1:r.y,x2:s.x,y2:s.y,color:arcColor(.5*(r.altitude+s.altitude),t),nearness:.5*(r.nearness+s.nearness),belowHorizon:r.belowHorizon||s.belowHorizon})}return i}(qe.arc,Ze):[],Xe=this.host._arcBackBuf,Qe=this.host._arcFrontBuf,et=this.host._arcFrontNearBuf;Xe.length=0,Qe.length=0,et.length=0;for(const B of Je)B.belowHorizon?Xe.push(B):B.nearness>=.5?et.push(B):Qe.push(B);const tt=Ke&&qe.sun.altitude>0,it=qe?.sun.irradiance??0,at=formatIrradiance(this.host.hass,it,H,z),ot=Math.sqrt(Math.max(0,Math.min(1,it/1e3))),nt=Ke&&r&&qe.sun.altitude>0&&this.host._weatherAvailable,rt=flowDuration(it,1e3,.8);let st=qe?.home.x??0,lt=qe?.home.y??0;if(i&&qe&&_){const e=nudgeToHomePill(qe.sun.x,qe.sun.y,i.pvLabel.x,i.pvLabel.y,28,11);st=e.x,lt=e.y}return B`
                <!--  Solar arc, BACK pass: only the dotted below-horizon segments (the sun's path under the
                      celestial sphere), so the home + chips read in front of the night half of the loop.
                      Above-horizon segments, ray, disc and W/m² readout are in the FRONT pass below.  -->
                ${Ke&&Xe.length>0?B`
                    <svg
                        class="solar-svg solar-svg-back"
                        style="--solar-daylight:${qe.daylight}"
                    >
                        ${Xe.map(e=>G`
                            <line
                                class="solar-arc-outline solar-arc-night"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${.5*(Pt+3.5*e.nearness)}"
                            ></line>
                        `)}
                        ${Xe.map(e=>G`
                            <line
                                class="solar-arc-segment solar-arc-night"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${.5*(1+3*e.nearness)}"
                            ></line>
                        `)}
                    </svg>
                `:K}


                ${_?(()=>{const e=i.pvLabel.x,t=i.pvLabel.y+11,n=this._nudgeToHomePill(e,t,i.home.x,i.home.y);return B`
                    <svg class="pv-home-leader-svg">
                        <line
                            class="pv-home-leader-line"
                            style="--pv-leader-color:${g}"
                            x1=${e}
                            y1=${t}
                            x2=${n.x}
                            y2=${n.y}
                        ></line>
                        ${D?K:G`
                            <!--  Filled disc riding the leader from the PV chip to the home, speed
                                  proportional to live production. No rotate="auto": a disc has no orientation.  -->
                            <circle
                                class="pv-home-leader-bead"
                                r="3"
                                fill="${g}"
                            >
                                <animateMotion
                                    dur="${C}s"
                                    repeatCount="indefinite"
                                    path="M ${e},${t} L ${n.x},${n.y}"
                                ></animateMotion>
                            </circle>
                        `}
                    </svg>`})():K}

                ${_?B`
                    <div
                        class="pv-pct-label ${y?"is-predicted":""} ${t&&"production"===this.host._chartTarget?"is-chart-active":""}"
                        style="left:${i.pvLabel.x}px; top:${i.pvLabel.y}px; --pv-leader-color:${g}"
                        role=${t?"button":K}
                        tabindex=${t?"0":K}
                        data-target="production"
                        @click=${t?this.host.onChartTargetClick:void 0}
                    >
                        <ha-icon icon=${chipSlotIcon(n,"production","mdi:solar-power")}></ha-icon>
                        <span>${M}</span>
                    </div>
                `:K}

                ${ee?B`
                    <svg class="battery-leader-svg">
                        <!--  Battery -> home static connector: keeps the chip tied to the home hub whenever it
                              is not actively discharging (the discharge flow below docks it then).  -->
                        ${je?G`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${ge}"
                                d="${je}"
                            ></path>
                        `:K}
                        <!--  Battery -> home discharge flow: solid rounded-L + bead toward the home, drawn only
                              while the battery is discharging to feed the house.  -->
                        ${He?G`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${ge}"
                                d="${He}"
                            ></path>
                            ${fe?K:G`
                                <circle
                                    class="battery-leader-bead"
                                    r="3"
                                    style="fill:${ge}"
                                >
                                    <animateMotion
                                        dur="${be}s"
                                        repeatCount="indefinite"
                                        path="${He}"
                                    ></animateMotion>
                                </circle>
                            `}
                        `:K}
                        <!--  PV -> battery chip, only while charging: an inverted L (down then right) in the PV
                              colour, bead flowing toward the battery so the user sees PV feeding it.  -->
                        ${ze?G`
                            <path
                                class="pv-home-leader-line"
                                style="--pv-leader-color:${g}"
                                fill="none"
                                d="${ze}"
                            ></path>
                            ${fe?K:G`
                                <circle
                                    class="pv-home-leader-bead"
                                    r="3"
                                    fill="${g}"
                                >
                                    <animateMotion
                                        dur="${be}s"
                                        repeatCount="indefinite"
                                        path="${ze}"
                                    ></animateMotion>
                                </circle>
                            `}
                        `:K}
                    </svg>
                    <div
                        class="battery-pct-label ${t&&"battery"===this.host._chartTarget?"is-chart-active":""}"
                        style="left:${ve}px; top:${ye}px; --battery-leader-color:${ge}"
                        role=${t?"button":K}
                        tabindex=${t?"0":K}
                        data-target="battery"
                        @click=${t?this.host.onChartTargetClick:void 0}
                    >
                        <ha-icon icon=${ke}></ha-icon>
                        <span>${we}</span>
                    </div>
                `:K}

                <!--  Grid chip on the LEFT of the home: one pill showing the ACTIVE flow only. Importing reads
                      consumption blue with a grid -> home bead; exporting flips to return purple with a
                      home -> grid bead. The dominant side wins when both are live.  -->
                ${!e||!l||null===i||null===I&&null===U||O?K:B`
                    <svg class="grid-leader-svg">
                        <path class="grid-leader-line" style="stroke:${Ve}" d=${xe} />
                        <!--  Single bead on the active flow. Import
                              flows grid -> home (default traversal),
                              export flows home -> grid (keyPoints 1;0
                              reverses it). Dropped when the active side
                              is idle, no misleading motion.           -->
                        ${null!==Ge?We?G`
                            <circle class="grid-leader-bead" r="3" style="fill:${Ve}">
                                <animateMotion dur="${Ge.toFixed(2)}s" repeatCount="indefinite"
                                               path="${xe}" />
                            </circle>
                        `:G`
                            <circle class="grid-leader-bead" r="3" style="fill:${Ve}">
                                <animateMotion dur="${Ge.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints="1;0" keyTimes="0;1"
                                               path="${xe}" />
                            </circle>
                        `:K}
                    </svg>
                    <div
                        class="grid-label ${t&&"grid"===this.host._chartTarget?"is-chart-active":""}"
                        style="left:${i.gridLabel.x}px; top:${i.gridLabel.y}px; --grid-leader-color:${Ve}"
                        role=${t?"button":K}
                        tabindex=${t?"0":K}
                        data-target="grid"
                        @click=${t?this.host.onChartTargetClick:void 0}
                    >
                        <ha-icon icon=${We?chipSlotIcon(n,"gridImport","mdi:transmission-tower-export"):chipSlotIcon(n,"gridExport","mdi:transmission-tower-import")}></ha-icon>
                        <span>${formatGridValue(this.host.hass,We?I??0:U??0,We?W:q,H,j)}</span>
                    </div>
                `}

                <!--  Monitoring-group chips (dynamic placement by active-group count). Each shows the group's live
                      total with a number badge; clicking one points the chart at that group's per-device curves.
                      The bead runs home -> chip; horizontal leads are reversed (keyPoints) to keep that direction.  -->
                ${e&&null!==i?Le.map(e=>B`
                    <svg class="group-leader-svg">
                        <path class="group-leader-line" style="stroke:${e.color}" d=${e.leadPath} />
                        ${null!==e.beadDur?G`
                            <circle class="group-leader-bead" r="3" style="fill:${e.color}">
                                <animateMotion dur="${e.beadDur.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints=${e.reverse?"1;0":K} keyTimes=${e.reverse?"0;1":K}
                                               path="${e.leadPath}" />
                            </circle>
                        `:K}
                    </svg>
                    <div
                        class="group-label ${t&&this.host._chartTarget===groupTarget(e.g)?"is-chart-active":""}"
                        style="left:${e.anchor.x}px; top:${e.anchor.y}px; --group-color:${e.color}"
                        role=${t?"button":K}
                        tabindex=${t?"0":K}
                        data-target=${groupTarget(e.g)}
                        @click=${t?this.host.onChartTargetClick:void 0}
                    >
                        ${e.icon?B`<ha-icon icon=${e.icon}></ha-icon>`:B`<span class="group-glyph-num">${e.g}</span>`}
                        <span>${null===e.watts?"":formatPvValue(this.host.hass,e.watts,"W",H,j)}</span>
                    </div>
                `):K}

                <!--  Solar arc, FAR-FRONT pass: above-horizon segments with nearness below the 0.5 midpoint
                      (arched away from the eye but still ahead of the sky dome's back wall). These render
                      BEHIND the home-anchored chips so the "back half" of the arc doesn't cross a chip.  -->
                ${Ke&&Qe.length>0?B`
                    <svg
                        class="solar-svg solar-svg-front-far"
                        style="--solar-daylight:${qe.daylight}"
                    >
                        ${Qe.map(e=>G`
                            <line
                                class="solar-arc-outline"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${Pt+3.5*e.nearness}"
                            ></line>
                        `)}
                        ${Qe.map(e=>G`
                            <line
                                class="solar-arc-segment"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${1+3*e.nearness}"
                            ></line>
                        `)}
                    </svg>
                `:K}

                <!--  Solar arc, NEAR-FRONT pass: above-horizon segments with nearness at or above 0.5 (closer
                      to the camera than the home). These render IN FRONT of the home chips + leaders so the
                      live arc reads on top of the HUD on its near side, keeping the sun visually dominant.  -->
                ${Ke&&et.length>0?B`
                    <svg
                        class="solar-svg solar-svg-front-near"
                        style="--solar-daylight:${qe.daylight}"
                    >
                        ${et.map(e=>G`
                            <line
                                class="solar-arc-outline"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${Pt+3.5*e.nearness}"
                            ></line>
                        `)}
                        ${et.map(e=>G`
                            <line
                                class="solar-arc-segment"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${1+3*e.nearness}"
                            ></line>
                        `)}
                    </svg>
                `:K}

                <!--  Ray + bead in their own SVG below the chip family (z 7 < pv-pct-label z 8) so the PV
                      chip occludes the ray endpoint at its border. The sun disc stays in the depth-split SVG
                      below (in front of / behind the home cluster by camera bearing), so the ray never rides
                      over the production chip.  -->
                ${Ke&&tt?B`
                    <svg class="solar-svg solar-ray-svg"
                         style="--solar-daylight:${qe.daylight}">
                        <line
                            class="solar-ray"
                            style="--sun-flow-duration:${rt}s"
                            x1=${qe.sun.x}  y1=${qe.sun.y}
                            x2=${st}    y2=${lt}
                            stroke=${Ze}
                        ></line>
                        <!--  Bead rides an absolute-coordinate path with cx / cy at the default 0 origin.
                              Single-attribute updates keep the SMIL animation continuous during rotation.  -->
                        <circle
                            class="solar-ray-bead"
                            r="3"
                            fill=${Ze}
                        >
                            <animateMotion
                                dur="${rt}s"
                                repeatCount="indefinite"
                                path="M ${qe.sun.x},${qe.sun.y} L ${st},${lt}"
                            ></animateMotion>
                        </circle>
                    </svg>
                `:K}

                ${Ke?B`
                    <svg
                        class="solar-svg solar-svg-sun ${qe.sun.nearness>=.5?"solar-svg-sun-near":"solar-svg-sun-far"}"
                        style="--solar-daylight:${qe.daylight}"
                    >
                        ${(()=>{const e=this.host._engine?.getSunArcScale()??1,t=Math.min((10+10*qe.sun.nearness)*e,22),i=t*ot,n=3*t,r=.55*ot;return G`
                                <defs>
                                    <radialGradient id="solar-halo-grad-${this.host._instanceId}">
                                        <stop offset="0%"   stop-color="${Ze}" stop-opacity="${r}"></stop>
                                        <stop offset="100%" stop-color="${Ze}" stop-opacity="0"></stop>
                                    </radialGradient>
                                </defs>
                                <circle
                                    class="solar-sun-halo"
                                    cx="${qe.sun.x}" cy="${qe.sun.y}"
                                    r="${n}"
                                    fill="url(#solar-halo-grad-${this.host._instanceId})"
                                ></circle>
                                <circle
                                    class="solar-sun-bg"
                                    cx="${qe.sun.x}" cy="${qe.sun.y}"
                                    r="${t}"
                                    fill="${Ze}"
                                    fill-opacity="${.2}"
                                ></circle>
                                <circle
                                    class="solar-sun-fill"
                                    cx="${qe.sun.x}" cy="${qe.sun.y}"
                                    r="${i}"
                                    fill="${Ze}"
                                    stroke="${Ye}"
                                    stroke-width="0.5"
                                ></circle>
                                <circle
                                    class="solar-sun-rim"
                                    cx="${qe.sun.x}" cy="${qe.sun.y}"
                                    r="${t}"
                                    fill="none"
                                    stroke="${Ze}"
                                    stroke-width="${1.5}"
                                ></circle>
                            `})()}
                    </svg>
                `:K}

                <!--  Weather chip, pinned above the sun disc: the cloud-cover glyph (clear / partly / overcast)
                      next to the live irradiance value. One chip carries both stories, the icon for the sky
                      condition and the number for the W/m²; clicking it targets the timeline's irradiance
                      view, where the cloud layers overlay the curve.  -->
                ${nt?B`
                    <div
                        class="solar-pct-label ${t&&"irradiance"===this.host._chartTarget?"is-chart-active":""}"
                        style="left:${qe.sun.x}px; top:${qe.sun.y-22}px; --solar-color:${c}"
                        role=${t?"button":K}
                        tabindex=${t?"0":K}
                        data-target="irradiance"
                        @click=${t?this.host.onChartTargetClick:void 0}
                    >
                        <ha-icon icon=${chipSlotIcon(n,"irradiance",this.host._cloudCover>=0?function cloudCoverIcon(e){return e<0?"mdi:weather-cloudy":e<15?"mdi:weather-sunny":e<40?"mdi:weather-partly-cloudy":e<75?"mdi:weather-cloudy":"mdi:weather-pouring"}(this.host._cloudCover):"mdi:white-balance-sunny")}></ha-icon>
                        <span>${at}</span>
                    </div>
                `:K}

                <!--  Sunrise / sunset markers: a sun-coloured glyph + local time just outside the arc at each
                      horizon crossing. Hidden by the show-sun-times option.  -->
                ${Ke&&qe&&function showSunTimes(e){return!1!==e?.["show-sun-times"]}(n)?B`
                    ${this._renderSunCrossing(qe.sunrise,qe.home,"mdi:weather-sunset-up",Ze)}
                    ${this._renderSunCrossing(qe.sunset,qe.home,"mdi:weather-sunset-down",Ze)}
                `:K}



                <!--  Home hub: the node the chip cluster orbits, at the projected home centre with no drop-leader
                      so every chip leader docks straight against it. Shown as the home pill (glyph + live
                      consumption) unless the home chip is hidden, in which case it collapses to a small hollow
                      ring: a bare contact point the leads converge on, the scene still visible through it.  -->
                ${e&&null!==i?u?B`<div class="home-ring" style="left:${i.home.x}px; top:${i.home.y}px; --home-ring-color:${chipSlotColor(this.host,n,"home")}"></div>`:B`
                    <div
                        class="home-pill ${this.host._homeHover?"is-hovered":""} ${t&&"consumption"===this.host._chartTarget?"is-chart-active":""}"
                        style="left:${i.home.x}px; top:${i.home.y}px"
                        role=${t?"button":K}
                        tabindex=${t?"0":K}
                        data-target="consumption"
                        @click=${t?this.host.onChartTargetClick:void 0}
                        @mouseenter=${this.host.onHomeEnter}
                        @mouseleave=${this.host.onHomeLeave}
                    >
                        <ha-icon icon=${chipSlotIcon(n,"home","mdi:home")}></ha-icon>
                        ${le?B`<span class="home-pill-usage">${de}</span>`:K}
                    </div>`:K}
        `}},It=/* @__PURE__ */new Map,Ut=(Lt=class HeliosCard extends le{constructor(...e){super(...e),this.preview=!1,this._hud=new Ft(this),this._now=/* @__PURE__ */new Date,this._cloudCover=-1,this._labelLayout=null,this._pvCurrent=null,this._pvUnit="",this._pvChangeSeries=null,this._pvChangeFetch=new et,this._pvChangeSeriesPerEntity=/* @__PURE__ */new Map,this._haSolarForecast=[],this._haSolarForecastLoaded=!1,this._haSolarForecastFetching=!1,this._haSolarForecastFetchedAt=0,this._batterySoc=null,this._batteryPower=null,this._batteryPowerUnit="",this._gridImportValue=null,this._gridImportUnit="",this._gridExportValue=null,this._gridExportUnit="",this._gridImportChangeSeries=null,this._gridExportChangeSeries=null,this._gridImportFetch=new et,this._gridExportFetch=new et,this._gridGuard={status:"unknown",cleanEvals:0,fetchKey:"",fetching:!1,entityKey:""},this._batterySocHistory=null,this._batterySocPerBankHistory=[],this._periodHourly=null,this._periodHourlyKey="",this._batteryFetchKey="",this._batteryFetching=!1,this._batteryChargeChangeSeries=null,this._batteryDischargeChangeSeries=null,this._batteryChangeFetch=new et,this._deviceChangeSeries=/* @__PURE__ */new Map,this._deviceChangeFetch=new et,this._irradianceHistory=null,this._irradianceFetchKey="",this._irradianceFetching=!1,this._sunScene=null,this._energyDefaults=Xe,this._haSolarTodayKwh=null,this._homeHover=!1,this._chartHoverPct=null,this._chartTarget="production",this._infoPanelOpen=!1,this._uiHidden=!1,this._chartSeries=null,this._timeRange=null,this._selectedTime=null,this._isLiveMode=!0,this._timelineMode="forecast",this._periodPastDays=modePastDays("forecast"),this._periodFutureDays=modeFutureDays("forecast"),this._energyDefaultsLoaded=!1,this._dailyTotalsKicked=!1,this._unifiedStore=null,this._lastHomeKey="",this._lastConfigSig="",this._initInflight=!1,this._cachedIsDarkThemesRef=void 0,this._cachedIsDark=!1,this._homeColorToken="",this._lastRefreshHassRef=void 0,this._lastRefreshConfigSig=void 0,this._lastRefreshTimeRangeRef=void 0,this._lastRefreshEnergyDefaultsRef=void 0,this._arcBackBuf=[],this._arcFrontBuf=[],this._arcFrontNearBuf=[],this._stopPropagation=e=>{e.stopPropagation()},this._onTimelineModeClick=e=>{const t=e.currentTarget.dataset.mode;t&&this._setTimelineMode(t)},this.setChartTarget=e=>{this._chartTarget!==e&&(this._chartTarget=e,this.persistUiState())},this.onChartTargetClick=e=>{const t=e.currentTarget.dataset.target;t&&(this.setChartTarget(t),this._infoPanelOpen=!0,this._infoPanelOpen&&refreshPeriodHourly(this))},this._onUiActivity=()=>{autoHideUi(this.config)&&(noUiDelayMs(this.config)<=0?this._uiHidden||(this._uiHidden=!0):(this._uiHidden&&(this._uiHidden=!1),this._scheduleUiHide()))},this._trackElement=null,this._trackPointerId=null,this.boundPointerMove=e=>function onTimelinePointerMove(e,t){t.pointerId===e._trackPointerId&&applyTimelinePointer(e,t)}(this,e),this.boundPointerUp=e=>function onTimelinePointerUp(e,t){if(t.pointerId!==e._trackPointerId)return;const i=e._trackElement;if(i){try{i.releasePointerCapture(t.pointerId)}catch(L){}i.removeEventListener("pointermove",e.boundPointerMove),i.removeEventListener("pointerup",e.boundPointerUp),i.removeEventListener("pointercancel",e.boundPointerUp)}e._trackElement=null,e._trackPointerId=null,e._chartHoverPct=null}(this,e),this._onPageVisibilityForTheme=()=>{"undefined"!=typeof document&&"visible"===document.visibilityState&&(this._cachedIsDarkThemesRef=void 0,this.requestUpdate())},this._onTimelinePointerDown=e=>function onTimelinePointerDown(e,t){if(!e._timeRange)return;const i=t.currentTarget;i.setPointerCapture(t.pointerId),e._trackElement=i,e._trackPointerId=t.pointerId,i.addEventListener("pointermove",e.boundPointerMove),i.addEventListener("pointerup",e.boundPointerUp),i.addEventListener("pointercancel",e.boundPointerUp),applyTimelinePointer(e,t)}(this,e),this._onChartHoverMove=e=>function onChartHoverMove(e,t){if(0!==t.buttons)return void(e._chartHoverPct=null);const i=t.currentTarget;if(!i)return;const n=i.getBoundingClientRect();n.width<=0||(e._chartHoverPct=100*Math.max(0,Math.min(1,(t.clientX-n.left)/n.width)))}(this,e),this._onChartHoverLeave=()=>function onChartHoverLeave(e){e._chartHoverPct=null}(this),this._instanceId=`h${Math.floor(1e9*Math.random()).toString(36)}`,this.onHomeEnter=()=>{this._homeHover=!0},this.onHomeLeave=()=>{this._homeHover=!1},this._sceneTapStartX=0,this._sceneTapStartY=0,this._onSceneTapStart=e=>{const t=this._localPointerXY(e);t&&(this._sceneTapStartX=t.x,this._sceneTapStartY=t.y)},this._onSceneTapEnd=e=>{const t=this._localPointerXY(e);t&&(Math.hypot(t.x-this._sceneTapStartX,t.y-this._sceneTapStartY)>10||this._infoPanelOpen&&(this._infoPanelOpen=!1))},this._exitScrubMode=()=>{null!==this._selectedTime&&(this._selectedTime=null),this._isLiveMode||(this._isLiveMode=!0)},this._uiStateRestored=!1}setConfig(e){if(!e)throw new Error("Invalid HELIOS configuration");this.config={...e},this._scheduleUiHide()}_applyPeriod(){this._engine?.setPeriodDays(this._periodPastDays,this._periodFutureDays),this._unifiedStore=null;const e=this._engine?.getTimelineRange();e&&(this._timeRange=e,this._selectedTime&&(this._selectedTime.getTime()<e.start.getTime()||this._selectedTime.getTime()>e.end.getTime())&&this._exitScrubMode()),this.requestUpdate()}_setTimelineMode(e){if(this._timelineMode===e)return;this._timelineMode=e;const t=Be[e];this._periodPastDays=modePastDays(e),this._periodFutureDays=modeFutureDays(e),t.weather||"irradiance"!==this._chartTarget||(this._chartTarget="production"),this._applyPeriod(),this.persistUiState()}get _storeFetchPeriod(){return function modeFetchPeriod(e,t){const i=modeBucketsPerHour(e,t);return i>=2?"5minute":i>=1?"hour":"day"}(this._timelineMode,this.config)}get _weatherAvailable(){return Be[this._timelineMode].weather}updateHomeAppearance(e){if(!this._engine)return;const t=chartAccentColor(this),i=e&&void 0!==this._lastHomeTarget;this._lastHomeTarget=this._chartTarget,this._engine.setHomeAppearance(t,i)}_renderPeriodSelector(){const e=pickTranslations(this.hass?.language),t={forecast:e.period?.forecast??"Forecast",yesterday:e.period?.yesterday??"Yesterday",today:e.period?.today??"Today",week:e.period?.week??"Week",month:e.period?.month??"Month",year:e.period?.year??"Year"};return B`
            <div
                class="tb-period-selector"
                role="group"
                aria-label=${e.period?.rangeLabel??"Time range"}
                @pointerdown=${this._stopPropagation}
            >
                ${Ue.map(e=>B`
                    <button
                        type="button"
                        class="tb-period-seg ${this._timelineMode===e?"is-on":""}"
                        data-mode=${e}
                        @click=${this._onTimelineModeClick}
                    >${t[e]}</button>
                `)}
            </div>
        `}static getConfigElement(){return document.createElement("helios-card-editor")}static getStubConfig(e,t){if(e&&Array.isArray(t)&&t.length>0)for(const i of t){if("string"!=typeof i||!i.startsWith("zone."))continue;const t=e.states?.[i],n=t?.attributes?.latitude,r=t?.attributes?.longitude;if("number"==typeof n&&Number.isFinite(n)&&"number"==typeof r&&Number.isFinite(r))return{"home-latitude":n,"home-longitude":r}}return{}}invalidateLocation(){this._lastHomeKey="",this.requestUpdate()}resetDataCache(){this._pvChangeSeries=null,this._pvChangeFetch.reset(),this._pvChangeSeriesPerEntity=/* @__PURE__ */new Map,this._haSolarForecast=[],this._haSolarForecastLoaded=!1,this._haSolarForecastFetching=!1,this._haSolarForecastFetchedAt=0,this._gridImportChangeSeries=null,this._gridExportChangeSeries=null,this._gridImportFetch.reset(),this._gridExportFetch.reset(),this._gridGuard={status:"unknown",cleanEvals:0,fetchKey:"",fetching:!1,entityKey:""},this._batterySocHistory=null,this._batteryFetchKey="",this._batteryChargeChangeSeries=null,this._batteryDischargeChangeSeries=null,this._batteryChangeFetch.reset(),this._deviceChangeSeries=/* @__PURE__ */new Map,this._deviceChangeFetch.reset(),this._irradianceHistory=null,this._irradianceFetchKey="",this._periodHourly=null,this._periodHourlyKey="",this._unifiedStore=null,function clearBatteryModuleCaches(){tt.clear()}(),function clearIrradianceModuleCaches(){it.clear()}(),function clearEnergyStatsCache(){Ie.clear()}(),function clearDurable(){let e=0;try{const t=window.localStorage;if(!t)return 0;const i=[];for(let e=0;e<t.length;e++){const n=t.key(e);n&&n.startsWith(Fe)&&i.push(n)}for(const n of i)t.removeItem(n),e++}catch{}return e}(),this._engine?.resetDataCache(),this._engine?.forceBuildingsRefetch(),this.requestUpdate()}getCardSize(){return 10}getGridOptions(){return{rows:8,columns:12,min_rows:4,max_rows:24,min_columns:12,max_columns:12}}_scheduleUiHide(){if(void 0!==this._uiHideTimer&&(window.clearTimeout(this._uiHideTimer),this._uiHideTimer=void 0),!autoHideUi(this.config))return void(this._uiHidden&&(this._uiHidden=!1));const e=noUiDelayMs(this.config);e<=0?this._uiHidden||(this._uiHidden=!0):this._uiHideTimer=window.setTimeout(()=>{this._uiHidden=!0},e)}connectedCallback(){super.connectedCallback(),Ot.add(this),this._registerCacheId(),void 0!==this._engineTeardownTimer&&(window.clearTimeout(this._engineTeardownTimer),this._engineTeardownTimer=void 0),this._dailyTotalsKicked=!1,tick(this),this._timer=window.setInterval(()=>{tick(this),refreshHaDailyTotals(this)},3e4),function initVisibilityObserver(e){if(e._visibilityObserver||"undefined"==typeof IntersectionObserver)return;let t=!0,i=!1;const applyState=()=>{const n="undefined"!=typeof document&&"hidden"===document.visibilityState,r=!t||n;if(function setAnimationsPaused(e,t){e.classList.toggle("helios-paused",t);const i=e.shadowRoot;if(!i)return;const n=i.querySelectorAll("svg");for(const r of n){const e=r;try{t?e.pauseAnimations?.():e.unpauseAnimations?.()}catch(L){}}}(e,r),e._engine?.setPaused(r),i&&!n){const t=e;t._lastRefreshHassRef=void 0,t._lastRefreshConfigSig=void 0,t._lastRefreshTimeRangeRef=void 0,t._lastRefreshEnergyDefaultsRef=void 0,e.requestUpdate()}i=n};e._visibilityObserver=new IntersectionObserver(e=>{for(const i of e)t=i.isIntersecting;applyState()},{threshold:0}),e._visibilityObserver.observe(e),"undefined"!=typeof document&&(e._onVisibilityChange=applyState,document.addEventListener("visibilitychange",e._onVisibilityChange))}(this),"undefined"!=typeof document&&document.addEventListener("visibilitychange",this._onPageVisibilityForTheme),subscribeEnergyPrefs(this),refreshHaDailyTotals(this),this.addEventListener("pointerdown",this._onUiActivity),this.addEventListener("pointermove",this._onUiActivity,{passive:!0}),this.addEventListener("wheel",this._onUiActivity,{passive:!0}),this.addEventListener("touchstart",this._onUiActivity,{passive:!0}),this._scheduleUiHide()}disconnectedCallback(){super.disconnectedCallback(),Ot.delete(this),window.clearInterval(this._timer),this.removeEventListener("pointerdown",this._onUiActivity),this.removeEventListener("pointermove",this._onUiActivity),this.removeEventListener("wheel",this._onUiActivity),this.removeEventListener("touchstart",this._onUiActivity),void 0!==this._uiHideTimer&&(window.clearTimeout(this._uiHideTimer),this._uiHideTimer=void 0),this._visibilityObserver?.disconnect(),this._visibilityObserver=void 0,this._onVisibilityChange&&(document.removeEventListener("visibilitychange",this._onVisibilityChange),this._onVisibilityChange=void 0),"undefined"!=typeof document&&document.removeEventListener("visibilitychange",this._onPageVisibilityForTheme),unsubscribeEnergyPrefs(this),this._engine&&(this._engine.cacheKey=this.effectiveCacheId()),this._engine?.persistCameraPose(),this.persistUiState(),this._unregisterCacheId(),void 0!==this._engine&&void 0===this._engineTeardownTimer&&(this._engineTeardownTimer=window.setTimeout(()=>{this._engineTeardownTimer=void 0,this._engine?.cleanup(),this._engine=void 0},400)),this._initInflight=!1}willUpdate(e){super.willUpdate(e),e.has("hass")&&function setServerTimeZone(e){const t=e||void 0;t!==We&&(We=t,Ve.clear(),Ne=t?new Intl.DateTimeFormat("en-US",{timeZone:t,hour12:!1,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}):void 0)}(this.hass?.config?.time_zone)}updated(e){this.toggleAttribute("data-ui-hidden",this._uiHidden),showTimeline(this.config)||("today"!==this._timelineMode&&this._setTimelineMode("today"),this._exitScrubMode()),function publishConsumptionColor(e){const t=function homeColor(e){const t=e?.["chip-home-color"];return("string"==typeof t?t.trim():"")||"primary"}(e.config);t!==e._homeColorToken&&(e._homeColorToken=t,e.style.setProperty("--helios-consumption-color",cssHex(e,uiColorVar(t,"green"),"#4caf50")))}(this),this._restoreUiState(),this._maybeRebuildUnifiedStore(),this._engine&&(e.has("_chartTarget")||e.has("_selectedTime")||e.has("hass")||e.has("_unifiedStore")||e.has("_engine"))&&this.updateHomeAppearance(e.has("_chartTarget")),this.hass&&!this._energyPrefsUnsub&&subscribeEnergyPrefs(this),this._energyDefaultsLoaded&&!this._dailyTotalsKicked&&(this._dailyTotalsKicked=!0,refreshHaDailyTotals(this));const t=this._maybeBootstrapOrUpdateEngine();null!==t&&this._runRefreshChainIfNeeded(t)}_maybeBootstrapOrUpdateEngine(){if(!this.hass?.config||!this.config)return null;const e=getHomeCoords(this.config,this.hass);if(!e)return null;const{lat:t,lon:i}=e,n=`${t.toFixed(5)},${i.toFixed(5)}`,r=n!==this._lastHomeKey;if(!this._engine)return this.isConnected?(this._initInflight||(this._lastHomeKey=n,this._lastConfigSig=computeConfigSig(this.config),initEngine(this)),null):null;r&&(this._lastHomeKey=n,this._engine.setHome(t,i));const s=computeConfigSig(this.config);return s!==this._lastConfigSig&&(this._lastConfigSig=s,this._engine.updateConfig(this.config)),s}_runRefreshChainIfNeeded(e){this.hass===this._lastRefreshHassRef&&e===this._lastRefreshConfigSig&&this._timeRange===this._lastRefreshTimeRangeRef&&this._energyDefaults===this._lastRefreshEnergyDefaultsRef||(this._lastRefreshHassRef=this.hass,this._lastRefreshConfigSig=e,this._lastRefreshTimeRangeRef=this._timeRange,this._lastRefreshEnergyDefaultsRef=this._energyDefaults,function refreshPv(e){if(!e.hass)return;const t=resolvePvLiveEntity(e._energyDefaults),i=e._energyDefaults.solarStatEnergyFroms;if(!t&&0===i.length)return void(null!==e._pvCurrent&&(e._pvCurrent=null,e._pvUnit=""));t||null===e._pvCurrent||(e._pvCurrent=null,e._pvUnit="");const n=e._energyDefaults.solarStatRates,r=n.length>1,s=t?e.hass.states?.[t]:void 0;if(s){let t=null,i="";if(r){let r=0,s="",l=!1;for(const t of n){const i=e.hass.states?.[t];if(!i)continue;const n=parseNumericState(i.state);null!==n&&(s||(s=String(i.attributes?.unit_of_measurement??"")),r+=n,l=!0)}l&&(t=r,i=s)}else t=parseNumericState(s.state),i=s.attributes?.unit_of_measurement??"";t!==e._pvCurrent&&(e._pvCurrent=t),i!==e._pvUnit&&(e._pvUnit=i)}else null!==e._pvCurrent&&(e._pvCurrent=null);if(!e._timeRange)return;const l=i;if(l.length>0){const t=localMidnightMinusDays(e._periodPastDays),i=changeRefreshAnchorMs(),n=[...unionChangeMeters(e._energyDefaults)].sort(),r=`${n.join(",")}|${t}|${i}`;e._pvChangeFetch.run(r,()=>fetchChangeById(e.hass,n,t,i,e._storeFetchPeriod).then(t=>{if(null===t)return;const i=mergeChangeSeries(t,l);if(null!==i&&(e._pvChangeSeries=i),l.length>=2){const i=/* @__PURE__ */new Map;for(const e of l){const n=t[e];n&&i.set(e,n)}i.size>0&&(e._pvChangeSeriesPerEntity=i)}e.requestUpdate()}))}}(this),refreshBattery(this),refreshGrid(this),refreshIrradiance(this),refreshDeviceConsumption(this),refreshPeriodHourly(this),fetchHaSolarForecast(this))}_computeIsDark(e){if(e&&"boolean"==typeof e.darkMode)return e.darkMode;if(this._cachedIsDarkThemesRef===e)return this._cachedIsDark;const t=isDarkFromCss(this);return this._cachedIsDarkThemesRef=e,this._cachedIsDark=t,t}_themesObj(){return this.hass?.themes}themeIsDark(){return this._computeIsDark(this._themesObj())}render(){const e=null!==getHomeCoords(this.config,this.hass),t=this._hud.render(),i=this._computeIsDark(this._themesObj())?"theme-dark":"theme-light",n=this._isCameraLocked(),r=this._infoPanelOpen,s="grid"===this._chartTarget?this._hud._gridLeaderColor:"battery"===this._chartTarget||"battery-soc"===this._chartTarget?this._hud._batteryLeaderColor:chartAccentColor(this);return B`
            <ha-card class=${[i,n?"camera-locked":"",this.preview?"helios-edit":""].filter(Boolean).join(" ")} style=${r?`--detail-accent:${s}`:""}>

                <div
                    id="map-container"
                    @pointerdown=${this._onSceneTapStart}
                    @pointerup=${this._onSceneTapEnd}
                ></div>

                ${e&&this._timeRange&&showTimeline(this.config)?B`
                    <div
                        class="time-bar"
                        @pointerdown=${this._onTimelinePointerDown}
                    >
                        ${renderTimelineHoverTooltip(this)}

                        <!--  Single re-targetable bottom chart: the active _chartTarget picks the series
                              (production + dashed forecast + per-source breakdown by default; grid /
                              battery / irradiance once a chip re-targets it). Hosts the dotted day
                              separators, the night-zone hatch, the future mask and the live + scrub
                              cursors. The day-label strip sits below so it never covers the curves.  -->
                        <div
                            class="tb-chart-stack"
                            style="--chart-accent:${chartAccentColor(this)}"
                        >
                            <div
                                class="tb-chart-card"
                                @pointermove=${this._onChartHoverMove}
                                @pointerleave=${this._onChartHoverLeave}
                            >
                                ${ge(`${this._chartTarget}|${this._timelineMode}`,renderBottomChart(this))}
                                ${"forecast"===this._timelineMode||"today"===this._timelineMode||"yesterday"===this._timelineMode||"week"===this._timelineMode?renderTimelineNightZones(this):K}
                                ${function renderTimelineFutureMask(e){const t=resolveRangeMs(e._timeRange);if(!t)return K;const{startMs:i,endMs:n,rangeMs:r}=t,s=Date.now();return s<=i||s>=n?K:B`
        <div
            class="hc-future-mask"
            style="left:${((s-i)/r*100).toFixed(2)}%"
        ></div>
    `}(this)}
                                ${function renderTimelineTicks(e){if(!e._timeRange)return K;const{start:t,end:i}=e._timeRange,n=i.getTime()-t.getTime(),toPct=e=>Math.max(0,Math.min(100,(e.getTime()-t.getTime())/n*100)),r=toPct(/* @__PURE__ */new Date),s=!e._isLiveMode&&null!==e._selectedTime,l=s?toPct(e._selectedTime):0;return B`
        <div class="tb-cursor-now" style="left:${r}%"></div>
        ${s?B`
            <div class="tb-cursor-sel" style="left:${l}%"></div>
        `:K}
    `}(this)}
                            </div>
                            ${renderTimelineDayLabels(this)}
                        </div>
                    </div>
                `:K}

                <!--  Period-mode band: a separate strip BELOW the timeline (own card styling, same width,
                      radius and themed border), holding the Forecast / 1 week / 1 month / 1 year selector.  -->
                ${e&&showTimeline(this.config)?B`
                    <div class="tb-band">
                        ${this._renderPeriodSelector()}
                    </div>
                `:K}

                ${t}

                <!--  Per-chip detail panel: tapping a chip aggregates its metric over the window in a compact
                      top-right readout (icons only, values in the card's unit).  -->
                ${r&&e&&function showDetailPanel(e){return!1!==e?.["show-detail-panel"]}(this.config)?function renderDetailPanel(e){const t=buildMetrics(e,e._chartTarget??"production");return t.length?B`
        <div class="detail-panel">
            ${t.map(e=>B`
                <div class="dp-row ${e.label?"dp-row-device":""}">
                    ${e.label?B`<span class="dp-label">${e.label}</span>`:B`<ha-icon icon=${e.icon}></ha-icon>`}
                    <span class="dp-value">${e.value}</span>
                </div>
            `)}
        </div>
    `:K}(this):K}

            </ha-card>
        `}_localPointerXY(e){const t=this._haCard;if(!t)return null;const i=t.getBoundingClientRect();return{x:e.clientX-i.left,y:e.clientY-i.top}}_maybeRebuildUnifiedStore(){(function isStoreFresh(e,t){return!!t&&t.dataVersion===computeDataVersion(e)})(this,this._unifiedStore)||(this._unifiedStore=buildUnifiedStore(this))}_isCameraLocked(){return!!this._engine&&this._engine.isCameraLocked()}_registerCacheId(){const e=cacheId(this.config);if(!e)return;const t=It.get(e)??[];t.includes(this)||(t.push(this),It.set(e,t))}_unregisterCacheId(){const e=cacheId(this.config),t=e?It.get(e):void 0;if(!t)return;const i=t.indexOf(this);i>=0&&t.splice(i,1),0===t.length&&It.delete(e)}effectiveCacheId(){const e=cacheId(this.config);if(!e)return"";const t=It.get(e),i=t?t.indexOf(this):-1;return i>0?`${e}#${i+1}`:e}_uiStateStorageKey(){const e=this.effectiveCacheId();if(e)return`helios:ui-state:${e}`;const t=getHomeCoords(this.config,this.hass);return t?`helios:ui-state:${Math.round(1e3*t.lat)/1e3}:${Math.round(1e3*t.lon)/1e3}`:null}_restoreUiState(){if(this._uiStateRestored)return;const e=this._uiStateStorageKey();if(e){this._uiStateRestored=!0;try{const t=window.localStorage.getItem(e);if(!t)return;const i=JSON.parse(t);if(i&&"object"==typeof i){const e=["production","consumption","grid","battery","battery-soc","irradiance",...zt];"string"==typeof i.chartTarget&&e.includes(i.chartTarget)&&(this._chartTarget=i.chartTarget),"string"==typeof i.timelineMode&&i.timelineMode in Be&&(this._timelineMode=i.timelineMode,this._periodPastDays=modePastDays(this._timelineMode),this._periodFutureDays=modeFutureDays(this._timelineMode))}}catch(L){}}}persistUiState(){const e=this._uiStateStorageKey();if(e)try{window.localStorage.setItem(e,JSON.stringify({chartTarget:this._chartTarget,timelineMode:this._timelineMode}))}catch(L){}}},Lt.styles=[Ze,Ye],Lt);__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],Ut.prototype,"hass",void 0),__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],Ut.prototype,"config",void 0),__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],Ut.prototype,"preview",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_engine",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_now",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_cloudCover",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_labelLayout",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_pvCurrent",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_pvUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_pvChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_pvChangeSeriesPerEntity",void 0),__decorate([r$1(),__decorateMetadata("design:type",Array)],Ut.prototype,"_haSolarForecast",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_batterySoc",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_batteryPower",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_batteryPowerUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_gridImportValue",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_gridImportUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_gridExportValue",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_gridExportUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_gridImportChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_gridExportChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_batterySocHistory",void 0),__decorate([r$1(),__decorateMetadata("design:type",Array)],Ut.prototype,"_batterySocPerBankHistory",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_periodHourly",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_batteryChargeChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_batteryDischargeChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_deviceChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_sunScene",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_energyDefaults",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_haSolarTodayKwh",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_homeHover",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_chartHoverPct",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_chartTarget",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_infoPanelOpen",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_uiHidden",void 0),__decorate([function e$2(e,t){return(i,n,r)=>{const o=t=>t.renderRoot?.querySelector(e)??null;if(t){const{get:e,set:t}="object"==typeof n?i:r??(()=>{const e=Symbol();return{get(){return this[e]},set(t){this[e]=t}}})();return e$3(i,n,{get(){let i=e.call(this);return void 0===i&&(i=o(this),(null!==i||this.hasUpdated)&&t.call(this,i)),i}})}return e$3(i,n,{get(){return o(this)}})}}("ha-card"),__decorateMetadata("design:type","undefined"==typeof HTMLElement?Object:HTMLElement)],Ut.prototype,"_haCard",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_chartSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_timeRange",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_selectedTime",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_isLiveMode",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_timelineMode",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],Ut.prototype,"_unifiedStore",void 0),Ut=__decorate([t$2("helios-card")],Ut);export{Ut as HeliosCard};