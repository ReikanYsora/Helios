var e,t=globalThis,i=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,r=Symbol(),s=/* @__PURE__ */new WeakMap,n=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==r)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(i&&void 0===e){const i=void 0!==t&&1===t.length;i&&(e=s.get(t)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&s.set(t,e))}return e}toString(){return this.cssText}},r$6=e=>new n("string"==typeof e?e:e+"",void 0,r),i$6=(e,...t)=>new n(1===e.length?e[0]:t.reduce((t,i,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+e[r+1],e[0]),e,r),l=i?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const i of e.cssRules)t+=i.cssText;return r$6(t)})(e):e,{is:c,defineProperty:d,getOwnPropertyDescriptor:u,getOwnPropertyNames:p,getOwnPropertySymbols:g,getPrototypeOf:m}=Object,f=globalThis,y=f.trustedTypes,b=y?y.emptyScript:"",_=f.reactiveElementPolyfillSupport,d$2=(e,t)=>e,v={toAttribute(e,t){switch(t){case Boolean:e=e?b:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let i=e;switch(t){case Boolean:i=null!==e;break;case Number:i=null===e?null:Number(e);break;case Object:case Array:try{i=JSON.parse(e)}catch(e){i=null}}return i}},f$2=(e,t)=>!c(e,t),w={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:f$2};(e=Symbol).metadata??(e.metadata=Symbol("metadata")),f.litPropertyMetadata??(f.litPropertyMetadata=/* @__PURE__ */new WeakMap);var $=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=w){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const i=Symbol(),r=this.getPropertyDescriptor(e,i,t);void 0!==r&&d(this.prototype,e,r)}}static getPropertyDescriptor(e,t,i){const{get:r,set:s}=u(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){const n=r?.call(this);s?.call(this,t),this.requestUpdate(e,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??w}static _$Ei(){if(this.hasOwnProperty(d$2("elementProperties")))return;const e=m(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(d$2("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(d$2("properties"))){const e=this.properties,t=[...p(e),...g(e)];for(const i of t)this.createProperty(i,e[i])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,i]of t)this.elementProperties.set(e,i)}this._$Eh=/* @__PURE__ */new Map;for(const[t,i]of this.elementProperties){const e=this._$Eu(t,i);void 0!==e&&this._$Eh.set(e,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const e of i)t.unshift(l(e))}else void 0!==e&&t.push(l(e));return t}static _$Eu(e,t){const i=t.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=/* @__PURE__ */new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??(this._$EO=/* @__PURE__ */new Set)).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=/* @__PURE__ */new Map,t=this.constructor.elementProperties;for(const i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((e,r)=>{if(i)e.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const i of r){const r=document.createElement("style"),s=t.litNonce;void 0!==s&&r.setAttribute("nonce",s),r.textContent=i.cssText,e.appendChild(r)}})(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){const i=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,i);if(void 0!==r&&!0===i.reflect){const s=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(t,i.type);this._$Em=e,null==s?this.removeAttribute(r):this.setAttribute(r,s),this._$Em=null}}_$AK(e,t){const i=this.constructor,r=i._$Eh.get(e);if(void 0!==r&&this._$Em!==r){const e=i.getPropertyOptions(r),s="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:v;this._$Em=r;const n=s.fromAttribute(t,e.type);this[r]=n??this._$Ej?.get(r)??n,this._$Em=null}}requestUpdate(e,t,i,r=!1,s){if(void 0!==e){const n=this.constructor;if(!1===r&&(s=this[e]),i??(i=n.getPropertyOptions(e)),!((i.hasChanged??f$2)(s,t)||i.useDefault&&i.reflect&&s===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,i))))return;this.C(e,t,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:r,wrapped:s},n){i&&!(this._$Ej??(this._$Ej=/* @__PURE__ */new Map)).has(e)&&(this._$Ej.set(e,n??t??this[e]),!0!==s||void 0!==n)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??(this._$Eq=/* @__PURE__ */new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,i]of e){const{wrapped:e}=i,r=this[t];!0!==e||this._$AL.has(t)||void 0===r||this.C(t,void 0,i,r)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=/* @__PURE__ */new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(e){}firstUpdated(e){}};$.elementStyles=[],$.shadowRootOptions={mode:"open"},$[d$2("elementProperties")]=/* @__PURE__ */new Map,$[d$2("finalized")]=/* @__PURE__ */new Map,_?.({ReactiveElement:$}),(f.reactiveElementVersions??(f.reactiveElementVersions=[])).push("2.1.2");var M=globalThis,i$4=e=>e,T=M.trustedTypes,C=T?T.createPolicy("lit-html",{createHTML:e=>e}):void 0,F="$lit$",H=`lit$${Math.random().toFixed(9).slice(2)}$`,E="?"+H,A=`<${E}>`,D=document,c$1=()=>D.createComment(""),a=e=>null===e||"object"!=typeof e&&"function"!=typeof e,R=Array.isArray,d$1=e=>R(e)||"function"==typeof e?.[Symbol.iterator],P="[ \t\n\f\r]",L=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,I=/-->/g,O=/>/g,z=RegExp(`>|${P}(?:([^\\s"'>=/]+)(${P}*=${P}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),W=/'/g,j=/"/g,B=/^(?:script|style|textarea|title)$/i,x=e=>(t,...i)=>({_$litType$:e,strings:t,values:i}),U=x(1),q=x(2),K=(x(3),Symbol.for("lit-noChange")),G=Symbol.for("lit-nothing"),Y=/* @__PURE__ */new WeakMap,X=D.createTreeWalker(D,129);function V(e,t){if(!R(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==C?C.createHTML(t):t}var N=(e,t)=>{const i=e.length-1,r=[];let s,n=2===t?"<svg>":3===t?"<math>":"",l=L;for(let c=0;c<i;c++){const t=e[c];let i,d,u=-1,p=0;for(;p<t.length&&(l.lastIndex=p,d=l.exec(t),null!==d);)p=l.lastIndex,l===L?"!--"===d[1]?l=I:void 0!==d[1]?l=O:void 0!==d[2]?(B.test(d[2])&&(s=RegExp("</"+d[2],"g")),l=z):void 0!==d[3]&&(l=z):l===z?">"===d[0]?(l=s??L,u=-1):void 0===d[1]?u=-2:(u=l.lastIndex-d[2].length,i=d[1],l=void 0===d[3]?z:'"'===d[3]?j:W):l===j||l===W?l=z:l===I||l===O?l=L:(l=z,s=void 0);const g=l===z&&e[c+1].startsWith("/>")?" ":"";n+=l===L?t+A:u>=0?(r.push(i),t.slice(0,u)+F+t.slice(u)+H+g):t+H+(-2===u?c:g)}return[V(e,n+(e[i]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),r]},Z=class S{constructor({strings:e,_$litType$:t},i){let r;this.parts=[];let s=0,n=0;const l=e.length-1,c=this.parts,[d,u]=N(e,t);if(this.el=S.createElement(d,i),X.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(r=X.nextNode())&&c.length<l;){if(1===r.nodeType){if(r.hasAttributes())for(const e of r.getAttributeNames())if(e.endsWith(F)){const t=u[n++],i=r.getAttribute(e).split(H),l=/([.?@])?(.*)/.exec(t);c.push({type:1,index:s,name:l[2],strings:i,ctor:"."===l[1]?te:"?"===l[1]?ie:"@"===l[1]?oe:ee}),r.removeAttribute(e)}else e.startsWith(H)&&(c.push({type:6,index:s}),r.removeAttribute(e));if(B.test(r.tagName)){const e=r.textContent.split(H),t=e.length-1;if(t>0){r.textContent=T?T.emptyScript:"";for(let i=0;i<t;i++)r.append(e[i],c$1()),X.nextNode(),c.push({type:2,index:++s});r.append(e[t],c$1())}}}else if(8===r.nodeType)if(r.data===E)c.push({type:2,index:s});else{let e=-1;for(;-1!==(e=r.data.indexOf(H,e+1));)c.push({type:7,index:s}),e+=H.length-1}s++}}static createElement(e,t){const i=D.createElement("template");return i.innerHTML=e,i}};function M$1(e,t,i=e,r){if(t===K)return t;let s=void 0!==r?i._$Co?.[r]:i._$Cl;const n=a(t)?void 0:t._$litDirective$;return s?.constructor!==n&&(s?._$AO?.(!1),void 0===n?s=void 0:(s=new n(e),s._$AT(e,i,r)),void 0!==r?(i._$Co??(i._$Co=[]))[r]=s:i._$Cl=s),void 0!==s&&(t=M$1(e,s._$AS(e,t.values),s,r)),t}var J=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:i}=this._$AD,r=(e?.creationScope??D).importNode(t,!0);X.currentNode=r;let s=X.nextNode(),n=0,l=0,c=i[0];for(;void 0!==c;){if(n===c.index){let t;2===c.type?t=new Q(s,s.nextSibling,this,e):1===c.type?t=new c.ctor(s,c.name,c.strings,this,e):6===c.type&&(t=new re(s,this,e)),this._$AV.push(t),c=i[++l]}n!==c?.index&&(s=X.nextNode(),n++)}return X.currentNode=D,r}p(e){let t=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}},Q=class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,r){this.type=2,this._$AH=G,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=M$1(this,e,t),a(e)?e===G||null==e||""===e?(this._$AH!==G&&this._$AR(),this._$AH=G):e!==this._$AH&&e!==K&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):d$1(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==G&&a(this._$AH)?this._$AA.nextSibling.data=e:this.T(D.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:i}=e,r="number"==typeof i?this._$AC(e):(void 0===i.el&&(i.el=Z.createElement(V(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===r)this._$AH.p(t);else{const e=new J(r,this),i=e.u(this.options);e.p(t),this.T(i),this._$AH=e}}_$AC(e){let t=Y.get(e.strings);return void 0===t&&Y.set(e.strings,t=new Z(e)),t}k(e){R(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let i,r=0;for(const s of e)r===t.length?t.push(i=new k(this.O(c$1()),this.O(c$1()),this,this.options)):i=t[r],i._$AI(s),r++;r<t.length&&(this._$AR(i&&i._$AB.nextSibling,r),t.length=r)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=i$4(e).nextSibling;i$4(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}},ee=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,r,s){this.type=1,this._$AH=G,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=s,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(/* @__PURE__ */new String),this.strings=i):this._$AH=G}_$AI(e,t=this,i,r){const s=this.strings;let n=!1;if(void 0===s)e=M$1(this,e,t,0),n=!a(e)||e!==this._$AH&&e!==K,n&&(this._$AH=e);else{const r=e;let l,c;for(e=s[0],l=0;l<s.length-1;l++)c=M$1(this,r[i+l],t,l),c===K&&(c=this._$AH[l]),n||(n=!a(c)||c!==this._$AH[l]),c===G?e=G:e!==G&&(e+=(c??"")+s[l+1]),this._$AH[l]=c}n&&!r&&this.j(e)}j(e){e===G?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},te=class extends ee{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===G?void 0:e}},ie=class extends ee{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==G)}},oe=class extends ee{constructor(e,t,i,r,s){super(e,t,i,r,s),this.type=5}_$AI(e,t=this){if((e=M$1(this,e,t,0)??G)===K)return;const i=this._$AH,r=e===G&&i!==G||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,s=e!==G&&(i===G||r);r&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},re=class{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){M$1(this,e)}},ae={M:F,P:H,A:E,C:1,L:N,R:J,D:d$1,V:M$1,I:Q,H:ee,N:ie,U:oe,B:te,F:re},se=M.litHtmlPolyfillSupport;se?.(Z,Q),(M.litHtmlVersions??(M.litHtmlVersions=[])).push("3.3.2");var ne=globalThis,le=class extends ${constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,i)=>{const r=i?.renderBefore??t;let s=r._$litPart$;if(void 0===s){const e=i?.renderBefore??null;r._$litPart$=s=new Q(t.insertBefore(c$1(),e),e,void 0,i??{})}return s._$AI(e),s})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return K}};le._$litElement$=!0,le.finalized=!0,ne.litElementHydrateSupport?.({LitElement:le});var ce=ne.litElementPolyfillSupport;ce?.({LitElement:le}),(ne.litElementVersions??(ne.litElementVersions=[])).push("4.2.2");var t$2=e=>(t,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)},he={attribute:!0,type:String,converter:v,reflect:!1,hasChanged:f$2},r$3=(e=he,t,i)=>{const{kind:r,metadata:s}=i;let n=globalThis.litPropertyMetadata.get(s);if(void 0===n&&globalThis.litPropertyMetadata.set(s,n=/* @__PURE__ */new Map),"setter"===r&&((e=Object.create(e)).wrapped=!0),n.set(i.name,e),"accessor"===r){const{name:r}=i;return{set(i){const s=t.get.call(this);t.set.call(this,i),this.requestUpdate(r,s,e,!0,i)},init(t){return void 0!==t&&this.C(r,void 0,e,t),t}}}if("setter"===r){const{name:r}=i;return function(i){const s=this[r];t.call(this,i),this.requestUpdate(r,s,e,!0,i)}}throw Error("Unsupported decorator location: "+r)};function n$1(e){return(t,i)=>"object"==typeof i?r$3(e,t,i):((e,t,i)=>{const r=t.hasOwnProperty(i);return t.constructor.createProperty(i,e),r?Object.getOwnPropertyDescriptor(t,i):void 0})(e,t,i)}function r$2(e){return n$1({...e,state:!0,attribute:!1})}var de,e$4=(e,t,i)=>(i.configurable=!0,i.enumerable=!0,Reflect.decorate&&"object"!=typeof t&&Object.defineProperty(e,t,i),i);function e$3(e,t){return(i,r,s)=>{const o=t=>t.renderRoot?.querySelector(e)??null;if(t){const{get:e,set:t}="object"==typeof r?i:s??(()=>{const e=Symbol();return{get(){return this[e]},set(t){this[e]=t}}})();return e$4(i,r,{get(){let i=e.call(this);return void 0===i&&(i=o(this),(null!==i||this.hasUpdated)&&t.call(this,i)),i}})}return e$4(i,r,{get(){return o(this)}})}}function r$1(e){return(t,i)=>e$4(t,i,{get(){return(this.renderRoot??de??(de=document.createDocumentFragment())).querySelectorAll(e)}})}var ue=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,i){this._$Ct=e,this._$AM=t,this._$Ci=i}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}},{I:pe}=ae,ge={},me=(e=>(...t)=>({_$litDirective$:e,values:t}))(class extends ue{constructor(){super(...arguments),this.key=G}render(e,t){return this.key=e,t}update(e,[t,i]){return t!==this.key&&(((e,t=ge)=>{e._$AH=t})(e),this.key=t),i}}),fe=36e5,ye=864e5,be=Math.PI/180,_e="#ffc107",ve="var(--red-color, #f44336)",we=.25,xe=[3e5,9e5,36e5],ke=[6e4,3e5,9e5,36e5],Se=6e4,$e=9e5,Me=["https://overpass-api.de/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter"],Te=.95047,Ce=1.08883,Fe=.137931034,He=.12841855,Ee=1200;function hasLocalLidar(e){return null!==function localLidarConfig(e){if(!0!==e?.["lidar-local-ndsm-enabled"])return null;const t=e?.["lidar-local-ndsm-url"];if("string"!=typeof t||!t.trim())return null;const i=Number(e?.["lidar-local-ndsm-min-lat"]),r=Number(e?.["lidar-local-ndsm-max-lat"]),s=Number(e?.["lidar-local-ndsm-min-lon"]),n=Number(e?.["lidar-local-ndsm-max-lon"]);return[i,r,s,n].every(Number.isFinite)?r<=i||n<=s?null:{url:t.trim(),minLat:i,maxLat:r,minLon:s,maxLon:n}:null}(e)}function customEntityId(e){const t=e?.["custom-entity"];return"string"==typeof t?t.trim():""}function customEntityColor(e){const t=e?.["custom-entity-color"];return("string"==typeof t?t.trim():"")||"red"}function cacheId(e){const t=e?.["cache-id"];return"string"==typeof t?t.trim():""}function valueDecimals(e){const t=e?.["value-decimals"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 1;const r=Math.round(i);return r<0?0:r>3?3:r}function buildingCount(e){const t=e?.["building-count"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 50;const r=Math.round(i);return r<10?10:r>100?100:r}function buildingFixedHeightM(e){const t=e?.["building-height"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 6;const r=Math.round(i);return r<3?3:r>10?10:r}function formatLocalisedNumber(e,t,i,r=!1){if(!isFinite(t))return r?"0":(0).toFixed(i);const s=e?.locale?.language??e?.language??void 0,n=r?{maximumFractionDigits:0}:{minimumFractionDigits:i,maximumFractionDigits:i};try{return new Intl.NumberFormat(s,n).format(t)}catch(I){return r?Math.round(t).toString():t.toFixed(i)}}function haUseAmPm(e){const t=e?.time_format;if("12"===t)return!0;if("24"===t)return!1;const i="language"===t?e?.language:void 0;try{const e=/* @__PURE__ */(new Date).toLocaleString(i);return e.includes("AM")||e.includes("PM")}catch(I){return!1}}function formatPowerKw(e,t,i,r=!1){return r?`${t>0?"+":t<0?"−":""}${formatLocalisedNumber(e,Math.abs(t)/1e3,i)} kW`:`${formatLocalisedNumber(e,t/1e3,i)} kW`}function energyToKwh(e,t){switch((t||"").trim().toLowerCase()){case"wh":return e/1e3;case"mwh":return 1e3*e;default:return e}}function pvNormalizeToWatts(e,t){const i=(t||"").toLowerCase();return"kw"===i?1e3*e:"mw"===i?1e6*e:"w"===i?e:0}function formatEntityValue(e,t,i,r){const s=(i||"").trim(),n=s.toLowerCase();if("w"===n||"kw"===n||"mw"===n)return formatPowerKw(e,pvNormalizeToWatts(t,i),r);if("wh"===n||"kwh"===n||"mwh"===n)return function formatEnergyKwh(e,t,i){return`${formatLocalisedNumber(e,t,i)} kWh`}(e,energyToKwh(t,i),r);const l=formatLocalisedNumber(e,t,r);return s?`${l} ${s}`:l}function lerpHexToward(e,t,i){const r=Math.max(0,Math.min(1,i)),s=parseInt(e.slice(1,3),16),n=parseInt(e.slice(3,5),16),l=parseInt(e.slice(5,7),16),c=parseInt(t.slice(1,3),16),d=parseInt(t.slice(3,5),16),u=parseInt(t.slice(5,7),16),p=Math.round(s+(c-s)*r),g=Math.round(n+(d-n)*r),m=Math.round(l+(u-l)*r),h=e=>e.toString(16).padStart(2,"0");return`#${h(p)}${h(g)}${h(m)}`}function uiColorVar(e,t){return`--${(e??"").trim()||t}-color`}function cssHex(e,t,i){if(!e)return i;const r=getComputedStyle(e).getPropertyValue(t).trim();if(/^#[0-9a-f]{6}$/i.test(r))return r;if(/^#[0-9a-f]{3}$/i.test(r))return"#"+r.slice(1).split("").map(e=>e+e).join("");const s=r.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);if(s){const h=e=>Math.max(0,Math.min(255,Math.round(parseFloat(e)))).toString(16).padStart(2,"0");return"#"+h(s[1])+h(s[2])+h(s[3])}return i}var rgbXyz=e=>{const t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},xyzLab=e=>e>.008856452?e**(1/3):e/He+Fe,xyzRgb=e=>255*(e<=.00304?12.92*e:1.055*e**(1/2.4)-.055),labXyz=e=>e>.206896552?e*e*e:He*(e-Fe);var Ae=/* @__PURE__ */new Map;function energySolarColor(e,t,i){if(e&&getComputedStyle(e).getPropertyValue(`--energy-solar-color-${i}`).trim())return cssHex(e,`--energy-solar-color-${i}`,"#ff9800");const r=cssHex(e,"--energy-solar-color","#ff9800");if(!i)return r;const s=`${r}|${t}|${i}`;let n=Ae.get(s);if(void 0===n){const e=function rgbToLab([e,t,i]){const r=rgbXyz(e),s=rgbXyz(t),n=rgbXyz(i),l=xyzLab((.4124564*r+.3575761*s+.1804375*n)/Te),c=xyzLab((.2126729*r+.7151522*s+.072175*n)/1),d=116*c-16;return[d<0?0:d,500*(l-c),200*(c-xyzLab((.0193339*r+.119192*s+.9503041*n)/Ce))]}(function hexToRgb(e){return[parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]}(r));n=function labToHex([e,t,i]){let r=(e+16)/116,s=r+t/500,n=r-i/200;r=1*labXyz(r),s=Te*labXyz(s),n=Ce*labXyz(n);const l=Math.round(xyzRgb(3.2404542*s-1.5371385*r-.4985314*n)),c=Math.round(xyzRgb(-.969266*s+1.8760108*r+.041556*n)),d=Math.round(xyzRgb(.0556434*s-.2040259*r+1.0572252*n)),h=e=>Math.min(255,Math.max(0,e)).toString(16).padStart(2,"0");return"#"+h(l)+h(c)+h(d)}([e[0]+(t?18:-18)*i,e[1],e[2]]),Ae.set(s,n)}return n}var ENERGY_COLOR_pv=e=>cssHex(e,"--energy-solar-color","#ff9800"),ENERGY_COLOR_consumption=e=>cssHex(e,"--green-color","#4caf50"),ENERGY_COLOR_gridImport=e=>cssHex(e,"--energy-grid-consumption-color","#488fc2"),ENERGY_COLOR_gridExport=e=>cssHex(e,"--energy-grid-return-color","#8353d1"),ENERGY_COLOR_batteryIn=e=>cssHex(e,"--energy-battery-in-color","#f06292"),ENERGY_COLOR_batteryOut=e=>cssHex(e,"--energy-battery-out-color","#4db6ac"),ENERGY_COLOR_sun=e=>_e,ENERGY_COLOR_cloud=e=>cssHex(e,"--secondary-text-color","#727272"),De=class extends Error{constructor(e,t){super(`callWS timeout after ${t} ms (${e})`),this.wsType=e,this.timeoutMs=t,this.name="WsTimeoutError"}},Re=0,Pe=[];function callWSWithTimeout(e,t,i=3e4){return e&&"function"==typeof e.callWS?function acquireFetchSlot(){return Re<2?(Re++,Promise.resolve()):new Promise(e=>{Pe.push(()=>{Re++,e()})})}().then(()=>new Promise((r,s)=>{let n=!1;const finish=e=>{n||(n=!0,function releaseFetchSlot(){Re=Math.max(0,Re-1);const e=Pe.shift();e&&e()}(),e())},l=setTimeout(()=>{finish(()=>s(new De(t.type,i)))},i);e.callWS(t).then(e=>{clearTimeout(l),finish(()=>r(e))},e=>{clearTimeout(l),finish(()=>s(e))})})):Promise.reject(/* @__PURE__ */new Error("hass.callWS unavailable"))}var Le=new Set(["w","kw","mw"]),Ie=new Set(["wh","kwh","mwh"]);function resolveCustomEntityLive(e,t){if(!t)return null;const i=e?.states?.[t];if(!i)return null;const r=parseFloat(i.state);if(!isFinite(r))return null;const s=String(i.attributes?.unit_of_measurement??""),n=s.trim().toLowerCase(),l=String(i.attributes?.device_class??""),c="power"===l||Le.has(n),d="energy"===l||Ie.has(n),u=c?Math.abs(pvNormalizeToWatts(r,s)):d?1e3*Math.abs(energyToKwh(r,s)):Math.abs(r);return{name:String(i.attributes?.friendly_name??t),display:formatEntityValue(e,r,s,1),signedValue:r,magnitudeW:u}}function resolveCustomEntityIcon(e,t){const i="string"==typeof t?.["custom-entity-icon"]?String(t["custom-entity-icon"]).trim():"";if(i)return i;const r=customEntityId(t);return(r?String(e?.states?.[r]?.attributes?.icon??""):"")||"mdi:flash"}function changeRefreshAnchorMs(){return Math.floor(Date.now()/Se)*Se}var Ne=/* @__PURE__ */new Map;async function fetchChangeSeries(e,t,i,r,s="5minute"){if(0===t.length)return null;if(!e?.callWS)return null;if(r<=i)return null;const n=`${s}|${i}|${r}|${[...t].sort().join("|")}`,l=Date.now();!function pruneExpired(e,t){for(const[i,r]of e)!r.inflight&&t-r.ts>55e3&&e.delete(i)}(Ne,l);const c=Ne.get(n);if(c){if(c.inflight)return c.inflight;if(l-c.ts<55e3)return c.result}const d=(async()=>{try{const n=await e.callWS({type:"recorder/statistics_during_period",start_time:new Date(i).toISOString(),end_time:new Date(r).toISOString(),statistic_ids:t,period:s,types:["change"],units:{energy:"kWh"}}),l=/* @__PURE__ */new Map;let c=!1;for(const e of t){const t=n?.[e];if(Array.isArray(t))for(const e of t){const t=parseStatBoundary$3(e?.start);if(null===t)continue;const i="number"==typeof e?.change?e.change:null;if(null===i||!Number.isFinite(i))continue;const r=parseStatBoundary$3(e?.end)??t+periodMs(s),n=l.get(t);n?n.kwh+=i:l.set(t,{startMs:t,endMs:r,kwh:i}),c=!0}}return c?[...l.values()].sort((e,t)=>e.startMs-t.startMs):null}catch(I){return null}})();Ne.set(n,{ts:l,result:null,inflight:d});const u=await d;return Ne.set(n,{ts:Date.now(),result:u}),u}function changeSeriesToWatts(e,t,i,r,s){const n=new Array(r).fill(null);if(!e||0===e.length)return n;const l=new Array(r).fill(0),c=new Array(r).fill(!1);for(const u of e){if(u.startMs<t||u.startMs>=s)continue;const e=Math.floor((u.startMs-t)/i);e<0||e>=r||(l[e]+=u.kwh,c[e]=!0)}const d=i/fe;for(let u=0;u<r;u++)c[u]&&(n[u]=1e3*l[u]/d);return n}function probeChangeWindow(e,t,i){let r=0,s=0,n=0,l=0;for(const c of e){if(c.endMs<=t||c.startMs>=i)continue;const e=c.endMs-c.startMs;if(e<=0)continue;const d=Math.min(c.endMs,i)-Math.max(c.startMs,t);d<=0||(r+=c.kwh*(d/e),s+=d,l++,c.kwh>0&&n++)}return{kwh:r,ms:s,nonZero:n,total:l}}function wattsFromBucket(e){const t=e.endMs-e.startMs;return t>0?Math.max(0,1e3*e.kwh/(t/fe)):0}function latestWattsFromChangeSeries(e,t){if(!e||0===e.length)return null;let i=-1;for(let n=e.length-1;n>=0;n--)if(e[n].endMs<=t){i=n;break}if(i<0)return null;const r=e[i].endMs,s=probeChangeWindow(e,r-$e,r);return 0===s.total||s.nonZero>=Math.ceil(.6*s.total)?wattsFromBucket(e[i]):s.ms>0?Math.max(0,1e3*s.kwh/(s.ms/fe)):0}function wattsAtFromChangeSeries(e,t){if(!e||0===e.length)return null;const i=45e4,r=probeChangeWindow(e,t-i,t+i);if(0===r.total)return null;if(r.nonZero>=Math.ceil(.6*r.total))for(const s of e)if(t>=s.startMs&&t<s.endMs)return wattsFromBucket(s);return r.ms>0?Math.max(0,1e3*r.kwh/(r.ms/fe)):0}function sumChangeForDay(e,t,i){if(!e||0===e.length)return null;let r=0,s=!1;for(const n of e)n.startMs<t||n.startMs>=i||(r+=n.kwh,s=!0);return s?r:null}function periodMs(e){return"5minute"===e?3e5:"hour"===e?fe:ye}function parseStatBoundary$3(e){if("number"==typeof e&&Number.isFinite(e))return e;if("string"==typeof e){const t=Date.parse(e);return Number.isNaN(t)?null:t}return null}var Oe=["now","week","month","year"],ze={now:{pastDays:0,futureDays:1,weather:!0,maxBucketsPerHour:12},week:{pastDays:7,futureDays:0,weather:!0,maxBucketsPerHour:12},month:{pastDays:30,futureDays:0,weather:!1,maxBucketsPerHour:1},year:{pastDays:365,futureDays:0,weather:!1,maxBucketsPerHour:1/24}};function modeBucketsPerHour(e,t){return Math.min(function displayUpdateFrequencyPerHour(e){const t=e?.["display-update-frequency-per-hour"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 4;const r=Math.round(i);return r<1?1:r>12?12:r}(t),ze[e].maxBucketsPerHour)}function clockNeedsHourly(e){return"clock"===e._viewMode&&modeBucketsPerHour(e._timelineMode,e.config)<1}function binChangeByHour(e){const t=new Array(24).fill(0);if(!e)return t;const i=e.map(e=>e.kwh).filter(e=>isFinite(e)&&e>0).sort((e,t)=>e-t),r=i.length?i[Math.floor(i.length/2)]:0,s=r>0?20*r:1/0;for(const n of e){if(!isFinite(n.kwh))continue;const e=Math.max(0,n.kwh);e>s||(t[new Date(n.startMs).getHours()]+=e)}return t}async function statByHour(e,t,i,r,s){const n=new Array(24).fill(0),l=new Array(24).fill(0);if(!t.length)return n;try{const c=await callWSWithTimeout(e,{type:"recorder/statistics_during_period",start_time:new Date(i).toISOString(),end_time:new Date(r).toISOString(),statistic_ids:[...t].sort(),period:"hour",types:s?["mean","change"]:["mean"],...s?{units:{energy:"kWh",power:"W"}}:{}});for(const e of t){const t=Array.isArray(c?.[e])?c[e]:[];for(const e of t){const t="number"==typeof e?.start?e.start:Date.parse(e?.start);if(!isFinite(t))continue;let i=null;if("number"==typeof e?.mean&&isFinite(e.mean))i=e.mean;else if(s&&"number"==typeof e?.change&&isFinite(e.change)){const r=(("number"==typeof e?.end?e.end:Date.parse(e?.end))-t)/fe;i=r>0?e.change/r*1e3:null}if(null===i||!isFinite(i))continue;const r=new Date(t).getHours();n[r]+=s?Math.abs(i):i,l[r]+=1}}}catch(I){}return n.map((e,t)=>l[t]?e/l[t]:0)}async function refreshClockHourly(e){if(!clockNeedsHourly(e)||!e.hass?.callWS||!e._timeRange)return null!==e._clockHourly&&(e._clockHourly=null,e.requestUpdate()),void(e._clockHourlyKey="");const t=e._energyDefaults,i=customEntityId(e.config),r=e._timeRange.start.getTime(),s=Math.floor(Math.min(Date.now(),e._timeRange.end.getTime())/fe)*fe;if(r>=s)return;const n=`${r}|${s}|${t.solarStatEnergyFroms}|${t.gridStatEnergyFroms}|${t.gridStatEnergyTos}|${t.batteryStatEnergyTos}|${t.batteryStatEnergyFroms}|${t.batteryStatSocs}|${i}`;if(n===e._clockHourlyKey)return;const l=!e._clockHourlyKey.startsWith(`${r}|`);e._clockHourlyKey=n,l&&null!==e._clockHourly&&(e._clockHourly=null,e.requestUpdate());const chg=t=>t.length?fetchChangeSeries(e.hass,[...t].sort(),r,s,"hour"):Promise.resolve(null),c=[...t.solarStatEnergyFroms].sort(),[d,u,p,g,m,f,y]=await Promise.all([Promise.all(c.map(t=>fetchChangeSeries(e.hass,[t],r,s,"hour"))),chg(t.gridStatEnergyFroms),chg(t.gridStatEnergyTos),chg(t.batteryStatEnergyTos),chg(t.batteryStatEnergyFroms),statByHour(e.hass,t.batteryStatSocs,r,s,!1),i?statByHour(e.hass,[i],r,s,!0):Promise.resolve(new Array(24).fill(0))]),b=d.map(e=>binChangeByHour(e)),_=new Array(24).fill(0);for(const T of b)for(let e=0;e<24;e++)_[e]+=T[e];const v=binChangeByHour(u),w=binChangeByHour(p),$=binChangeByHour(g),M=binChangeByHour(m);e._clockHourly={pv:b,gridImport:v,gridExport:w,batteryCharge:$,batteryDischarge:M,consumption:_.map((e,t)=>Math.max(0,e+v[t]-w[t]-($[t]-M[t]))),soc:f,custom:y},e.requestUpdate()}var We={cardName:"Helios",cardDescription:"☀️ Real-time 3D sun, clouds, PV production, battery and LiDAR shadows on your home",period:{rangeLabel:"Time range",now:"Now",week:"1 week",month:"1 month",year:"1 year"},editor:{locationSection:"Location",homeLatitude:"Home latitude",homeLongitude:"Home longitude",locationHint:"Override the home address used as the card's center. Leave both fields empty to use Home Assistant's configured home. The override is only applied when BOTH fields are set to valid coordinates.",uiAndMapSection:"UI",autoRotate:"Camera auto-rotation",autoRotateHint:"When idle for a few seconds, the camera slowly orbits the home (about 1.5°/s, opposite to the sun's apparent motion). A single-finger drag pauses it instantly and it resumes once you let go.",autoRotateOn:"On",autoRotateOff:"Off",dataDisplaySection:"Data display",displayUpdateFrequency:"Graph detail",displayUpdateFrequencyHelp:"How many points per hour the graphs draw. The data itself is always Home Assistant's 5-minute statistics; this only controls how densely the curve is plotted: 1 = one point per hour (smoothest, lightest to render), 12 = one point every 5 minutes (full detail, heaviest). Default 4 = a point every 15 minutes. Lower it on older or slower devices to cut rendering cost. The forecast curve follows the same cadence, so a finer setting also resolves short shadow dips (a tree clipping production for half an hour) that an hourly curve steps over.",valueDecimals:"Decimals",valueDecimalsHelp:"Number of decimals shown on every value readout. Power is always shown in kW and energy in kWh; this sets the precision for all of them so the chips read uniform. 0 to 3, default 1.",installationSection:"PV installation",installationHint:"Every entity Helios reads (PV production, grid import / export, battery power and state of charge) is pulled from the [Home Assistant Energy dashboard](/config/energy). This section only adds the install-level details that improve the forecast accuracy: optional irradiance sensor.",solarIrradianceEntity:"Solar irradiance entity",solarIrradianceEntityHelp:"Pick a sensor reporting global shortwave irradiance in W/m² (typical Ecowitt / Davis / personal weather station). When set, its current state and recorder history replace Open-Meteo for the live + past irradiance everywhere it appears (sun chip number, PV chart Y axis, sun arc colouring). Forecast hours stay on Open-Meteo since a sensor cannot carry future values.",customEntity:"Custom entity",customEntityHelp:"Pick any power (W/kW) or energy (Wh/kWh) entity to surface as an extra red chip top-left.",customEntityIcon:"Custom entity icon",customEntityColor:"Custom entity colour",customEntityColorHelp:"Colour of the custom entity chip, its leader line and its clock ring.",buildingsSection:"Building",buildingsHint:'To keep the card smooth in dense urban areas, only buildings within the configured radius around the home are rendered in 3D. The home itself stays at full opacity; nearby buildings are rendered with the configured opacity so they provide urban context without competing with the data overlays. The cluster radius groups attached outbuildings (verandas, garages, sheds) into the "home" set.',displayRadius:"Display radius",displayRadiusHelp:"Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device; 0 shows just the home.",buildingCount:"Building count",buildingCountHelp:"Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device.",buildingRealSize:"Real building heights",buildingRealSizeOn:"On",buildingRealSizeOff:"Off",buildingRealSizeHint:"On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below.",buildingHeight:"Building height",buildingHeightHelp:"Fixed height applied to every building when real heights are off.",buildingClusterRadius:"Home cluster radius",buildingOpacity:"Surrounding opacity",buildingColor:"Building colour",buildingColorHelp:"Base tint applied to the surrounding buildings in the scene.",shadowsSection:"Shadows",shadowsEnabled:"Show shadows",shadowsEnabledOn:"Shown",shadowsEnabledOff:"Hidden",shadowsEnabledHint:"Toggles the cast ground shadows. When on, Helios picks the best available source automatically: a LiDAR provider when one covers your area (buildings + vegetation), OpenFreeMap building footprints otherwise (buildings only).",shadowOpacity:"Shadow opacity",shadowOpacityHint:"Opacity of the cast ground shadows.",resetSection:"Reset",resetSectionHint:"Maintenance tools to wipe data the card has cached locally.",resetCacheButton:"Reset data cache",resetCacheWarning:"Warning: this clears the cached Open-Meteo weather and the in-memory PV history for EVERY Helios card open on this page. The refined forecast will lose its 5 days of calibration until they're re-fetched (a few minutes depending on your HA server). Your data inside Home Assistant is never touched.",resetCacheDone:"Cache cleared ✓",aboutSection:"About",aboutVersionLabel:"Version",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios is built by one passionate developer, with a lot of energy and very little sleep. If you like my work, a small star on GitHub already helps me a lot, and if you can, a small coffee keeps the project alive.",aboutDeveloperLabel:"Developer",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},je={en:We,fr:{cardName:"Helios",cardDescription:"☀️ Soleil, nuages, production PV, batterie et ombres LiDAR sur ta maison, en 3D temps réel",period:{rangeLabel:"Période",now:"Maintenant",week:"1 semaine",month:"1 mois",year:"1 an"},editor:{locationSection:"Localisation",homeLatitude:"Latitude du domicile",homeLongitude:"Longitude du domicile",locationHint:"Remplace l'adresse du domicile utilisée comme centre de la carte. Laissez les deux champs vides pour utiliser le domicile configuré dans Home Assistant. La substitution n'est appliquée que lorsque LES DEUX champs contiennent des coordonnées valides.",uiAndMapSection:"UI",autoRotate:"Rotation auto de la caméra",autoRotateHint:"Après quelques secondes d'inactivité, la caméra tourne lentement autour de la maison (environ 1,5°/s, dans le sens inverse du mouvement apparent du soleil). Un glissement à un doigt met la rotation en pause immédiatement, elle reprend dès que tu lâches.",autoRotateOn:"Activée",autoRotateOff:"Désactivée",dataDisplaySection:"Affichage des données",displayUpdateFrequency:"Détail du graphique",displayUpdateFrequencyHelp:"Combien de points par heure les graphiques tracent. La donnée elle-même est toujours en 5 minutes (statistiques Home Assistant) ; ce réglage ne change que la densité de tracé de la courbe : 1 = un point par heure (le plus lisse, le plus léger), 12 = un point toutes les 5 minutes (détail maximal, le plus lourd). Par défaut 4 = un point toutes les 15 minutes. Baissez-le sur un appareil ancien ou lent pour réduire le coût d'affichage. La courbe de prévision suit la même cadence : un réglage plus fin fait donc ressortir les creux d'ombre courts (un arbre qui coupe la production une demi-heure) qu'une courbe horaire enjambe.",valueDecimals:"Décimales",valueDecimalsHelp:"Nombre de décimales affichées sur chaque valeur. La puissance est toujours en kW et l'énergie en kWh ; ce réglage fixe la précision de toutes pour que les chips restent uniformes. De 0 à 3, par défaut 1.",installationSection:"Installation photovoltaïque",installationHint:"Toutes les entités lues par Helios (production PV, import / export grid, puissance batterie et SoC) sont récupérées depuis le [dashboard Énergie de Home Assistant](/config/energy). Cette section sert uniquement à ajouter des détails sur ton installation pour affiner la prévision : capteur d'irradiance optionnel.",solarIrradianceEntity:"Entité d'irradiance solaire",solarIrradianceEntityHelp:"Choisis un capteur qui remonte l'irradiance solaire globale en W/m² (typiquement une station météo Ecowitt / Davis / perso). Quand il est défini, son état actuel et son historique recorder remplacent Open-Meteo pour les valeurs live + passées partout où elles apparaissent (nombre sur la pastille soleil, axe Y du graphique PV, coloration de l'arc solaire). Les heures de prévision continuent d'utiliser Open-Meteo, un capteur ne peut pas avoir de valeurs dans le futur.",customEntity:"Entité personnalisée",customEntityHelp:"Choisis n'importe quelle entité de puissance (W/kW) ou d'énergie (Wh/kWh) à afficher dans un chip rouge supplémentaire en haut à gauche.",customEntityIcon:"Icône de l'entité personnalisée",customEntityColor:"Couleur de l'entité personnalisée",customEntityColorHelp:"Couleur du chip de l'entité personnalisée, de sa ligne de liaison et de son anneau d'horloge.",buildingsSection:"Bâtiment",buildingsHint:"Pour ménager les performances en zone urbaine dense, seuls les bâtiments dans le rayon configuré autour de la maison sont rendus en 3D. La maison elle-même reste toujours à pleine opacité, les bâtiments voisins sont rendus en transparence pour donner le contexte sans concurrencer les données. Le rayon de regroupement permet d'inclure les bâtiments attenants (véranda, dépendance, garage) dans le groupe « maison ».",displayRadius:"Rayon d'affichage",displayRadiusHelp:"Rayon autour de la maison dans lequel les bâtiments sont récupérés et affichés, jusqu'au bord du disque de carte estompé. Baissez-le pour alléger le rendu sur un appareil lent ; à 0, seule la maison reste.",buildingCount:"Nombre de bâtiments",buildingCountHelp:"Nombre maximum de bâtiments voisins à afficher. Baissez-le pour alléger le rendu sur un appareil lent.",buildingRealSize:"Hauteurs réelles des bâtiments",buildingRealSizeOn:"Oui",buildingRealSizeOff:"Non",buildingRealSizeHint:"Oui : utilise les hauteurs réelles OpenStreetMap (plafonnées pour garder un cadrage lisible). Non : applique à chaque bâtiment la hauteur fixe ci-dessous.",buildingHeight:"Hauteur des bâtiments",buildingHeightHelp:"Hauteur fixe appliquée à chaque bâtiment lorsque les hauteurs réelles sont désactivées.",buildingClusterRadius:"Rayon de regroupement maison",buildingOpacity:"Opacité des bâtiments voisins",buildingColor:"Couleur des bâtiments",buildingColorHelp:"Teinte de base appliquée aux bâtiments environnants dans la scène.",shadowsSection:"Ombres",shadowsEnabled:"Afficher les ombres",shadowsEnabledOn:"Affichées",shadowsEnabledOff:"Masquées",shadowsEnabledHint:"Active ou masque les ombres projetées au sol. Quand actif, Helios choisit automatiquement la meilleure source disponible : un fournisseur LiDAR si ta zone est couverte (bâtiments + végétation), sinon les empreintes des bâtiments OpenFreeMap (bâtiments uniquement).",shadowOpacity:"Opacité des ombres",shadowOpacityHint:"Opacité des ombres projetées au sol.",resetSection:"Réinitialisation",resetSectionHint:"Outils de maintenance pour purger les données mises en cache par la carte.",resetCacheButton:"Réinitialiser le cache des données",resetCacheWarning:"Attention : ce bouton vide la météo Open-Meteo en cache local et l'historique PV en mémoire pour TOUTES les cartes Helios ouvertes. La prévision affinée perdra ses 5 derniers jours de calibration le temps qu'ils soient récupérés à nouveau (quelques minutes selon ton serveur HA). Tes données dans Home Assistant ne sont jamais touchées.",resetCacheDone:"Cache vidé ✓",aboutSection:"À propos",aboutVersionLabel:"Version",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios est développé par un seul développeur passionné, avec beaucoup d'énergie et peu de sommeil. Si tu aimes mon travail, une petite étoile sur GitHub m'aide déjà énormément, et si tu le peux, un petit café garde le projet en vie.",aboutDeveloperLabel:"Développeur",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}}},Be=We;function pickTranslations(e){if(!e)return Be;const t=e.toLowerCase();if(je[t])return je[t];const i=t.split("-")[0];return je[i]?je[i]:Be}function tileUrl(e,t,i){return`https://${"abcd"[(e+t)%4]}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/${i}/${e}/${t}.png`}async function buildGround(e,t,i=18){const[r,s]=function lonLatToTile(e,t,i){const r=2**i,s=t*be;return[(e+180)/360*r,(1-Math.log(Math.tan(s)+1/Math.cos(s))/Math.PI)/2*r]}(t,e,i),n=Math.floor(r)-3,l=Math.floor(s)-3,c=1792,d=256*(r-n),u=256*(s-l),p=document.createElement("canvas");p.width=c,p.height=c,p.className="ground";const g=p.getContext("2d");if(g){const e=[];for(let t=0;t<7;t++)for(let r=0;r<7;r++){const s=n+t,c=l+r;e.push(new Promise(e=>{const n=new Image;n.onload=()=>{g.drawImage(n,256*t,256*r,256,256),e()},n.onerror=()=>e(),n.referrerPolicy="no-referrer",n.src=tileUrl(s,c,i)}))}await Promise.all(e)}const m=document.createElement("div");return m.className="ground-fade",m.style.width="1792px",m.style.height="1792px",{el:p,fade:m,homeX:d,homeY:u,size:c}}var Ve=i$6`
    :host
    {
        display: block;
        height:  100%;
    }

    ha-card
    {
        position: relative;
        overflow: hidden;
        /*  Card background follows the HA theme (the basemap disc fades into it at its edges), so the card
            reads as a first-party tile rather than a black box. */
        background: var(--ha-card-background, var(--card-background-color, #fff));
        /*  Clip the backdrop to the padding box so it stops inside the <ha-card> border instead of bleeding
            under it and painting a corner that breaks HA's subtle frame. */
        background-clip: padding-box;
        /*  Container-query host so the kiosk breakpoint at the bottom reacts to the card's own width,
            not the viewport (which would mis-fire with several cards side by side). See issue #33. */
        container-type: inline-size;
        container-name: helios-card;
        /*  Border + shadow come from <ha-card>'s own --ha-card-* tokens; border-radius stays because
            overflow:hidden clips the full-bleed map to it. */
        border-radius: var(--ha-card-border-radius, 12px);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        height:     100%;
        width:      100%;
        /*  Floor for layouts where the parent gives no explicit height (vertical-stack, panel, some
            grids): without it height:100% collapses to the children's intrinsic height and the 3D map
            area vanishes. 480 px gives the map ~330 px. Layouts that pass a height override this. */
        min-height: 480px;
        /*  Stacking context so absolute z-index children stay scoped to the card and don't escape
            above HA chrome on scroll. */
        isolation: isolate;
    }

    #map-container
    {
        /*  Absolute + inset so the container fills the ha-card via containing-block dimensions (which
            respect min-height). A percentage height would collapse to 0 under Masonry (min-height-only
            floor); absolute works under every layout. Hosts the 2.5D renderer's ground holder + scene SVG.
            overflow:hidden clips the tilted basemap canvas (which extends past the frame at low pitch) to
            the card; perspective gives the rotateX/rotateZ ground transform its vanishing point. */
        position: absolute;
        /*  Bleed 1 px under the border (re-clipped by the card's overflow:hidden) to cover the
            anti-alias seam where the black backdrop would peek at the rounded corners. */
        inset: -1px;
        overflow: hidden;
        perspective: 1200px;
        /*  Explicit z-index so the container (and its home prism) sits ABOVE the clock's flat-ground guide
            layer (.clock-guide-svg, z-index 0) yet still below every HUD overlay (z-index 4+) and the clock
            cylinders (.clock-svg, z-index 5). Lets the dial spokes/hub pass under the house. */
        z-index: 1;
    }

    /*  Renderer ground holder: the tilted basemap tile canvas + edge fade, driven by a CSS 3D transform
        (rotateX = pitch, rotateZ = bearing) the renderer writes each frame. preserve-3d keeps the canvas
        in the parent's perspective space. */
    .scene-ground-holder
    {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        pointer-events: none;
    }
    /*  Basemap tile canvas (CARTO Voyager). Positioned by the renderer's transform-origin + transform;
        sized in JS to the stitched tile grid. One light style is fetched for both themes. */
    .ground
    {
        position: absolute;
        top: 0;
        left: 0;
    }
    /*  Dark theme tints the (light) Voyager basemap to a dark map purely in CSS — invert + hue-rotate keep
        it legible, brightness + low saturation keep it calm under the HUD. Reads better than swapping to a
        separate dark tile set (too bright in light, too dark in dark). */
    ha-card.theme-dark .ground
    {
        filter: invert(0.9) hue-rotate(170deg) brightness(1.3) contrast(1) saturate(0.4);
    }
    /*  Edge fade: same size + transform as the ground, a radial gradient that's transparent out to 90%
        (GROUND_FADE_START) then dissolves to the themed card background, turning the square tile grid into
        a soft disc that melts into the card. */
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
            transparent ${r$6(90)}%,
            var(--ha-card-background, var(--card-background-color, #fff)) 100%
        );
    }
    /*  Screen-space scene SVG: the renderer repaints night-shade + cast shadows + extruded buildings into
        it every frame. Full-size overlay above the ground, click-transparent (the HUD SVGs above own
        their own pointer events). */
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
        HUD chips: ONE shared box recipe for all six floating pills so they
        render at identical height, min-width, padding and font. Only the
        DISTINCT bits (border-colour, z-index, colour, pointer behaviour,
        active-glow, ha-icon, per-chip states) live in the per-chip rules
        below. Do not re-declare the box geometry per chip.
        ============================================================ */
    .pv-pct-label,
    .battery-pct-label,
    .grid-label,
    .custom-label,
    .solar-pct-label,
    .cloud-chip,
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
        box-shadow: 0 1px 3px var(--shadow-color);
    }

    /*  Crisp-text: the chips land at fractional pixels (50% anchor + -50% translate), so geometric
        precision + antialiased smoothing keeps the glyphs sharp. */
    .pv-pct-label,
    .battery-pct-label,
    .grid-label,
    .custom-label,
    .solar-pct-label,
    .cloud-chip,
    .home-pill
    {
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }

    /*  Camera-lock toggle, top-left. 40 px circle; brand-blue pastille appears when locked. */
    .overlay-btn
    {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width:  40px;
        height: 40px;
        box-sizing: border-box;
        padding: 0;
        background-color: transparent;
        background-clip: padding-box;
        color: var(--primary-text-color, #212121);
        border: 0;
        outline: 0 !important;
        outline-offset: 0;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        pointer-events: auto;
        position: relative;
        z-index: 50;
        opacity: 1;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.15s, color 0.15s;
    }
    .overlay-btn:hover,
    .overlay-btn:focus,
    .overlay-btn:focus-visible,
    .overlay-btn:active
    {
        outline: 0 !important;
        box-shadow: none !important;
    }
    .overlay-btn ha-icon
    {
        --mdc-icon-size: 22px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        pointer-events: none;
    }
    .overlay-btn:hover  { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08); }
    .overlay-btn:active { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.16); }
    .overlay-btn.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .overlay-btn.is-on:hover  { background: var(--dark-primary-color, #0288d1); }
    .overlay-btn.is-on:active { background: var(--darker-primary-color, #01579b); }
    /*  Disabled state: button stays visible to show the lock state but is inert,
        greyed out with no hover/active feedback. */
    .overlay-btn.is-disabled,
    .overlay-btn[disabled]
    {
        opacity: 0.45;
        cursor: default;
        pointer-events: none;
    }

    /*  View mode. Clock fades every layer but the basemap (and the top-left controls); Scene restores them.
        The basemap (.scene-ground-holder) lives inside #map-container alongside .scene-svg, so the scene SVG
        is faded by name while the map container itself (and the holder) stay. */
    ha-card > :not(#map-container):not(.overlay-top-left):not(.time-bar):not(.clock-overlay):not(.overlay-top-right),
    ha-card .scene-svg
    {
        transition: opacity var(--ha-animation-duration-slow, 350ms) ease;
    }
    /*  Clock mode hides the HUD chips/leaders/timeline; the scene SVG stays visible but the engine renders it
        home-only (setHomeOnly), so the home prism anchors the dial centre. */
    ha-card.mode-clock > :not(#map-container):not(.overlay-top-left):not(.time-bar):not(.clock-overlay):not(.overlay-top-right):not(.tb-band)
    {
        opacity: 0;
        pointer-events: none;
    }

    /*  Top-left rail hosting the mode toggles + camera-lock. pointer-events off on
        the rail; the buttons opt back in so they don't steal map interactions. */
    .overlay-top-left
    {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        pointer-events: none;
    }
    /*  PV production chip: compact horizontal pill tinted in the production colour (--pv-leader-color,
        set inline). Fixed min-width shared with the battery chips so the leader gap is identical
        regardless of how wide the value reads. */
    .pv-pct-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
    }

    /*  Shared icon recipe for the five value chips (PV / battery / grid / cloud / sun). The home
        pill's icon is coloured differently, so it keeps its own rule below. */
    .pv-pct-label ha-icon,
    .battery-pct-label ha-icon,
    .grid-label ha-icon,
    .custom-label ha-icon,
    .cloud-chip ha-icon,
    .solar-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Re-targetable chips: clicking one points the bottom chart at that metric. Base chips are
        display-only; the [role="button"] selector re-enables events and out-specifies the base rule. */
    .pv-pct-label[role="button"],
    .battery-pct-label[role="button"],
    .grid-label[role="button"],
    .custom-label[role="button"],
    .solar-pct-label[role="button"]
    {
        pointer-events: auto;
        cursor: pointer;
    }
    /*  Active target: a soft halo in the chip's own metric colour so the chip-to-chart coupling reads
        at a glance. */
    .pv-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--pv-leader-color, var(--energy-solar-color, #ff9800)) 70%, transparent);
    }
    .battery-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac)) 70%, transparent);
    }
    .grid-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2)) 70%, transparent);
    }
    .custom-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--custom-leader-color, ${r$6(ve)}) 70%, transparent);
    }
    .solar-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #ffc107)) 70%, transparent);
    }

    /*  Predicted PV chip when scrubbing into the future: the value is modelled, not measured, so the
        chip dims and a leading "≈" (set by render) signals "estimate". */
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

    /*  Grid chip, same pill recipe as the PV/battery chips. Shows the active flow only; the border
        follows the inline --grid-leader-color (blue importing, purple exporting), icon + value flip
        with it. */
    .grid-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2));
    }
    /*  Custom-entity chip, same pill recipe; red border + red leader from --custom-leader-color. Icon-only,
        like the cluster's other chips — the icon (override / entity / generic) carries the identity. */
    .custom-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--custom-leader-color, ${r$6(ve)});
    }
    /*  Full-size overlay SVGs for the home-cluster leaders (grid, custom, PV→home, battery). Identical box;
        each hosts its own coloured path(s) defined below. */
    .grid-leader-svg,
    .custom-leader-svg,
    .pv-home-leader-svg,
    .battery-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    /*  Single grid leader; stroke + bead fill from the inline --grid-leader-color, so one path serves
        both import (blue) and export (purple). */
    .grid-leader-line,
    .custom-leader-line
    {
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  PV → home leader: vertical dashed line from the PV chip down to the home, in the PV colour.
        z 5, below the chip cluster (z 6) so the dashes pass behind the chips. */
    .pv-home-leader-line
    {
        stroke: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  Moving bead riding a leader at a speed proportional to live flow, like HA's energy-distribution
        card. Shared by the PV→home, battery and sun→PV ray beads (identical recipe). */
    .pv-home-leader-bead,
    .battery-leader-bead,
    .solar-svg .solar-ray-bead
    {
        opacity: 0.95;
        stroke: var(--primary-text-color, #212121);
        stroke-width: 1;
        paint-order: stroke fill;
    }



    /*  Battery leaders. SoC↔PV and PV↔Power share a solid L-shaped path with a rounded bend. The
        PV↔Power leader carries a bead at a speed proportional to |P|, its path flipped inline when
        discharging so travel matches the flow. The SoC leader is static: SoC is a level, not a flow. */
    .battery-leader-line
    {
        stroke: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
    }

    /*  Solar overlay split into two passes so chips never occlude the live sun while the night part
        still reads as background: .solar-svg-back paints the below-horizon dots below the chip cluster
        (z 4); .solar-svg-front paints the above-horizon arc + ray + sun disc above the chips (z 7). */
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
        /*  Home == consumption: matches the consumption green used by its clock area + chart. */
        color: var(--green-color, #4caf50);
        border-color: var(--green-color, #4caf50);
        /*  Clickable: the home is the consumption chip, retargeting the bottom chart to home usage. */
        pointer-events: auto;
        cursor: pointer;
        /*  Keep the mask fade and ease the hover glow in/out. */
        transition: opacity 0.35s ease, box-shadow 0.2s ease;
    }
    /*  Light glow on home hover; the hover state is driven from the hitbox by the card. */
    .home-pill.is-hovered
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 7px 1px color-mix(in srgb, var(--green-color, #4caf50) 28%, transparent);
    }
    /*  Active consumption target: same retarget glow the other chips use, in the consumption green. */
    .home-pill.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--green-color, #4caf50) 70%, transparent);
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
    /*  Above-horizon arc in two passes so depth drives the local z-order around the home cluster:
        front-far (z 5) is behind the chips/pill (arc disappears behind the home), front-near (z 11) is
        in front (arc comes over the top). Sun disc (z 12) + W/m² chip (z 13) paint last. */
    .solar-svg-front-far  { z-index: 5; }
    .solar-svg-front-near { z-index: 11; }
    /*  Sun disc inherits the arc's depth split: far half under chips + leaders (z 5, passes behind the
        home), near half over everything but the W/m² chip (z 12). */
    .solar-svg-sun-far    { z-index: 5;  }
    .solar-svg-sun-near   { z-index: 12; }
    /*  Sun → PV ray + bead on their own SVG below the chips (z 8) so the chip background occludes the
        ray endpoint at the chip border. The sun disc stays in the depth-split SVGs above. */
    .solar-ray-svg        { z-index: 7;  }

    /*  Arc: first pass a dark outline for legibility on light basemaps, second pass the sun colour on
        top. Stroke widths set inline per segment. */
    .solar-svg .solar-arc-outline { stroke: rgba(0, 0, 0, 0.35); stroke-linecap: round; }
    .solar-svg .solar-arc-segment { stroke-linecap: round; }

    /*  Below-horizon segments as round dots (dasharray "0 N" + round linecap = true circles
        everywhere) so the underground leg reads without colour cues. Stroke alpha halved vs the
        above-horizon arc so the dotted leg recedes as ambient context. */
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

    /*  Incidence ray: dashes flow sun → home at a speed proportional to live irradiance. 1 px hairline
        to match the home cluster's leaders. */
    .solar-svg .solar-ray
    {
        stroke-width: 1;
        stroke-dasharray: 5 5;
        stroke-opacity: 0.55;
        stroke-linecap: round;
        animation: solar-ray-flow var(--sun-flow-duration, 30s) linear infinite;
    }

    @keyframes solar-ray-flow
    {
        from { stroke-dashoffset: 0;  }
        to   { stroke-dashoffset: -10; }
    }

    /*  Cloud chip on the sun → home line: a grey pill showing live cover, clickable to re-target the
        chart to the cloud bands. Same recipe + active glow as the other chips. */
    /*  Cloud chip is the only chip with a custom width: it's just a short percentage, so it sizes to its
        content (no fixed width) and reads about half as wide as the others, saving space. */
    .cloud-chip
    {
        z-index: 11;
        width: auto;
        pointer-events: auto;
        cursor: pointer;
        color: var(--primary-text-color, #212121);
        border-color: var(--secondary-text-color, #727272);
    }
    .cloud-chip.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--secondary-text-color, #727272) 70%, transparent);
    }
    /*  Short cloud-coloured leader joining the irradiance chip to the cloud chip on its right. */
    .cloud-chip-leader
    {
        position: absolute;
        transform: translateY(-50%);
        width: 14px;
        height: 2px;
        background: var(--secondary-text-color, #727272);
        border-radius: 1px;
        pointer-events: none;
        z-index: 10;
    }

    /*  Sunrise / sunset marker: a small glyph + local time pinned just outside the arc at the horizon
        crossing, centred on its computed point. Sun-coloured, click-transparent. */
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

    /*  Solar irradiance label pinned above the live sun, same chip language as the cloud/PV chips.
        Distinct from the shared base: it anchors above the sun, so it uses a -100% vertical translate
        instead of the shared -50%, and sits higher in the stack. */
    .solar-pct-label
    {
        transform: translate(-50%, -100%);
        pointer-events: none;
        /*  Above the arc-front lines (z 11) so an arc segment never crosses the W/m² readout; the sun
            disc (z 12) still paints on top. */
        z-index: 13;
        color: var(--primary-text-color, #212121);
        /*  Sun chip uses the HA amber token so it stays distinct from the PV production chip (orange). */
        border-color: var(--helios-sun-color, var(--amber-color, var(--warning-color, #ffc107)));
    }


    /*  ============================================================
        Dark theme, opt-in via \`card-theme: dark\`. Affects only the chrome
        (chips, charts, cursors, labels, leaders, tooltips); the basemap
        keeps its own colours. Chip plates flip white → near-black, text/
        borders go light-grey, and chart hairlines flip to white-on-dark
        with the same opacity envelopes. User-coloured fills, the scrub
        blue and the live tooltip plate already read on dark, left alone.
        ============================================================ */

    /*  Solar arc outline: the light skin paints a black halo for legibility on bright basemaps; in
        dark mode that halo would vanish into the map, so paint a faint white halo instead. */
    ha-card.theme-dark .solar-svg .solar-arc-outline
    {
        stroke: rgba(255, 255, 255, 0.45);
    }


    /*  Animation perf hooks:
        1. .helios-paused (set by the card's IntersectionObserver when scrolled off-screen) pauses every
           CSS animation; SMIL <animateMotion> is paused in parallel via svg.pauseAnimations().
        2. prefers-reduced-motion disables every helios animation + transition at the OS level. */
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



`,Ue=i$6`
    /*  Timeline, pinned to the bottom of the card. The whole bar accepts pointer events for scrub.
        Slides out below the card edge (transform) instead of fading when hidden. */
    .time-bar
    {
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: transform;
        position: absolute;
        /*  Sits above the period-mode band (which is pinned at bottom: 6px). */
        bottom: calc(var(--tb-band-h, 36px) + 12px);
        /*  Centred via left/right gutters, not translateX(-50%): the transform promoted the bar into a
            compositor layer that rasterised the inner SVG charts at fractional resolution = blur. */
        left: 8px;
        right: 8px;
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

    /*  Chart + day-label footer composite. The frame (accent stroke, radius, shadow) lives here so the
        chart and its footer read as one instrument with a hairline divider between them, like the HA
        energy-solar-overview timeline. overflow:hidden clips both children to the rounded corners. */
    .tb-chart-stack
    {
        position: relative;
        background: var(--card-background-color, #ffffff);
        /*  HA-style card frame: a thin stroke in the active chart accent, softened to 60 % so it reads
            as a subtle frame. */
        border: var(--ha-border-width-sm, 1px) solid
            color-mix(in srgb, var(--chart-accent, var(--primary-text-color, #212121)) 60%, transparent);
        border-radius: var(--ha-border-radius-lg, 8px);
        box-shadow: 0 1px 3px var(--shadow-color);
        overflow: hidden;
    }
    .tb-chart-card
    {
        position: relative;
        /*  Height scales with container width (cqw): 36 px floor on a small tile, 72 px ceiling on a
            kiosk. Both timeline charts share this expression so they stay equal height. */
        height: clamp(36px, 8cqw, 72px);
        overflow: hidden;
    }
    .hc-chart-svg
    {
        display: block;
        width: 100%;
        height: 100%;
    }
    /*  Grow only the curves up from the baseline when the chart re-targets (SVG is keyed so it
        re-mounts and replays), matching HA's 500 ms grow. Separators + hover guide sit outside this
        group so they don't stretch. fill-box anchors the scale at the chart baseline. */
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

    /*  Stroke-only outline over the filled area so peaks read cleanly where the gradient fades.
        0.7 px hairline: a wider stroke self-overlapped on high-variation days and smudged dense
        regions into a band. */
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
        clear-sky model. Stroke colour is computed theme-aware in charts.ts. */
    .hc-chart-predicted
    {
        stroke-dasharray: 4 3;
        stroke-width: 1;
    }

    /*  Per-source PV curves on multi-source installs. Drawn under the aggregate at lower opacity as
        background context. Stroke colour comes from the inline attribute (HA Energy's per-source ramp,
        see energySolarColor in format.ts) so the curve matches its tooltip-row pastille + the
        home histogram band. */
    .hc-chart-line-source
    {
        opacity: 0.35;
    }



    /*  Dotted day separators at midnight boundaries, at 0.55 alpha so they read clearly. Flips with
        the theme via --rgb-primary-text-color. */
    .hc-day-sep
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        stroke-width: 1.2;
        stroke-dasharray: 2 2.5;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }


    /*  Live cursor: thin "where now is" line spanning the chart. Slightly wide + opaque so it stays
        readable through the future-mask wash, but kept subtle as a passive reference. */
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
    /*  Scrub cursor: a thin solid brand-blue stroke spanning the chart, no arrow or handle, so it
        reads as a minimal scrub mark. */
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
        preserveAspectRatio="none", which stretched <circle> dots into ovals. CSS-pixel dots
        (width=height, border-radius 50%) stay round. Position derived from the hoverX/W, hoverY/H
        ratios since card and SVG share the same content area. */
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
        children slide together as one block on scrub. Bottom + margin lift the stack into the gap
        above the chart card. */
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
        border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .tb-hover-tooltip-time-icon
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
    .tb-hover-tooltip-row
    {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 1px 0;
    }

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
    .tb-hover-tooltip-value
    {
        flex: 1;
        text-align: right;
    }

    /*  Per-source breakdown rows under the aggregate PV row on multi-source installs. Indented +
        smaller so they read as children of the headline. The colour pastille mirrors the per-source
        chart curve so row and curve can be matched. */
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
        border + primary glyph) so it reads on both themes without clashing with the tooltip background.
        The dot pulses, mirroring HA Energy's live-data vocabulary. */
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
        edges. Painted via repeating-linear-gradient so the magnet-snap variant can flow the dots
        (a dashed border could not be animated). */
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


    /*  Future-mask wash: stretches from "now" to the right edge, on top of the curves and night zones
        but below the cursors (z 4). Card background at moderate alpha lightens both curves and
        night-zone washes in one pass without redoubling on overlap. */
    .hc-future-mask
    {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        pointer-events: none;
        z-index: 3;
        /*  color-mix on transparent keeps the wash translucent on every theme so the predicted PV
            curve stays visible; the bare var(--card-background-color) goes opaque in dark mode and
            would hide the prediction. */
        background: color-mix(in srgb, var(--card-background-color, #ffffff) 55%, transparent);
    }


    .hc-night-zone
    {
        position: absolute;
        top: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 3;
        /*  Night-slice wash: a touch darker in light themes (lighter in dark, rule below), no hatch or
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
        height: 22px;
        box-sizing: border-box;
        /*  Footer band of the chart stack: frame lives on .tb-chart-stack, so here we only draw the
            hairline separating labels from the chart above (like the HA timeline footer). */
        border-top: var(--ha-border-width-sm, 1px) solid
            var(--divider-color, rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.12));
        overflow: hidden;
        pointer-events: none;
    }
    /*  Timeline label point-positioned on its model fraction: inline left anchors the fraction, the
        translate centres the text over it. */
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
        /*  HA frontend font stack so the label's metrics match the chart cards above. */
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: clamp(9px, 7cqw, 11px);
        line-height: 18px;
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

    /*  Header row above the chart: active-target indicator left, period selector right. pointer-events:
        none so the band stays transparent to map rotation; the children re-enable events. */
    /*  Period-mode band: a separate strip below the timeline, its own card frame — same width (8 px gutters),
        radius and themed border as the timeline card. Pinned to the bottom; the timeline sits above it. Stays
        visible in clock mode. --tb-band-h keeps the timeline's bottom offset in sync. */
    .tb-band
    {
        position: absolute;
        bottom: 6px;
        left: 8px;
        right: 8px;
        height: var(--tb-band-h, 36px);
        z-index: 1000;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px;
        background: var(--card-background-color, #ffffff);
        border: var(--ha-border-width-sm, 1px) solid
            var(--divider-color, var(--ha-card-border-color, rgba(0, 0, 0, 0.12)));
        border-radius: var(--ha-border-radius-lg, 8px);
        box-shadow: 0 1px 3px var(--shadow-color);
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
        background: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08);
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

    /*  Fullscreen / kiosk breakpoint (issue #33): above 900 px card width the chip text bumps one size
        step up so the chips, day-strip and W/m² readout stay legible from across the room. On-map
        geometry is scaled separately by the engine (_heliosScale). Keyed on the container query (above)
        so it flips on the card's own width, not the viewport's. */
    @container helios-card (min-width: 900px)
    {
        .tb-day-strip-date
        {
            font-size: clamp(8px, 5.5cqw, var(--ha-font-size-s, 12px));
        }
        .tb-hover-tooltip
        {
            font-size: var(--ha-font-size-s, 13px);
        }
    }

`,qe=i$6`
    /*  Overlay wrapper that holds the whole clock (svg + medallion + labels + tooltip). Full-bleed and
        inert; its absolutely-positioned children share the card's coordinate space. Named so the scene's
        clock-mode fade leaves it (and the right rail) untouched. */
    .clock-overlay
    {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    /*  Flat-ground guide layer (centre hub + 24 hour spokes + compass) painted each frame, above the basemap
        (#map-container) so it stays visible, below the cylinders (.clock-svg z5) so columns rise over it. */
    .clock-guide-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        pointer-events: none;
        overflow: visible;
    }

    /*  Screen-space SVG the cylinders paint into each frame (innerHTML set imperatively). Sits above the
        basemap AND the home prism, below the controls; inert so map drag-rotate passes straight through. */
    .clock-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 5;
        pointer-events: none;
        overflow: visible;
    }

    /*  Hour labels laid flat on the ground (transform set per frame), outside the ring of cylinders.
        Below the cylinders so foreground columns pass over them. */
    .clock-hour-label
    {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 3;
        transform-origin: center;
        will-change: transform, opacity;
        pointer-events: none;
        font-size: var(--ha-font-size-l, 16px);
        font-weight: var(--ha-font-weight-medium, 500);
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
        white-space: nowrap;
    }

    /*  Compass letters (N / S) laid flat on the ground at the triangle tips. Like the hour labels but bold
        and at full opacity — they never fade with distance, so the orientation always reads. */
    .clock-compass-label
    {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 3;
        transform-origin: center;
        will-change: transform;
        pointer-events: none;
        font-size: var(--ha-font-size-l, 16px);
        font-weight: var(--ha-font-weight-bold, 700);
        line-height: 1;
        white-space: nowrap;
    }

    /*  Hover tooltip; left/top set inline to the cursor, then clamped inside the card. */
    /*  Anchored bottom-left, just above the period band — NOT under the cursor — so it never sits over the
        dial or the scrub it describes. */
    .clock-tip
    {
        position: absolute;
        left: 8px;
        bottom: calc(var(--tb-band-h, 36px) + 12px);
        z-index: 14;
        min-width: 120px;
        max-width: calc(100% - 16px);
        box-sizing: border-box;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 8px;
        padding: 6px 10px;
        font-size: var(--ha-font-size-s, 12px);
        line-height: 1.6;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 2px 6px var(--shadow-color, rgba(0, 0, 0, 0.3));
        pointer-events: none;
    }
    .clock-tip-head
    {
        font-weight: 600;
        margin-bottom: 2px;
    }
    .clock-tip-row
    {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
    }
    .clock-tip-row ha-icon
    {
        --mdc-icon-size: 16px;
        flex: none;
    }
    /*  Per-entity breakdown row: the value pushed flush right so the column of numbers aligns. */
    .clock-tip-val
    {
        margin-left: auto;
        font-variant-numeric: tabular-nums;
    }
    .clock-tip-total
    {
        font-weight: 600;
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    /*  Forecast (not-yet-measured) hours: italic to echo the transparent cylinders. */
    .clock-tip.is-predicted
    {
        font-style: italic;
    }

    /*  Right-hand metric rail: the dynamic list of clickable chips that retargets the clock. Mirrors the
        top-left rail; only configured metrics render, stacked with no gaps. */
    .overlay-top-right
    {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        pointer-events: none;
    }
    /*  Idle icon takes the metric's colour so the rail reads like the chips; the active button fills with
        that same colour (overriding the shared --primary-color fill). */
    .overlay-top-right .overlay-btn ha-icon
    {
        color: var(--clock-btn-color, var(--primary-text-color, #212121));
    }
    .overlay-top-right .overlay-btn.is-on
    {
        background: var(--clock-btn-color, var(--primary-color, #03a9f4));
    }
    .overlay-top-right .overlay-btn.is-on ha-icon
    {
        color: var(--text-on-primary-color, #ffffff);
    }

    /*  Rail row that pairs the Clock mode button with the sub-mode toggle, side by side. */
    .overlay-top-left .rail-row
    {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }
    /*  Sub-mode toggle: a pill with a sliding circular knob, the SAME height as the 40 px rail buttons it
        sits beside. Left = histogram, right = area curve; the knob slides under the active side and that
        icon brightens onto it. */
    .clock-submode
    {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 40px;
        box-sizing: border-box;
        padding: 6px;
        border-radius: 999px;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        box-shadow: 0 1px 3px var(--shadow-color, rgba(0, 0, 0, 0.2));
        cursor: pointer;
        pointer-events: auto;
        user-select: none;
    }
    .clock-submode .cs-knob
    {
        position: absolute;
        top: 6px;
        left: 6px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        transition: transform var(--ha-animation-duration-fast, 150ms) ease;
    }
    /*  Knob sits over histogram (left) by default; slides one slot (icon width + gap) right for area. */
    .clock-submode.mode-area .cs-knob
    {
        transform: translateX(32px);
    }
    .clock-submode .cs-opt
    {
        position: relative;
        z-index: 1;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color, #727272);
        transition: color var(--ha-animation-duration-fast, 150ms) ease;
    }
    /*  The active side's icon reads on the knob fill. */
    .clock-submode.mode-histogram .cs-histogram,
    .clock-submode.mode-area .cs-area
    {
        color: var(--text-on-primary-color, #ffffff);
    }
`,Ke=i$6`
    /*  Clock mode fades all but a few layers; LiDAR mode goes further and hides EVERYTHING (basemap + scene
        SVG + HUD + timeline) except the top-left rail, so only the controls float over the LiDAR wireframe. */
    ha-card.mode-lidar > :not(.overlay-top-left):not(.lidar-overlay)
    {
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--ha-animation-duration-slow, 350ms) ease;
    }
`;function startOfDay(e){const t=new Date(e);return t.setHours(0,0,0,0),t}function addDays(e,t){const i=new Date(e);return i.setDate(i.getDate()+t),i}function addWeeks(e,t){return addDays(e,7*t)}function addMonths(e,t){const i=new Date(e);return i.setMonth(i.getMonth()+t),i}function startOfISOWeek(e){const t=startOfDay(e);return addDays(t,-(t.getDay()+6)%7)}function startOfMonth(e){const t=new Date(e);return t.setHours(0,0,0,0),t.setDate(1),t}function buildTimelineModel(e,t,i=7){const r=t.getTime()-e.getTime()||1,s=r/ye;let n,l,c,d,u;if(s<=2.05){n="intraday";const t=r/fe,s=[1,2,3,4,6,12].find(e=>t/e<=i)??12,p=Math.ceil((e.getHours()+e.getMinutes()/60+.001)/s)*s;l=new Date(startOfDay(e).getTime()+p*fe),c=e=>new Date(e.getTime()+s*fe),d=null,u="boundary"}else s<=14.05?(n="days",l=addDays(startOfDay(e),1),c=e=>addDays(e,1),d=e=>startOfDay(e),u="centered"):s<=120.05?(n="weeks",l=startOfISOWeek(addWeeks(e,1)),c=e=>addWeeks(e,1),d=e=>startOfISOWeek(e),u="boundary"):(n="months",l=startOfMonth(addMonths(e,1)),c=e=>addMonths(e,1),d=e=>startOfMonth(e),u="centered");const p="days"===n?Math.max(i,16):i,thin=e=>{const t=Math.max(1,Math.ceil(e.length/p));return e.filter((e,i)=>i%t===0)},g=[];for(let b=l,_=0;b.getTime()<t.getTime()&&_<500;_++){const t=(b.getTime()-e.getTime())/r;t>0&&t<1&&g.push({frac:t,date:new Date(b)}),b=c(b)}const m=thin(g);let f;if("boundary"===u)f=m;else{const i=[];let s=d(e);for(let n=0;s.getTime()<t.getTime()&&n<500;n++){const n=c(s),l=n.getTime()-s.getTime()||1;if(Math.min(n.getTime(),t.getTime())-Math.max(s.getTime(),e.getTime())>=.99*l){const t=((s.getTime()+n.getTime())/2-e.getTime())/r;i.push({frac:t,date:new Date(s)})}s=n}f=thin(i)}const y=[];if(s>1.05&&s<=40){let i=addDays(startOfDay(e),1);for(let s=0;i.getTime()<t.getTime()&&s<64;s++){const t=(i.getTime()-e.getTime())/r;t>0&&t<1&&y.push(t),i=addDays(i,1)}}return{kind:n,start:e,end:t,separators:m,labels:f,dayBoundaries:y}}function resolvePvLiveEntity(e){return e.solarStatRates.length>0?e.solarStatRates[0]:e.solarStatEnergyFroms.length>0?e.solarStatEnergyFroms[0]:""}var Ge=/* @__PURE__ */new Map;function refreshPv(e){const t=resolvePvLiveEntity(e._energyDefaults);if(!t||!e.hass)return void(null===e._pvCurrent&&null===e._pvHistory||(e._pvCurrent=null,e._pvHistory=null,e._pvUnit=""));null===e._pvHistory&&(e._pvHistory={times:[],values:[]});const i=e._energyDefaults.solarStatRates.length>0?e._energyDefaults.solarStatRates:e._energyDefaults.solarStatEnergyFroms,r=i.length>1,s=e.hass.states?.[t];if(s){let t=null,n="",l=0;if(r){let r=0,s="",c=!1;for(const t of i){const i=e.hass.states?.[t];if(!i)continue;const n=parseFloat(i.state);if(!isFinite(n))continue;s||(s=String(i.attributes?.unit_of_measurement??"")),r+=n,c=!0;const d=i.last_updated?new Date(i.last_updated).getTime():Date.now();d>l&&(l=d)}c&&(t=r,n=s)}else{const e=parseFloat(s.state);t=isFinite(e)?e:null,n=s.attributes?.unit_of_measurement??"",l=s.last_updated?new Date(s.last_updated).getTime():Date.now()}if(t!==e._pvCurrent&&(e._pvCurrent=t),n!==e._pvUnit&&(e._pvUnit=n),null!==t){const i=l||Date.now(),r=e._pvHistory;if(r){const s=r.times.length-1;if(i>(s>=0?r.times[s].getTime():0)&&null!==t&&(r.times.push(new Date(i)),r.values.push(t),e._timeRange)){const t=e._timeRange.start.getTime();let i=0;for(;i<r.times.length&&r.times[i].getTime()<t;)i++;i>0&&(r.times.splice(0,i),r.values.splice(0,i))}}}}else null!==e._pvCurrent&&(e._pvCurrent=null);if(!e._timeRange)return;const n=e._timeRange.end,l=/* @__PURE__ */new Date;l.setHours(0,0,0,0);const c=[...i].sort(),d=c.length>0?c.join(","):t;if(!e._pvCalibStatsFetching){const i=/* @__PURE__ */new Date(l.getTime()-5*ye),r=`${d}@h|${i.getTime()}|${n.getTime()}`;if(r!==e._pvCalibStatsFetchKey){e._pvCalibStatsFetchKey=r;const s=function pvStatsCacheGet(e,t){const i=e.get(t);return i?Date.now()-i.ts>9e5?(e.delete(t),null):i:null}(Ge,r);if(s)e._pvCalibStats=s.stats,e._pvHistoryPerEntity=s.perEntity;else{const s=c.length>0?c:[t],l=(e._pvUnit||"").toLowerCase();!async function fetchPvStatistics(e,t,i,r,s,n="",l=!1){if(!e.hass?.callWS||0===t.length)return;const c="_pvCalibStatsFetching",d="_pvCalibStats",u=Ge;e[c]=!0;try{const c=/* @__PURE__ */new Date,p=r>c?c:r;if(i>=p)return void(e[d]={times:[],values:[]});const g=await callWSWithTimeout(e.hass,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:p.toISOString(),statistic_ids:t,period:s,types:["mean","state"],units:{energy:"kWh",power:"W"}}),m=[];for(const e of t){const t=(g&&g[e])??[],i=[],r=[];for(const e of t){const t=e?.start,s=e?.end,n=parseStatBoundary$2(t),l=parseStatBoundary$2(s);if(null===n)continue;let c=e?.mean;if(null==c&&(c=e?.state),null==c)continue;const d="number"==typeof c?c:parseFloat(String(c));if(!isFinite(d))continue;const u=null!==l?(n+l)/2:n;i.push(new Date(u)),r.push(d)}m.push({times:i,values:r})}const f=/* @__PURE__ */new Map;for(let e=0;e<t.length;e++)f.set(t[e],m[e]);e._pvHistoryPerEntity=f;const y=function aggregatePvHistoriesLkcf(e,t=!1){if(0===e.length)return{times:[],values:[]};if(1===e.length)return e[0];const i=/* @__PURE__ */new Set;for(const c of e)for(const e of c.times)i.add(e.getTime());const r=Array.from(i).sort((e,t)=>e-t),s=new Array(e.length).fill(-1),n=t?new Array(e.length).fill(null):null,l=[];for(const c of r){let t=0;for(let i=0;i<e.length;i++){const r=e[i];let l=s[i];for(;l+1<r.times.length&&r.times[l+1].getTime()<=c;)l++;s[i]=l,l>=0&&isFinite(r.values[l])&&(n?(null===n[i]&&(n[i]=r.values[l]),t+=r.values[l]-n[i]):t+=r.values[l])}l.push(t)}return{times:r.map(e=>new Date(e)),values:l}}(m,l);e[d]=y,n&&u.set(n,{stats:y,perEntity:f,ts:Date.now()})}catch(p){e[d]={times:[],values:[]}}finally{e[c]=!1}}(e,s,i,n,"hour",r,"wh"===l||"kwh"===l||"mwh"===l)}}}const u=e._energyDefaults.solarStatEnergyFroms;if(u.length>0&&!e._pvChangeSeriesFetching){const t=new Date(l.getTime()-e._periodPastDays*ye),i=[...u].sort(),r=`${i.join(",")}|${t.getTime()}|${n.getTime()}|${changeRefreshAnchorMs()}`;r!==e._pvChangeSeriesFetchKey&&(e._pvChangeSeriesFetchKey=r,e._pvChangeSeriesFetching=!0,fetchChangeSeries(e.hass,i,t.getTime(),n.getTime(),e._storeFetchPeriod).then(t=>{null!==t&&(e._pvChangeSeries=t),e.requestUpdate()}).finally(()=>{e._pvChangeSeriesFetching=!1}))}}function parseStatBoundary$2(e){if(null==e)return null;if("number"==typeof e)return e>1e12?e:1e3*e;if("string"==typeof e){const t=Number(e);if(Number.isFinite(t)&&t>1e9)return t>1e12?t:1e3*t;const i=new Date(e).getTime();return isFinite(i)?i:null}return null}function formatPvValue(e,t,i,r){return formatEntityValue(e,t,i,r)}var Ye=class{constructor(){this.bearingDeg=180,this.tiltDeg=50,this.pxPerMetre=1,this.centreX=0,this.centreY=0,this.hasViewport=!1,this._cosB=Math.cos(180*be),this._sinB=Math.sin(180*be),this._cosT=Math.cos(50*be),this._sinT=Math.sin(50*be)}setPose(e,t){this.bearingDeg=e,this.tiltDeg=Math.min(65,Math.max(5,t))}setViewport(e,t){const i=this.tiltDeg*be,r=this.bearingDeg*be;this.centreX=e/2,this.centreY=t/2,this.hasViewport=!0,this._cosB=Math.cos(r),this._sinB=Math.sin(r),this._cosT=Math.cos(i),this._sinT=Math.sin(i)}project3(e,t,i){const r=e*this.pxPerMetre,s=-t*this.pxPerMetre,n=i*this.pxPerMetre,l=r*this._cosB-s*this._sinB,c=r*this._sinB+s*this._cosB,d=c*this._sinT+n*this._cosT,u=Ee/Math.max(Ee-d,180);return{x:this.centreX+l*u,y:this.centreY+(c*this._cosT-n*this._sinT)*u,depth:d}}project(e,t,i){const r=this.project3(e,t,i);return[r.x,r.y]}groundTransform(e,t){return{transformOrigin:`${e}px ${t}px`,transform:`translate(${(this.centreX-e).toFixed(2)}px, ${(this.centreY-t).toFixed(2)}px) rotateX(${this.tiltDeg}deg) rotateZ(${this.bearingDeg}deg)`}}};function pointsAttr(e){return e.map(e=>`${e[0].toFixed(1)},${e[1].toFixed(1)}`).join(" ")}var lerp=(e,t,i)=>e+(t-e)*i,hexByte=(e,t)=>parseInt(e.slice(t,t+2),16);function mixHex(e,t,i){let r="#";for(let s=1;s<7;s+=2){const n=hexByte(e,s);r+=Math.round(n+(hexByte(t,s)-n)*i).toString(16).padStart(2,"0")}return r}function tintedRgba(e,t,i){const r=function buildingColor(e,t){if(t<-6)return mixHex(e,"#0a0e1a",.85);const i=mixHex(e,"#0a0e1a",.85),r=mixHex(e,"#2a2540",.55),s=mixHex(e,"#5a3220",.35);return t<0?mixHex(i,r,(t+6)/6):t<6?mixHex(r,s,t/6):t<20?mixHex(s,e,(t-6)/14):e}(e,t);return`rgba(${hexByte(r,1)},${hexByte(r,3)},${hexByte(r,5)},${i})`}var arcColor=(e,t)=>e<=0?"#3a4a63":e<12?mixHex(t,"#ff6a00",.5):t;function osmHeightM(e){if(!e)return null;const t=parseFloat(e.height);if(Number.isFinite(t)&&t>0)return t;const i=parseFloat(e["building:levels"]);return Number.isFinite(i)&&i>0?3*i:null}function distanceToHome(e){if(function pointInPolygon(e,t,i){let r=!1;for(let s=0,n=i.length-1;s<i.length;n=s++){const[l,c]=i[s],[d,u]=i[n];c>t!=u>t&&e<(d-l)*(t-c)/(u-c)+l&&(r=!r)}return r}(0,0,e))return 0;let t=1/0;for(let i=0,r=e.length-1;i<e.length;r=i++){const[s,n]=e[r],l=e[i][0]-s,c=e[i][1]-n,d=l*l+c*c,u=d?Math.max(0,Math.min(1,(-s*l-n*c)/d)):0;t=Math.min(t,Math.hypot(s+u*l,n+u*c))}return t}function parseRawBuildings(e,t,i){const r=111320*Math.cos(t*be),s=[],n=[];for(const l of e)if("way"===l.type&&l.geometry)n.push({geometry:l.geometry,tags:l.tags});else if("relation"===l.type&&l.members)for(const e of l.members)!e.geometry||"outer"!==e.role&&e.role||n.push({geometry:e.geometry,tags:l.tags});for(const{geometry:l,tags:c}of n){const e=l.map(e=>[(e.lon-i)*r,111320*(e.lat-t)]);if(e.length>1&&e[0][0]===e[e.length-1][0]&&e.pop(),e.length<3)continue;let n=0;for(let t=0;t<e.length;t++){const i=(t+1)%e.length;n+=e[t][0]*e[i][1]-e[i][0]*e[t][1]}n<0&&e.reverse();let d=0,u=0;for(const[t,i]of e)d+=t,u+=i;s.push({footprint:e,centerX:d/e.length,centerY:u/e.length,distanceM:distanceToHome(e),osmHeightM:osmHeightM(c)})}return s.sort((e,t)=>e.distanceM-t.distanceM),s.slice(0,100)}function simplifyFootprint(e){const t=e.length;if(t<4)return e;const i=[];for(let r=0;r<t;r++){const s=e[(r+t-1)%t],n=e[r],l=e[(r+1)%t],c=l[0]-s[0],d=l[1]-s[1],u=(n[0]-s[0])*d-(n[1]-s[1])*c;Math.abs(u)/(Math.hypot(c,d)||1)>.05&&i.push(n)}return i.length>=3?i:e}function convexHull(e){if(e.length<3)return e.slice();const t=e.slice().sort((e,t)=>e[0]-t[0]||e[1]-t[1]),cross=(e,t,i)=>(t[0]-e[0])*(i[1]-e[1])-(t[1]-e[1])*(i[0]-e[0]),i=[];for(const s of t){for(;i.length>=2&&cross(i[i.length-2],i[i.length-1],s)<=0;)i.pop();i.push(s)}const r=[];for(let s=t.length-1;s>=0;s--){const e=t[s];for(;r.length>=2&&cross(r[r.length-2],r[r.length-1],e)<=0;)r.pop();r.push(e)}return i.pop(),r.pop(),i.concat(r)}var prefersReducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,Xe=class{constructor(e,t={}){this.camera=new Ye,this._groundToken=0,this._buildings=[],this._sun={azimuth:0,altitude:0},this._growth=1,this._home={growth:1},this._homeRaf=0,this._homeOnly=!1,this._palette={home:"#488fc2",neighbor:"#cccccc",sun:"#ffc107",shadow:"#000000",shadowOpacity:.32,neighborOpacity:.25},this._redrawScheduled=!1,this._rafToken=0,this._growthRaf=0,this._alive=!0,this._obsW=-1,this._obsH=-1,this._container=e,t.sun&&(this._palette.sun=t.sun),t.shadow&&(this._palette.shadow=t.shadow),null!=t.shadowOpacity&&(this._palette.shadowOpacity=t.shadowOpacity),this._groundHolder=document.createElement("div"),this._groundHolder.className="scene-ground-holder",this._sceneSvg=document.createElementNS("http://www.w3.org/2000/svg","svg"),this._sceneSvg.setAttribute("class","scene-svg"),e.appendChild(this._groundHolder),e.appendChild(this._sceneSvg),this._resizeObserver=new ResizeObserver(e=>{const t=e[e.length-1]?.contentRect;if(!t)return;const i=Math.round(t.width),r=Math.round(t.height);i===this._obsW&&r===this._obsH||(this._obsW=i,this._obsH=r,this.scheduleRedraw())}),this._resizeObserver.observe(e);const i=e.clientWidth,r=e.clientHeight;i>0&&r>0&&this.camera.setViewport(i,r)}async setLocation(e,t){this.camera.pxPerMetre=function pxPerMetreFor(e,t=18){return 256*2**t/(40075016.686*Math.cos(e*be))}(e);const i=++this._groundToken,r=await buildGround(e,t);this._alive&&i===this._groundToken&&(this._ground=r,this._groundHolder.replaceChildren(r.el,r.fade),this.scheduleRedraw())}setBuildings(e){this._buildings=e,this.scheduleRedraw()}setSun(e,t){this._sun={azimuth:e,altitude:t},this.scheduleRedraw()}setGrowth(e){this._growth=Math.max(0,Math.min(1,e))}animateGrowth(){if(this._growthRaf&&(cancelAnimationFrame(this._growthRaf),this._growthRaf=0),prefersReducedMotion())return this._growth=1,void this.scheduleRedraw();this._growth=0,this.scheduleRedraw();const e=performance.now(),tick=t=>{if(!this._alive)return void(this._growthRaf=0);const i=Math.min(1,(t-e)/500);this._growth=1-(1-i)**3,this.scheduleRedraw(),this._growthRaf=i<1?requestAnimationFrame(tick):0};this._growthRaf=requestAnimationFrame(tick)}setPalette(e){this._palette={...this._palette,...e},this.scheduleRedraw()}setHome(e,t=[]){this._home={color:e,bands:t,growth:this._home.growth??1},this.scheduleRedraw()}setHomeOnly(e){this._homeOnly!==e&&(this._homeOnly=e,this.scheduleRedraw())}animateHomeTo(e,t=[]){if(this._homeRaf&&(cancelAnimationFrame(this._homeRaf),this._homeRaf=0),!this._home.color||prefersReducedMotion())return this._home={color:e,bands:t,growth:1},void this.scheduleRedraw();const i=220,r=performance.now(),tick=s=>{if(!this._alive)return void(this._homeRaf=0);const n=s-r;if(n<i){const e=n/i;this._home={...this._home,growth:1-e*e*e}}else{if(!(n<520))return this._home={color:e,bands:t,growth:1},this.scheduleRedraw(),void(this._homeRaf=0);{const r=(n-i)/300;this._home={color:e,bands:t,growth:1-(1-r)**3}}}this.scheduleRedraw(),this._homeRaf=requestAnimationFrame(tick)};this._homeRaf=requestAnimationFrame(tick)}setCameraBearing(e){this.camera.setPose(e,this.camera.tiltDeg),this.scheduleRedraw()}setCameraPitch(e){this.camera.setPose(this.camera.bearingDeg,e),this.scheduleRedraw()}getCameraBearing(){return this.camera.bearingDeg}getCameraPitch(){return this.camera.tiltDeg}scheduleRedraw(){!this._redrawScheduled&&this._alive&&(this._redrawScheduled=!0,this._rafToken=requestAnimationFrame(()=>{this._redrawScheduled=!1,this._draw()}))}_draw(){if(!this._alive)return;const e=this._container.clientWidth||0,t=this._container.clientHeight||0;if(0===e||0===t)return;if(this.camera.setViewport(e,t),this._ground){const{transform:e,transformOrigin:t}=this.camera.groundTransform(this._ground.homeX,this._ground.homeY);this._ground.el.style.transformOrigin=t,this._ground.el.style.transform=e,this._ground.fade.style.transformOrigin=t,this._ground.fade.style.transform=e}this._sceneSvg.setAttribute("viewBox",`0 0 ${e} ${t}`);const i=this._sun.altitude,r=this._homeOnly?this._buildings.filter(e=>e.isHome):this._buildings,s=this._homeOnly?{opacity:0,color:""}:function nightShade(e){return e<-12?{color:"#02040c",opacity:.68}:e<-6?{color:"#040824",opacity:lerp(.5,.68,(-e-6)/6)}:e<0?{color:"#0a1240",opacity:lerp(.5,.3,(e+6)/6)}:e<6?{color:"#3a1408",opacity:lerp(.3,.1,e/6)}:e<20?{color:"#3a1408",opacity:lerp(.1,0,(e-6)/14)}:{color:"#000000",opacity:0}}(i),n=s.opacity>0?`<rect width="${e}" height="${t}" fill="${s.color}" opacity="${s.opacity.toFixed(3)}"/>`:"";this._sceneSvg.innerHTML=n+function renderShadows(e,t,i,r,s){const n=Math.min(1,i.altitude/10);if(n<=0)return"";const l=(i.azimuth+180)*be;let c="";for(const d of t){if(e.project3(d.centerX,d.centerY,0).depth>=1020)continue;const t=Math.min(d.height/Math.tan(i.altitude*be),50),s=Math.sin(l)*t,n=Math.cos(l)*t,u=d.footprint.map(t=>e.project(t[0],t[1],0)),p=d.footprint.map(t=>e.project(t[0]+s,t[1]+n,0));c+=`<polygon points="${pointsAttr(convexHull([...u,...p]))}" fill="${r}"/>`}return c?`<g opacity="${(s*n).toFixed(3)}">${c}</g>`:""}(this.camera,r,this._sun,this._palette.shadow,this._palette.shadowOpacity)+function renderBuildings(e,t,i,r,s,n=.25,l={}){const c=t.map((t,i)=>{const r=e.project3(t.centerX,t.centerY,0);return{index:i,depth:r.y,cameraZ:r.depth}}).filter(e=>e.cameraZ<1020).sort((e,t)=>e.depth-t.depth),d=r.neighbor,nbRgba=e=>`rgba(${hexByte(d,1)},${hexByte(d,3)},${hexByte(d,5)},${Math.max(0,Math.min(1,e)).toFixed(3)})`,u=l.bands&&l.bands.length>=2?l.bands:null;let p="";for(const{index:g}of c){const c=t[g],d=simplifyFootprint(c.footprint),m=c.height*s*(c.isHome?l.growth??1:1),f=[0],y=[];if(c.isHome&&u){for(const e of u)f.push(Math.min(1,f[f.length-1]+e.frac)),y.push(tintedRgba(mixHex(e.color,"#000000",.22),i,.9));f[f.length-1]=1}else f.push(1),y.push(c.isHome?tintedRgba(mixHex(l.color??r.home,"#000000",.22),i,.9):nbRgba(.7*n));const b=f.map(t=>d.map(i=>e.project(i[0],i[1],m*t))),_=b[0],v=b[b.length-1],w=u?u[u.length-1].color:l.color??r.home,$=c.isHome?tintedRgba(mixHex(w,"#ffffff",.18),i,.92):nbRgba(n);let M=nbRgba(Math.min(1,1.1*n));if(c.isHome){const e=mixHex(l.color??r.home,"#ffffff",.5);M=`rgba(${hexByte(e,1)},${hexByte(e,3)},${hexByte(e,5)},0.1)`}const T=c.isHome?1:.4,C=[];for(let t=0;t<_.length;t++){const r=(t+1)%_.length,s=_[t],n=_[r],l=v[r],c=v[t];if(s[0]*n[1]-n[0]*s[1]+(n[0]*l[1]-l[0]*n[1])+(l[0]*c[1]-c[0]*l[1])+(c[0]*s[1]-s[0]*c[1])>=0)continue;let p="";for(let e=0;e<y.length;e++){const i=b[e],s=b[e+1];p+=`<polygon points="${pointsAttr([i[t],i[r],s[r],s[t]])}" fill="${y[e]}" stroke="${M}" stroke-width="${T}"/>`}if(u&&y.length>1)for(let e=1;e<y.length;e++){const s=b[e],n=tintedRgba(mixHex(u[e-1].color,"#000000",.45),i,.95);p+=`<line x1="${s[t][0].toFixed(2)}" y1="${s[t][1].toFixed(2)}" x2="${s[r][0].toFixed(2)}" y2="${s[r][1].toFixed(2)}" stroke="${n}" stroke-width="0.9"/>`}const g=(d[t][0]+d[r][0])/2,f=(d[t][1]+d[r][1])/2;C.push({depth:e.project3(g,f,m/2).depth,svg:p})}C.push({depth:e.project3(c.centerX,c.centerY,m).depth,svg:`<polygon points="${pointsAttr(v)}" fill="${$}" stroke="${M}" stroke-width="${c.isHome?1:.6}"/>`}),C.sort((e,t)=>e.depth-t.depth),p+=C.map(e=>e.svg).join("")}return p}(this.camera,r,i,this._palette,this._growth,this._palette.neighborOpacity,this._home),this.onAfterDraw?.()}cleanup(){this._alive=!1,this._resizeObserver?.disconnect(),this._resizeObserver=void 0,this._rafToken&&(cancelAnimationFrame(this._rafToken),this._rafToken=0),this._growthRaf&&(cancelAnimationFrame(this._growthRaf),this._growthRaf=0),this._homeRaf&&(cancelAnimationFrame(this._homeRaf),this._homeRaf=0),this._groundHolder.remove(),this._sceneSvg.remove()}},Ze=null,Je=null;function getSunPosition(e,t,i){const r=`${e.getTime()}|${t.toFixed(6)}|${i.toFixed(6)}`;if(r===Ze&&null!==Je)return Je;const s=Math.PI/180,n=e.getUTCHours()+e.getUTCMinutes()/60+e.getUTCSeconds()/3600,l=Math.floor((e.getTime()-Date.UTC(e.getUTCFullYear(),0,0))/864e5),c=23.45*Math.sin(s*(360/365)*(l-81)),d=s*(360/365)*(l-81);let u=15*(n+i/15+(9.87*Math.sin(2*d)-7.53*Math.cos(d)-1.5*Math.sin(d))/60-12);u=((u+180)%360+360)%360-180;const p=Math.sin(s*t)*Math.sin(s*c)+Math.cos(s*t)*Math.cos(s*c)*Math.cos(s*u),g=Math.asin(Math.max(-1,Math.min(1,p)))/s,m=Math.cos(g*s),f=m>1e-4?(Math.sin(s*c)-Math.sin(s*t)*p)/(Math.cos(s*t)*m):0;let y=Math.acos(Math.max(-1,Math.min(1,f)))/s;u>0&&(y=360-y);const b={altitude:g,azimuth:y};return Ze=r,Je=b,b}function computePvPower(e,t,i,r,s,n){const l=getSunPosition(e,t,i),c=l.altitude;if(c<=0)return 0;const d=Math.PI/180,u=Math.sin(c*d),p=1098*u*Math.exp(-.059/u),g=1-.75*(Math.max(0,Math.min(100,r))/100)**3.4,m=null!=n?.ghiWm2&&n.ghiWm2>=0?n.ghiWm2:p*g;let f;if(!s||s.tiltDeg<=0&&!s.tracker)f=n?.shading?.25*m:m;else{let e=s.tiltDeg,t=s.azimuthDeg;"dual-axis"===s.tracker?(e=90-c,t=l.azimuth):"single-axis-h"===s.tracker?e=90-c:"single-axis-v"===s.tracker&&(t=l.azimuth);const i=e*d,r=(l.azimuth-t)*d,p=c*d,y=Math.sin(p)*Math.cos(i)+Math.cos(p)*Math.sin(i)*Math.cos(r),b=y>0?Math.max(0,y)/Math.max(.087,u):0;let _;_=null!=n?.directWm2&&n.directWm2>=0&&null!=n?.diffuseWm2&&n.diffuseWm2>=0&&n.directWm2+n.diffuseWm2>0?n.directWm2/(n.directWm2+n.diffuseWm2):Math.max(0,Math.min(.85,(g-.25)/.75*.85));const v=1-_,w=n?.shading?0:m*_*b,$=m*v*(1+Math.cos(i))/2,M=.2*m*(1-Math.cos(i))/2;f=null!=n?.poaWm2&&n.poaWm2>=0?n.shading?Math.min(n.poaWm2,$+M):n.poaWm2:w+$+M}const y=Math.max(0,f/1e3);return Math.max(0,Math.min(100,100*y))}function computeIrradianceWm2(e,t,i,r){const s=getSunPosition(e,t,i).altitude;if(s<=0)return 0;const n=Math.PI/180,l=Math.sin(s*n),c=1098*l*Math.exp(-.059/l),d=1-.75*(Math.max(0,Math.min(100,r))/100)**3.4;return Math.max(0,c*d)}function medianOfNumbers(e){const t=[];for(const r of e)null==r||Number.isNaN(r)||t.push(r);if(0===t.length)return null;t.sort((e,t)=>e-t);const i=Math.trunc(t.length/2);return t.length%2==0?(t[i-1]+t[i])/2:t[i]}var Qe={cacheHits:0,networkFetches:0,inflightDedups:0,rateLimit429:0,otherErrors:0};var et=/* @__PURE__ */new Map;function cacheKey(e,t,i){return`helios-weather-cache:${i}:${e.toFixed(3)},${t.toFixed(3)}`}var tt=["shortwave_radiation_instant","cloud_cover","cloud_cover_low","cloud_cover_mid","cloud_cover_high","weather_code"];function readSeries(e,t,i){const r=e?.hourly?.[t];if(Array.isArray(r))return r.map(e=>null==e||Number.isNaN(e)?null:Number(e));const s=[];for(const c of i){const i=e?.hourly?.[`${t}_${c}`];Array.isArray(i)&&s.push(i.map(e=>null==e||Number.isNaN(e)?null:Number(e)))}if(0===s.length)return[];const n=Math.max(...s.map(e=>e.length)),l=new Array(n);for(let c=0;c<n;c++)l[c]=medianOfNumbers(s.map(e=>e[c]));return l}function readWeatherCode(e,t){const i=e?.hourly?.weather_code;if(Array.isArray(i))return i.map(e=>Number(e)||0);for(const r of t){const t=e?.hourly?.[`weather_code_${r}`];if(Array.isArray(t))return t.map(e=>Number(e)||0)}return[]}var fillCloud=e=>e.map(e=>null==e?0:e);async function fetchHomePointData(e,t,i,r,s){const n=Number(e.toFixed(3)),l=Number(t.toFixed(3)),c=function readCache(e,t,i){try{const r=window.localStorage?.getItem(cacheKey(e,t,i));if(!r)return null;const s=JSON.parse(r);if(Date.now()-s.storedAt>27e5)return null;if(new Date(s.storedAt).toDateString()!==/* @__PURE__ */(new Date).toDateString())return null;const n=s.payload;return n&&!Array.isArray(n)&&Array.isArray(n.times)?{lat:n.lat,lon:n.lon,times:n.times.map(e=>new Date(e)),cloudCover:n.cloudCover??[],cloudLow:n.cloudLow??[],cloudMid:n.cloudMid??[],cloudHigh:n.cloudHigh??[],weatherCode:n.weatherCode??[],shortwave:n.shortwave??[]}:null}catch{return null}}(n,l,r);if(c)return Qe.cacheHits++,c;const d=cacheKey(n,l,r),u=et.get(d);if(u)return Qe.inflightDedups++,u;const p=(async()=>{const e=function pickModelsForLocation(e,t,i){if("standard"===i)return["best_match"];const r="ecmwf_ifs025";return e>=41.3&&e<=51.2&&t>=-5.5&&t<=8.5?["meteofrance_seamless",r]:e>=49.5&&e<=61&&t>=-10.5&&t<=2?["ukmo_seamless",r]:e>=46&&e<=56&&t>=5&&t<=22?["dwd_icon_seamless",r]:e>=36.5&&e<=47&&t>=10&&t<=18.5?["italia_meteo_arpae_icon_2i",r]:e>=54.5&&e<=71.5&&t>=4&&t<=32?["metno_seamless",r]:e>=24.5&&e<=49.5&&t>=-125&&t<=-66.5?["gfs_seamless",r]:e>=33&&e<=39&&t>=124.5&&t<=132?["kma_seamless",r]:e>=24&&e<=46&&t>=122&&t<=146?["jma_seamless",r]:e>=-47.5&&e<=-10&&t>=112&&t<=179?["bom_access_global",r]:[r,"gfs_seamless"]}(n,l,r);let t=`https://api.open-meteo.com/v1/forecast?latitude=${n.toFixed(3)}&longitude=${l.toFixed(3)}&hourly=${tt.join(",")}&models=${e.join(",")}&past_days=5&forecast_days=3&timezone=auto`;void 0!==i&&(t+=`&elevation=${i.toFixed(0)}`);try{Qe.networkFetches++;const i=await fetch(t,{signal:s});if(!i.ok){if(429===i.status){Qe.rateLimit429++;const e=/* @__PURE__ */new Error("Open-Meteo rate limit (HTTP 429)");throw e.status=429,e}return Qe.otherErrors++,null}const d=await i.json(),u=Array.isArray(d)?d[0]:d,p=(u?.hourly?.time??[]).map(e=>new Date(e)),g=fillCloud(readSeries(u,"cloud_cover_low",e)),m=fillCloud(readSeries(u,"cloud_cover_mid",e)),f=fillCloud(readSeries(u,"cloud_cover_high",e)),y={lat:n,lon:l,times:p,cloudCover:g.map((e,t)=>{const i=Math.max(0,Math.min(100,e??0)),r=Math.max(0,Math.min(100,m[t]??0)),s=Math.max(0,Math.min(100,f[t]??0));return Math.min(100,i+.6*r+.2*s)}),cloudLow:g,cloudMid:m,cloudHigh:f,weatherCode:readWeatherCode(u,e),shortwave:(c=readSeries(u,"shortwave_radiation_instant",e),c.map(e=>null==e?-1:e))};return function writeCache(e,t,i,r){try{const s={storedAt:Date.now(),payload:{lat:r.lat,lon:r.lon,times:r.times.map(e=>e.toISOString()),cloudCover:r.cloudCover,cloudLow:r.cloudLow,cloudMid:r.cloudMid,cloudHigh:r.cloudHigh,weatherCode:r.weatherCode,shortwave:r.shortwave}};window.localStorage?.setItem(cacheKey(e,t,i),JSON.stringify(s))}catch{}}(n,l,r,y),y}catch(d){if(d&&"object"==typeof d&&429===d.status)throw d;return d&&"object"==typeof d&&"AbortError"!==d.name&&Qe.otherErrors++,null}var c})();et.set(d,p);try{return await p}finally{et.delete(d)}}function bumpStat(e){if("undefined"==typeof window)return;const t=window;t.__heliosStats||(t.__heliosStats={enginesCreated:0,enginesCleanedUp:0,updateConfigCalls:0,styleReloads:0,addBuildingsCalls:0,buildingFetchStarts:0}),t.__heliosStats[e]=(t.__heliosStats[e]??0)+1}var it=/* @__PURE__ */new Map;var ot=class HeliosEngine{_clearWeatherTimer(){void 0!==this._weatherTimer&&(window.clearInterval(this._weatherTimer),window.clearTimeout(this._weatherTimer),this._weatherTimer=void 0)}setSolarRadiationSamples(e){if(!e||0===e.length){if(null===this._sensorIrradianceSamples)return;return this._sensorIrradianceSamples=null,this._arcInputsCache=void 0,void this._renderForCurrentSelection()}const t=[];for(const r of e){const e=r.time.getTime();isFinite(e)&&(!isFinite(r.wm2)||r.wm2<0||t.push({tMs:e,wm2:r.wm2}))}t.sort((e,t)=>e.tMs-t.tMs);const i=t.length>0?t:null;this._sensorSamplesEqual(this._sensorIrradianceSamples,i)||(this._sensorIrradianceSamples=i,this._arcInputsCache=void 0,this._renderForCurrentSelection())}_sensorSamplesEqual(e,t){if(e===t)return!0;if(null===e||null===t)return!1;if(e.length!==t.length)return!1;for(let i=0;i<e.length;i++){if(e[i].tMs!==t[i].tMs)return!1;if(e[i].wm2!==t[i].wm2)return!1}return!0}_sensorIrradianceAt(e){const t=this._sensorIrradianceSamples;if(!t||0===t.length)return null;const i=e.getTime();let r=-1,s=Number.POSITIVE_INFINITY;for(let n=0;n<t.length;n++){const e=Math.abs(t[n].tMs-i);if(e<s)s=e,r=n;else if(e>s)break}return r<0||s>HeliosEngine.SENSOR_IRRADIANCE_WINDOW_MS?null:t[r].wm2}_cameraPoseStorageKey(){const e=this.cacheKey.trim();return e?`helios:camera-pose:${e}`:`helios:camera-pose:${Math.round(1e3*this.homeLat)/1e3}:${Math.round(1e3*this.homeLon)/1e3}`}_readStoredPose(){try{const e=window.localStorage.getItem(this._cameraPoseStorageKey());if(!e)return null;const t=JSON.parse(e);if(t&&"object"==typeof t)return t}catch{}return null}_writeStoredPose(e){try{window.localStorage.setItem(this._cameraPoseStorageKey(),JSON.stringify(e))}catch{}}_initialBearing(){const e=this._readStoredPose(),t=e&&"number"==typeof e.bearing?e.bearing:NaN,i=Number(this.cfg["camera-bearing-deg"]),r=Number.isFinite(t)?t:i;return Number.isFinite(r)?(r%360+360)%360:this.homeLat>=0?180:0}_initialPitch(){const e=this._readStoredPose(),t=e&&"number"==typeof e.pitch?e.pitch:NaN,i=Number(this.cfg["camera-pitch-deg"]),r=Number.isFinite(t)?t:i;return Number.isFinite(r)?Math.max(15,Math.min(55,r)):50}isCameraLocked(){const e=this._readStoredPose();return e&&"boolean"==typeof e.locked?e.locked:!0===this.cfg["camera-locked"]}setCameraBearing(e){if(!this._renderer||!Number.isFinite(e))return;const t=(e%360+360)%360;this._renderer.setCameraBearing(t)}setCameraPitch(e){if(!this._renderer||!Number.isFinite(e))return;const t=Math.max(15,Math.min(55,e));this._renderer.setCameraPitch(t)}persistCameraPose(){this._renderer&&this._writeStoredPose({bearing:this._renderer.getCameraBearing(),pitch:this._renderer.getCameraPitch(),locked:this.isCameraLocked()})}setCameraLocked(e){this._renderer&&(this.cfg["camera-locked"]=e,this._writeStoredPose({bearing:this._renderer.getCameraBearing(),pitch:this._renderer.getCameraPitch(),locked:e}))}setHomeAppearance(e,t,i){this._renderer&&(i?this._renderer.animateHomeTo(e,t):this._renderer.setHome(e,t))}setHomeOnly(e){this._renderer?.setHomeOnly(e)}getDefaultBearing(){return this.homeLat>=0?180:0}getDefaultPitch(){return 50}getCameraBearing(){return this._renderer?this._renderer.getCameraBearing():this.getDefaultBearing()}getCameraPitch(){return this._renderer?this._renderer.getCameraPitch():this.getDefaultPitch()}getCameraZoom(){return 18}getViewportWidth(){return this._cachedCanvasCssW}_startAutoRotateLoop(){if(void 0!==this._autoRotateRaf||!this._renderer)return;this._autoRotateLastFrame=performance.now(),this._autoRotateLastUserAction=0,this._autoRotateBearing=this._renderer.getCameraBearing();const tick=e=>{const t=this._renderer;if(!t)return void(this._autoRotateRaf=void 0);const i=Math.max(0,e-this._autoRotateLastFrame)/1e3;this._autoRotateLastFrame=e;const r=Date.now()-this._autoRotateLastUserAction,s=!0===this.cfg["auto-rotate-enabled"],n=!0===this.cfg["camera-locked"];s&&!n?(r>=5e3?((void 0===this._autoRotateBearing||r-5e3<16)&&(this._autoRotateBearing=t.getCameraBearing()),this._autoRotateBearing-=4*i,t.setCameraBearing(this._autoRotateBearing)):this._autoRotateBearing=t.getCameraBearing(),this._autoRotateRaf=requestAnimationFrame(tick)):this._autoRotateRaf=void 0};this._autoRotateRaf=requestAnimationFrame(tick)}constructor(e,t,i,r,s=!1,n=""){this._fetchLat=0,this._fetchLon=0,this._mapReady=!1,this._homeHourlyData=null,this._selectedTime=null,this._lastAtmosphereAlt=-999,this._rateLimitStreak=0,this._otherErrorStreak=0,this._obsW=-1,this._obsH=-1,this._paused=!1,this._sensorIrradianceSamples=null,this.cacheKey="",this._autoRotateLastFrame=0,this._autoRotateLastUserAction=0,this._buildingsData=null,this._buildingsRaw=null,this._buildingsLocKey="",this._grown=!1,this._selectedTimeShadowTimer=null,this._postExitCooldownUntil=0,this._anchorPtsBuf=[],this._cachedCanvasCssW=0,this._cachedCanvasCssH=0,this.homeLat=i[1],this.homeLon=i[0],this.homeElevation="number"==typeof r&&Number.isFinite(r)?r:void 0,this.cfg={...t},this._editMode=s,this.cacheKey=n,bumpStat("enginesCreated"),this._fetchLat=this.homeLat,this._fetchLon=this.homeLon,this._initMapInstance(e,i)}_initMapInstance(e,t){this._container=e,this._renderer=new Xe(e,{sun:_e,shadow:"#000000",shadowOpacity:this._shadowOpacity()}),this._renderer.setCameraBearing(this._initialBearing()),this._renderer.setCameraPitch(this._initialPitch()),this._resolvePalette(),this._renderer.onAfterDraw=()=>{this.onMapTransform?.()},this._resizeObserver=new ResizeObserver(e=>{const t=e[e.length-1]?.contentRect;if(!t)return;const i=Math.round(t.width),r=Math.round(t.height);i===this._obsW&&r===this._obsH||(this._obsW=i,this._obsH=r,this._cachedCanvasCssW=t.width||this._cachedCanvasCssW,this._cachedCanvasCssH=t.height||this._cachedCanvasCssH,this._arcScaleMemo=void 0)}),this._resizeObserver.observe(e),this._cachedCanvasCssW=e.clientWidth||this._cachedCanvasCssW,this._cachedCanvasCssH=e.clientHeight||this._cachedCanvasCssH;try{window.__heliosEngine=this}catch(I){}this._bootstrapRenderer(),e.style.touchAction="none";let i=!1,r=0,s=0,n=null;const onDown=t=>{if(!("mouse"===t.pointerType&&0!==t.button||null!==n||this.isUserGestureSuppressed()||this.isCameraLocked())){i=!0,n=t.pointerId,r=t.clientX,s=t.clientY,this._autoRotateLastUserAction=Date.now();try{e.setPointerCapture(t.pointerId)}catch(I){}}},onMove=e=>{if(!i||!this._renderer||e.pointerId!==n)return;const t=e.clientX-r,l=e.clientY-s;r=e.clientX,s=e.clientY,this._autoRotateLastUserAction=Date.now(),this._renderer.setCameraBearing(this._renderer.getCameraBearing()-.35*t);const c=Math.max(15,Math.min(55,this._renderer.getCameraPitch()-.3*l));this._renderer.setCameraPitch(c)},onEnd=t=>{if(t.pointerId===n){i=!1,n=null;try{e.releasePointerCapture(t.pointerId)}catch(I){}this.persistCameraPose()}};e.addEventListener("pointerdown",onDown),e.addEventListener("pointermove",onMove),e.addEventListener("pointerup",onEnd),e.addEventListener("pointercancel",onEnd),this._dragRotateHandlers={canvas:e,onDown:onDown,onMove:onMove,onEnd:onEnd},this._refreshWeather()}async _bootstrapRenderer(){const e=this._renderer;if(e){try{await e.setLocation(this.homeLat,this.homeLon)}catch(t){}this._renderer===e&&this._onRendererReady()}}_onRendererReady(){this._renderer&&(this._mapReady=!0,this._applyBuildings(),this._ensureBuildings(),window.clearInterval(this._skyTimer),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere(),this._skyTimer=window.setInterval(()=>{this._paused||this._refreshShadowsAndAtmosphere()},6e4),this._startAutoRotateLoop(),this._homeHourlyData&&this._renderForCurrentSelection())}_cssHex(e,t){const i=this._container?getComputedStyle(this._container).getPropertyValue(e).trim():"";if(/^#[0-9a-f]{6}$/i.test(i))return i;if(/^#[0-9a-f]{3}$/i.test(i))return"#"+i.slice(1).split("").map(e=>e+e).join("");const r=i.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);if(r){const h=e=>Math.max(0,Math.min(255,Math.round(parseFloat(e)))).toString(16).padStart(2,"0");return"#"+h(r[1])+h(r[2])+h(r[3])}return t}_resolvePalette(){this._renderer?.setPalette({home:this._cssHex("--energy-grid-consumption-color","#488fc2"),neighbor:this._buildingColor(),sun:_e,shadow:this._cssHex("--shadow-color","#000000"),shadowOpacity:this._shadowsEnabled()?this._shadowOpacity():0,neighborOpacity:this._buildingOpacity()})}_shadowsEnabled(){return!1!==this.cfg["shadows-enabled"]}_shadowOpacity(){const e=Number(this.cfg["shadow-opacity"]);return Number.isFinite(e)?Math.max(0,Math.min(1,e)):.32}_findHourIndex(e){const t=this._homeHourlyData;if(!t||!t.times.length)return 0;const i=e.getTime(),r=t.times;let s=0,n=Math.abs(r[0].getTime()-i);for(let l=1;l<r.length;l++){const e=Math.abs(r[l].getTime()-i);if(e<n)n=e,s=l;else if(e>n)break}return s}_getWeatherAtTime(e){const t={cloudCover:0,cloudLow:0,cloudMid:0,cloudHigh:0,shortwave:-1,cloudIntensity:"clear"},i=this._homeHourlyData;if(!i||!i.times.length)return t;const r=this._findHourIndex(e);if(r<0||r>=i.times.length)return t;const s=i.cloudCover[r]??0;return{cloudCover:s,cloudLow:i.cloudLow[r]??0,cloudMid:i.cloudMid[r]??0,cloudHigh:i.cloudHigh[r]??0,shortwave:i.shortwave[r]??-1,cloudIntensity:(n=i.weatherCode[r]??0,l=s,n>=95?"storm":n>=45&&n<=48?"fog":n>=61&&n<=67||n>=71&&n<=77||n>=80?"heavy":n>=51?"moderate":l<15?"clear":l<50?"light":l<80?"moderate":"heavy")};var n,l}getTimelineRange(){return this._getTimeRange()}setPeriodDays(e,t){this._periodPastDays=e,this._periodFutureDays=t}_getTimeRange(){const e=this._periodPastDays??2,t=this._periodFutureDays??1,i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const r=i.getTime()-24*e*36e5,s=i.getTime()+24*(t+1)*36e5;return{start:new Date(r),end:new Date(s)}}_renderForCurrentSelection(){if(!this._renderer)return;const e=this._selectedTime??/* @__PURE__ */new Date,t=this._getWeatherAtTime(e),i=computePvPower(e,this.homeLat,this.homeLon,t.cloudCover);let r=-1;t.shortwave>=0&&(r=Math.max(0,Math.min(100,t.shortwave/1e3*100)));const s=this._sensorIrradianceAt(e),n=null!==s?Math.max(0,Math.min(100,s/1e3*100)):-1;let l,c;n>=0?(l=n,c="sensor"):r>=0?(l=r,c="shortwave"):(l=i,c="haurwitz"),this.onWeatherUpdate?.({cloudCover:t.cloudCover,cloudLow:t.cloudLow,cloudMid:t.cloudMid,cloudHigh:t.cloudHigh,cloudIntensity:t.cloudIntensity,timeRange:this._getTimeRange(),isLiveTime:null===this._selectedTime,pvPower:l,pvPowerHaurwitz:i,pvPowerShortwave:r,irradianceSource:c})}_buildingRadiusMeters(){return function displayRadiusM(e){const t=e?.["display-radius"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 200;const r=Math.round(i);return r<0?0:r>500?500:r}(this.cfg)}_buildingOpacity(){const e=Number(this.cfg["building-opacity"]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):.25}_buildingClusterRadiusMeters(){const e=Number(this.cfg["building-cluster-radius"]);return!Number.isFinite(e)||e<0?0:Math.min(100,e)}_buildingColor(){return this._cssHex(uiColorVar(function buildingColorToken(e){const t=e?.["building-color"];return("string"==typeof t?t.trim():"")||"grey"}(this.cfg),"grey"),"#9e9e9e")}_buildingsLocationKey(){return`${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}`}_ensureBuildings(){if(!this._renderer)return;const e=this._buildingsLocationKey();if(this._buildingsRaw&&this._buildingsLocKey===e)return void this._applyBuildings();const t=function sharedBuildingsCacheGet(e){const t=it.get(e);return t?Date.now()-t.ts>18e5?(it.delete(e),null):t.data:null}(e);if(t)return this._buildingsRaw=t,this._buildingsLocKey=e,this._applyBuildings(),this._lastAtmosphereAlt=-999,void this._refreshShadowsAndAtmosphere();this._buildingsAbort?.abort();const i=new AbortController;this._buildingsAbort=i,bumpStat("buildingFetchStarts");try{this.onBuildingsFetchStart?.()}catch(I){}(async function fetchRawBuildings(e,t,i){const r=e,s=t,n=Math.round(500),l=function cacheKey$1(e,t){return`helios-bld2:${e.toFixed(4)}:${t.toFixed(4)}`}(r,s);try{const e=localStorage.getItem(l),t=e?JSON.parse(e):null;if(t?.buildings?.length&&Date.now()-t.time<2592e6)return t.buildings}catch(I){}const c=`[out:json][timeout:25];(way["building"](around:${n},${r},${s});relation["building"](around:${n},${r},${s}););out geom;`;for(const u of Me)try{const e=await fetch(u+"?data="+encodeURIComponent(c),{referrerPolicy:"no-referrer",signal:i});if(!e.ok)throw new Error(String(e.status));const t=parseRawBuildings((await e.json()).elements??[],r,s);if(t.length){try{localStorage.setItem(l,JSON.stringify({time:Date.now(),buildings:t}))}catch(I){}return t}}catch(d){if("AbortError"===d?.name)throw d;await new Promise(e=>{setTimeout(e,1200)})}return[]})(this.homeLat,this.homeLon,i.signal).then(t=>{!i.signal.aborted&&this._renderer&&(this._buildingsRaw=t,this._buildingsLocKey=e,it.set(e,{data:t,ts:Date.now()}),this._applyBuildings(),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere())}).catch(()=>{}).finally(()=>{try{this.onBuildingsFetchEnd?.()}catch(I){}})}_applyBuildings(){var e;this._renderer&&(this._buildingsData=function interpretBuildings(e,t){if(0===e.length)return[{footprint:[[-5,-4],[5,-4],[5,4],[-5,4]],height:6,isHome:!0,centerX:0,centerY:0}];let i=e.filter(e=>e.distanceM<=t.radiusM);0===i.length&&(i=[e[0]]),i=i.slice(0,Math.max(0,t.count)),0===i.length&&(i=[e[0]]);const r=i.map(e=>({footprint:e.footprint,height:t.realSize?Math.min(25,e.osmHeightM??6):t.fixedHeightM,isHome:!1,centerX:e.centerX,centerY:e.centerY}));r[0].isHome=!0;const s=r[0],n=Math.max(0,t.clusterRadiusM);if(n>0)for(let l=0;l<r.length;l++){if(0===l)continue;const e=r[l].centerX-s.centerX,t=r[l].centerY-s.centerY;Math.hypot(e,t)<=n&&(r[l].isHome=!0)}return r}(this._buildingsRaw??[],{radiusM:this._buildingRadiusMeters(),count:buildingCount(this.cfg),realSize:(e=this.cfg,!1!==e?.["building-real-size"]),fixedHeightM:buildingFixedHeightM(this.cfg),clusterRadiusM:this._buildingClusterRadiusMeters()}),this._pushRenderableSources())}_pushRenderableSources(){if(!this._renderer)return;const e=this._buildingsData??[];this._renderer.setBuildings(e),e.length&&!this._grown&&(this._grown=!0,this._editMode||this._renderer.animateGrowth())}_refreshShadowsAndAtmosphere(){if(!this._renderer)return;const{altitude:e,azimuth:t}=getSunPosition(this._selectedTime??/* @__PURE__ */new Date,this.homeLat,this.homeLon);Math.abs(e-this._lastAtmosphereAlt)<1.5||(this._lastAtmosphereAlt=e,this._renderer.setPalette({shadowOpacity:this._shadowsEnabled()?this._shadowOpacity():0}),this._renderer.setSun(t,e))}_resolvedPrecision(){return"high"}async _refreshWeather(e,t){const i=e??this.homeLat,r=t??this.homeLon;this._fetchAbortController?.abort(),this._fetchAbortController=new AbortController;const s=this._fetchAbortController.signal;this._clearWeatherTimer(),this.onFetchStart?.();try{const e=this._resolvedPrecision();this._homeHourlyData=await fetchHomePointData(i,r,this.homeElevation,e,s),this._renderForCurrentSelection(),this._rateLimitStreak=0,this._otherErrorStreak=0,null===this._selectedTime&&(this._weatherTimer=window.setInterval(()=>this._refreshWeather(this._fetchLat,this._fetchLon),6e5))}catch(n){if("AbortError"===n.name)return;let e;this.onWeatherUpdate?.({cloudCover:0,cloudLow:0,cloudMid:0,cloudHigh:0,cloudIntensity:"clear",timeRange:this._getTimeRange(),isLiveTime:null===this._selectedTime,pvPower:0,pvPowerHaurwitz:0,pvPowerShortwave:-1,irradianceSource:"haurwitz"}),429===n.status?(e=xe[Math.min(this._rateLimitStreak,xe.length-1)],this._rateLimitStreak++,this._weatherTimer=window.setTimeout(()=>this._refreshWeather(this._fetchLat,this._fetchLon),e)):(e=ke[Math.min(this._otherErrorStreak,ke.length-1)],this._otherErrorStreak++,this._weatherTimer=window.setTimeout(()=>this._refreshWeather(this._fetchLat,this._fetchLon),e))}finally{this.onFetchEnd?.()}}resetDataCache(){const e=function clearWeatherCache(){let e=0;try{const t=window.localStorage;if(!t)return 0;const i=[];for(let e=0;e<t.length;e++){const r=t.key(e);r&&r.startsWith("helios-weather-cache:")&&i.push(r)}for(const r of i)t.removeItem(r),e++}catch(I){}return e}();return this._homeHourlyData=null,this._refreshWeather(this._fetchLat,this._fetchLon),e}setPaused(e){this._paused!==e&&(this._paused=e,e?(void 0!==this._skyTimer&&(window.clearInterval(this._skyTimer),this._skyTimer=void 0),this._clearWeatherTimer()):(this._refreshShadowsAndAtmosphere(),void 0===this._skyTimer&&(this._skyTimer=window.setInterval(()=>{this._paused||this._refreshShadowsAndAtmosphere()},6e4)),void 0===this._weatherTimer&&this._refreshWeather(this._fetchLat,this._fetchLon)))}isPaused(){return this._paused}isViewportReady(){return this._renderer?.camera.hasViewport??!1}setHome(e,t){e===this.homeLat&&t===this.homeLon||(this.homeLat=e,this.homeLon=t,this._fetchLat=e,this._fetchLon=t,this._renderer?.setLocation(e,t),this._ensureBuildings(),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere(),this._refreshWeather(e,t))}isUserGestureSuppressed(){return Date.now()<this._postExitCooldownUntil}projectHomeLabelLayout(){if(!this._renderer)return null;const e=this._projectScenePoint(this.homeLon,this.homeLat,0);if(!e)return null;const t=this.homeLat,i=Math.cos(t*Math.PI/180),r=this._heliosScale(),s=this._clusterLiftScale(),n=84*r,l=60*r;let c=e.y;const d=this._buildingsData?.filter(e=>e.isHome)??[];if(d.length>0){let e=0;for(const t of d)t.height>e&&(e=t.height);if(e>0){const t=this._projectScenePoint(this.homeLon,this.homeLat,e);t&&(c=t.y)}}const u=28*s,p=e.y-u,g=e.x,m=p-70*s,f=e.x+n,y=p-l/2,b=p+l/2,_=e.x-n,v=p+l/2,w=e.x-n,$=p-l/2,M=1/111320,T=M/i,C=this._anchorPtsBuf;48!==C.length&&(C.length=48);for(let F=0;F<48;F++){const t=F/48*Math.PI*2,i=4*Math.cos(t),r=4*Math.sin(t),s=this._projectScenePoint(this.homeLon+i*T,this.homeLat+r*M,0);if(!s){C[F]="0,0";continue}const n=Math.trunc(100*(s.x-e.x))/100,l=Math.trunc(100*(s.y-e.y))/100;C[F]=n+","+l}return{pvLabel:{x:g,y:m},batterySocLabel:{x:f,y:b},batteryPowerLabel:{x:f,y:y},gridLabel:{x:_,y:v},customLabel:{x:w,y:$},home:{x:e.x,y:p},homeRoof:{x:e.x,y:c},homeAnchorPoints:C.join(" ")}}_heliosScale(){const e=Math.min(this._cachedCanvasCssW||1/0,this._cachedCanvasCssH||1/0);if(!Number.isFinite(e)||e<=0)return 1;return e<=600?1:e>=1200?1.6:1+(1.6-1)*(e-600)/600}_clusterLiftScale(){const e=Math.min(this._cachedCanvasCssW||1/0,this._cachedCanvasCssH||1/0);if(!Number.isFinite(e)||e<=0)return 1;return e<=600?1:e>=1200?2.4:1+1.4*(e-600)/600}_steppedArcScale(e){if(!Number.isFinite(e)||e<=0)return 1;const t=600,i=.72;return e<=360?i:e<t?i+.28*(e-360)/240:e>=1200?2.2:1+(2.2-1)*(e-t)/600}_sunArcScale(){const e=this._cachedCanvasCssW,t=this._cachedCanvasCssH,i=Math.min(e||1/0,t||1/0),r=this._renderer?this.getCameraZoom():-1,s=this._arcScaleMemo;if(s&&s.w===e&&s.h===t&&s.zoom===r)return s.scale;let n=this._steppedArcScale(i);if(this._renderer&&Number.isFinite(i)&&i>0){const e=Math.PI/180,t=111320,r=111320*Math.cos(this.homeLat*e),s=60,l=this._projectScenePoint(this.homeLon,this.homeLat,0);if(l){let e=0;for(let i=0;i<8;i++){const n=i/8*2*Math.PI,c=s*Math.sin(n),d=s*Math.cos(n),u=this._projectScenePoint(this.homeLon+c/r,this.homeLat+d/t,0);if(!u)continue;const p=Math.hypot(u.x-l.x,u.y-l.y);p>e&&(e=p)}const c=e/s;if(c>0){const e=.41*i/c;n=Math.max(.72,Math.min(e/40,6))}}}return this._arcScaleMemo={w:e,h:t,zoom:r,scale:n},n}getSunArcScale(){return this._sunArcScale()}_projectScenePoint(e,t,i){if(!this._renderer)return null;const r=111320*Math.cos(this.homeLat*Math.PI/180),s=(e-this.homeLon)*r,n=111320*(t-this.homeLat);return this._renderer.camera.project3(s,n,i)}projectSunScene(e){if(!this._renderer)return null;const t=this._projectScenePoint(this.homeLon,this.homeLat,0);if(!t)return null;const i=new Date(e);i.setHours(0,0,0,0);const r=9e5,s=this._homeHourlyData?(()=>this._getWeatherAtTime(e)?.cloudCover??0)():0,n=i.getTime(),l=Math.round(s),c=Math.round(100*this._sunArcScale());let d=this._arcInputsCache;if(!d||d.dayStartMs!==n||d.cloudPctInt!==l||d.scaleKey!==c){const e=[];for(let t=0;t<96;t++){const i=new Date(n+t*r),l=this._sunSpherePoint(i);if(!l){e.push(null);continue}const c=this._sensorIrradianceAt(i),d=null!==c?c:computeIrradianceWm2(i,this.homeLat,this.homeLon,s);e.push({lon:l.lon,lat:l.lat,altitudeM:l.altitudeM,altitudeDeg:l.altitudeDeg,wm2:d,belowHorizon:l.altitudeM<0})}d={dayStartMs:n,cloudPctInt:l,scaleKey:c,samples:e},this._arcInputsCache=d}const u=[];for(let C=0;C<96;C++){const e=d.samples[C];if(!e)continue;const t=this._projectScenePoint(e.lon,e.lat,e.altitudeM);t&&u.push({x:t.x,y:t.y,irradiance:e.wm2,depth:t.depth,altitude:e.altitudeDeg,belowHorizon:e.belowHorizon})}const p=this._sunSpherePoint(e),g=getSunPosition(e,this.homeLat,this.homeLon).altitude,m=this._sensorIrradianceAt(e),f=null!==m?m:computeIrradianceWm2(e,this.homeLat,this.homeLon,s);let y=null;p&&(y=this._projectScenePoint(p.lon,p.lat,p.altitudeM)),y||(y={...t,depth:t.depth});let b=1/0,_=-1/0;for(const C of u)C.depth<b&&(b=C.depth),C.depth>_&&(_=C.depth);y.depth<b&&(b=y.depth),y.depth>_&&(_=y.depth);const v=_-b||1,nearnessOf=e=>(e-b)/v,w=u.map(e=>({x:e.x,y:e.y,irradiance:e.irradiance,altitude:e.altitude,nearness:nearnessOf(e.depth),belowHorizon:e.belowHorizon})),$=(()=>{if(g>=6)return 1;if(g<=-6)return we;return we+.75*((g+6)/12)})();let M=null,T=null;for(let C=1;C<d.samples.length;C++){const e=d.samples[C-1],t=d.samples[C];if(!e||!t)continue;const i=e.belowHorizon,s=t.belowHorizon;if(i===s)continue;const l=e.altitudeM,c=t.altitudeM-l,u=Math.abs(c)<1e-6?.5:-l/c,p=Math.max(0,Math.min(1,u)),g=e.lon+(t.lon-e.lon)*p,m=e.lat+(t.lat-e.lat)*p,f=this._projectScenePoint(g,m,0);if(!f)continue;const y=this._projectScenePoint(e.lon,e.lat,e.altitudeM),b=this._projectScenePoint(t.lon,t.lat,t.altitudeM),_=y&&b?Math.atan2(b.y-y.y,b.x-y.x):0,v=new Date(n+(C-1+p)*r),w={x:f.x,y:f.y,angleRad:_,time:v};i&&!s?M=w:!i&&s&&(T=w)}return{arc:w,sun:{x:y.x,y:y.y,irradiance:f,altitude:g,nearness:nearnessOf(y.depth)},home:{x:t.x,y:t.y},daylight:$,sunrise:M,sunset:T}}_sunSpherePoint(e){const t=getSunPosition(e,this.homeLat,this.homeLon),i=Math.PI/180,r=t.altitude*i,s=t.azimuth*i,n=40*this._sunArcScale(),l=n*Math.cos(r)*Math.sin(s),c=n*Math.cos(r)*Math.cos(s),d=n*Math.sin(r),u=111320*Math.cos(this.homeLat*i);return{lon:this.homeLon+l/u,lat:this.homeLat+c/111320,altitudeM:d,altitudeDeg:t.altitude}}setSelectedTime(e){this._selectedTime=e,null===e?(this._clearWeatherTimer(),this._weatherTimer=window.setInterval(()=>this._refreshWeather(this._fetchLat,this._fetchLon),6e5)):this._clearWeatherTimer(),this._mapReady&&(this._lastAtmosphereAlt=-999,this._renderForCurrentSelection(),null!==this._selectedTimeShadowTimer&&window.clearTimeout(this._selectedTimeShadowTimer),this._selectedTimeShadowTimer=window.setTimeout(()=>{this._selectedTimeShadowTimer=null,this._refreshShadowsAndAtmosphere()},100))}getTimelineSeries(){const e=this._homeHourlyData;if(!e||!e.times.length)return null;const t=e.times.map((t,i)=>{const r=this._sensorIrradianceAt(e.times[i]);if(null!==r)return r;const s=e.shortwave[i]??-1;return s>=0?s:10*computePvPower(e.times[i],this.homeLat,this.homeLon,e.cloudCover[i]??0)}),i=e.times.map((t,i)=>e.cloudCover[i]??0),r=e.times.map((t,i)=>e.cloudLow[i]??0),s=e.times.map((t,i)=>e.cloudMid[i]??0),n=e.times.map((t,i)=>e.cloudHigh[i]??0);return{times:e.times.slice(),irradiance:t,cloud:i,cloudLow:r,cloudMid:s,cloudHigh:n}}getStatsSnapshot(){const e=this._shadowsEnabled(),t=this._buildingsData?{home:this._buildingsData.filter(e=>e.isHome).length,surroundings:this._buildingsData.filter(e=>!e.isHome).length}:null;let i;return i=e?this._buildingsData?"footprints":"pending":"disabled",{mapReady:this._mapReady,hemisphere:this.homeLat>=0?"N":"S",shadows:{enabled:e,source:i,opacity:this._shadowOpacity(),clipRadiusM:this._buildingRadiusMeters()},buildings:{radiusM:this._buildingRadiusMeters(),clusterRadiusM:this._buildingClusterRadiusMeters(),opacity:this._buildingOpacity(),color:this._buildingColor(),footprints:t},weather:{samples:this._homeHourlyData?.times.length??0,rateLimitStreak:this._rateLimitStreak,openMeteoStats:{...Qe}},timeline:{rangeStart:this._getTimeRange()?.start?.toISOString()??null,rangeEnd:this._getTimeRange()?.end?.toISOString()??null,selectedTime:this._selectedTime?.toISOString()??null},caches:{arcCacheDay:this._arcInputsCache?new Date(this._arcInputsCache.dayStartMs).toISOString().slice(0,10):null,arcCacheCloudPct:this._arcInputsCache?.cloudPctInt??null}}}updateConfig(e){bumpStat("updateConfigCalls");const t=this._buildingRadiusMeters(),i=this._shadowOpacity(),r=this._shadowsEnabled(),s=!0===this.cfg["auto-rotate-enabled"],n=!0===this.cfg["camera-locked"];this.cfg={...e};const l=!0===this.cfg["auto-rotate-enabled"],c=!0===this.cfg["camera-locked"];if(!l||c||s&&!n||!this._renderer||this._startAutoRotateLoop(),!this._renderer)return;const d=this._buildingRadiusMeters();this._ensureBuildings(),d!==t&&(this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere());const u=this._shadowOpacity(),p=this._shadowsEnabled();this._resolvePalette(),u===i&&p===r||(this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere()),this._renderer.scheduleRedraw(),this._homeHourlyData&&this._mapReady&&this._renderForCurrentSelection()}cleanup(){if(bumpStat("enginesCleanedUp"),this._clearWeatherTimer(),null!==this._selectedTimeShadowTimer&&(window.clearTimeout(this._selectedTimeShadowTimer),this._selectedTimeShadowTimer=null),window.clearInterval(this._skyTimer),this._fetchAbortController?.abort(),this._buildingsAbort?.abort(),this._arcInputsCache=void 0,this._resizeObserver?.disconnect(),void 0!==this._autoRotateRaf&&(cancelAnimationFrame(this._autoRotateRaf),this._autoRotateRaf=void 0),this._dragRotateHandlers){const e=this._dragRotateHandlers;e.canvas.removeEventListener("pointerdown",e.onDown),e.canvas.removeEventListener("pointermove",e.onMove),e.canvas.removeEventListener("pointerup",e.onEnd),e.canvas.removeEventListener("pointercancel",e.onEnd)}this._buildingsData=null,this._buildingsRaw=null,this._buildingsLocKey="",this._homeHourlyData=null,this._dragRotateHandlers=void 0;try{this._renderer?.cleanup()}catch(I){}this._renderer=void 0,this._mapReady=!1;try{const e=window;void 0!==e.__heliosEngine&&delete e.__heliosEngine}catch(I){}}};function nearlyEq(e,t){return Math.abs(e-t)<=.25}function pointEq(e,t){return e===t||!(!e||!t)&&(nearlyEq(e.x,t.x)&&nearlyEq(e.y,t.y))}function refreshHud(e){if(e._engine&&!e._engine.isViewportReady())return;const t=e._engine?.projectHomeLabelLayout()??null;(function labelLayoutEq(e,t){return e===t||!(!e||!t)&&pointEq(e.pvLabel,t.pvLabel)&&pointEq(e.batterySocLabel,t.batterySocLabel)&&pointEq(e.batteryPowerLabel,t.batteryPowerLabel)&&pointEq(e.gridLabel,t.gridLabel)&&pointEq(e.customLabel,t.customLabel)&&pointEq(e.home,t.home)&&e.homeAnchorPoints===t.homeAnchorPoints})(e._labelLayout,t)||(e._labelLayout=t);const i=e._selectedTime??e._now,r=e._engine?e._engine.projectSunScene(i):null;(function sunSceneEq(e,t){if(e===t)return!0;if(!e||!t)return!1;if(!nearlyEq(e.daylight,t.daylight))return!1;if(!pointEq(e.home,t.home))return!1;if(!nearlyEq(e.sun.x,t.sun.x)||!nearlyEq(e.sun.y,t.sun.y)||!nearlyEq(e.sun.altitude,t.sun.altitude))return!1;if(e.arc.length!==t.arc.length)return!1;for(let i=0;i<e.arc.length;i++){const r=e.arc[i],s=t.arc[i];if(r.belowHorizon!==s.belowHorizon)return!1;if(!nearlyEq(r.x,s.x)||!nearlyEq(r.y,s.y))return!1}return!(null===e.sunrise!=(null===t.sunrise)||e.sunrise&&t.sunrise&&(!nearlyEq(e.sunrise.x,t.sunrise.x)||!nearlyEq(e.sunrise.y,t.sunrise.y))||null===e.sunset!=(null===t.sunset)||e.sunset&&t.sunset&&(!nearlyEq(e.sunset.x,t.sunset.x)||!nearlyEq(e.sunset.y,t.sunset.y)))})(e._sunScene,r)||(e._sunScene=r)}function flowDuration(e,t,i=.4){if(!isFinite(e)||e<=0)return 30;const r=1-Math.min(1,e/t);return 30-(30-i)*(1-r*r*r)}ot.SENSOR_IRRADIANCE_WINDOW_MS=18e5;var rt=["solar-irradiance-entity","display-radius","building-cluster-radius","building-count","building-real-size","building-height","building-opacity","auto-rotate-enabled"];function parseConfigCoord(e){if("number"==typeof e)return isFinite(e)?e:null;if("string"==typeof e){const t=e.trim();if(""===t)return null;const i=Number(t);return isFinite(i)?i:null}return null}var at=/* @__PURE__ */new WeakMap,st=null;function getHomeCoords(e,t){const i=t?.config,r=window.__heliosLocationOverride;if(e){const t=at.get(e);if(t&&t.hassCfg===i&&t.overrideId===r)return t.result}else if(st&&st.hassCfg===i&&st.overrideId===r)return st.result;const s=function _resolveHomeCoords(e,t,i){if(i&&"number"==typeof i.lat&&"number"==typeof i.lon&&isFinite(i.lat)&&isFinite(i.lon))return{lat:i.lat,lon:i.lon};const r=parseConfigCoord(e?.["home-latitude"]),s=parseConfigCoord(e?.["home-longitude"]);if(null!==r&&null!==s&&r>=-90&&r<=90&&s>=-180&&s<=180)return{lat:r,lon:s};const n=t?.latitude,l=t?.longitude;return"number"!=typeof n||"number"!=typeof l?null:{lat:n,lon:l}}(e,i,r),n={hassCfg:i,overrideId:r,result:s};return e?at.set(e,n):st=n,s}var nt=/* @__PURE__ */new WeakMap;function computeConfigSig(e){if(!e)return"";const t=nt.get(e);if(void 0!==t)return t;const i=rt.map(t=>`${t}=${e[t]??""}`).join("|");return nt.set(e,i),i}function initEngine(e){e._initInflight=!0,function initEngineNow(e){requestAnimationFrame(()=>{const t=e;if(!t.isConnected)return void(e._initInflight=!1);const i=t.shadowRoot?.getElementById("map-container");if(!i||!e.config||!e.hass?.config)return void(e._initInflight=!1);const r=getHomeCoords(e.config,e.hass);if(!r)return void(e._initInflight=!1);const{lat:s,lon:n}=r,l=e.hass.config.elevation;e._engine=new ot(i,e.config,[n,s],l,!0===e.preview,e.effectiveCacheId?.()??""),function wireEngineCallbacks(e){if(!e._engine)return;e.requestUpdate(),e._engine.onWeatherUpdate=t=>{e._cloudCover=t.cloudCover,e._timeRange=t.timeRange,e._isLiveMode=t.isLiveTime,e._chartSeries=e._engine?.getTimelineSeries()??null,refreshHud(e)};let t=null;e._engine.onMapTransform=()=>{e._engine?.isPaused()||null===t&&(t=requestAnimationFrame(()=>{t=null,refreshHud(e),"clock"===e._viewMode&&e.paintClock?.()}))}}(e),e._engine.setPeriodDays(e._periodPastDays,e._periodFutureDays),"clock"===e._viewMode&&e._engine.setHomeOnly(!0),e._timeRange||(e._timeRange=e._engine.getTimelineRange()),e._initInflight=!1})}(e)}async function fetchHaSolarForecast(e){if(e.hass?.callWS&&!(e._haSolarForecastFetching||e._haSolarForecastLoaded&&Date.now()-(e._haSolarForecastFetchedAt??0)<3e5)){e._haSolarForecastFetchedAt=Date.now(),e._haSolarForecastFetching=!0;try{const t=await async function fetchHeliosSeries(e){const t=e._energyDefaults?.solarForecastEntryIds??[];if(0===t.length)return null;const i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const r=/* @__PURE__ */new Date(i.getTime()-2*ye).toISOString(),s=new Date(i.getTime()+3*ye).toISOString();for(const n of t)try{const t=(await e.hass.callWS({type:"helios_forecast/series",entry_id:n,start:r,end:s}))?.points;if(!Array.isArray(t))continue;const i=[];for(const e of t){const t=Date.parse(e.t);Number.isFinite(t)&&"number"==typeof e.pv_w&&Number.isFinite(e.pv_w)&&i.push({tMs:t,wh:e.pv_w})}return i.sort((e,t)=>e.tMs-t.tMs),i}catch(I){continue}return null}(e);e._haSolarForecast=null!==t?t:function mergeSolarForecast(e){if(!e||"object"!=typeof e)return[];const t=/* @__PURE__ */new Map;for(const r of Object.keys(e)){const i=e[r]?.wh_hours;if(i&&"object"==typeof i)for(const e of Object.keys(i)){const r=Date.parse(e);if(!Number.isFinite(r))continue;const s=i[e];"number"==typeof s&&Number.isFinite(s)&&t.set(r,(t.get(r)??0)+s)}}const i=[];for(const[r,s]of t)i.push({tMs:r,wh:s});return i.sort((e,t)=>e.tMs-t.tMs),i}(await e.hass.callWS({type:"energy/solar_forecast"})),e._haSolarForecastLoaded=!0,e.requestUpdate()}catch(I){e._haSolarForecastLoaded=!0}finally{e._haSolarForecastFetching=!1}}}function forecastWattsAt(e,t){if(0===e.length)return null;let i=0,r=e.length-1,s=-1;for(;i<=r;){const n=Math.trunc((i+r)/2);e[n].tMs<=t?(s=n,i=n+1):r=n-1}if(s<0)return null;const n=e[s],l=e[s+1];if(l&&l.tMs-n.tMs<=54e5&&l.tMs>n.tMs){const e=(t-n.tMs)/(l.tMs-n.tMs),i=e<0?0:e>1?1:e;return n.wh+(l.wh-n.wh)*i}return t>=n.tMs+36e5?null:n.wh}function bucketForMs(e,t,i,r){if(t<e)return-1;const s=Math.floor((t-e)/i);return s>=r?-1:s}function interpolateNullGaps(e){const t=e.length;let i=0;for(;i<t;){if(null!==e[i]){i++;continue}let r=i;for(;r<t&&null===e[r];)r++;const s=i>0?e[i-1]:null,n=r<t?e[r]:null;if(null===s&&null===n)return;if(null===s)for(let t=i;t<r;t++)e[t]=n;else{if(null===n){for(let r=i;r<t;r++)e[r]=s;return}{const t=r-i+1;for(let l=i;l<r;l++){const r=(l-i+1)/t;e[l]=s+(n-s)*r}}}i=r}}function buildGridChange(e,t,i,r,s){const n=changeSeriesToWatts(e,t,i,r,s);for(let d=0;d<n.length;d++){const e=n[d];null!==e&&e<0&&(n[d]=0)}const l=bucketForMs(t,s,i,r),c=Math.min(r,l<0?0:l+1);if(c>0){const e=n.slice(0,c);interpolateNullGaps(e);for(let t=0;t<c;t++)n[t]=e[t]}return n}function computeDataVersion(e){return`d${/* @__PURE__ */(new Date).toDateString()}|c${modeBucketsPerHour(e._timelineMode,e.config)}|${e._chartSeries?.times.length??0}|${e._pvHistory?.times.length??0}|${e._pvCalibStats?.times.length??0}|${e._pvChangeSeries?.length??0}|${(e._batteryChargeChangeSeries?.length??0)+(e._batteryDischargeChangeSeries?.length??0)}|${e._gridImportChangeSeries?.length??0}|${e._gridExportChangeSeries?.length??0}|${e._batterySoc??""}|f${e._haSolarForecast?.length??0}`}function buildUnifiedStore(e){const t=modeBucketsPerHour(e._timelineMode,e.config),i=24*t,r=e._periodPastDays,s=r+1+e._periodFutureDays,n=s*i,l=fe/t,c={bucketsPerHour:t,bucketsPerDay:i,bucketsTotal:n,stepMs:l},d=function storeOriginMs(e){const t=/* @__PURE__ */new Date;return t.setHours(0,0,0,0),t.getTime()-e*ye}(r),u=d+s*ye,p=Date.now(),g=function buildIrradiance(e,t,i,r){const s=new Array(r.bucketsTotal).fill(null),n=e._chartSeries;if(!n||0===n.times.length)return s;const l=new Array(r.bucketsTotal).fill(0),c=new Array(r.bucketsTotal).fill(0);for(let d=0;d<n.times.length;d++){const e=n.times[d].getTime();if(e<t||e>=i)continue;const s=n.irradiance?.[d];if("number"!=typeof s||!Number.isFinite(s)||s<0)continue;const u=bucketForMs(t,e,r.stepMs,r.bucketsTotal);u<0||(l[u]+=s,c[u]+=1)}for(let d=0;d<r.bucketsTotal;d++)c[d]>0&&(s[d]=l[d]/c[d]);return interpolateNullGaps(s),s}(e,d,u,c),m=function buildCloud(e,t,i,r){const s=new Array(r.bucketsTotal).fill(null),n=e._chartSeries;if(!n||0===n.times.length)return s;const l=new Array(r.bucketsTotal).fill(0),c=new Array(r.bucketsTotal).fill(0);for(let d=0;d<n.times.length;d++){const e=n.times[d].getTime();if(e<t||e>=i)continue;const s=n.cloud[d];if("number"!=typeof s||!Number.isFinite(s))continue;const u=bucketForMs(t,e,r.stepMs,r.bucketsTotal);u<0||(l[u]+=Math.max(0,Math.min(100,s)),c[u]+=1)}for(let d=0;d<r.bucketsTotal;d++)c[d]>0&&(s[d]=l[d]/c[d]);return interpolateNullGaps(s),s}(e,d,u,c),f=function buildProduction(e,t,i,r,s){const n=changeSeriesToWatts(e._pvChangeSeries,t,s.stepMs,s.bucketsTotal,r);for(let d=0;d<n.length;d++){const e=n[d];null!==e&&e<0&&(n[d]=0)}const l=bucketForMs(t,r,s.stepMs,s.bucketsTotal),c=Math.min(s.bucketsTotal,l<0?0:l+1);if(c>0){const e=n.slice(0,c);interpolateNullGaps(e);for(let t=0;t<c;t++)n[t]=e[t]}return n}(e,d,0,p,c),y=function buildForecast(e,t,i,r){const s=new Array(r.bucketsTotal).fill(null),n=e._haSolarForecast;if(!n||0===n.length)return s;for(let l=0;l<r.bucketsTotal;l++){const e=t+l*r.stepMs+r.stepMs/2;if(e<t||e>=i)continue;const c=forecastWattsAt(n,e);null!==c&&Number.isFinite(c)&&(s[l]=Math.max(0,c))}return s}(e,d,u,c),b=function buildBattery(e,t,i,r){const s=changeSeriesToWatts(e._batteryChargeChangeSeries,t,r.stepMs,r.bucketsTotal,i),n=changeSeriesToWatts(e._batteryDischargeChangeSeries,t,r.stepMs,r.bucketsTotal,i),l=new Array(r.bucketsTotal).fill(null);for(let u=0;u<r.bucketsTotal;u++){const e=s[u],t=n[u];null===e&&null===t||(l[u]=Math.max(0,e??0)-Math.max(0,t??0))}const c=bucketForMs(t,i,r.stepMs,r.bucketsTotal),d=Math.min(r.bucketsTotal,c<0?0:c+1);if(d>0){const e=l.slice(0,d);interpolateNullGaps(e);for(let t=0;t<d;t++)l[t]=e[t]}return l}(e,d,p,c),_=function buildBatterySoc(e,t,i,r){const s=new Array(r.bucketsTotal).fill(null),n=e._batterySoc;if(null==n||!Number.isFinite(n))return s;const l=bucketForMs(t,i,r.stepMs,r.bucketsTotal);return l>=0&&(s[l]=Math.max(0,Math.min(100,n))),s}(e,d,p,c),v=buildGridChange(e._gridImportChangeSeries,d,c.stepMs,c.bucketsTotal,p),w=buildGridChange(e._gridExportChangeSeries,d,c.stepMs,c.bucketsTotal,p);return{storeStartMs:d,storeEndMs:u,bucketsPerHour:t,bucketsPerDay:i,bucketsTotal:n,stepMs:l,builtAtMs:p,dataVersion:computeDataVersion(e),irradiance:g,cloud:m,production:f,forecast:y,battery:b,batterySoc:_,gridImport:v,gridExport:w}}function valueAt(e,t,i){if(i<t.storeStartMs||i>=t.storeEndMs)return null;const r=(i-t.storeStartMs)/t.stepMs-.5,s=Math.max(0,Math.min(t.bucketsTotal-1,Math.floor(r))),n=Math.max(0,Math.min(t.bucketsTotal-1,s+1)),l=e[s],c=e[n];if(null===l&&null===c)return null;if(null===l)return c;if(null===c)return l;return l+(c-l)*Math.max(0,Math.min(1,r-s))}function findSunCrossing(e,t,i,r,s){const n=36e5;let l=getSunPosition(new Date(i),e,t).altitude,c=0,d=0,u=!1;for(let p=i+n;p<=r;p+=n){const i=getSunPosition(new Date(p),e,t).altitude;if("rising"===s&&l<=0&&i>0){c=p-n,d=p,u=!0;break}if("setting"===s&&l>0&&i<=0){c=p-n,d=p,u=!0;break}l=i}if(!u)return null;for(let p=0;p<12;p++){const i=(c+d)/2;"rising"===s==getSunPosition(new Date(i),e,t).altitude>0?d=i:c=i}/* @__PURE__ */
return new Date((c+d)/2)}var lt=null;function renderTimelineNightZones(e){const t=function computeNightIntervals(e){const t=e._timeRange;if(!t)return[];const i=getHomeCoords(e.config,e.hass);if(!i)return[];const r=t.start.getTime(),s=t.end.getTime(),n=s-r;if(n<=0)return[];const l=`${r}|${s}|${i.lat.toFixed(4)}|${i.lon.toFixed(4)}`;if(lt&&lt.key===l)return lt.out;const c=[],d=new Date(t.start);d.setHours(0,0,0,0),d.setDate(d.getDate()-1);const u=s+864e5;for(;d.getTime()<=u;){const e=d.getTime(),t=e+864e5,r=findSunCrossing(i.lat,i.lon,e,t,"rising"),s=findSunCrossing(i.lat,i.lon,e,t,"setting");r&&c.push({ms:r.getTime(),kind:"sunrise"}),s&&c.push({ms:s.getTime(),kind:"sunset"}),d.setDate(d.getDate()+1)}c.sort((e,t)=>e.ms-t.ms);const p=[];let g=null,m=!1;for(const y of c)"sunset"===y.kind?g=y.ms:(null!==g?(p.push({startMs:g,endMs:y.ms}),g=null):m||p.push({startMs:-1/0,endMs:y.ms}),m=!0);null!==g&&p.push({startMs:g,endMs:1/0});const f=[];for(const y of p){const e=Math.max(y.startMs,r),t=Math.min(y.endMs,s);t>e&&f.push({startPct:(e-r)/n*100,endPct:(t-r)/n*100})}return lt={key:l,out:f},f}(e);return 0===t.length?G:U`
        ${t.map(e=>U`
            <div
                class="hc-night-zone"
                style="left:${e.startPct.toFixed(2)}%; width:${(e.endPct-e.startPct).toFixed(2)}%"
            ></div>
        `)}
    `}var chartIsDark=e=>!!e.hass?.themes?.darkMode;function pvValueAtTime(e,t,i){const r=(e._pvUnit||"").trim();if(!r)return{value:NaN,unit:"",isPredicted:!1};const s=r.toLowerCase(),n="wh"===s||"kwh"===s||"mwh"===s,l=n?"kwh"===s?"kW":"mwh"===s?"MW":"W":r,c=l.toLowerCase(),d="kw"===c?.001:"mw"===c?1e-6:1,u=getHomeCoords(e.config,e.hass);if(u&&getSunPosition(new Date(t),u.lat,u.lon).altitude<=0)return{value:0,unit:l,isPredicted:!1};const p=i??e._pvHistory,g=p&&p.times.length>=1?p.times[0].getTime():1/0,m=p&&p.times.length>=1?p.times[p.times.length-1].getTime():-1/0;if(p&&p.times.length>=2&&t>=g&&t<=m)if(n)for(let y=1;y<p.times.length;y++){const e=p.times[y].getTime();if(t>e)continue;const i=p.times[y-1].getTime();if(t<i)break;const r=(e-i)/36e5;if(r<=0||r>6)break;const s=p.values[y]-p.values[y-1];if(!isFinite(s)||s<0)break;return{value:Math.max(0,s/r),unit:l,isPredicted:!1}}else{const e=interpAt(p.times,p.values,t);if(isFinite(e))return{value:Math.max(0,e),unit:l,isPredicted:!1}}if(!i){const i=e._pvCalibStats;if(i&&i.times.length>=2&&t<=m)if(n)for(let e=1;e<i.times.length;e++){const r=i.times[e].getTime();if(t>r)continue;const s=i.times[e-1].getTime();if(t<s)break;const n=(r-s)/36e5;if(n<=0||n>6)break;const c=i.values[e]-i.values[e-1];if(!isFinite(c)||c<0)break;return{value:Math.max(0,c/n),unit:l,isPredicted:!1}}else{const e=interpAt(i.times,i.values,t);if(isFinite(e))return{value:Math.max(0,e),unit:l,isPredicted:!1}}}if(i)return{value:NaN,unit:l,isPredicted:!1};const f=e._unifiedStore;if(f){const e=valueAt(f.forecast,f,t);if(null!==e&&e>0)return{value:Math.max(0,e)*d,unit:l,isPredicted:!0}}return{value:NaN,unit:l,isPredicted:!1}}function renderTimelineHoverTooltip(e){const t=e._timeRange,i=e._chartSeries;if(!t)return G;const r=t.start.getTime(),s=t.end.getTime()-r;if(s<=0)return G;const n=e._chartHoverPct;if(null===n||n<0||n>100)return G;const l=n,c=r+l/100*s,d=i?interpAt(i.times,i.irradiance,c):NaN,u=i?interpAt(i.times,i.cloudLow,c):NaN,p=i?interpAt(i.times,i.cloudMid,c):NaN,g=i?interpAt(i.times,i.cloudHigh,c):NaN,m=e._customEntityHistory?interpAt(e._customEntityHistory.times,e._customEntityHistory.values,c):NaN,f=pvValueAtTime(e,c),y=e._chartTarget??"production",b=e._unifiedStore,_=b?valueAt(b.gridImport,b,c)??NaN:NaN,v=b?valueAt(b.gridExport,b,c)??NaN:NaN,w=b?valueAt(b.battery,b,c)??NaN:NaN,$=b?valueAt(b.production,b,c)??NaN:NaN,M=isFinite($)||isFinite(_)||isFinite(v)||isFinite(w),T=Math.max(0,(isFinite($)?$:0)+(isFinite(_)?_:0)-(isFinite(v)?v:0)-(isFinite(w)?w:0)),C=e._batterySocHistory?interpAt(e._batterySocHistory.times,e._batterySocHistory.values,c):NaN,F=valueDecimals(e.config),kw=t=>`${formatLocalisedNumber(e.hass,t/1e3,F)} kW`,H=e._pvHistoryPerEntity,E=H.size>1?Array.from(H.keys()).sort():[],A=[];for(let U=0;U<E.length;U++){const t=E[U],i=H.get(t);if(!i)continue;const r=pvValueAtTime(e,c,i);if(!isFinite(r.value))continue;const s=e.hass?.states?.[t],n=String(s?.attributes?.friendly_name??t),l="W"===r.unit?0:F,d=`${formatLocalisedNumber(e.hass,r.value,l)} ${r.unit}`;A.push({id:t,label:n,valueText:d,colorIdx:U})}const D=isFinite(f.value),R=e,P=ENERGY_COLOR_cloud(R),L=lerpHexToward(P,"#ffffff",.55),I=lerpHexToward(P,"#000000",.5),O=new Date(c),z=e.hass?.language||void 0,W=s/864e5,j=W<=2.05?{hour:"2-digit",minute:"2-digit"}:W<=14.05?{weekday:"short",hour:"2-digit",minute:"2-digit"}:{weekday:"short",day:"numeric",month:"short"},B=new Intl.DateTimeFormat(z,j).format(O),q=new Date(O);q.setHours(0,0,0,0);const K=/* @__PURE__ */new Date;K.setHours(0,0,0,0);const Y=q.getTime()===K.getTime(),X=c>Date.now();let Z=function computeDailyKwhTotals(e){const t=/* @__PURE__ */new Map;if(!e._timeRange)return t;const{start:i,end:r}=e._timeRange,s=i.getTime(),n=r.getTime(),dayKey=e=>{const t=new Date(e);return t.setHours(0,0,0,0),t.getTime()},l=e._pvChangeSeries;if(l&&l.length>0){const e=new Date(s);for(e.setHours(0,0,0,0);e.getTime()<n;){const i=e.getTime(),r=new Date(e);r.setDate(r.getDate()+1);const s=sumChangeForDay(l,i,r.getTime());null!==s&&t.set(i,Math.max(0,s)),e.setTime(r.getTime())}}const c=e._unifiedStore;if(c){const e=Date.now(),i=c.stepMs/36e5;for(let r=0;r<c.bucketsTotal;r++){const l=c.storeStartMs+(r+.5)*c.stepMs;if(l<s||l>n)continue;if(l<e)continue;const d=c.forecast[r];if(null===d||!isFinite(d)||d<=0)continue;const u=dayKey(l);t.set(u,(t.get(u)??0)+d*i/1e3)}}return t}(e).get(q.getTime());Y&&!X&&"number"==typeof e._haSolarTodayKwh&&isFinite(e._haSolarTodayKwh)&&(Z=e._haSolarTodayKwh);const J=X&&void 0!==Z&&isFinite(Z)&&Z>=.05,Q=void 0!==Z&&isFinite(Z)&&Z>=.05?formatLocalisedNumber(e.hass,Z,F)+" kWh":"",ee=Date.now(),te=ee>=r&&ee<=r+s&&Math.abs(l-(ee-r)/s*100)<=1.2,ie=D&&"W"!==f.unit?F:0,oe=(e.hass?.language||"").toLowerCase().startsWith("fr")?"Retour au live":"Back to live";return U`
        <div
            class="tb-hover-tooltip-tail ${te?"is-magnet-snap":""}"
            style="left:${l.toFixed(2)}%"
        ></div>
        <div
            class="tb-hover-tooltip-wrapper"
            style="left:${l.toFixed(2)}%; transform: translateX(-${l.toFixed(2)}%)"
        >
            <div class="tb-hover-tooltip">
                <div class="tb-hover-tooltip-time">
                    <ha-icon class="tb-hover-tooltip-time-icon" icon="mdi:clock-outline"></ha-icon>
                    <span class="tb-hover-tooltip-time-label">${B}</span>
                    <span
                        class="tb-hover-tooltip-live-chip ${te?"is-visible":""}"
                        title=${oe}
                        aria-label=${oe}
                        aria-hidden=${te?"false":"true"}
                    >
                        <ha-icon class="tb-hover-tooltip-live-chip-dot" icon="mdi:circle-medium"></ha-icon>
                        <span class="tb-hover-tooltip-live-chip-label">${"Live"}</span>
                    </span>
                </div>
                ${"production"===y?U`
                    ${J&&Q?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_pv(R)}" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Q}</span>
                        </div>
                    `:G}
                    ${D?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_pv(R)}" icon="mdi:solar-power"></ha-icon>
                            <span class="tb-hover-tooltip-value">${formatLocalisedNumber(e.hass,f.value,ie)} ${f.unit}</span>
                        </div>
                    `:G}
                    ${A.map(t=>U`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${energySolarColor(e,chartIsDark(e),t.colorIdx)}"></span>
                            <span class="tb-hover-tooltip-sublabel">${t.label}</span>
                            <span class="tb-hover-tooltip-value">${t.valueText}</span>
                        </div>
                    `)}
                `:G}
                ${"consumption"===y&&M?U`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_consumption(R)}" icon="mdi:home-lightning-bolt"></ha-icon>
                        <span class="tb-hover-tooltip-value">${kw(T)}</span>
                    </div>
                `:G}
                ${"grid"===y?U`
                    ${isFinite(_)&&_>=1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_gridImport(R)}" icon="mdi:transmission-tower-export"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(_)}</span>
                        </div>
                    `:G}
                    ${isFinite(v)&&v>=1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_gridExport(R)}" icon="mdi:transmission-tower-import"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(v)}</span>
                        </div>
                    `:G}
                `:G}
                ${"battery"===y?U`
                    ${isFinite(w)&&w>=1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_batteryIn(R)}" icon="mdi:battery-arrow-up"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(w)}</span>
                        </div>
                    `:G}
                    ${isFinite(w)&&w<=-1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_batteryOut(R)}" icon="mdi:battery-arrow-down"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(-w)}</span>
                        </div>
                    `:G}
                `:G}
                ${"battery-soc"===y&&isFinite(C)?U`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_batteryOut(R)}" icon="mdi:battery"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,C)))} %</span>
                    </div>
                `:G}
                ${"irradiance"===y&&isFinite(d)?U`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR_sun(R)}" icon="mdi:white-balance-sunny"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,d))} W/m²</span>
                    </div>
                `:G}
                ${"custom"===y&&isFinite(m)?U`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${cssHex(R,"--red-color","#f44336")}" icon=${resolveCustomEntityIcon(e.hass,e.config)}></ha-icon>
                        <span class="tb-hover-tooltip-value">${formatLocalisedNumber(e.hass,Math.abs(m)/1e3,F)} kW</span>
                    </div>
                `:G}
                ${"cloud"===y?U`
                    ${isFinite(g)?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${I}" icon="mdi:format-vertical-align-top"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,g)))} %</span>
                        </div>
                    `:G}
                    ${isFinite(p)?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${P}" icon="mdi:format-vertical-align-center"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,p)))} %</span>
                        </div>
                    `:G}
                    ${isFinite(u)?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${L}" icon="mdi:format-vertical-align-bottom"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,u)))} %</span>
                        </div>
                    `:G}
                `:G}
            </div>
        </div>
    `}function interpAt(e,t,i){const r=Math.min(e.length,t.length);if(0===r)return NaN;if(i<=e[0].getTime())return isFinite(t[0])?t[0]:NaN;if(i>=e[r-1].getTime()){const e=t[r-1];return isFinite(e)?e:NaN}let s=0,n=r-1;for(;n-s>1;){const t=Math.trunc((s+n)/2);e[t].getTime()<=i?s=t:n=t}const l=e[s].getTime(),c=e[n].getTime(),d=t[s],u=t[n];if(!isFinite(d)||!isFinite(u))return NaN;const p=c-l;return p<=0?u:d+(u-d)*(i-l)/p}function renderPvChart(e){const t=e,i=e._timeRange;e._pvHistory;const r=1e3,s=100;if(!i)return U`<svg class="hc-chart-svg" viewBox="0 0 ${r} ${s}" preserveAspectRatio="none"></svg>`;const n=i.start.getTime(),l=i.end.getTime()-n;if(l<=0)return U`<svg class="hc-chart-svg" viewBox="0 0 ${r} ${s}" preserveAspectRatio="none"></svg>`;const c=ENERGY_COLOR_pv(t),d=e.hass?.themes?.darkMode?lerpHexToward(c,"#ffffff",.55):lerpHexToward(c,"#000000",.35),u=i.end.getTime(),p=buildTimelineModel(i.start,i.end).dayBoundaries.map(e=>e*r),g=(e._pvUnit||"").toLowerCase(),m="wh"===g||"kwh"===g||"mwh"===g,f=e._unifiedStore,y=f?function sliceForRange(e,t,i){const r=Math.max(e.storeStartMs,t),s=Math.min(e.storeEndMs,i);if(s<=r)return{times:[],production:[],forecast:[],cloud:[],irradiance:[]};const n=e.stepMs,l=Math.floor((r-e.storeStartMs)/n),c=[],d=[],u=[],p=[],g=[];for(let m=e.storeStartMs+l*n+n/2;m<s;m+=n)m<r||(c.push(new Date(m)),d.push(valueAt(e.production,e,m)),u.push(valueAt(e.forecast,e,m)),p.push(valueAt(e.cloud,e,m)),g.push(valueAt(e.irradiance,e,m)));return{times:c,production:d,forecast:u,cloud:p,irradiance:g}}(f,n,u):null,xOf=e=>(e.getTime()-n)/l*r,b=(()=>{const e=m?"kwh"===g?"kw":"mwh"===g?"mw":"wh"===g?"w":"":g;return"kw"===e?.001:"mw"===e?1e-6:1})(),_=[];if(y)for(let I=0;I<y.times.length;I++){const e=y.production[I];null!==e&&isFinite(e)&&_.push({t:y.times[I],v:e*b})}const v=[];if(y)for(let I=0;I<y.times.length;I++){const e=y.forecast[I];null===e||!isFinite(e)||e<=0||v.push({t:y.times[I],v:e*b})}let w=1;for(const I of _)I.v>w&&(w=I.v);for(const I of v)I.v>w&&(w=I.v);const yOf=e=>s-90*Math.max(0,Math.min(1,e/w)),$=_.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`);let M="",T="";if($.length>=2){const e=xOf(_[0].t),t=xOf(_[_.length-1].t);M=`M ${e},100 L ${$.join(" L ")} L ${t},100 Z`,T=`M ${$.join(" L ")}`}const C=e._pvHistoryPerEntity.size>1?Array.from(e._pvHistoryPerEntity.keys()).sort():[],F=[];if(C.length>1&&_.length>=2){const t=e,i=chartIsDark(e),r=C.length,s=_.length,n=[];for(let c=0;c<r;c++){const t=e._pvHistoryPerEntity.get(C[c]),i=new Array(s).fill(0);if(t)for(let r=0;r<s;r++){const s=pvValueAtTime(e,_[r].t.getTime(),t).value;i[r]=isFinite(s)&&s>0?s:0}n.push(i)}const l=new Array(s).fill(0);for(let e=0;e<r;e++){const c=[],d=[];for(let t=0;t<s;t++){let i=0;for(let e=0;e<r;e++)i+=n[e][t];const s=i>0?n[e][t]/i:0,u=l[t],p=u+s*_[t].v;l[t]=p,c.push(`${xOf(_[t].t).toFixed(2)},${yOf(p).toFixed(2)}`),d.push(`${xOf(_[t].t).toFixed(2)},${yOf(u).toFixed(2)}`)}F.push({color:energySolarColor(t,i,e),path:`M ${c.join(" L ")} L ${d.reverse().join(" L ")} Z`})}}let H="";v.length>=2&&(H=`M ${v.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`).join(" L ")}`);const E=e._chartHoverPct;let A=0,D=NaN,R=NaN,P=!1;if(null!==E&&E>=0&&E<=100){A=E/100*r;const e=n+E/100*l,t=_.length>0?_[_.length-1].t.getTime():-1/0;if(_.length>=1&&e<=t){const t=interpAt(_.map(e=>e.t),_.map(e=>e.v),e);isFinite(t)&&(D=yOf(Math.max(0,t)))}if(v.length>=1){const t=interpAt(v.map(e=>e.t),v.map(e=>e.v),e);isFinite(t)&&(R=yOf(Math.max(0,t)))}P=isFinite(D)||isFinite(R)}const L=[];if(P&&null!==E&&F.length>0){const t=n+E/100*l,i=interpAt(_.map(e=>e.t),_.map(e=>e.v),t);if(isFinite(i)&&i>0){const r=C.map(i=>{const r=e._pvHistoryPerEntity.get(i);if(!r)return 0;const s=pvValueAtTime(e,t,r).value;return isFinite(s)&&s>0?s:0}),s=r.reduce((e,t)=>e+t,0);if(s>0){let t=0;for(let n=0;n<C.length;n++)t+=r[n]/s,L.push({y:yOf(t*i),color:energySolarColor(e,chartIsDark(e),n)})}}}return U`
        <svg
            class="hc-chart-svg"
            viewBox="0 0 ${r} ${s}"
            preserveAspectRatio="none"
        >
            ${p.map(e=>q`
                <line
                    class="hc-day-sep"
                    x1="${e.toFixed(2)}" y1="0"
                    x2="${e.toFixed(2)}" y2="${s}"
                ></line>
            `)}
            <g class="hc-chart-grow">
                ${F.length>0?F.map(e=>q`
                        <path
                            d="${e.path}"
                            fill="${e.color}"
                            fill-opacity="0.55"
                        ></path>
                    `):M?q`
                        <path
                            d="${M}"
                            fill="${c}"
                            fill-opacity="0.25"
                        ></path>
                    `:G}
                ${T?q`
                    <path
                        class="hc-chart-line"
                        d="${T}"
                        stroke="${c}"
                    ></path>
                `:G}
                ${H?q`
                    <path
                        class="hc-chart-line hc-chart-predicted"
                        d="${H}"
                        stroke="${d}"
                    ></path>
                `:G}
            </g>
            ${P?q`
                <line
                    class="hc-hover-guide"
                    x1="${A.toFixed(2)}" y1="0"
                    x2="${A.toFixed(2)}" y2="${s}"
                ></line>
            `:G}
        </svg>
        ${P&&isFinite(D)?U`
            <div class="hc-hover-dot-html" style="left: ${(A/r*100).toFixed(2)}%; top: ${(D/s*100).toFixed(2)}%; background: ${c};"></div>
        `:G}
        ${P&&isFinite(R)?U`
            <div class="hc-hover-dot-html" style="left: ${(A/r*100).toFixed(2)}%; top: ${(R/s*100).toFixed(2)}%; background: ${d};"></div>
        `:G}
        ${L.map(e=>U`
            <div class="hc-hover-dot-html" style="left: ${(A/r*100).toFixed(2)}%; top: ${(e.y/s*100).toFixed(2)}%; background: ${e.color};"></div>
        `)}
    `}function renderBottomChart(e){const t=e._chartTarget??"production";return"production"===t?renderPvChart(e):function renderTargetChart(e,t){const i=e,r=e._unifiedStore,s=e._timeRange,n=1e3,l=100;if(!r||!s)return U`<svg class="hc-chart-svg" viewBox="0 0 ${n} ${l}" preserveAspectRatio="none"></svg>`;const c=s.start.getTime(),d=s.end.getTime(),u=d-c;if(u<=0)return U`<svg class="hc-chart-svg" viewBox="0 0 ${n} ${l}" preserveAspectRatio="none"></svg>`;const xOf=e=>(e-c)/u*n,toPts=(e,t)=>{const i=[];for(let s=0;s<e.length;s++){const n=e[s];if(null===n||!isFinite(n))continue;const l=r.storeStartMs+(s+.5)*r.stepMs;l<c||l>d||i.push({t:l,v:t?t(n):n})}return i},sum=e=>e.reduce((e,t)=>e+t.v,0);let p,g=0;if("consumption"===t){const e=[];for(let t=0;t<r.production.length;t++){const i=r.production[t],s=r.gridImport[t],n=r.gridExport[t],l=r.battery[t];if(null===i&&null===s&&null===n&&null===l)continue;const u=r.storeStartMs+(t+.5)*r.stepMs;if(u<c||u>d)continue;const p=Math.max(0,(i??0)+(s??0)-(n??0)-(l??0));e.push({t:u,v:p})}p=[{pts:e,color:ENERGY_COLOR_consumption(i)}]}else if("grid"===t){const e=toPts(r.gridImport),t=toPts(r.gridExport);p=[{pts:e,color:ENERGY_COLOR_gridImport(i)},{pts:t,color:ENERGY_COLOR_gridExport(i)}]}else if("battery"===t){const e=toPts(r.battery,e=>Math.max(0,e)),t=toPts(r.battery,e=>Math.max(0,-e));p=[{pts:e,color:ENERGY_COLOR_batteryIn(i)},{pts:t,color:ENERGY_COLOR_batteryOut(i)}]}else if("battery-soc"===t){const t=e._batterySocHistory,r=[];if(t)for(let e=0;e<t.times.length;e++){const i=t.times[e].getTime();if(i<c||i>d)continue;const s=t.values[e];void 0!==s&&isFinite(s)&&r.push({t:i,v:s})}p=[{pts:r,color:ENERGY_COLOR_batteryOut(i)}],g=100}else if("custom"===t){const t=e._customEntityHistory,r=[];if(t)for(let e=0;e<t.times.length;e++){const i=t.times[e].getTime();if(i<c||i>d)continue;const s=t.values[e];isFinite(s)&&r.push({t:i,v:Math.abs(s)})}p=[{pts:r,color:cssHex(i,"--red-color","#f44336")}]}else if("cloud"===t){const t=e._chartSeries,r=[],s=[],n=[];if(t)for(let e=0;e<t.times.length;e++){const i=t.times[e].getTime();if(i<c||i>d)continue;const l=t.cloudLow[e],u=t.cloudMid[e],p=t.cloudHigh[e];(isFinite(l)||isFinite(u)||isFinite(p))&&(r.push({t:i,v:isFinite(l)?Math.max(0,l):0}),s.push({t:i,v:isFinite(u)?Math.max(0,u):0}),n.push({t:i,v:isFinite(p)?Math.max(0,p):0}))}p=[{pts:r,color:lerpHexToward(ENERGY_COLOR_cloud(i),"#ffffff",.55)},{pts:s,color:ENERGY_COLOR_cloud(i)},{pts:n,color:lerpHexToward(ENERGY_COLOR_cloud(i),"#000000",.5)}],g=0}else p=[{pts:toPts(r.irradiance),color:ENERGY_COLOR_sun(i)}],g=1e3;const m="cloud"===t&&p.length>1&&p.every(e=>e.pts.length===p[0].pts.length&&e.pts.length>=2);let f=g;if(f<=0)if(f=1,m){const e=p[0].pts.length;for(let t=0;t<e;t++){let e=0;for(const i of p)e+=i.pts[t].v;e>f&&(f=e)}}else for(const T of p)for(const e of T.pts)e.v>f&&(f=e.v);const y=10,yOf=e=>l-Math.max(0,Math.min(1,e/f))*(l-y);let b;if(m){const e=p[0].pts.length,t=new Array(e).fill(0);b=p.map(i=>{const r=[],s=[];for(let l=0;l<e;l++){const e=t[l],n=e+i.pts[l].v;t[l]=n,r.push(`${xOf(i.pts[l].t).toFixed(2)},${yOf(n).toFixed(2)}`),s.push(`${xOf(i.pts[l].t).toFixed(2)},${yOf(e).toFixed(2)}`)}const n=`M ${r.join(" L ")}`;return{area:`M ${r.join(" L ")} L ${s.reverse().join(" L ")} Z`,line:n,color:i.color,total:sum(i.pts)}})}else b=p.map(e=>{if(e.pts.length<2)return{area:"",line:"",color:e.color,total:sum(e.pts)};const t=e.pts.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`),i=xOf(e.pts[0].t),r=xOf(e.pts[e.pts.length-1].t);return{area:`M ${i},${l} L ${t.join(" L ")} L ${r},${l} Z`,line:`M ${t.join(" L ")}`,color:e.color,total:sum(e.pts)}});const _=buildTimelineModel(s.start,s.end).dayBoundaries.map(e=>e*n),v=e._chartHoverPct;let w=0,$=!1;const M=[];if(null!==v&&v>=0&&v<=100){w=v/100*n;const e=c+v/100*u;let t=0;for(const i of p){if(i.pts.length<1)continue;const r=interpAt(i.pts.map(e=>new Date(e.t)),i.pts.map(e=>e.v),e);isFinite(r)&&(m?(t+=Math.max(0,r),M.push({y:yOf(t),color:i.color})):M.push({y:yOf(Math.max(0,r)),color:i.color}),$=!0)}}return U`
        <svg class="hc-chart-svg" viewBox="0 0 ${n} ${l}" preserveAspectRatio="none">
            ${_.map(e=>q`
                <line class="hc-day-sep" x1="${e.toFixed(2)}" y1="0" x2="${e.toFixed(2)}" y2="${l}"></line>
            `)}
            <g class="hc-chart-grow">
                ${b.map(e=>e.area?q`
                    <path d="${e.area}" fill="${e.color}" fill-opacity="${m?"0.6":"0.22"}"></path>
                `:G)}
                ${b.map(e=>e.line?q`
                    <path class="hc-chart-line" d="${e.line}" stroke="${e.color}"></path>
                `:G)}
            </g>
            ${$?q`
                <line class="hc-hover-guide" x1="${w.toFixed(2)}" y1="0" x2="${w.toFixed(2)}" y2="${l}"></line>
            `:G}
        </svg>
        ${M.map(e=>U`
            <div class="hc-hover-dot-html" style="left: ${(w/n*100).toFixed(2)}%; top: ${(e.y/l*100).toFixed(2)}%; background: ${e.color};"></div>
        `)}
    `}(e,t)}function chartAccentColor(e){const t=e,i=e._chartTarget??"production";if("production"===i)return ENERGY_COLOR_pv(t);if("consumption"===i)return ENERGY_COLOR_consumption(t);if("irradiance"===i)return ENERGY_COLOR_sun(t);if("cloud"===i)return ENERGY_COLOR_cloud(t);if("battery-soc"===i)return ENERGY_COLOR_batteryOut(t);if("custom"===i)return cssHex(t,"--red-color","#f44336");const r=e._unifiedStore,s=e._timeRange;if(!r||!s)return"grid"===i?ENERGY_COLOR_gridImport(t):ENERGY_COLOR_batteryOut(t);const n=s.start.getTime(),l=s.end.getTime(),sumArr=(e,t)=>{let i=0;for(let s=0;s<e.length;s++){const c=e[s];if(null===c||!isFinite(c))continue;const d=r.storeStartMs+(s+.5)*r.stepMs;d<n||d>l||(i+=t?t(c):c)}return i};return"grid"===i?sumArr(r.gridImport)>=sumArr(r.gridExport)?ENERGY_COLOR_gridImport(t):ENERGY_COLOR_gridExport(t):sumArr(r.battery,e=>Math.max(0,e))>=sumArr(r.battery,e=>Math.max(0,-e))?ENERGY_COLOR_batteryIn(t):ENERGY_COLOR_batteryOut(t)}function renderTimelineDayLabels(e){if(!e._timeRange)return G;const{start:t,end:i}=e._timeRange,r=buildTimelineModel(t,i),s=r.labels.filter(e=>e.frac>.02&&e.frac<.98),n=r.separators.filter(e=>e.frac>.02&&e.frac<.98),l=/* @__PURE__ */new Date;l.setHours(0,0,0,0);return U`
        <div class="tb-day-strip">
            ${n.map(e=>U`
                <div class="tb-day-strip-sep" style="left:${(100*e.frac).toFixed(2)}%"></div>
            `)}
            ${s.map(t=>U`
                <span
                    class="tb-day-strip-date ${(e=>"days"===r.kind&&e.getTime()===l.getTime())(t.date)?"is-today":""}"
                    style="left:${(100*t.frac).toFixed(2)}%"
                >${function formatTimelineLabel(e,t,i){const r=i?.language||void 0,s="intraday"===e?{hour:"2-digit",minute:"2-digit"}:"days"===e?{weekday:"short"}:"weeks"===e?{day:"numeric",month:"short"}:{month:"long"};try{return new Intl.DateTimeFormat(r,s).format(t)}catch(I){return new Intl.DateTimeFormat(void 0,s).format(t)}}(r.kind,t.date,e.hass)}</span>
            `)}
        </div>
    `}var ct=.5,ht=.25;function easeOutCubic(e){return 1-(1-(e<0?0:e>1?1:e))**3}function distToSegment(e,t,i,r,s,n){const l=s-i,c=n-r,d=l*l+c*c,u=d?Math.max(0,Math.min(1,((e-i)*l+(t-r)*c)/d)):0;return Math.hypot(e-(i+u*l),t-(r+u*c))}var dt=96;function slotOf(e){return 4*e.getHours()+Math.floor(e.getMinutes()/15)}function fillGaps(e){const t=e.length;if(!e.some(e=>Number.isFinite(e)))return new Array(t).fill(0);const i=e.slice();for(let r=0;r<t;r++){if(Number.isFinite(i[r]))continue;let s=1;for(;!Number.isFinite(e[((r-s)%t+t)%t]);)s++;let n=1;for(;!Number.isFinite(e[(r+n)%t]);)n++;const l=e[((r-s)%t+t)%t];i[r]=l+(e[(r+n)%t]-l)*(s/(s+n))}return i}function expandHourly(e,t){const i=new Array(dt);for(let r=0;r<dt;r++){const s=Math.max(0,e[Math.floor(r/4)]??0);i[r]=t?s/4:s}return i}function binSlotAvg(e,t){const i=new Array(dt).fill(0),r=new Array(dt).fill(0);for(let s=0;s<e.bucketsTotal;s++){const n=t[s];if(null===n||!isFinite(n))continue;const l=slotOf(new Date(e.storeStartMs+(s+.5)*e.stepMs));i[l]+=Math.abs(n),r[l]+=1}return fillGaps(i.map((e,t)=>r[t]?e/r[t]:NaN))}function binSlotSum(e,t){const i=new Array(dt).fill(0),r=e.stepMs/fe,s=9e5;for(let n=0;n<e.bucketsTotal;n++){const l=t[n];if(null===l||!isFinite(l))continue;const c=Math.max(0,l)*r/1e3,d=e.storeStartMs+n*e.stepMs,u=d+e.stepMs;for(let t=d;t<u;){const r=Math.floor(t/s)*s+s,n=Math.min(u,r);i[slotOf(new Date(t))]+=c*((n-t)/e.stepMs),t=n}}return i}function hasSignal(e){return!!e&&e.some(e=>null!==e&&isFinite(e)&&0!==e)}function clockTargetMeta(e,t){const i=e;switch(t){case"consumption":return{icon:"mdi:home-lightning-bolt",color:ENERGY_COLOR_consumption(i)};case"grid":return{icon:"mdi:transmission-tower",color:ENERGY_COLOR_gridImport(i)};case"battery":return{icon:"mdi:battery-charging",color:ENERGY_COLOR_batteryOut(i)};case"battery-soc":return{icon:"mdi:battery",color:ENERGY_COLOR_batteryOut(i)};case"irradiance":return{icon:"mdi:white-balance-sunny",color:ENERGY_COLOR_sun(i)};case"cloud":return{icon:"mdi:weather-cloudy",color:ENERGY_COLOR_cloud(i)};case"custom":return{icon:resolveCustomEntityIcon(e.hass,e.config),color:cssHex(i,uiColorVar(customEntityColor(e.config),"red"),"#f44336")};default:return{icon:"mdi:solar-power",color:ENERGY_COLOR_pv(i)}}}var ut={production:"Production",consumption:"Consumption",grid:"Grid",battery:"Battery","battery-soc":"Battery charge",irradiance:"Irradiance",cloud:"Cloud cover",custom:"Custom"},pt={production:"Production",consumption:"Consommation",grid:"Réseau",battery:"Batterie","battery-soc":"Charge batterie",irradiance:"Irradiance",cloud:"Nébulosité",custom:"Personnalisé"};function buildClockData(e,t){if(e._clockHourly)return function buildClockDataHourly(e,t,i){const r=e,s=e.themeIsDark(),n=clockTargetMeta(e,t),data=(e,i)=>({target:t,color:n.color,unit:e,layers:i}),oneE=(e,t,i)=>({color:e,icon:t,label:"",values:expandHourly(i,!0)}),oneA=(e,t,i)=>({color:e,icon:t,label:"",values:expandHourly(i,!1)});switch(t){case"production":return data("energy",i.pv.map((e,t)=>oneE(energySolarColor(r,s,t),"mdi:solar-power",e)));case"consumption":return data("energy",[oneE(ENERGY_COLOR_consumption(r),"mdi:home-lightning-bolt",i.consumption)]);case"grid":return data("energy",[oneE(ENERGY_COLOR_gridImport(r),"mdi:transmission-tower-import",i.gridImport),oneE(ENERGY_COLOR_gridExport(r),"mdi:transmission-tower-export",i.gridExport)]);case"battery":return data("energy",[oneE(ENERGY_COLOR_batteryOut(r),"mdi:battery-arrow-up",i.batteryDischarge),oneE(ENERGY_COLOR_batteryIn(r),"mdi:battery-arrow-down",i.batteryCharge)]);case"battery-soc":return data("percent",[oneA(ENERGY_COLOR_batteryOut(r),"mdi:battery",i.soc)]);case"custom":return data("power",[oneA(n.color,n.icon,i.custom)]);default:return data("irradiance"===t?"irradiance":"energy",[])}}(e,t,e._clockHourly);const i=e._unifiedStore,r=e,s=e.themeIsDark(),n=clockTargetMeta(e,t),data=(e,i)=>({target:t,color:n.color,unit:e,layers:i});if(modeBucketsPerHour(e._timelineMode,e.config)<1)return data("irradiance"===t?"irradiance":"energy",[]);if("production"===t){if(!i)return data("energy",[]);const t=Array.from(e._pvHistoryPerEntity.keys()).sort(),n=Date.now(),l=i.stepMs/fe,c=9e5,d=t.map(()=>new Array(dt).fill(0));for(let r=0;r<i.bucketsTotal;r++){const s=i.storeStartMs+(r+.5)*i.stepMs;if(s>n)break;const u=i.storeStartMs+r*i.stepMs,p=u+i.stepMs;t.forEach((t,r)=>{const n=e._pvHistoryPerEntity.get(t);if(!n)return;const g=pvValueAtTime(e,s,n).value;if(!(isFinite(g)&&g>0))return;const m=g*l/1e3;for(let e=u;e<p;){const t=Math.floor(e/c)*c+c,s=Math.min(p,t);d[r][slotOf(new Date(e))]+=m*((s-e)/i.stepMs),e=s}})}return data("energy",t.map((t,i)=>({color:energySolarColor(r,s,i),icon:"mdi:solar-power",label:String(e.hass?.states?.[t]?.attributes?.friendly_name??t),values:d[i]})))}const avgOf=(e,t)=>fillGaps(e.map((e,i)=>t[i]?e/t[i]:NaN));if("battery-soc"===t){const t=e._batterySocHistory,i=new Array(dt).fill(0),s=new Array(dt).fill(0);if(t)for(let e=0;e<t.times.length;e++){const r=t.values[e];if(!isFinite(r))continue;const n=slotOf(t.times[e]);i[n]+=r,s[n]+=1}return data("percent",[{color:ENERGY_COLOR_batteryOut(r),icon:"mdi:battery",label:"",values:avgOf(i,s)}])}if("cloud"===t){const t=e._chartSeries,i=[new Array(dt).fill(0),new Array(dt).fill(0),new Array(dt).fill(0)],s=[new Array(dt).fill(0),new Array(dt).fill(0),new Array(dt).fill(0)];if(t)for(let e=0;e<t.times.length;e++){const r=slotOf(t.times[e]);[t.cloudLow[e],t.cloudMid[e],t.cloudHigh[e]].forEach((e,t)=>{isFinite(e)&&(i[t][r]+=Math.max(0,e),s[t][r]+=1)})}const n=ENERGY_COLOR_cloud(r),l=[lerpHexToward(n,"#ffffff",.55),n,lerpHexToward(n,"#000000",.5)],c=["mdi:format-vertical-align-bottom","mdi:format-vertical-align-center","mdi:format-vertical-align-top"];return data("percent",[0,1,2].map(e=>({color:l[e],icon:c[e],label:"",values:avgOf(i[e],s[e])})))}if("custom"===t){const t=e._customEntityHistory,i=new Array(dt).fill(0),r=new Array(dt).fill(0);if(t)for(let e=0;e<t.times.length;e++){const s=t.values[e];if(!isFinite(s))continue;const n=slotOf(t.times[e]);i[n]+=Math.abs(s),r[n]+=1}return data("power",[{color:n.color,icon:n.icon,label:"",values:avgOf(i,r)}])}if(!i)return data("irradiance"===t?"irradiance":"energy",[]);let l,c="energy";if("grid"===t)l=[{series:i.gridImport,color:ENERGY_COLOR_gridImport(r),icon:"mdi:transmission-tower-import"},{series:i.gridExport,color:ENERGY_COLOR_gridExport(r),icon:"mdi:transmission-tower-export"}];else if("battery"===t){const e=i.battery.map(e=>null===e?null:Math.max(0,e));l=[{series:i.battery.map(e=>null===e?null:Math.max(0,-e)),color:ENERGY_COLOR_batteryOut(r),icon:"mdi:battery-arrow-up"},{series:e,color:ENERGY_COLOR_batteryIn(r),icon:"mdi:battery-arrow-down"}]}else if("irradiance"===t)c="irradiance",l=[{series:i.irradiance,color:ENERGY_COLOR_sun(r),icon:"mdi:white-balance-sunny"}];else{const e=new Array(i.bucketsTotal).fill(null);for(let t=0;t<i.bucketsTotal;t++){const r=i.production[t],s=i.gridImport[t],n=i.gridExport[t],l=i.battery[t];null===r&&null===s&&null===n&&null===l||(e[t]=Math.max(0,(r??0)+(s??0)-(n??0)-(l??0)))}l=[{series:e,color:ENERGY_COLOR_consumption(r),icon:"mdi:home-lightning-bolt"}]}const d="energy"===c?binSlotSum:binSlotAvg;return data(c,l.map(e=>({color:e.color,icon:e.icon,label:"",values:d(i,e.series)})))}function ringRadiusFrac(e){return 1-.6*Math.min(e,7)/7}function hourlyOf(e,t){const i=new Array(24).fill(0);for(let r=0;r<24;r++){let s=0;for(let t=0;t<4;t++)s+=Math.max(0,e[4*r+t]??0);i[r]=t?s:s/4}return i}function ringMax(e,t){let i=0;if("histogram"===t){const t=e.layers.map(t=>hourlyOf(t.values,"energy"===e.unit));for(let e=0;e<24;e++){let r=0;for(const i of t)r+=Math.max(0,i[e]);i=Math.max(i,r)}}else for(let r=0;r<dt;r++){let t=0;for(const i of e.layers)t+=Math.max(0,i.values[r]??0);i=Math.max(i,t)}return i}function foot(e,t,i,r,s){const n=Math.sin(s),l=Math.cos(s),c=Math.cos(s),d=-Math.sin(s);return[[e+i*n+r*c,t+i*l+r*d],[e+i*n-r*c,t+i*l-r*d],[e-i*n-r*c,t-i*l-r*d],[e-i*n+r*c,t-i*l+r*d]]}function stackedColumn(e,t,i,r,s){if(!r.length)return"";const n=[0];for(const g of r)n.push(n[n.length-1]+g.frac);n[n.length-1]=1;const l=n.map(r=>t.map(t=>e.project(t[0],t[1],i*r))),c=e.bearingDeg*Math.PI/180,d=[];for(let g=0;g<t.length;g++){const e=(g+1)%t.length,i=t[e][0]-t[g][0];if((t[e][1]-t[g][1])*Math.sin(c)+i*Math.cos(c)<=0)continue;let n="";for(let t=0;t<r.length;t++){const i=l[t],c=l[t+1];n+=`<polygon points="${i[g][0].toFixed(1)},${i[g][1].toFixed(1)} ${i[e][0].toFixed(1)},${i[e][1].toFixed(1)} ${c[e][0].toFixed(1)},${c[e][1].toFixed(1)} ${c[g][0].toFixed(1)},${c[g][1].toFixed(1)}" fill="${r[t].wall}" stroke="${s}" stroke-width="0.4"/>`}d.push({depth:(l[0][g][1]+l[0][e][1])/2,faces:n})}d.sort((e,t)=>e.depth-t.depth);let u=d.map(e=>e.faces).join("");const p=l[l.length-1].map(e=>`${e[0].toFixed(1)},${e[1].toFixed(1)}`).join(" ");return u+=`<polygon points="${p}" fill="${r[r.length-1].roof}" stroke="${s}" stroke-width="0.6"/>`,u}function clockGuide(e,t,i,r){const s="var(--primary-text-color, #212121)",n=.12*t,l=1.1*t,c=[];for(let u=0;u<=32;u++){const t=u/32*2*Math.PI,i=e.project(n*Math.sin(t),n*Math.cos(t),0);c.push(`${i[0].toFixed(1)},${i[1].toFixed(1)}`)}let d=`<polyline points="${c.join(" ")}" fill="none" stroke="${s}" stroke-opacity="0.25" stroke-width="1"/>`;for(let u=0;u<24;u++){const t=u/24*2*Math.PI,c=e.project(n*Math.sin(t),n*Math.cos(t),0),p=e.project(l*Math.sin(t),l*Math.cos(t),0),g=u===i,m=g?ht+.75*r:ht;d+=`<line x1="${c[0].toFixed(1)}" y1="${c[1].toFixed(1)}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="${s}" stroke-opacity="${m.toFixed(3)}" stroke-width="${g?"1.5":"1"}"/>`}return d}function projectClockFrame(e,t,i,r,s){const n=Math.min(2*e.centreX,2*e.centreY)||1,l=e.pxPerMetre||1,c=.34*n/l,d=.3*n/l,u=e.tiltDeg,p=e.bearingDeg,g=1.18*c,m=Array.from({length:24},(t,i)=>e.project3(g*Math.sin(i/24*2*Math.PI),g*Math.cos(i/24*2*Math.PI),0));let f=1/0,y=-1/0;for(const C of m)f=Math.min(f,C.depth),y=Math.max(y,C.depth);const b=y-f||1,_=m.map((e,t)=>({x:e.x,y:e.y,opacity:.15+.85*(e.depth-f)/b,transform:`translate(-50%, -50%) perspective(900px) rotateX(${u}deg) rotateZ(${p+t/24*360+180}deg)`})),v=/* @__PURE__ */new Map;for(const C of t){const e=C.data.unit;v.set(e,Math.max(v.get(e)??0,ringMax(C.data,i)))}const w=[],$=[];t.forEach((t,u)=>{const p=c*ringRadiusFrac(t.slot),g=v.get(t.data.unit)??0;"histogram"===i?function projectHistogramRing(e,t,i,r,s,n,l,c,d,u,p,g,m){const f=r.data,y=f.layers.map(e=>hourlyOf(e.values,"energy"===f.unit)),totalAt=e=>y.reduce((t,i)=>t+Math.max(0,i[e]),0),b=l>0?n*r.heightScale/l:0,_=.45*function ringSpacingM(e){return.6*e/7}(i),v=.018*c/d*ringRadiusFrac(r.slot),w=null===u?null:Math.floor(u/4);for(let $=0;$<24;$++){const i=($+.5)/24*2*Math.PI,l=t*Math.sin(i),c=t*Math.cos(i),d=totalAt($),u=e.project(l,c,0),M=e.project(l,c,d*b);m.push({slot:4*$,bx:u[0],by:u[1],tx:M[0],ty:M[1]});const T=$===w,C=r.opacity*(null===w||T?1:1-.5*p);if(d<=0){const t=.04*n*r.heightScale;let s=stackedColumn(e,foot(l,c,_,v,i),t,[{frac:1,wall:"rgba(140,140,140,0.3)",roof:"rgba(170,170,170,0.42)"}],"rgba(0,0,0,0.25)");C<1&&(s=`<g opacity="${C.toFixed(3)}">${s}</g>`),g.push({depth:u[1],svg:s});continue}const F=f.layers.map((e,t)=>({v:Math.max(0,y[t][$]),color:e.color})).filter(e=>e.v>0).map(e=>({frac:e.v/d,wall:lerpHexToward(e.color,"#000000",.25),roof:lerpHexToward(e.color,"#ffffff",T?.4:.12)}));if(!F.length)continue;const H=T?"rgba(255,255,255,0.9)":"rgba(0,0,0,0.3)";let E=stackedColumn(e,foot(l,c,_,v,i),d*b,F,H);T&&(E=`<g filter="url(#clock-glow-${s})">${E}</g>`),C<1&&(E=`<g opacity="${C.toFixed(3)}">${E}</g>`),g.push({depth:u[1],svg:E})}}(e,p,c,t,u,d,g,n,l,r,s,$,w):function projectAreaRing(e,t,i,r,s,n,l,c,d,u){const p=i.data,totalAt=e=>p.layers.reduce((t,i)=>t+Math.max(0,i.values[e]??0),0),g=n>0?s*i.heightScale/n:0;let m=0;for(let _=0;_<dt;_++)m=Math.max(m,totalAt(_));for(let _=0;_<dt;_++){const i=_/dt*2*Math.PI,r=t*Math.sin(i),s=t*Math.cos(i),n=e.project(r,s,0),l=e.project(r,s,totalAt(_)*g);u.push({slot:_,bx:n[0],by:n[1],tx:l[0],ty:l[1]})}if(m<=0){const r=[];for(let i=0;i<=dt;i++){const s=i/dt*2*Math.PI,n=e.project(t*Math.sin(s),t*Math.cos(s),0);r.push(`${n[0].toFixed(1)},${n[1].toFixed(1)}`)}return void d.push({depth:-1/0,svg:`<polyline points="${r.join(" ")}" fill="none" stroke="${p.color}" stroke-opacity="${(.3*i.opacity).toFixed(3)}" stroke-width="1"/>`})}const f=[],y=p.layers.map(()=>[]);for(let _=0;_<=dt;_++){const i=_%dt,r=_/dt*2*Math.PI,s=t*Math.sin(r),n=t*Math.cos(r);f.push(e.project(s,n,0));let l=0;for(let t=0;t<p.layers.length;t++)l+=Math.max(0,p.layers[t].values[i]??0),y[t].push(e.project(s,n,l*g))}const b=y[y.length-1];for(let _=0;_<dt;_++){const e=(f[_][1]+f[_+1][1])/2,t=null!==l&&_===l,s=t?ct+.5*c:ct;for(let r=0;r<p.layers.length;r++){const t=p.layers[r],n=0===r?f[_]:y[r-1][_],l=0===r?f[_+1]:y[r-1][_+1],c=y[r][_],u=y[r][_+1],g=(i.opacity*s*(t.predicted?.5:1)).toFixed(3),m=lerpHexToward(t.color,"#000000",.12);if(d.push({depth:e,svg:`<polygon points="${n[0].toFixed(1)},${n[1].toFixed(1)} ${l[0].toFixed(1)},${l[1].toFixed(1)} ${u[0].toFixed(1)},${u[1].toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}" fill="${m}" fill-opacity="${g}"/>`}),r<p.layers.length-1){const r=lerpHexToward(t.color,"#ffffff",.3);d.push({depth:e,svg:`<line x1="${c[0].toFixed(1)}" y1="${c[1].toFixed(1)}" x2="${u[0].toFixed(1)}" y2="${u[1].toFixed(1)}" stroke="${r}" stroke-opacity="${i.opacity.toFixed(3)}" stroke-width="0.75"/>`})}}const n=t?"rgba(255,255,255,0.97)":lerpHexToward(p.color,"#ffffff",.3),u=t?` filter="url(#clock-glow-${r})"`:"",g=t?1+1.5*c:1;d.push({depth:e,svg:`<line x1="${b[_][0].toFixed(1)}" y1="${b[_][1].toFixed(1)}" x2="${b[_+1][0].toFixed(1)}" y2="${b[_+1][1].toFixed(1)}" stroke="${n}" stroke-opacity="${i.opacity.toFixed(3)}" stroke-width="${g.toFixed(2)}"${u}/>`})}}(e,p,t,u,d,g,r,s,$,w)}),$.sort((e,t)=>e.depth-t.depth);let M="<defs>";t.forEach((e,t)=>{M+=`<filter id="clock-glow-${t}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${e.data.color}" flood-opacity="0.95"/></filter>`}),M+="</defs>";const T=function clockCompass(e,t,i,r){const s=1.3*t,n=1.42*t,l=.05*t,c=1.5*t,triangle=(t,i)=>{const r=Math.sin(t),c=Math.cos(t),d=Math.cos(t),u=-Math.sin(t),p=e.project(n*r,n*c,0),g=e.project(s*r+l*d,s*c+l*u,0),m=e.project(s*r-l*d,s*c-l*u,0);return`<polygon points="${p[0].toFixed(1)},${p[1].toFixed(1)} ${g[0].toFixed(1)},${g[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}" fill="${i}"/>`};return{svg:triangle(0,"var(--red-color, #f44336)")+triangle(Math.PI,"var(--primary-text-color, #212121)"),labels:[{angle:0,label:"N",hourEquiv:0},{angle:Math.PI,label:"S",hourEquiv:12}].map(({angle:t,label:s,hourEquiv:n})=>{const l=e.project(c*Math.sin(t),c*Math.cos(t),0);return{x:l[0],y:l[1],label:s,transform:`translate(-50%, -50%) perspective(900px) rotateX(${r}deg) rotateZ(${i+n/24*360+180}deg)`}})}}(e,c,p,u);return{guideSvg:clockGuide(e,c,null,0)+T.svg,svg:M+$.map(e=>e.svg).join(""),hits:w,labels:_,compass:T.labels}}function clockHitTest(e,t,i){let r=null,s=22;for(const n of e){const e=distToSegment(t,i,n.bx,n.by,n.tx,n.ty);e<s&&(s=e,r=n.slot)}return r}function clockLayerValue(e,t,i,r){return"histogram"===i?function hourlyAt(e,t,i){let r=0;for(let s=0;s<4;s++)r+=Math.max(0,e[4*t+s]??0);return i?r:r/4}(e.values,Math.floor(r/4),"energy"===t.unit):Math.max(0,e.values[r]??0)}function formatClockValue(e,t,i){if("percent"===t.unit)return`${Math.round(Math.max(0,i))} %`;if("irradiance"===t.unit)return`${Math.round(Math.max(0,i))} W/m²`;const r=valueDecimals(e.config);return"energy"===t.unit?`${formatLocalisedNumber(e.hass,i,r)} kWh`:`${formatLocalisedNumber(e.hass,i/1e3,r)} kW`}var gt=/* @__PURE__ */new Map;function resolveBatteryEntities(e){return{powerEntity:e.batteryStatRates[0]??e.batteryStatEnergyFroms[0]??e.batteryStatEnergyTos[0]??null,socEntity:e.batteryStatSocs[0]??null}}function refreshBattery(e){if(!e.hass)return;const{powerEntity:t,socEntity:i}=resolveBatteryEntities(e._energyDefaults);if(!t&&!i)return null!==e._batterySoc&&(e._batterySoc=null),null!==e._batteryPower&&(e._batteryPower=null),""!==e._batteryPowerUnit&&(e._batteryPowerUnit=""),null!==e._batterySocHistory&&(e._batterySocHistory=null),null!==e._batteryPowerHistory&&(e._batteryPowerHistory=null),void(e._batteryFetchKey="");let r=null;const s=e._energyDefaults.batteryStatSocs;if(s.length>0){let t=0,i=0;for(const r of s){const s=e.hass.states?.[r],n=s?parseFloat(s.state):NaN;isFinite(n)&&(t+=n,i+=1)}i>0&&(r=Math.max(0,Math.min(100,t/i)))}let n=null,l="";const c=e._energyDefaults.batteryStatRates;if(c.length>0){let t=0,i=!1;for(const r of c){const s=e.hass.states?.[r],n=s?parseFloat(s.state):NaN;if(!isFinite(n))continue;const l=pvNormalizeToWatts(n,String(s.attributes?.unit_of_measurement??""));t+=e._energyDefaults.invertedRateEntities.includes(r)?-l:l,i=!0}i&&(n=t,l="W")}else if(e._energyDefaults.batteryStatEnergyTos.length>0||e._energyDefaults.batteryStatEnergyFroms.length>0){const t=Date.now(),i=latestWattsFromChangeSeries(e._batteryChargeChangeSeries,t),r=latestWattsFromChangeSeries(e._batteryDischargeChangeSeries,t);null===i&&null===r||(n=Math.max(0,i??0)-Math.max(0,r??0),l="W")}if(r!==e._batterySoc&&(e._batterySoc=r),n!==e._batteryPower&&(e._batteryPower=n),l!==e._batteryPowerUnit&&(e._batteryPowerUnit=l),function fetchBatteryChangeSeries(e){const t=e._energyDefaults.batteryStatEnergyTos,i=e._energyDefaults.batteryStatEnergyFroms;if(0===t.length&&0===i.length)return;if(e._batteryChangeFetching)return;const r=/* @__PURE__ */new Date;r.setHours(0,0,0,0);const s=r.getTime()-24*e._periodPastDays*36e5,n=changeRefreshAnchorMs(),l=[...t].sort(),c=[...i].sort(),d=`${l.join(",")}|${c.join(",")}|${s}|${n}`;if(d===e._batteryChangeFetchKey)return;e._batteryChangeFetchKey=d,e._batteryChangeFetching=!0,Promise.all([l.length>0?fetchChangeSeries(e.hass,l,s,n,e._storeFetchPeriod):Promise.resolve(null),c.length>0?fetchChangeSeries(e.hass,c,s,n,e._storeFetchPeriod):Promise.resolve(null)]).then(([t,i])=>{null!==t&&(e._batteryChargeChangeSeries=t),null!==i&&(e._batteryDischargeChangeSeries=i),e.requestUpdate()}).finally(()=>{e._batteryChangeFetching=!1})}(e),!e._timeRange||e._batteryFetching)return;const d=e._energyDefaults.batteryStatRates;if(0===s.length&&0===d.length)return;const u=e._timeRange.start,p=6e4*Math.floor(Date.now()/6e4),g=/* @__PURE__ */new Date(p-216e5),m=u<g?u:g,f=`${m.getTime()}|${g.getTime()}|${e._timeRange.end.getTime()}`,y=[...s].sort(),b=[...d].sort(),_=`${y.join(",")}|${b.join(",")}@${f}`;if(_===e._batteryFetchKey)return;e._batteryFetchKey=_;const v=function batteryHistoryCacheGet(e){const t=gt.get(e);return t?Date.now()-t.ts>9e5?(gt.delete(e),null):t:null}(_);if(v)return e._batterySocHistory=v.soc,void(e._batteryPowerHistory=v.power);!async function fetchBatteryHistory(e,t,i,r,s,n,l=""){if(!e.hass?.callWS)return;if(0===t.length&&0===i.length)return;e._batteryFetching=!0;try{const c=/* @__PURE__ */new Date,d=n>c?c:n;if(r>=d&&s>=d)return e._batterySocHistory={times:[],values:[]},void(e._batteryPowerHistory={times:[],values:[]});const u=/* @__PURE__ */new Set;for(const e of t)u.add(e);for(const e of i)u.add(e);const p=Array.from(u),g={},m=await callWSWithTimeout(e.hass,{type:"recorder/statistics_during_period",start_time:r.toISOString(),end_time:d.toISOString(),statistic_ids:p,period:e._storeFetchPeriod,types:["mean","state"],units:{energy:"kWh",power:"W"}});if(p.some(e=>Array.isArray(m?.[e])&&m[e].length>0))for(const e of p)g[e]=parseBatteryStats(m?.[e]??[]);else{const t=await callWSWithTimeout(e.hass,{type:"history/history_during_period",start_time:s.toISOString(),end_time:d.toISOString(),entity_ids:p,minimal_response:!0,no_attributes:!0,significant_changes_only:!0});for(const e of p)g[e]=parseRawBatteryHistory(t?.[e]??[])}const f=new Set(e._energyDefaults.invertedRateEntities),y=aggregateBatteryLkcf(t.map(e=>g[e]??{times:[],values:[]}),"mean",e=>Math.max(0,Math.min(100,e))),b=aggregateBatteryLkcf(i.map(e=>g[e]??{times:[],values:[]}),"sum",(e,t)=>f.has(i[t])?-e:e);e._batterySocHistory=y,e._batteryPowerHistory=b,l&&gt.set(l,{soc:y,power:b,ts:Date.now()})}catch(c){e._batterySocHistory={times:[],values:[]},e._batteryPowerHistory={times:[],values:[]}}finally{e._batteryFetching=!1}}(e,y,b,m,g,e._timeRange.end,_)}function parseRawBatteryHistory(e){const t=[],i=[];for(const r of e??[]){const e="string"==typeof r?.s?r.s:"string"==typeof r?.state?r.state:null;if(null===e||"unavailable"===e||"unknown"===e||""===e)continue;const s=parseFloat(e);if(!isFinite(s))continue;let n=null;"number"==typeof r?.lu?n=/* @__PURE__ */new Date(1e3*r.lu):"string"==typeof r?.last_updated?n=new Date(r.last_updated):"string"==typeof r?.last_changed&&(n=new Date(r.last_changed)),n&&!isNaN(n.getTime())&&(t.push(n),i.push(s))}return{times:t,values:i}}function parseBatteryStats(e){const t=[],i=[];for(const r of e??[]){const e=parseStatBoundary$1(r?.start),s=parseStatBoundary$1(r?.end);if(null===e)continue;let n=r?.mean,l=!1;if(null==n&&(n=r?.state,l=!0),null==n)continue;const c="number"==typeof n?n:parseFloat(String(n));if(!isFinite(c))continue;const d=l?s??e:null!==s?(e+s)/2:e;t.push(new Date(d)),i.push(c)}return{times:t,values:i}}function parseStatBoundary$1(e){if(null==e)return null;if("number"==typeof e)return e>1e12?e:1e3*e;if("string"==typeof e){const t=Number(e);if(Number.isFinite(t)&&t>1e9)return t>1e12?t:1e3*t;const i=new Date(e).getTime();return isFinite(i)?i:null}return null}function aggregateBatteryLkcf(e,t,i){if(0===e.length)return{times:[],values:[]};if(1===e.length){const t=e[0];return{times:t.times,values:t.values.map((e,t)=>i(e,0))}}const r=/* @__PURE__ */new Set;for(const c of e)for(const e of c.times)r.add(e.getTime());const s=Array.from(r).sort((e,t)=>e-t),n=new Array(e.length).fill(-1),l=[];for(const c of s){let r=0,s=0;for(let t=0;t<e.length;t++){const l=e[t];let d=n[t];for(;d+1<l.times.length&&l.times[d+1].getTime()<=c;)d++;n[t]=d,d>=0&&isFinite(l.values[d])&&(r+=i(l.values[d],t),s++)}l.push(0===s?NaN:"mean"===t?r/s:r)}return{times:s.map(e=>new Date(e)),values:l}}var mt=/* @__PURE__ */new Map;function parseStatBoundary(e){if(null==e)return null;if("number"==typeof e)return e>1e12?e:1e3*e;if("string"==typeof e){const t=Number(e);if(Number.isFinite(t)&&t>1e9)return t>1e12?t:1e3*t;const i=new Date(e).getTime();return isFinite(i)?i:null}return null}function refreshIrradiance(e){const t=String(e.config?.["solar-irradiance-entity"]??"").trim();if(!t||!e.hass)return null!==e._irradianceHistory&&(e._irradianceHistory=null),e._irradianceFetchKey="",void e._engine?.setSolarRadiationSamples(null);if(pushIrradianceToEngine(e),!e._timeRange||e._irradianceFetching)return;const i=e._timeRange.start,r=6e4*Math.floor(Date.now()/6e4),s=/* @__PURE__ */new Date(r-216e5),n=i<s?s:i,l=`${t}@${n.getTime()}|${e._timeRange.end.getTime()}`;if(l===e._irradianceFetchKey)return;e._irradianceFetchKey=l;const c=function irradianceHistoryCacheGet(e){const t=mt.get(e);return t?Date.now()-t.ts>9e5?(mt.delete(e),null):t:null}(l);if(c)return e._irradianceHistory=c.history,void pushIrradianceToEngine(e);!async function fetchIrradianceHistory(e,t,i,r,s=""){if(!e.hass?.callWS)return;e._irradianceFetching=!0;try{const n=/* @__PURE__ */new Date,l=r>n?n:r;if(i>=l)return e._irradianceHistory={times:[],values:[]},void pushIrradianceToEngine(e);let c={times:[],values:[]};const d=await callWSWithTimeout(e.hass,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:l.toISOString(),statistic_ids:[t],period:"5minute",types:["mean"]}),u=(d&&d[t])??[];if(u.length>0)c=function parseIrradianceStats(e){const t=[],i=[];for(const r of e??[]){const e=parseStatBoundary(r?.start),s=parseStatBoundary(r?.end);if(null===e)continue;const n=r?.mean;if(null==n)continue;const l="number"==typeof n?n:parseFloat(String(n));if(!isFinite(l)||l<0)continue;const c=null!==s?(e+s)/2:e;t.push(new Date(c)),i.push(l)}return{times:t,values:i}}(u);else{const r=await callWSWithTimeout(e.hass,{type:"history/history_during_period",start_time:i.toISOString(),end_time:l.toISOString(),entity_ids:[t],minimal_response:!0,no_attributes:!0,significant_changes_only:!0});c=function parseRawIrradianceHistory(e){const t=[],i=[];let r=null;for(const s of e){const e=s?.s??s?.state;if(null==e||"unavailable"===e||"unknown"===e||""===e)continue;const n=parseFloat(String(e));if(!isFinite(n)||n<0)continue;let l=null;const c=s?.lu??s?.lc??s?.last_updated??s?.last_changed??null;if("number"==typeof c)l=new Date(c>1e12?c:1e3*c);else if("string"==typeof c){const e=Number(c);l=Number.isFinite(e)&&e>1e9?new Date(e>1e12?e:1e3*e):new Date(c)}l&&!isNaN(l.getTime())||null===r||(l=new Date(r)),l&&!isNaN(l.getTime())&&(r=l.getTime(),t.push(l),i.push(n))}return{times:t,values:i}}((r&&r[t])??[])}e._irradianceHistory=c,pushIrradianceToEngine(e),s&&mt.set(s,{history:c,ts:Date.now()})}catch(n){e._irradianceHistory={times:[],values:[]},pushIrradianceToEngine(e)}finally{e._irradianceFetching=!1}}(e,t,n,e._timeRange.end,l)}var ft=/* @__PURE__ */new WeakMap;function pushIrradianceToEngine(e){if(!e._engine)return;const t=String(e.config?.["solar-irradiance-entity"]??"").trim();if(!t||!e.hass)return e._engine.setSolarRadiationSamples(null),void ft.delete(e);const i=e._irradianceHistory,r=e.hass.states?.[t],s=ft.get(e);if(s&&s.histRef===i&&s.stateRef===r&&s.entity===t)return;const n=[];if(i)for(let l=0;l<i.times.length;l++)n.push({time:i.times[l],wm2:i.values[l]});if(r){const e=parseFloat(r.state);if(isFinite(e)&&e>=0){const t=r.last_updated?new Date(r.last_updated):/* @__PURE__ */new Date;n.push({time:t,wm2:e})}}e._engine.setSolarRadiationSamples(n.length>0?n:null),ft.set(e,{histRef:i,stateRef:r,entity:t})}function tick(e){const t=/* @__PURE__ */new Date,i=e._now;if(i&&t.getMinutes()===i.getMinutes()&&t.getHours()===i.getHours()&&t.getDate()===i.getDate()&&t.getMonth()===i.getMonth()&&t.getFullYear()===i.getFullYear())return;const r=!i||t.getDate()!==i.getDate()||t.getMonth()!==i.getMonth()||t.getFullYear()!==i.getFullYear();if(e._now=t,r&&e._engine){const t=e._engine.getTimelineRange();t&&(e._timeRange=t),e._chartSeries=e._engine.getTimelineSeries()??e._chartSeries}refreshHud(e)}function applyTimelinePointer(e,t){if(!e._timeRange)return;const i=t.currentTarget.getBoundingClientRect(),r=Math.max(0,Math.min(1,(t.clientX-i.left)/i.width)),s=e._timeRange.end.getTime()-e._timeRange.start.getTime(),n=e._timeRange.start.getTime()+r*s,l=Date.now(),c=e._timeRange.start.getTime(),d=e._timeRange.end.getTime();if(l>=c&&l<=d){const r=(l-c)/s,n=i.left+r*i.width,d=t.clientX;if(Math.abs(d-n)<=8)return void(e._isLiveMode&&null===e._selectedTime||(e._selectedTime=null,e._isLiveMode=!0,e._chartHoverPct=null,e._engine?.setSelectedTime(null)))}const u=new Date(n);e._selectedTime&&e._selectedTime.getTime()===u.getTime()||(e._selectedTime=u,e._isLiveMode=!1,e._chartHoverPct=100*r,e._engine?.setSelectedTime(u))}function refreshGrid(e){if(!e.hass)return null!==e._gridImportValue&&(e._gridImportValue=null),""!==e._gridImportUnit&&(e._gridImportUnit=""),null!==e._gridExportValue&&(e._gridExportValue=null),void(""!==e._gridExportUnit&&(e._gridExportUnit=""));fetchGridChangeSeries(e,"import"),fetchGridChangeSeries(e,"export");const t=e._energyDefaults?.gridStatRates??[];if(t.length>0)!function readStatRates(e,t){let i=0,r=!1;for(const s of t){const t=e.hass.states?.[s];if(!t)continue;const n=t.state;if(null==n||""===n||"unknown"===n||"unavailable"===n)continue;const l=parseNumericState(n);if(null===l)continue;const c=pvNormalizeToWatts(l,String(t.attributes?.unit_of_measurement??"").trim());i+=e._energyDefaults?.invertedRateEntities.includes(s)??!1?-c:c,r=!0}if(!r)return;!function applyCombinedSplit(e,t){t>=0?(applyValue(e,"import",t,"W"),applyValue(e,"export",null,"")):(applyValue(e,"import",null,""),applyValue(e,"export",-t,"W"))}(e,i)}(e,t);else{const t=Date.now(),i=latestWattsFromChangeSeries(e._gridImportChangeSeries,t),r=latestWattsFromChangeSeries(e._gridExportChangeSeries,t);applyValue(e,"import",null!==i?Math.max(0,i):null,null!==i?"W":""),applyValue(e,"export",null!==r?Math.max(0,r):null,null!==r?"W":"")}}function fetchGridChangeSeries(e,t){const i=e._energyDefaults,r="import"===t?i?.gridStatEnergyFroms??[]:i?.gridStatEnergyTos??[];if(0===r.length)return;if("import"===t?e._gridImportChangeFetching:e._gridExportChangeFetching)return;const s=/* @__PURE__ */new Date;s.setHours(0,0,0,0);const n=s.getTime()-24*e._periodPastDays*36e5,l=changeRefreshAnchorMs(),c=[...r].sort(),d=`${c.join(",")}|${n}|${l}`;d!==("import"===t?e._gridImportChangeFetchKey:e._gridExportChangeFetchKey)&&("import"===t?(e._gridImportChangeFetchKey=d,e._gridImportChangeFetching=!0):(e._gridExportChangeFetchKey=d,e._gridExportChangeFetching=!0),fetchChangeSeries(e.hass,c,n,l,e._storeFetchPeriod).then(i=>{null!==i&&("import"===t?e._gridImportChangeSeries=i:e._gridExportChangeSeries=i),e.requestUpdate()}).finally(()=>{"import"===t?e._gridImportChangeFetching=!1:e._gridExportChangeFetching=!1}))}function applyValue(e,t,i,r){const s=null===i?null:Math.max(0,i);"import"===t?(e._gridImportValue!==s&&(e._gridImportValue=s),e._gridImportUnit!==r&&(e._gridImportUnit=r)):(e._gridExportValue!==s&&(e._gridExportValue=s),e._gridExportUnit!==r&&(e._gridExportUnit=r))}function parseNumericState(e){if("number"==typeof e)return Number.isFinite(e)?e:null;if("string"!=typeof e)return null;const t=e.trim();if(""===t)return null;const i=t.replace(",","."),r=parseFloat(i);return Number.isFinite(r)?r:null}function formatGridValue(e,t,i,r){return null===t?"":formatEntityValue(e,t,i,r)}var yt={solarStatRates:[],solarStatEnergyFroms:[],gridStatRates:[],gridStatEnergyFroms:[],gridStatEnergyTos:[],batteryStatRates:[],batteryStatEnergyFroms:[],batteryStatEnergyTos:[],batteryStatSocs:[],invertedRateEntities:[],solarForecastEntryIds:[]};async function fetchEnergyPrefs(e){if(e.hass?.callWS)try{e._energyDefaults=function parseEnergyPrefs(e){const t={solarStatRates:[],solarStatEnergyFroms:[],gridStatRates:[],gridStatEnergyFroms:[],gridStatEnergyTos:[],batteryStatRates:[],batteryStatEnergyFroms:[],batteryStatEnergyTos:[],batteryStatSocs:[],invertedRateEntities:[],solarForecastEntryIds:[]},i=Array.isArray(e?.energy_sources)?e.energy_sources:[];for(const r of i){if(!r||"object"!=typeof r)continue;const e=String(r.type??"").toLowerCase();if("solar"===e){const e=pickFirstString(r.stat_energy_from);e&&t.solarStatEnergyFroms.push(e);const i=pickFirstString(r.stat_rate);i&&t.solarStatRates.push(i);const s=r.config_entry_solar_forecast;if(Array.isArray(s))for(const r of s)"string"!=typeof r||""===r.trim()||t.solarForecastEntryIds.includes(r.trim())||t.solarForecastEntryIds.push(r.trim());else"string"!=typeof s||""===s.trim()||t.solarForecastEntryIds.includes(s.trim())||t.solarForecastEntryIds.push(s.trim())}else if("grid"===e){const e=pickFirstString(r.stat_energy_from);e&&t.gridStatEnergyFroms.push(e);const i=pickFirstString(r.stat_energy_to);i&&t.gridStatEnergyTos.push(i);const s=pickFirstString(r.stat_rate);if(s)t.gridStatRates.push(s);else for(const n of collectPowerConfigRates(r.power_config,"grid"))t.gridStatRates.push(n.entity),n.inverted&&t.invertedRateEntities.push(n.entity)}else if("battery"===e){const e=pickFirstString(r.stat_energy_from);e&&t.batteryStatEnergyFroms.push(e);const i=pickFirstString(r.stat_energy_to);i&&t.batteryStatEnergyTos.push(i);const s=pickFirstString(r.stat_soc);s&&t.batteryStatSocs.push(s);for(const n of collectPowerConfigRates(r.power_config,"battery"))t.batteryStatRates.push(n.entity),n.inverted&&t.invertedRateEntities.push(n.entity)}}return t}(await e.hass.callWS({type:"energy/get_prefs"})),e._energyDefaultsLoaded=!0,e.requestUpdate()}catch(I){e._energyDefaultsLoaded=!0}}function subscribeEnergyPrefs(e){if(e.hass?.connection&&!e._energyPrefsUnsub){fetchEnergyPrefs(e);try{e._energyPrefsUnsub=e.hass.connection.subscribeEvents(()=>fetchEnergyPrefs(e),"energy_preferences_updated")}catch(I){}}}var bt=/* @__PURE__ */new Map;async function fetchTodayKwhChange(e,t){if(0===t.length)return null;if(!e.hass?.callWS)return null;const i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const r=/* @__PURE__ */new Date,s=`${i.getFullYear()}-${i.getMonth()}-${i.getDate()}|${[...t].sort().join("|")}`,n=r.getTime(),l=bt.get(s);if(l){if(l.inflight)return l.inflight;if(n-l.ts<25e3)return l.result}const c=(async()=>{try{const s=await e.hass.callWS({type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:r.toISOString(),statistic_ids:t,period:"day",types:["change"],units:{energy:"kWh"}});let n=0,l=!1;for(const e of t){const t=s?.[e];if(Array.isArray(t))for(const e of t){const t="number"==typeof e?.change?e.change:null;null!==t&&(n+=t,l=!0)}}return l?n:null}catch(I){return null}})();bt.set(s,{ts:n,result:null,inflight:c});const d=await c;return bt.set(s,{ts:Date.now(),result:d}),d}async function refreshHaDailyTotals(e){const t=e._energyDefaults,[i,r,s,n,l]=await Promise.all([fetchTodayKwhChange(e,t.solarStatEnergyFroms),fetchTodayKwhChange(e,t.gridStatEnergyFroms),fetchTodayKwhChange(e,t.gridStatEnergyTos),fetchTodayKwhChange(e,t.batteryStatEnergyTos),fetchTodayKwhChange(e,t.batteryStatEnergyFroms)]);let c=!1;null!==i&&i!==e._haSolarTodayKwh&&(e._haSolarTodayKwh=i,c=!0),null!==r&&r!==e._haGridImportTodayKwh&&(e._haGridImportTodayKwh=r,c=!0),null!==s&&s!==e._haGridExportTodayKwh&&(e._haGridExportTodayKwh=s,c=!0),null!==n&&n!==e._haBatteryChargedKwh&&(e._haBatteryChargedKwh=n,c=!0),null!==l&&l!==e._haBatteryDischargedKwh&&(e._haBatteryDischargedKwh=l,c=!0),c&&e.requestUpdate()}function collectPowerConfigRates(e,t){if(!e||"object"!=typeof e)return[];const i=e,r=[],s=pickFirstString(i.stat_rate);s&&r.push({entity:s,inverted:"battery"===t});const n=pickFirstString(i.stat_rate_inverted);if(n&&r.push({entity:n,inverted:"grid"===t}),r.length>0)return r;const l=pickFirstString(i.stat_rate_from);l&&r.push({entity:l,inverted:"battery"===t});const c=pickFirstString(i.stat_rate_to);return c&&r.push({entity:c,inverted:"grid"===t}),r}function pickFirstString(e){if("string"==typeof e&&""!==e.trim())return e.trim();if(Array.isArray(e))for(const t of e)if("string"==typeof t&&""!==t.trim())return t.trim();return null}var _t,vt,wt=i$6`
    .editor
    {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title
    {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        margin-top: 10px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
    }

    /*  Subsection heading inside a collapsible block. Quieter than
        .section-title (no border, dimmer) so it reads as a logical
        group still inside the parent section. */
    .subsection-title
    {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--secondary-text-color, #6c757d);
        margin-top: 16px;
        margin-bottom: 4px;
    }

    /*  Collapsible section. Native <details>/<summary> so open/closed
        state needs no JS and is keyboard-accessible. Default triangle
        replaced by a custom ::before chevron so the row matches a
        .section-title heading. Extra margin-top separates siblings;
        first child gets none (editor handles its own top padding). */
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
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        padding-bottom: 6px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.18));
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
    /*  Per-section icon between the chevron and label. Inherits the
        section title's tint, sized to match the title's rhythm. */
    .section-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        margin-right: 2px;
        flex-shrink: 0;
    }

    /*  Help text margins stack with the section's 14 px flex gap:
        field→help = 22 px, help→next field = 34 px (1.5x ratio), so
        the help reads as attached to the field above it. */
    .field-help
    {
        font-size: 11px;
        color: var(--secondary-text-color, #727272);
        margin: 8px 0 20px 0;
    }

    .field-help a       { color: var(--primary-color, #03a9f4); text-decoration: none; }
    .field-help a:hover { text-decoration: underline; }

    .hint
    {
        font-size: 11px;
        color: var(--secondary-text-color, #727272);
        font-style: italic;
        margin: 8px 0 20px 0;
    }
    .hint a
    {
        color: var(--primary-color, #03a9f4);
        text-decoration: none;
        font-style: normal;
        font-weight: 500;
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

    /*  Extra gap between two consecutive fields with no help text
        between them (e.g. the lat/lon pair). Only fires when both
        siblings are .field, so help-separated rows are unaffected. */
    .field + .field
    {
        margin-top: 8px;
    }

    /*  Stacked variant for controls too wide to share a row with
        their label (e.g. ha-entity-picker). */
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
        font-size: 13px;
        color: var(--primary-text-color, #212121);
        flex: 1;
    }

    input[type="text"],
    input[type="number"]
    {
        width: 180px;
        padding: 6px 8px;
        border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: 13px;
    }

    /*  Native dropdown for settings with 3+ options that won't fit a
        segmented toggle across languages. Same width as the text
        inputs for right-edge alignment; native chevron kept on
        purpose as the most familiar control across HA frontends. */
    .he-select
    {
        width: 180px;
        padding: 6px 8px;
        border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: 13px;
    }

    /*  Two-button toggle, sized to match the other inputs for
        consistent right-edge alignment. */
    .segmented-toggle
    {
        display: inline-flex;
        width: 180px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
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
        font-size: 13px;
        font-family: inherit;
        transition: background 0.15s, color 0.15s;
    }

    .seg-option + .seg-option
    {
        border-left: 1px solid var(--divider-color, rgba(0,0,0,0.12));
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

    /*  Slider variant replacing number inputs so a value out of the
        supported range can't be entered. Value shown right of track. */
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
        font-size: 12px;
        color: var(--secondary-text-color, #727272);
        min-width: 44px;
        text-align: right;
    }

    code
    {
        font-family: monospace;
        background: var(--secondary-background-color, rgba(0,0,0,0.05));
        padding: 1px 4px;
        border-radius: 3px;
    }

    /*  Gap under the entity picker row in each grid slot so the
        invert toggle / add-source button doesn't crowd the dropdown. */
    .grid-source-row
    {
        margin-bottom: 12px;
    }

    /*  Reset section: warning stacked above the button so the
        destructive-action explanation is read before the click
        target. Button right-aligned to match the +Add affordance.
        Red border + label reinforces "this empties data". */
    .reset-warning
    {
        font-size: 11px;
        line-height: 1.4;
        color: var(--secondary-text-color, #5f6368);
        opacity: 0.85;
        margin-bottom: 8px;
    }
    .reset-btn
    {
        background: transparent;
        border: 1px solid #ef4444;
        color: #ef4444;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        display: block;
        margin-left: auto;
        margin-top: 8px;
        width: fit-content;
    }
    .reset-btn:hover
    {
        background: rgba(239, 68, 68, 0.08);
    }
    .reset-btn:focus-visible
    {
        outline: 2px solid #ef4444;
        outline-offset: 2px;
    }

    /*  About section pinned at the bottom of the editor. Compact
        rows styled as a soft credits-panel footer, not a config
        section. */
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
        font-weight: 500;
        color: var(--secondary-text-color, #71717a);
        font-size: 13px;
    }
    .about-value
    {
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
        font-size: 13px;
        color: var(--primary-text-color, #18181b);
    }
    /*  Identity rows. Label-left, content-right layout (from about-row's
        flex container); variants below tune the right side (link, plain
        value, version chip). */
    .about-row-value
    {
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, inherit));
        font-size: 14px;
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
        font-size: 14px;
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
    /*  X brand mark: inline SVG (mdi:twitter would mis-label the
        post-rebrand platform). Sized to match adjacent ha-icon glyphs. */
    .about-row-svg
    {
        width:  18px;
        height: 18px;
        flex-shrink: 0;
    }
    /*  Version chip styled as a link jumping to the matching GitHub
        release page. */
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
    .about-link
    {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: var(--primary-color, #3b82f6);
        font-size: 14px;
        font-weight: 500;
        padding: 6px 0;
    }
    .about-link:hover { text-decoration: underline; }
    .about-link ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
    }
    .about-paragraph
    {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
        color: var(--secondary-text-color, #52525b);
    }
    .about-coffee
    {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    /*  BMC button: same outline shape as reset-btn but in BMC yellow,
        with the same hover bloom for consistency. */
    .about-coffee-link
    {
        margin-top: 8px;
        background: transparent;
        border: 1px solid #ffcc00;
        color: #ffcc00;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        align-self: flex-end;
        margin-left: auto;
        width: fit-content;
    }
    .about-coffee-link:hover
    {
        background: rgba(255, 204, 0, 0.08);
        text-decoration: none;
    }
    .about-coffee-link:focus-visible
    {
        outline: 2px solid #ffcc00;
        outline-offset: 2px;
    }
`;function __decorateMetadata(e,t){if("object"==typeof Reflect&&"function"==typeof Reflect.metadata)return Reflect.metadata(e,t)}function __decorate(e,t,i,r){var s,n=arguments.length,l=n<3?t:null===r?r=Object.getOwnPropertyDescriptor(t,i):r;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)l=Reflect.decorate(e,t,i,r);else for(var c=e.length-1;c>=0;c--)(s=e[c])&&(l=(n<3?s(l):n>3?s(t,i,l):s(t,i))||l);return n>3&&l&&Object.defineProperty(t,i,l),l}var xt,kt,St=(_t=class HeliosCardEditor extends le{constructor(...e){super(...e),this._cfg={},this._pickerReady=!1,this._openSection="location",this._sliderDebounce=/* @__PURE__ */new Map,this._onSectionToggleEvt=e=>{const t=e.currentTarget.dataset.section;t&&this._onSectionToggle(t,e)},this._onNumFieldChange=e=>{const t=e.currentTarget.dataset.key;t&&this._numField(t,e)},this._onNumSliderInput=e=>{const t=e.currentTarget.dataset.key;t&&this._numSlider(t,e)},this._onEntityValueChanged=e=>{const t=e.currentTarget.dataset.key;t&&this._update(t,e.detail.value??"")},this._onBoolToggleClick=e=>{const t=e.currentTarget,i=t.dataset.key;i&&this._update(i,"true"===t.dataset.value)},this._solarIrradianceEntityFilter=e=>{if(!e||!e.attributes)return!1;if("irradiance"===e.attributes.device_class)return!0;const t=String(e.attributes.unit_of_measurement??"").trim();return"W/m²"===t||"W/m2"===t},this._customEntityFilter=e=>{if(!e||!e.attributes)return!1;const t=String(e.attributes.device_class??"");if("power"===t||"energy"===t)return!0;const i=String(e.attributes.unit_of_measurement??"").trim().toLowerCase();return"w"===i||"kw"===i||"mw"===i||"wh"===i||"kwh"===i||"mwh"===i},this._resetFeedback=null}disconnectedCallback(){super.disconnectedCallback();for(const e of this._sliderDebounce.values())window.clearTimeout(e);this._sliderDebounce.clear(),void 0!==this._resetFeedbackTimer&&(window.clearTimeout(this._resetFeedbackTimer),this._resetFeedbackTimer=void 0)}setConfig(e){if(this._cfg={...e},!this._cfg["cache-id"]){const e=`c${Date.now().toString(36)}${Math.floor(1e9*Math.random()).toString(36)}`;setTimeout(()=>{this._cfg["cache-id"]||this._update("cache-id",e)},0)}}connectedCallback(){super.connectedCallback(),this._ensureEntityPicker()}async _ensureEntityPicker(){if(!this._pickerReady)if("undefined"!=typeof customElements&&customElements.get("ha-entity-picker"))this._pickerReady=!0;else try{const e=window;if("function"==typeof e.loadCardHelpers){const t=await e.loadCardHelpers();if(t?.createCardElement){const e=(await t.createCardElement({type:"entities",entities:[]}))?.constructor;"function"==typeof e?.getConfigElement&&await e.getConfigElement()}}"undefined"!=typeof customElements&&await Promise.race([customElements.whenDefined("ha-entity-picker"),new Promise(e=>{setTimeout(e,vt.PICKER_LOAD_TIMEOUT_MS)})])}catch(e){}finally{this._pickerReady=!0}}_t(){return pickTranslations(this.hass?.language)}_update(e,t){const i={...this._cfg,[e]:t};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i}})),this._cfg=i}_numField(e,t){const i=t.target.value.trim();if(""===i)return void this._update(e,void 0);const r=parseFloat(i);isFinite(r)&&this._update(e,r)}_numSlider(e,t){const i=parseFloat(t.target.value);if(!isFinite(i))return;this._cfg={...this._cfg,[e]:i};const r=String(e),s=this._sliderDebounce.get(r);void 0!==s&&window.clearTimeout(s);const n=window.setTimeout(()=>{this._sliderDebounce.delete(r),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._cfg}}))},vt.SLIDER_COMMIT_DELAY_MS);this._sliderDebounce.set(r,n)}_onSectionToggle(e,t){const i=t.currentTarget;i.open?(this._openSection=e,requestAnimationFrame(()=>{i.scrollIntoView({behavior:"smooth",block:"start"})})):this._openSection===e&&(this._openSection=null)}_fmtNum(e,t){return t>=1?String(Math.round(e)):e.toFixed(2)}render(){const e=this._cfg,t=this._t(),i=this.hass?.config?.latitude,r=this.hass?.config?.longitude,s="number"==typeof i&&isFinite(i)?String(i):"52.379",n="number"==typeof r&&isFinite(r)?String(r):"4.900";return U`
            <div class="editor">

                <details class="advanced-section" data-section="location" ?open=${"location"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map-marker"></ha-icon>${t.editor.locationSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.homeLatitude}</span>
                    <input
                        type="number"
                        min="-90"
                        max="90"
                        step="any"
                        placeholder=${s}
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
                        placeholder=${n}
                        .value=${null!=e["home-longitude"]?String(e["home-longitude"]):""}
                        data-key="home-longitude"
                        @change=${this._onNumFieldChange}
                    />
                </label>
                <div class="hint">${t.editor.locationHint}</div>

                </details>

                <details class="advanced-section" data-section="map" ?open=${"map"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:tune"></ha-icon>${t.editor.uiAndMapSection}</summary>
                <div class="field">
                    <span class="label">${t.editor.autoRotate}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${!0===e["auto-rotate-enabled"]?"active":""}"
                            data-key="auto-rotate-enabled" data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.autoRotateOn}</button>
                        <button
                            type="button"
                            class="seg-option ${!0!==e["auto-rotate-enabled"]?"active":""}"
                            data-key="auto-rotate-enabled" data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.autoRotateOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.autoRotateHint}</div>

                <div class="field field-block">
                    <span class="label">${t.editor.customEntity}</span>
                    ${this._pickerReady?U`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass=${this.hass}
                            .value=${String(e["custom-entity"]??"")}
                            .includeDomains=${["sensor","input_number","number"]}
                            .entityFilter=${this._customEntityFilter}
                            data-key="custom-entity"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-entity-picker>
                    `:G}
                </div>
                <div class="field-help">${t.editor.customEntityHelp}</div>
                ${""!==String(e["custom-entity"]??"")?U`
                    <div class="field field-block">
                        <span class="label">${t.editor.customEntityIcon}</span>
                        ${this._pickerReady?U`
                            <ha-icon-picker
                                .hass=${this.hass}
                                .value=${String(e["custom-entity-icon"]??"")}
                                data-key="custom-entity-icon"
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-icon-picker>
                        `:G}
                    </div>
                    <div class="field field-block">
                        <span class="label">${t.editor.customEntityColor}</span>
                        ${this._pickerReady?U`
                            <ha-selector
                                .hass=${this.hass}
                                .selector=${{ui_color:{default_color:"red"}}}
                                .value=${String(e["custom-entity-color"]??"red")}
                                data-key="custom-entity-color"
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>
                        `:G}
                    </div>
                    <div class="field-help">${t.editor.customEntityColorHelp}</div>
                `:G}

                </details>

                <details class="advanced-section" data-section="buildings" ?open=${"buildings"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:office-building-outline"></ha-icon>${t.editor.buildingsSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.displayRadius??"Display radius"}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${0}
                            max=${500}
                            step="10"
                            .value=${String(e["display-radius"]??200)}
                            data-key="display-radius"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["display-radius"]??200),10)} m</span>
                    </div>
                </label>
                <div class="hint">${t.editor.displayRadiusHelp??"Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device; 0 shows just the home."}</div>
                <label class="field">
                    <span class="label">${t.editor.buildingCount??"Building count"}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${10}
                            max=${100}
                            step="5"
                            .value=${String(e["building-count"]??50)}
                            data-key="building-count"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["building-count"]??50),5)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.buildingCountHelp??"Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device."}</div>
                <div class="field">
                    <span class="label">${t.editor.buildingRealSize??"Real building heights"}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${!1!==e["building-real-size"]?"active":""}"
                            data-key="building-real-size" data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.buildingRealSizeOn??"On"}</button>
                        <button
                            type="button"
                            class="seg-option ${!1===e["building-real-size"]?"active":""}"
                            data-key="building-real-size" data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.buildingRealSizeOff??"Off"}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.buildingRealSizeHint??"On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below."}</div>
                ${!1===e["building-real-size"]?U`
                    <label class="field">
                        <span class="label">${t.editor.buildingHeight??"Building height"}</span>
                        <div class="slider-row">
                            <input
                                type="range"
                                min=${3}
                                max=${10}
                                step="0.5"
                                .value=${String(e["building-height"]??6)}
                                data-key="building-height"
                                @input=${this._onNumSliderInput}
                            />
                            <span class="slider-value">${this._fmtNum(Number(e["building-height"]??6),.5)} m</span>
                        </div>
                    </label>
                `:G}
                <label class="field">
                    <span class="label">${t.editor.buildingClusterRadius}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="100" step="1"
                            .value=${String(e["building-cluster-radius"]??0)}
                            data-key="building-cluster-radius"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["building-cluster-radius"]??0),1)} m</span>
                    </div>
                </label>
                <label class="field">
                    <span class="label">${t.editor.buildingOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value=${String(e["building-opacity"]??.25)}
                            data-key="building-opacity"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["building-opacity"]??.25),.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.buildingsHint}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.buildingColor}</span>
                    ${this._pickerReady?U`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ui_color:{default_color:"grey"}}}
                            .value=${String(e["building-color"]??"grey")}
                            data-key="building-color"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    `:G}
                </div>
                <div class="field-help">${t.editor.buildingColorHelp}</div>

                </details>

                <details class="advanced-section" data-section="shadows" ?open=${"shadows"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gradient-vertical"></ha-icon>${t.editor.shadowsSection}</summary>
                <div class="field">
                    <span class="label">${t.editor.shadowsEnabled}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${!1!==e["shadows-enabled"]?"active":""}"
                            data-key="shadows-enabled" data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.shadowsEnabledOn}</button>
                        <button
                            type="button"
                            class="seg-option ${!1===e["shadows-enabled"]?"active":""}"
                            data-key="shadows-enabled" data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.shadowsEnabledOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.shadowsEnabledHint}</div>

                <label class="field">
                    <span class="label">${t.editor.shadowOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value=${String(e["shadow-opacity"]??.32)}
                            data-key="shadow-opacity"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["shadow-opacity"]??.32),.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.shadowOpacityHint}</div>

                </details>

                <details class="advanced-section" data-section="dataDisplay" ?open=${"dataDisplay"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:chart-timeline-variant"></ha-icon>${t.editor.dataDisplaySection}</summary>
                <label class="field">
                    <span class="label">${t.editor.displayUpdateFrequency}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${1}
                            max=${12}
                            step="1"
                            .value=${String(e["display-update-frequency-per-hour"]??4)}
                            data-key="display-update-frequency-per-hour"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["display-update-frequency-per-hour"]??4),1)} / h</span>
                    </div>
                </label>
                <div class="field-help">${t.editor.displayUpdateFrequencyHelp}</div>
                <label class="field">
                    <span class="label">${t.editor.valueDecimals??"Value decimals"}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${0}
                            max=${3}
                            step="1"
                            .value=${String(e["value-decimals"]??1)}
                            data-key="value-decimals"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["value-decimals"]??1),1)}</span>
                    </div>
                </label>
                <div class="field-help">${t.editor.valueDecimalsHelp??"Number of decimals shown on every value (power in kW, energy in kWh). 0 to 3."}</div>
                </details>

                <details class="advanced-section" data-section="installation" ?open=${"installation"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:solar-power-variant"></ha-icon>${t.editor.installationSection}</summary>
                <div class="hint">${function renderMarkdownLinks(e){const t=[],i=/\[([^\]]+)\]\(([^)]+)\)/g;let r,s=0;for(;null!==(r=i.exec(e));){r.index>s&&t.push(e.slice(s,r.index));const i=r[1],n=r[2];/^https?:\/\//i.test(n)?t.push(U`<a href=${n} target="_blank" rel="noopener noreferrer">${i}</a>`):/^\/[a-zA-Z0-9_\-/.]*$/.test(n)?t.push(U`<a href=${n}>${i}</a>`):t.push(`${i} (${n})`),s=r.index+r[0].length}return s<e.length&&t.push(e.slice(s)),t}(t.editor.installationHint)}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.solarIrradianceEntity}</span>
                    ${this._pickerReady?U`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass=${this.hass}
                            .value=${String(e["solar-irradiance-entity"]??"")}
                            .includeDomains=${["sensor","input_number"]}
                            .entityFilter=${this._solarIrradianceEntityFilter}
                            data-key="solar-irradiance-entity"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-entity-picker>
                    `:G}
                </div>
                <div class="field-help">${t.editor.solarIrradianceEntityHelp}</div>

                </details>


                <details class="advanced-section" data-section="reset" ?open=${"reset"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:refresh"></ha-icon>${t.editor.resetSection}</summary>
                    <div class="hint">${t.editor.resetSectionHint}</div>
                    <div class="hint reset-warning">${t.editor.resetCacheWarning}</div>
                    <button
                        type="button"
                        class="reset-btn"
                        @click=${this._onResetCacheClick}
                    >${this._resetFeedback??t.editor.resetCacheButton}</button>
                </details>

                <details class="advanced-section about-section" data-section="about" ?open=${"about"===this._openSection} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:information-outline"></ha-icon>${t.editor.aboutSection}</summary>
                    <!-- Identity + links column. Every row uses the same label-left, content-right
                         layout the version row established: a single .about-row line per piece of
                         info, the right side carrying the value (or a clickable link with icon).
                         The X brand mark is an inline SVG because the MDI icon set doesn't ship
                         the post-rebrand glyph and mdi:twitter would mis-label the platform. -->
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutVersionLabel}</span>
                        <a class="about-row-link about-version-link"
                           href="https://github.com/ReikanYsora/Helios/releases/tag/v${"2026.7.1-a14"}"
                           target="_blank" rel="noopener noreferrer"
                        >${"2026.7.1-a14"}</a>
                    </div>
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutDeveloperLabel}</span>
                        <span class="about-row-value">ReikanYsora (Jérôme Crémoux)</span>
                    </div>
                    <div class="about-row">
                        <span class="about-label" aria-hidden="true"></span>
                        <a class="about-row-link" href="https://x.com/ReikanYsora" target="_blank" rel="noopener noreferrer">
                            <svg class="about-row-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" fill="currentColor"/>
                            </svg>
                            <span>@ReikanYsora</span>
                        </a>
                    </div>
                    <div class="about-row">
                        <span class="about-label" aria-hidden="true"></span>
                        <a class="about-row-link" href="https://www.linkedin.com/in/jerome-cremoux/" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:linkedin"></ha-icon>
                            <span>${t.editor.aboutDeveloperLinkedIn}</span>
                        </a>
                    </div>
                    <div class="about-row">
                        <span class="about-label" aria-hidden="true"></span>
                        <a class="about-row-link" href="https://github.com/ReikanYsora/Helios" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:github"></ha-icon>
                            <span>${t.editor.aboutRepoCard}</span>
                        </a>
                    </div>
                    <div class="about-block about-coffee">
                        <p class="about-paragraph">${t.editor.aboutCoffeeMessage}</p>
                        <a class="about-link about-coffee-link" href="https://www.buymeacoffee.com/reikanysora" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:coffee"></ha-icon>
                            <span>${t.editor.aboutCoffeeLink}</span>
                        </a>
                    </div>
                </details>

            </div>
        `}_onResetCacheClick(){try{window.dispatchEvent(new CustomEvent("helios-data-cache-reset"))}catch(I){}const e=pickTranslations(this.hass?.language);this._resetFeedback=e.editor.resetCacheDone,void 0!==this._resetFeedbackTimer&&window.clearTimeout(this._resetFeedbackTimer),this._resetFeedbackTimer=window.setTimeout(()=>{this._resetFeedback=null},vt.RESET_FEEDBACK_MS)}},vt=_t,_t.SLIDER_COMMIT_DELAY_MS=250,_t.PICKER_LOAD_TIMEOUT_MS=8e3,_t.RESET_FEEDBACK_MS=2e3,_t.styles=wt,_t);__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],St.prototype,"hass",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],St.prototype,"_cfg",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],St.prototype,"_pickerReady",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],St.prototype,"_openSection",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],St.prototype,"_resetFeedback",void 0),St=vt=__decorate([t$2("helios-card-editor")],St);var $t=pickTranslations("undefined"!=typeof navigator?navigator.language:"en");window.customCards=window.customCards||[];{const e={type:"helios-card",name:$t.cardName,description:$t.cardDescription,preview:!0},t=window.customCards.findIndex(e=>"helios-card"===e.type);t>=0?window.customCards[t]=e:window.customCards.push(e)}{const e="__heliosBannerPrinted",t=window;if(!t[e]){t[e]=!0;const i="background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px 0 0 4px;font-weight:bold;";console.info("%c☀ HELIOS%c v2026.7.1-a14",i,"background:#1f2937;color:#f59e0b;padding:2px 8px;border-radius:0 4px 4px 0;font-weight:bold;"),console.info("%c☀ HELIOS%c run window.heliosStats() in the console for a live config + engine dump",i,"color:#6b7280;font-style:italic;")}}var Mt=/* @__PURE__ */new Set,Tt=/* @__PURE__ */new Map;window.addEventListener("helios-data-cache-reset",()=>{for(const e of Mt)e.resetDataCache()});{const e=window;e.heliosStats||(e.heliosStats=()=>{const t=Array.from(Mt).map((e,t)=>({index:t,snapshot:e.getStatsSnapshot()})),i={version:"2026.7.1-a14",cards:t.length,lifecycle:e.__heliosStats??null,details:t},r="color:#f59e0b;font-weight:bold;";return console.groupCollapsed(`%c☀ HELIOS stats%c v2026.7.1-a14, ${t.length} card${1===t.length?"":"s"} alive`,"background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px;font-weight:bold;","color:#6b7280;font-weight:normal;"),console.log("%cLifecycle counters",r,e.__heliosStats??"(none yet)"),t.forEach((e,t)=>{const i=e.snapshot;console.groupCollapsed(`%cCard #${t+1}`,r),console.log("config:",i.config),console.log("engine:",i.engine),console.log("pv:",i.pv),console.groupEnd()}),console.groupEnd(),i})}{const e=window;e.setHeliosLocation||(e.setHeliosLocation=(t,i)=>{if(!("number"!=typeof t||"number"!=typeof i||!isFinite(t)||!isFinite(i)||t<-90||t>90||i<-180||i>180)){e.__heliosLocationOverride={lat:t,lon:i};for(const e of Mt)e.invalidateLocation()}}),e.clearHeliosLocation||(e.clearHeliosLocation=()=>{if(e.__heliosLocationOverride){e.__heliosLocationOverride=void 0;for(const e of Mt)e.invalidateLocation()}})}var Ct=(xt=class HeliosCard extends le{constructor(...e){super(...e),this.preview=!1,this._now=/* @__PURE__ */new Date,this._cloudCover=-1,this._labelLayout=null,this._pvCurrent=null,this._pvUnit="",this._pvHistory=null,this._pvHistoryPerEntity=/* @__PURE__ */new Map,this._pvCalibStats=null,this._pvCalibStatsFetchKey="",this._pvCalibStatsFetching=!1,this._pvChangeSeries=null,this._pvChangeSeriesFetchKey="",this._pvChangeSeriesFetching=!1,this._haSolarForecast=[],this._haSolarForecastLoaded=!1,this._haSolarForecastFetching=!1,this._haSolarForecastFetchedAt=0,this._batterySoc=null,this._batteryPower=null,this._batteryPowerUnit="",this._gridImportValue=null,this._gridImportUnit="",this._gridExportValue=null,this._gridExportUnit="",this._gridImportChangeSeries=null,this._gridExportChangeSeries=null,this._gridImportChangeFetchKey="",this._gridExportChangeFetchKey="",this._gridImportChangeFetching=!1,this._gridExportChangeFetching=!1,this._batterySocHistory=null,this._customEntityHistory=null,this._customEntityKey="",this._clockHourly=null,this._clockHourlyKey="",this._batteryPowerHistory=null,this._batteryFetchKey="",this._batteryFetching=!1,this._batteryChargeChangeSeries=null,this._batteryDischargeChangeSeries=null,this._batteryChangeFetchKey="",this._batteryChangeFetching=!1,this._irradianceHistory=null,this._irradianceFetchKey="",this._irradianceFetching=!1,this._sunScene=null,this._energyDefaults=yt,this._haSolarTodayKwh=null,this._haGridImportTodayKwh=null,this._haGridExportTodayKwh=null,this._haBatteryChargedKwh=null,this._haBatteryDischargedKwh=null,this._homeHover=!1,this._chartHoverPct=null,this._chartTarget="production",this._viewMode="scene",this._clockTargets=[],this._clockSubMode="area",this._clockData=[],this._clockHoverSlot=null,this._clockHits=[],this._clockHoverX=0,this._clockHoverY=0,this._clockTapSticky=!1,this._clockTapStartX=0,this._clockTapStartY=0,this._clockGrowStart=/* @__PURE__ */new Map,this._clockExiting=[],this._clockSlotFrom=/* @__PURE__ */new Map,this._clockSlideStart=0,this._clockAnimSeq=0,this._clockReloadStart=0,this._clockReloadWindowStartMs=0,this._clockDim=0,this._clockDimSlot=null,this._clockDimSeq=0,this._chartSeries=null,this._timeRange=null,this._selectedTime=null,this._isLiveMode=!0,this._timelineMode="now",this._periodPastDays=ze.now.pastDays,this._periodFutureDays=ze.now.futureDays,this._energyDefaultsLoaded=!1,this._dailyTotalsKicked=!1,this._unifiedStore=null,this._lastHomeKey="",this._lastConfigSig="",this._initInflight=!1,this._cachedIsDarkThemesRef=void 0,this._cachedIsDark=!1,this._lastRefreshHassRef=void 0,this._lastRefreshConfigSig=void 0,this._lastRefreshTimeRangeRef=void 0,this._lastRefreshEnergyDefaultsRef=void 0,this._arcBackBuf=[],this._arcFrontBuf=[],this._arcFrontNearBuf=[],this._stopPropagation=e=>{e.stopPropagation()},this._onTimelineModeClick=e=>{const t=e.currentTarget.dataset.mode;t&&this._setTimelineMode(t)},this._setChartTarget=e=>{this._chartTarget!==e&&(this._chartTarget=e,this._persistUiState())},this._onChartTargetClick=e=>{const t=e.currentTarget.dataset.target;t&&this._setChartTarget(t)},this._legacyKeyWarningFired=!1,this._trackElement=null,this._trackPointerId=null,this.boundPointerMove=e=>function onTimelinePointerMove(e,t){t.pointerId===e._trackPointerId&&applyTimelinePointer(e,t)}(this,e),this.boundPointerUp=e=>function onTimelinePointerUp(e,t){if(t.pointerId!==e._trackPointerId)return;const i=e._trackElement;if(i){try{i.releasePointerCapture(t.pointerId)}catch(I){}i.removeEventListener("pointermove",e.boundPointerMove),i.removeEventListener("pointerup",e.boundPointerUp),i.removeEventListener("pointercancel",e.boundPointerUp)}e._trackElement=null,e._trackPointerId=null,e._chartHoverPct=null}(this,e),this._onPageVisibilityForTheme=()=>{"undefined"!=typeof document&&"visible"===document.visibilityState&&(this._cachedIsDarkThemesRef=void 0,this.requestUpdate())},this._onTimelinePointerDown=e=>function onTimelinePointerDown(e,t){if(!e._timeRange)return;if(e._engine?.isUserGestureSuppressed())return;const i=t.currentTarget;i.setPointerCapture(t.pointerId),e._trackElement=i,e._trackPointerId=t.pointerId,i.addEventListener("pointermove",e.boundPointerMove),i.addEventListener("pointerup",e.boundPointerUp),i.addEventListener("pointercancel",e.boundPointerUp),applyTimelinePointer(e,t)}(this,e),this._onChartHoverMove=e=>function handleChartHoverMove(e,t){if(0!==t.buttons)return void(e._chartHoverPct=null);const i=t.currentTarget;if(!i)return;const r=i.getBoundingClientRect();r.width<=0||(e._chartHoverPct=100*Math.max(0,Math.min(1,(t.clientX-r.left)/r.width)))}(this,e),this._onChartHoverLeave=()=>function handleChartHoverLeave(e){e._chartHoverPct=null}(this),this._instanceId=`h${Math.floor(1e9*Math.random()).toString(36)}`,this._onHomeEnter=()=>{this._homeHover=!0},this._onHomeLeave=()=>{this._homeHover=!1},this._exitScrubMode=()=>{null!==this._selectedTime&&(this._selectedTime=null),this._isLiveMode||(this._isLiveMode=!0)},this._onViewModeClick=e=>{const t=e.currentTarget.dataset.view;t&&this._setViewMode(t)},this._onSubModeKeydown=e=>{"Enter"!==e.key&&" "!==e.key||(e.preventDefault(),this._toggleClockSubMode())},this._toggleClockTarget=e=>{const t=this._clockTargets.indexOf(e),i=t<0;this._captureClockSlots();const r=Date.now();if(i)this._clockExiting=this._clockExiting.filter(t=>t.data.target!==e),this._clockTargets=[...this._clockTargets,e],this._clockGrowStart.set(e,r);else{const i=this._clockData[t],s=this._clockGrowStart.get(e),n=s?easeOutCubic((r-s)/320):1;i&&this._clockExiting.push({data:i,slot:this._clockSlotFrom.get(e)??t,start:r,h0:n}),this._clockGrowStart.delete(e),this._clockTargets=this._clockTargets.filter(t=>t!==e)}this._rebuildClockData(),this._clockTargets.length>0&&this._setChartTarget(this._clockTargets[0]),this._persistUiState(),this._clockAnimate()},this._onClockTargetToggleClick=e=>{const t=e.currentTarget.dataset.target;t&&this._toggleClockTarget(t)},this._uiStateRestored=!1,this._onClockHover=e=>{if("clock"!==this._viewMode||"mouse"!==e.pointerType)return;if(0!==e.buttons)return void(null!==this._clockHoverSlot&&(this._clockHoverSlot=null,this._clockTapSticky=!1));const t=this._haCard;if(!t)return;const i=t.getBoundingClientRect();this._clockHoverX=e.clientX-i.left,this._clockHoverY=e.clientY-i.top;const r=clockHitTest(this._clockHits,this._clockHoverX,this._clockHoverY);this._clockTapSticky=!1,r!==this._clockHoverSlot?this._clockHoverSlot=r:null!==r&&this._scheduleClockPaint()},this._onClockHoverEnd=()=>{null===this._clockHoverSlot||this._clockTapSticky||(this._clockHoverSlot=null)},this._onClockTapStart=e=>{if("clock"!==this._viewMode||"mouse"===e.pointerType)return;const t=this._haCard;if(!t)return;const i=t.getBoundingClientRect();this._clockTapStartX=e.clientX-i.left,this._clockTapStartY=e.clientY-i.top},this._onClockTapEnd=e=>{if("clock"!==this._viewMode||"mouse"===e.pointerType)return;const t=this._haCard;if(!t)return;const i=t.getBoundingClientRect(),r=e.clientX-i.left,s=e.clientY-i.top;if(Math.hypot(r-this._clockTapStartX,s-this._clockTapStartY)>10)return;this._clockHoverX=r,this._clockHoverY=s;const n=clockHitTest(this._clockHits,r,s);null!==n?(this._clockTapSticky=!0,this._clockHoverSlot=n):(this._clockTapSticky=!1,this._clockHoverSlot=null)},this._onCameraLockToggle=()=>{this._engine&&(this._engine.setCameraLocked(!this._engine.isCameraLocked()),this.requestUpdate())}}setConfig(e){if(!e)throw new Error("Invalid HELIOS configuration");this.config={...e},this._warnIfLegacyEntityKeys(e)}_applyPeriod(){this._engine?.setPeriodDays(this._periodPastDays,this._periodFutureDays),this._unifiedStore=null;const e=this._engine?.getTimelineRange();e&&(this._timeRange=e,this._selectedTime&&(this._selectedTime.getTime()<e.start.getTime()||this._selectedTime.getTime()>e.end.getTime())&&this._exitScrubMode()),this.requestUpdate()}_setTimelineMode(e){if(this._timelineMode===e)return;this._timelineMode=e;const t=ze[e];if(this._periodPastDays=t.pastDays,this._periodFutureDays=t.futureDays,t.weather||(this._clockTargets=this._clockTargets.filter(e=>"irradiance"!==e&&"cloud"!==e),"irradiance"!==this._chartTarget&&"cloud"!==this._chartTarget||(this._chartTarget=this._clockTargets[0]??"production")),this._applyPeriod(),this._persistUiState(),"clock"===this._viewMode){const e=/* @__PURE__ */new Date;e.setHours(0,0,0,0),this._clockReloadStart=Date.now(),this._clockReloadWindowStartMs=e.getTime()-this._periodPastDays*ye,this._clockGrowStart.clear(),refreshClockHourly(this),this._clockAnimate()}}get _storeFetchPeriod(){return function modeFetchPeriod(e,t){const i=modeBucketsPerHour(e,t);return i>=2?"5minute":i>=1?"hour":"day"}(this._timelineMode,this.config)}get _weatherAvailable(){return ze[this._timelineMode].weather}_updateHomeAppearance(e){if(!this._engine)return;const t=chartAccentColor(this),i=this._selectedTime?.getTime()??Date.now(),r="production"===this._chartTarget?function solarBands(e,t){const i=e._pvHistoryPerEntity;if(!i||i.size<2)return[];const r=Array.from(i.keys()).sort(),s=e,n=chartIsDark(e),l=t>=Date.now()-3e5,c=[];for(let u=0;u<r.length;u++){const s=r[u];let n=NaN;if(l){const t=e.hass?.states?.[s];if(t){const e=parseFloat(t.state);isFinite(e)&&(n=pvNormalizeToWatts(e,String(t.attributes?.unit_of_measurement??"")))}}if(!(isFinite(n)&&n>0)){const r=i.get(s);r&&(n=pvValueAtTime(e,t,r).value)}isFinite(n)&&n>0&&c.push({v:n,idx:u})}const d=c.reduce((e,t)=>e+t.v,0);return d<=0||c.length<2?[]:c.map(e=>({frac:e.v/d,color:energySolarColor(s,n,e.idx)}))}(this,i):[],s=e&&void 0!==this._lastHomeTarget;this._lastHomeTarget=this._chartTarget,this._engine.setHomeAppearance(t,r,s)}_updateClockHomeAppearance(){if(!this._engine)return;const e=this._clockTargets.map(e=>clockTargetMeta(this,e).color);if(0===e.length)return void this._engine.setHomeAppearance(ENERGY_COLOR_consumption(this),[],!1);const t=e.length>=2?e.map(t=>({frac:1/e.length,color:t})):[];this._engine.setHomeAppearance(e[0],t,!1)}_renderPeriodSelector(){const e=pickTranslations(this.hass?.language),t={now:e.period?.now??"Now",week:e.period?.week??"1 week",month:e.period?.month??"1 month",year:e.period?.year??"1 year"};return U`
            <div
                class="tb-period-selector"
                role="group"
                aria-label=${e.period?.rangeLabel??"Time range"}
                @pointerdown=${this._stopPropagation}
            >
                ${Oe.map(e=>U`
                    <button
                        type="button"
                        class="tb-period-seg ${this._timelineMode===e?"is-on":""}"
                        data-mode=${e}
                        @click=${this._onTimelineModeClick}
                    >${t[e]}</button>
                `)}
            </div>
        `}_warnIfLegacyEntityKeys(e){if(this._legacyKeyWarningFired)return;if(!this.hass?.callService)return;const t=[];for(const r of kt._LEGACY_ENTITY_KEYS){const i=e[r];null!=i&&""!==i&&t.push(r)}if(0===t.length)return;this._legacyKeyWarningFired=!0;const i=`The Helios card no longer reads its PV, grid and battery entities from the card YAML. The following key${t.length>1?"s are":" is"} silently ignored: ${t.map(e=>"`"+e+"`").join(", ")}. Helios now resolves these directly from the official Home Assistant Energy dashboard (Settings → Dashboards → Energy → your sources). The PV forecast is also read from the Energy dashboard's configured solar forecast now, so the card no longer carries any PV install configuration. Only the entity slots and the forecast config were retired; the visual options still live in the card YAML.`;try{this.hass.callService("persistent_notification","create",{notification_id:"helios-legacy-entity-config",title:"Helios card: deprecated entity keys ignored",message:i})}catch(I){}}static getConfigElement(){return document.createElement("helios-card-editor")}static getStubConfig(e,t){if(e&&Array.isArray(t)&&t.length>0)for(const i of t){if("string"!=typeof i||!i.startsWith("zone."))continue;const t=e.states?.[i],r=t?.attributes?.latitude,s=t?.attributes?.longitude;if("number"==typeof r&&Number.isFinite(r)&&"number"==typeof s&&Number.isFinite(s))return{"home-latitude":r,"home-longitude":s}}return{}}getStatsSnapshot(){const e={};if(this.config)for(const[t,i]of Object.entries(this.config))"home-latitude"!==t&&"home-longitude"!==t&&(e[t]=i);return{config:e,engine:this._engine?this._engine.getStatsSnapshot():null,pv:{entityConfigured:""!==resolvePvLiveEntity(this._energyDefaults),unit:this._pvUnit||null}}}invalidateLocation(){this._lastHomeKey="",this.requestUpdate()}resetDataCache(){this._pvHistory=null,this._pvCalibStats=null,this._pvChangeSeries=null,this._pvChangeSeriesFetchKey="",this._haSolarForecast=[],this._haSolarForecastLoaded=!1,this._haSolarForecastFetching=!1,this._haSolarForecastFetchedAt=0,this._pvCalibStatsFetchKey="",this._gridImportChangeSeries=null,this._gridExportChangeSeries=null,this._gridImportChangeFetchKey="",this._gridExportChangeFetchKey="",this._batterySocHistory=null,this._batteryPowerHistory=null,this._batteryFetchKey="",this._batteryChargeChangeSeries=null,this._batteryDischargeChangeSeries=null,this._batteryChangeFetchKey="",this._irradianceHistory=null,this._irradianceFetchKey="",this._clockHourly=null,this._clockHourlyKey="",this._unifiedStore=null,function clearPvModuleCaches(){Ge.clear()}(),function clearBatteryModuleCaches(){gt.clear()}(),function clearIrradianceModuleCaches(){mt.clear()}(),function clearEnergyStatsCache(){Ne.clear()}(),this._engine?.resetDataCache(),this.requestUpdate()}getCardSize(){return 15}getGridOptions(){return{rows:8,columns:12,min_rows:8,max_rows:24,min_columns:12,max_columns:12}}connectedCallback(){super.connectedCallback(),Mt.add(this),this._registerCacheId(),void 0!==this._engineTeardownTimer&&(window.clearTimeout(this._engineTeardownTimer),this._engineTeardownTimer=void 0),this._dailyTotalsKicked=!1,tick(this),this._timer=window.setInterval(()=>{tick(this),refreshHaDailyTotals(this)},3e4),function initVisibilityObserver(e){if(e._visibilityObserver||"undefined"==typeof IntersectionObserver)return;let t=!0,i=!1;const applyState=()=>{const r="undefined"!=typeof document&&"hidden"===document.visibilityState,s=!t||r;if(function setAnimationsPaused(e,t){e.classList.toggle("helios-paused",t);const i=e.shadowRoot;if(!i)return;const r=i.querySelectorAll("svg");for(const s of r){const e=s;try{t?e.pauseAnimations?.():e.unpauseAnimations?.()}catch(I){}}}(e,s),e._engine?.setPaused(s),i&&!r){const t=e;t._lastRefreshHassRef=void 0,t._lastRefreshConfigSig=void 0,t._lastRefreshTimeRangeRef=void 0,t._lastRefreshEnergyDefaultsRef=void 0,e.requestUpdate()}i=r};e._visibilityObserver=new IntersectionObserver(e=>{for(const i of e)t=i.isIntersecting;applyState()},{threshold:0}),e._visibilityObserver.observe(e),"undefined"!=typeof document&&(e._onVisibilityChange=applyState,document.addEventListener("visibilitychange",e._onVisibilityChange))}(this),"undefined"!=typeof document&&document.addEventListener("visibilitychange",this._onPageVisibilityForTheme),subscribeEnergyPrefs(this),refreshHaDailyTotals(this)}disconnectedCallback(){super.disconnectedCallback(),Mt.delete(this),window.clearInterval(this._timer),this._visibilityObserver?.disconnect(),this._visibilityObserver=void 0,this._onVisibilityChange&&(document.removeEventListener("visibilitychange",this._onVisibilityChange),this._onVisibilityChange=void 0),"undefined"!=typeof document&&document.removeEventListener("visibilitychange",this._onPageVisibilityForTheme),function unsubscribeEnergyPrefs(e){if(e._energyPrefsUnsub){try{e._energyPrefsUnsub()}catch(I){}e._energyPrefsUnsub=void 0}}(this),this._engine&&(this._engine.cacheKey=this.effectiveCacheId()),this._engine?.persistCameraPose(),this._persistUiState(),this._unregisterCacheId(),this._clockAnimSeq++,this._clockDimSeq++,void 0!==this._engine&&void 0===this._engineTeardownTimer&&(this._engineTeardownTimer=window.setTimeout(()=>{this._engineTeardownTimer=void 0,this._engine?.cleanup(),this._engine=void 0},400)),this._initInflight=!1}updated(e){if(this._restoreUiState(),"lidar"!==this._viewMode||hasLocalLidar(this.config)||(this._viewMode="scene"),this._maybeRebuildUnifiedStore(),"clock"!==this._viewMode&&this._engine&&(e.has("_chartTarget")||e.has("_selectedTime")||e.has("hass")||e.has("_unifiedStore"))&&this._updateHomeAppearance(e.has("_chartTarget")),"clock"===this._viewMode){if((e.has("_viewMode")||e.has("_clockTargets")||e.has("_unifiedStore")||e.has("_chartSeries")||e.has("_batterySocHistory")||e.has("_customEntityHistory")||e.has("_clockHourly"))&&this._rebuildClockData(),this._clockReloadStart&&(clockNeedsHourly(this)?null!==this._clockHourly:null!==this._unifiedStore&&this._clockWindowFetched())){const e=Math.max(Date.now(),this._clockReloadStart+320);this._clockTargets.forEach(t=>this._clockGrowStart.set(t,e)),this._clockReloadStart=0,this._clockAnimate()}(e.has("_viewMode")||e.has("_clockTargets")||e.has("_unifiedStore"))&&(this._engine?.setHomeOnly(!0),this._updateClockHomeAppearance()),e.has("_clockHoverSlot")&&this._startClockDim(),e.has("_clockData")&&this._scheduleClockPaint()}if(this.hass&&!this._energyPrefsUnsub&&subscribeEnergyPrefs(this),this._energyDefaultsLoaded&&!this._dailyTotalsKicked&&(this._dailyTotalsKicked=!0,refreshHaDailyTotals(this)),!this.hass?.config||!this.config)return;const t=getHomeCoords(this.config,this.hass);if(!t)return;const{lat:i,lon:r}=t,s=`${i.toFixed(5)},${r.toFixed(5)}`,n=s!==this._lastHomeKey;if(!this._engine){if(!this.isConnected)return;if(this._initInflight)return;return this._lastHomeKey=s,this._lastConfigSig=computeConfigSig(this.config),void initEngine(this)}n&&(this._lastHomeKey=s,this._engine.setHome(i,r));const l=computeConfigSig(this.config);l!==this._lastConfigSig&&(this._lastConfigSig=l,this._engine.updateConfig(this.config)),this.hass===this._lastRefreshHassRef&&l===this._lastRefreshConfigSig&&this._timeRange===this._lastRefreshTimeRangeRef&&this._energyDefaults===this._lastRefreshEnergyDefaultsRef||(this._lastRefreshHassRef=this.hass,this._lastRefreshConfigSig=l,this._lastRefreshTimeRangeRef=this._timeRange,this._lastRefreshEnergyDefaultsRef=this._energyDefaults,refreshPv(this),refreshBattery(this),refreshGrid(this),refreshIrradiance(this),async function refreshCustomEntity(e){const t=customEntityId(e.config);if(!t||!e.hass?.callWS||!e._timeRange)return null!==e._customEntityHistory&&(e._customEntityHistory=null,e.requestUpdate()),void(e._customEntityKey="");const i=e._timeRange.start,r=/* @__PURE__ */new Date,s=e._timeRange.end>r?r:e._timeRange.end;if(i>=s)return void(e._customEntityHistory={times:[],values:[]});const n=e._storeFetchPeriod,l=`${t}|${i.getTime()}|${s.getTime()}|${n}`;if(l!==e._customEntityKey){e._customEntityKey=l;try{const r=await callWSWithTimeout(e.hass,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:s.toISOString(),statistic_ids:[t],period:n,types:["mean","change"],units:{energy:"kWh",power:"W"}}),l=Array.isArray(r?.[t])?r[t]:[],c=[],d=[];for(const e of l){const t="number"==typeof e?.start?e.start:Date.parse(e?.start);if(!isFinite(t))continue;let i=null;if("number"==typeof e?.mean&&isFinite(e.mean))i=e.mean;else if("number"==typeof e?.change&&isFinite(e.change)){const r="number"==typeof e?.end?(e.end-t)/36e5:(Date.parse(e?.end)-t)/36e5;i=r>0?e.change/r*1e3:null}null!==i&&isFinite(i)&&(c.push(new Date(t)),d.push(i))}e._customEntityHistory={times:c,values:d}}catch(I){e._customEntityHistory={times:[],values:[]}}e.requestUpdate()}}(this),refreshClockHourly(this),fetchHaSolarForecast(this))}_computeIsDark(e){if(e&&"boolean"==typeof e.darkMode)return e.darkMode;if(this._cachedIsDarkThemesRef===e)return this._cachedIsDark;const t=this._probeIsDarkFromCss();return this._cachedIsDarkThemesRef=e,this._cachedIsDark=t,t}themeIsDark(){return this._computeIsDark(this.hass?.themes)}_probeIsDarkFromCss(){try{const e=getComputedStyle(this).getPropertyValue("--primary-background-color").trim();if(!e)return!1;const t=e.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);let i=0,r=0,s=0;if(t){const e=3===t[1].length?t[1].split("").map(e=>e+e).join(""):t[1];i=parseInt(e.slice(0,2),16),r=parseInt(e.slice(2,4),16),s=parseInt(e.slice(4,6),16)}else{const t=e.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);t&&(i=+t[1],r=+t[2],s=+t[3])}return(.299*i+.587*r+.114*s)/255<.5}catch(I){}return!1}_nudgeToHomePill(e,t,i,r){const s=kt.HOME_PILL_HALF_WIDTH_PX,n=kt.HOME_PILL_HALF_HEIGHT_PX,l=e-i,c=t-r,d=Math.max(0,s-n);if(Math.abs(l)<=d)return{x:e,y:r+(c>=0?1:-1)*n};const u=i+(l>=0?1:-1)*d,p=e-u,g=t-r,m=Math.sqrt(p*p+g*g)||1;return{x:u+n*p/m,y:r+n*g/m}}_renderSunCrossing(e,t,i,r){if(!e)return G;const s=e.x-t.x,n=e.y-t.y,l=Math.hypot(s,n)||1,c=e.x+s/l*22,d=e.y+n/l*22,u=e.time.toLocaleTimeString(this.hass?.locale?.language??void 0,{hour:"2-digit",minute:"2-digit"});return U`
            <div
                class="sun-cross-marker"
                style="left:${c.toFixed(1)}px; top:${d.toFixed(1)}px; --sun-cross-color:${r}"
            >
                <ha-icon icon=${i}></ha-icon>
                <span>${u}</span>
            </div>
        `}render(){const e=null!==getHomeCoords(this.config,this.hass),t=this._labelLayout,i=resolvePvLiveEntity(this._energyDefaults),r=ENERGY_COLOR_pv(this),s=!this._isLiveMode&&null!==this._selectedTime,n=s&&this._selectedTime.getTime()>Date.now()+6e4,l=""!==i&&null!==t?s?function pvRateAtTime(e,t){const i=wattsAtFromChangeSeries(e._pvChangeSeries,t.getTime());return null===i?null:{value:Math.max(0,i),unit:"W"}}(this,this._selectedTime):null!==this._pvCurrent?function currentPvRate(e){const t=e._energyDefaults.solarStatRates;if(t.length>0){let i=0,r=!1;for(const s of t){const t=e.hass?.states?.[s];if(!t)continue;const n=parseFloat(t.state);isFinite(n)&&(i+=pvNormalizeToWatts(n,String(t.attributes?.unit_of_measurement??"")),r=!0)}if(r)return{value:Math.max(0,i),unit:"W"}}const i=latestWattsFromChangeSeries(e._pvChangeSeries,Date.now());return null===i?null:{value:Math.max(0,i),unit:"W"}}(this):null:null;let c=null;if(n&&""!==i&&null!==t&&this._unifiedStore){const e=valueAt(this._unifiedStore.forecast,this._unifiedStore,this._selectedTime.getTime());null!==e&&e>0&&(c={value:e,unit:"W"})}const d=n&&null!==c,u=d?c:l,p=e&&null!==t&&""!==i&&null!==u&&(!n||d)&&(!s||u.value>0),g=valueDecimals(this.config),m=p?(d?"≈ ":"")+formatPvValue(this.hass,u.value,u.unit,g):"",f=null!==l?pvNormalizeToWatts(l.value,l.unit):0,y=flowDuration(f,5e3,.5),b=!(f>0),_=resolveBatteryEntities(this._energyDefaults),v=null!==_.socEntity,w=null!==_.powerEntity,$=!this._isLiveMode&&null!==this._selectedTime,M=$&&this._selectedTime.getTime()>Date.now()+6e4,T=$&&!M?this._selectedTime.getTime():null,C=null!==T?wattsAtFromChangeSeries(this._gridImportChangeSeries,T):this._gridImportValue,F=null!==T?wattsAtFromChangeSeries(this._gridExportChangeSeries,T):this._gridExportValue,H=null===C?null:Math.max(0,C),E=null===F?null:Math.max(0,F),A=null!==T?"W":this._gridImportUnit,D=null!==T?"W":this._gridExportUnit,R=$?function batterySampleAtTime(e,t){if(!e||0===e.times.length)return null;const i=t.getTime(),r=e.times[0].getTime(),s=e.times[e.times.length-1].getTime();if(i<r||i>s+6e4)return null;let n=e.times.length-1;for(let l=0;l<e.times.length;l++)if(e.times[l].getTime()>i){n=l-1;break}return n<0&&(n=0),e.values[n]}(this._batterySocHistory,this._selectedTime):this._batterySoc;let P;if($){const e=this._selectedTime.getTime(),t=wattsAtFromChangeSeries(this._batteryChargeChangeSeries,e),i=wattsAtFromChangeSeries(this._batteryDischargeChangeSeries,e);P=null===t&&null===i?null:Math.max(0,t??0)-Math.max(0,i??0)}else P=this._batteryPower;const L=$?"W":this._batteryPowerUnit,I=e&&null!==t&&!M&&v&&null!==R,O=e&&null!==t&&!M&&w&&null!==P,z=I?`${Math.round(R)} %`:"",W=O?function formatBatteryPower(e,t,i,r){return formatPowerKw(e,pvNormalizeToWatts(t,i),r,!0)}(this.hass,-P,L,g):"",j=n||null===u?null:pvNormalizeToWatts(u.value,u.unit),B=null!==H||null!==E?(H??0)-(E??0):null,K=O?P:null,Y=null===j&&null===B&&null===K?null:Math.max(0,(j??0)+(B??0)-(K??0)),X=e&&null!==t&&!M&&null!==Y,Z=X?formatGridValue(this.hass,Y,"W",g):"",J=O&&P>0,Q=O&&P<0,ee=J?"var(--energy-battery-in-color, #f06292)":"var(--energy-battery-out-color, #4db6ac)",te=O?Math.abs(pvNormalizeToWatts(P,L)):0,ie=O&&te<5,oe=flowDuration(te,5e3),buildLPathToHome=(e,i,r)=>{if(!t)return"";const s=t.home.x,n=t.home.y,l=s>e?1:-1,c=n>i?1:-1,d=e+l*r,u=i,p=s-13*l,g=n-c*kt.HOME_PILL_HALF_HEIGHT_PX,m=Math.min(12,Math.abs(p-d)/2,Math.abs(g-u)/2),f=p-l*m,y=u+c*m;return`M ${d.toFixed(1)},${u.toFixed(1)} L ${f.toFixed(1)},${u.toFixed(1)} Q ${p.toFixed(1)},${u.toFixed(1)} ${p.toFixed(1)},${y.toFixed(1)} L ${p.toFixed(1)},${g.toFixed(1)}`},re=t?.batterySocLabel.x??0,ae=t?.batterySocLabel.y??0,se=t?.batteryPowerLabel.x??0,ne=t?.batteryPowerLabel.y??0,le=t&&O?`M ${re.toFixed(1)},${(ae-14).toFixed(1)} L ${se.toFixed(1)},${(ne+14).toFixed(1)}`:"",ce=t&&Q?buildLPathToHome(re,ae,22):"",he=t&&I&&!O&&!Q?buildLPathToHome(re,ae,22):"",de=t&&J&&p?((e,t,i,r,s)=>{const n=i>e?1:-1,l=r>t?1:-1,c=Math.min(12,Math.abs(i-e)/2,Math.abs(r-t)/2);if(s){const s=r-l*c,d=e+n*c;return`M ${e.toFixed(1)},${t.toFixed(1)} L ${e.toFixed(1)},${s.toFixed(1)} Q ${e.toFixed(1)},${r.toFixed(1)} ${d.toFixed(1)},${r.toFixed(1)} L ${i.toFixed(1)},${r.toFixed(1)}`}const d=i-n*c,u=t+l*c;return`M ${e.toFixed(1)},${t.toFixed(1)} L ${d.toFixed(1)},${t.toFixed(1)} Q ${i.toFixed(1)},${t.toFixed(1)} ${i.toFixed(1)},${u.toFixed(1)} L ${i.toFixed(1)},${r.toFixed(1)}`})(t.pvLabel.x+14,t.pvLabel.y+11,se-30,ne,!0):"",ue=buildLPathToHome(t?.gridLabel.x??0,t?.gridLabel.y??0,22),pe=null!==this._gridImportValue?Math.abs(pvNormalizeToWatts(this._gridImportValue,this._gridImportUnit)):0,ge=null!==this._gridExportValue?Math.abs(pvNormalizeToWatts(this._gridExportValue,this._gridExportUnit)):0,proportionalBeadDur=(e,t)=>{const i=Math.max(e,1);return Math.min(8,Math.max(1.2,1.2*t/i))},fe=pe<5?null:proportionalBeadDur(pe,5e3),ye=ge<5?null:proportionalBeadDur(ge,1e3),be=(H??0)>=(E??0),_e=be?"var(--energy-grid-consumption-color, #488fc2)":"var(--energy-grid-return-color, #8353d1)",ve=be?fe:ye,we=resolveCustomEntityLive(this.hass,customEntityId(this.config)),xe=resolveCustomEntityIcon(this.hass,this.config),ke=function resolveUiColor(e,t){const i=(e??"").trim();return i?/^(#|rgb|var)/i.test(i)?i:`var(--${i}-color, ${t})`:t}(customEntityColor(this.config),"#f44336"),Se=buildLPathToHome(t?.customLabel.x??0,t?.customLabel.y??0,22),$e=this._isLiveMode||null===this._selectedTime?null:this._selectedTime.getTime(),Me=function customChipWatts(e,t,i,r){if(!t)return null;if(null!==r)return function customSampleAtTime(e,t){if(!e||0===e.times.length)return null;if(t<e.times[0].getTime()||t>e.times[e.times.length-1].getTime()+36e5)return null;let i=e.times.length-1;for(let r=0;r<e.times.length;r++)if(e.times[r].getTime()>t){i=r-1;break}return e.values[i<0?0:i]}(i,r);const s=e?.states?.[t];if(!s)return null;const n=String(s.attributes?.unit_of_measurement??"");if("energy"===String(s.attributes?.device_class??"")||Ie.has(n.trim().toLowerCase()))return i&&i.values.length>0?i.values[i.values.length-1]:null;const l=parseFloat(s.state);return isFinite(l)?pvNormalizeToWatts(l,n):null}(this.hass,customEntityId(this.config),this._customEntityHistory,$e),Te=null===Me?"":formatPvValue(this.hass,Me,"W",g),Ce=null===Me?0:Math.abs(Me),Fe=null===Me||Ce<5?null:Math.min(8,Math.max(1.2,6e3/Math.max(Ce,1))),He=null===Me||Me>=0,Ee=this._sunScene,Ae=e&&null!==Ee&&Ee.arc.length>=2,De=ENERGY_COLOR_sun(this),Re=function darkenHex(e,t){const i=1-Math.max(0,Math.min(1,t)),r=Math.round(parseInt(e.slice(1,3),16)*i),s=Math.round(parseInt(e.slice(3,5),16)*i),n=Math.round(parseInt(e.slice(5,7),16)*i),h=e=>e.toString(16).padStart(2,"0");return`#${h(r)}${h(s)}${h(n)}`}(De,.2),Pe=Ae?function buildArcSegments(e,t){const i=[];for(let r=0;r<e.length-1;r++){const s=e[r],n=e[r+1];i.push({x1:s.x,y1:s.y,x2:n.x,y2:n.y,color:arcColor(.5*(s.altitude+n.altitude),t),nearness:.5*(s.nearness+n.nearness),belowHorizon:s.belowHorizon||n.belowHorizon})}return i}(Ee.arc,De):[],Le=this._arcBackBuf,Ne=this._arcFrontBuf,Oe=this._arcFrontNearBuf;Le.length=0,Ne.length=0,Oe.length=0;for(const U of Pe)U.belowHorizon?Le.push(U):U.nearness>=.5?Oe.push(U):Ne.push(U);const ze=Ae&&Ee.sun.altitude>0,We=Ee?.sun.irradiance??0,je=Math.round(We),Be=Math.sqrt(Math.max(0,Math.min(1,We/1e3))),Ve=Ae&&Ee.sun.altitude>0&&this._weatherAvailable,Ue=flowDuration(We,1e3,.8);let qe=Ee?.home.x??0,Ke=Ee?.home.y??0;if(t&&Ee&&i){const e=t.pvLabel.x,i=t.pvLabel.y,r=28,s=11,n=Ee.sun.x-e,l=Ee.sun.y-i,c=Math.max(0,r-s);if(Math.abs(n)<=c)qe=Ee.sun.x,Ke=i+(l>=0?1:-1)*s;else{const t=e+(n>=0?1:-1)*c,r=i,l=Ee.sun.x-t,d=Ee.sun.y-r,u=Math.sqrt(l*l+d*d)||1;qe=t+s*l/u,Ke=r+s*d/u}}const Ge=this.hass?.themes;return U`
            <ha-card class=${[this._computeIsDark(Ge)?"theme-dark":"theme-light",this._isCameraLocked()?"camera-locked":"",this.preview?"helios-edit":"","clock"===this._viewMode?"mode-clock":"","lidar"===this._viewMode?"mode-lidar":""].filter(Boolean).join(" ")}>

                <div
                    id="map-container"
                    @pointermove=${this._onClockHover}
                    @pointerleave=${this._onClockHoverEnd}
                    @pointerdown=${this._onClockTapStart}
                    @pointerup=${this._onClockTapEnd}
                ></div>

                ${e&&"clock"===this._viewMode?U`
                    <div class="clock-overlay">
                        <svg class="clock-guide-svg" xmlns="http://www.w3.org/2000/svg"></svg>
                        <svg class="clock-svg" xmlns="http://www.w3.org/2000/svg"></svg>
                        ${Array.from({length:24},(e,t)=>U`
                            <div class="clock-hour-label">${this._formatClockHour(t)}</div>
                        `)}
                        ${[{l:"N",c:"var(--red-color, #f44336)"},{l:"S",c:"var(--primary-text-color, #212121)"}].map(e=>U`<div class="clock-compass-label" style="color:${e.c}">${e.l}</div>`)}
                        ${null!==this._clockHoverSlot?this._renderClockTooltip(this._clockHoverSlot):G}
                    </div>
                `:G}

                ${e&&this._timeRange&&"scene"===this._viewMode?U`
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
                                ${me(this._chartTarget,renderBottomChart(this))}
                                ${renderTimelineNightZones(this)}
                                ${function renderTimelineFutureMask(e){const t=e._timeRange;if(!t)return G;const i=t.start.getTime(),r=t.end.getTime(),s=r-i;if(s<=0)return G;const n=Date.now();return n<=i||n>=r?G:U`
        <div
            class="hc-future-mask"
            style="left:${((n-i)/s*100).toFixed(2)}%"
        ></div>
    `}(this)}
                                ${function renderTimelineTicks(e){if(!e._timeRange)return G;const{start:t,end:i}=e._timeRange,r=i.getTime()-t.getTime(),toPct=e=>Math.max(0,Math.min(100,(e.getTime()-t.getTime())/r*100)),s=toPct(/* @__PURE__ */new Date),n=!e._isLiveMode&&null!==e._selectedTime,l=n?toPct(e._selectedTime):0;return U`
        <div class="tb-cursor-now" style="left:${s}%"></div>
        ${n?U`
            <div class="tb-cursor-sel" style="left:${l}%"></div>
        `:G}
    `}(this)}
                            </div>
                            ${renderTimelineDayLabels(this)}
                        </div>
                    </div>
                `:G}

                <!--  Period-mode band: a separate strip BELOW the timeline (own card styling — same width,
                      radius and themed border), holding the Now / 1 week / 1 month / 1 year selector. Stays
                      visible in clock mode too so the window can be changed from there.  -->
                ${!e||"scene"!==this._viewMode&&"clock"!==this._viewMode?G:U`
                    <div class="tb-band">
                        ${this._renderPeriodSelector()}
                    </div>
                `}

<!--  Camera lock chip (top-left). Tapping flips the
                      lock and asks the engine to persist the pose
                      (bearing + pitch + lock flag) to localStorage for
                      the next reload. No tooltip/label: the padlock
                      glyph carries the meaning and tooltips are
                      useless on touch.                              -->
                ${e?(()=>{const e=this._isCameraLocked(),t=e?"mdi:lock":"mdi:lock-open-variant",i="scene"===this._viewMode,r="clock"===this._viewMode,s="lidar"===this._viewMode,n=hasLocalLidar(this.config);return U`
                        <div class="overlay-top-left">
                            <button
                                type="button"
                                class="overlay-btn ${i?"is-on":""}"
                                aria-pressed=${i?"true":"false"}
                                title="Scene"
                                data-view="scene"
                                @click=${this._onViewModeClick}
                            >
                                <ha-icon icon="mdi:weather-sunny"></ha-icon>
                            </button>
                            <div class="rail-row">
                                <button
                                    type="button"
                                    class="overlay-btn ${r?"is-on":""}"
                                    aria-pressed=${r?"true":"false"}
                                    title="Clock"
                                    data-view="clock"
                                    @click=${this._onViewModeClick}
                                >
                                    <ha-icon icon="mdi:clock-outline"></ha-icon>
                                </button>
                                ${r?this._renderClockSubModeToggle():G}
                            </div>
                            ${n?U`
                                <button
                                    type="button"
                                    class="overlay-btn ${s?"is-on":""}"
                                    aria-pressed=${s?"true":"false"}
                                    title="LiDAR"
                                    data-view="lidar"
                                    @click=${this._onViewModeClick}
                                >
                                    <ha-icon icon="mdi:satellite-variant"></ha-icon>
                                </button>
                            `:G}
                            <button
                                type="button"
                                class="overlay-btn ${e?"is-on":""}"
                                aria-pressed=${e?"true":"false"}
                                @click=${this._onCameraLockToggle}
                            >
                                <ha-icon icon=${t}></ha-icon>
                            </button>
                        </div>
                    `})():G}

                <!--  Right-hand metric rail (clock mode): one button per configured metric, stacked with no
                      gaps. Multi-select FILTERS — each active metric adds a concentric ring; the active ones
                      fill with their own colour.  -->
                ${e&&"clock"===this._viewMode?(()=>{const e=function availableClockTargets(e){const t=e._unifiedStore,i=e._pvHistoryPerEntity.size>0||hasSignal(t?.production)||hasSignal(t?.forecast),r=hasSignal(t?.gridImport)||hasSignal(t?.gridExport),s=hasSignal(t?.battery),n=!!e._batterySocHistory&&e._batterySocHistory.values.length>0,l=[];return i&&l.push("production"),(i||r||s)&&l.push("consumption"),n&&l.push("battery-soc"),s&&l.push("battery"),r&&l.push("grid"),e._weatherAvailable&&hasSignal(t?.irradiance)&&l.push("irradiance"),e._weatherAvailable&&hasSignal(t?.cloud)&&l.push("cloud"),customEntityId(e.config)&&l.push("custom"),l}(this);return e.length?U`
                        <div class="overlay-top-right">
                            ${e.map(e=>{const t=clockTargetMeta(this,e),i=this._clockTargets.includes(e),r=function clockTargetLabel(e,t){return"custom"===t?resolveCustomEntityLive(e.hass,customEntityId(e.config))?.name||customEntityId(e.config)||"Custom":(String(e.hass?.language??"").toLowerCase().startsWith("fr")?pt:ut)[t]}(this,e);return U`
                                    <button
                                        type="button"
                                        class="overlay-btn ${i?"is-on":""}"
                                        style="--clock-btn-color:${t.color}"
                                        aria-pressed=${i?"true":"false"}
                                        title=${r}
                                        aria-label=${r}
                                        data-target=${e}
                                        @click=${this._onClockTargetToggleClick}
                                    >
                                        <ha-icon icon=${t.icon}></ha-icon>
                                    </button>
                                `})}
                        </div>
                    `:G})():G}

                <!--  Solar arc, BACK pass. Renders only the dotted
                      below-horizon segments (the sun's path through
                      the underside of the celestial sphere), so the
                      home and its chips read in front of the night
                      half of the loop. Above-horizon segments, the
                      ray, the disc and the W/m² readout move to the
                      FRONT pass at the end of the overlay stack.  -->
                ${Ae&&Le.length>0?U`
                    <svg
                        class="solar-svg solar-svg-back"
                        style="--solar-daylight:${Ee.daylight}"
                    >
                        ${Le.map(e=>q`
                            <line
                                class="solar-arc-outline solar-arc-night"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${(kt.OUTLINE_FAR+(kt.OUTLINE_NEAR-kt.OUTLINE_FAR)*e.nearness)*kt.NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                        ${Le.map(e=>q`
                            <line
                                class="solar-arc-segment solar-arc-night"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${(kt.SEGMENT_FAR+(kt.SEGMENT_NEAR-kt.SEGMENT_FAR)*e.nearness)*kt.NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                    </svg>
                `:G}


                <!--  PV → home animated leader. Vertical dashed line
                      from the PV chip's bottom edge down to the home
                      marker, painted in the configured PV colour and
                      flowing toward the home at a pace proportional
                      to live production over theoretical peak. Same
                      dash vocabulary as the battery leader, no L bend
                      because PV and the home share the same X anchor
                      so a straight segment is the right vocabulary.
                      Hidden when no PV entity is configured.  -->
                <!--  Empty slot kept so the home stack stays
                      vertically anchored for the leaders below. -->
                ${G}

                ${p?(()=>{const e=t.pvLabel.x,i=t.pvLabel.y+11,s=this._nudgeToHomePill(e,i,t.home.x,t.home.y);return U`
                    <svg class="pv-home-leader-svg">
                        <line
                            class="pv-home-leader-line"
                            style="--pv-leader-color:${r}"
                            x1=${e}
                            y1=${i}
                            x2=${s.x}
                            y2=${s.y}
                        ></line>
                        ${b?G:q`
                            <!--  Moving bead, a small filled disc rides
                                  the leader from the PV chip to the
                                  home, at a speed proportional to live
                                  production. No rotate="auto" needed
                                  since a disc has no orientation.  -->
                            <circle
                                class="pv-home-leader-bead"
                                r="3"
                                fill="${r}"
                            >
                                <animateMotion
                                    dur="${y}s"
                                    repeatCount="indefinite"
                                    path="M ${e},${i} L ${s.x},${s.y}"
                                ></animateMotion>
                            </circle>
                        `}
                    </svg>`})():G}

                ${p?U`
                    <div
                        class="pv-pct-label ${d?"is-predicted":""} ${"production"===this._chartTarget?"is-chart-active":""}"
                        style="left:${t.pvLabel.x}px; top:${t.pvLabel.y}px; --pv-leader-color:${r}"
                        role="button"
                        tabindex="0"
                        data-target="production"
                        @click=${this._onChartTargetClick}
                    >
                        <ha-icon icon="mdi:solar-power"></ha-icon>
                        <span>${m}</span>
                    </div>
                `:G}

                ${I||O?U`
                    <svg class="battery-leader-svg">
                        <!--
                            SoC → Power chip, solid straight vertical
                            hairline between the two stacked chips. No
                            animation: SoC is a level, not a flow.
                        -->
                        ${le?q`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${ee}"
                                d="${le}"
                            ></path>
                        `:G}
                        <!--  SoC → home static connector when the SoC chip is the only battery chip. -->
                        ${he?q`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${ee}"
                                d="${he}"
                            ></path>
                        `:G}
                        <!--
                            SoC → home, the battery→home discharge
                            flow: solid rounded-L + bead toward the
                            home, drawn only while the battery is
                            discharging to feed the house.
                        -->
                        ${ce?q`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${ee}"
                                d="${ce}"
                            ></path>
                            ${ie?G:q`
                                <circle
                                    class="battery-leader-bead"
                                    r="3"
                                    style="fill:${ee}"
                                >
                                    <animateMotion
                                        dur="${oe}s"
                                        repeatCount="indefinite"
                                        path="${ce}"
                                    ></animateMotion>
                                </circle>
                            `}
                        `:G}
                        <!--
                            PV → Power chip, only while charging: an
                            inverted L (down then right) in the PV
                            colour with a bead flowing toward the
                            battery, so the user sees the PV feeding it.
                        -->
                        ${de?q`
                            <path
                                class="pv-home-leader-line"
                                style="--pv-leader-color:${r}"
                                fill="none"
                                d="${de}"
                            ></path>
                            ${ie?G:q`
                                <circle
                                    class="pv-home-leader-bead"
                                    r="3"
                                    fill="${r}"
                                >
                                    <animateMotion
                                        dur="${oe}s"
                                        repeatCount="indefinite"
                                        path="${de}"
                                    ></animateMotion>
                                </circle>
                            `}
                        `:G}
                    </svg>
                    ${I?U`
                        <div
                            class="battery-pct-label ${"battery-soc"===this._chartTarget?"is-chart-active":""}"
                            style="left:${t.batterySocLabel.x}px; top:${t.batterySocLabel.y}px; --battery-leader-color:${ee}"
                            role="button"
                            tabindex="0"
                            data-target="battery-soc"
                            @click=${this._onChartTargetClick}
                        >
                            <ha-icon icon="mdi:battery"></ha-icon>
                            <span>${z}</span>
                        </div>
                    `:G}
                    ${O?U`
                        <div
                            class="battery-pct-label ${"battery"===this._chartTarget?"is-chart-active":""}"
                            style="left:${t.batteryPowerLabel.x}px; top:${t.batteryPowerLabel.y}px; --battery-leader-color:${ee}"
                            role="button"
                            tabindex="0"
                            data-target="battery"
                            @click=${this._onChartTargetClick}
                        >
                            <ha-icon icon="mdi:lightning-bolt"></ha-icon>
                            <span>${W}</span>
                        </div>
                    `:G}
                `:G}

                <!--  Grid chip on the LEFT of the home, sitting on the
                      cluster's centre row. A single normal-size pill
                      that shows the ACTIVE flow only: when importing it
                      reads consumption blue with the import value and a
                      grid → home bead, when exporting it flips to return
                      purple with the export value and a home → grid
                      bead. The dominant side wins when both are live.
                      Same compact recipe as the other chips so the text
                      stays crisp under camera rotation.               -->
                <!--  Custom-entity chip (top-left, above grid). Red leader to the home; bead flows home ->
                      chip on a positive value, chip -> home on a negative one. Shown only when the entity is
                      configured AND has a real value at the active instant — scrubbing into a gap (no history,
                      or a flat 0 before the entity existed) drops the chip + leader instead of an empty pill.  -->
                ${!e||null===t||null===we||null===Me||null!==$e&&0===Me?G:U`
                    <svg class="custom-leader-svg">
                        <path class="custom-leader-line" style="stroke:${ke}" d=${Se} />
                        ${null!==Fe?He?q`
                            <circle class="custom-leader-bead" r="3" style="fill:${ke}">
                                <animateMotion dur="${Fe.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints="1;0" keyTimes="0;1" path="${Se}" />
                            </circle>
                        `:q`
                            <circle class="custom-leader-bead" r="3" style="fill:${ke}">
                                <animateMotion dur="${Fe.toFixed(2)}s" repeatCount="indefinite"
                                               path="${Se}" />
                            </circle>
                        `:G}
                    </svg>
                    <div
                        class="custom-label ${"custom"===this._chartTarget?"is-chart-active":""}"
                        style="left:${t.customLabel.x}px; top:${t.customLabel.y}px; --custom-leader-color:${ke}"
                        title=${we.name}
                        role="button"
                        tabindex="0"
                        data-target="custom"
                        @click=${this._onChartTargetClick}
                    >
                        <ha-icon icon=${xe}></ha-icon>
                        <span>${Te}</span>
                    </div>
                `}

                ${!e||null===t||null===H&&null===E||M?G:U`
                    <svg class="grid-leader-svg">
                        <path class="grid-leader-line" style="stroke:${_e}" d=${ue} />
                        <!--  Single bead on the active flow. Import
                              flows grid → home (default traversal),
                              export flows home → grid (keyPoints 1;0
                              reverses it). Dropped when the active side
                              is idle, no misleading motion.           -->
                        ${null!==ve?be?q`
                            <circle class="grid-leader-bead" r="3" style="fill:${_e}">
                                <animateMotion dur="${ve.toFixed(2)}s" repeatCount="indefinite"
                                               path="${ue}" />
                            </circle>
                        `:q`
                            <circle class="grid-leader-bead" r="3" style="fill:${_e}">
                                <animateMotion dur="${ve.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints="1;0" keyTimes="0;1"
                                               path="${ue}" />
                            </circle>
                        `:G}
                    </svg>
                    <div
                        class="grid-label ${"grid"===this._chartTarget?"is-chart-active":""}"
                        style="left:${t.gridLabel.x}px; top:${t.gridLabel.y}px; --grid-leader-color:${_e}"
                        role="button"
                        tabindex="0"
                        data-target="grid"
                        @click=${this._onChartTargetClick}
                    >
                        <ha-icon icon=${be?"mdi:transmission-tower-export":"mdi:transmission-tower-import"}></ha-icon>
                        <span>${formatGridValue(this.hass,be?H??0:E??0,be?A:D,g)}</span>
                    </div>
                `}

                <!--  Solar arc, FAR-FRONT pass. Above-horizon
                      segments whose nearness is below the 0.5 mid-
                      point: the arc has already arched away from the
                      eye but is still in front of the sky dome's
                      back wall. These render BEHIND the home-anchored
                      chips so a chip cluster doesn't get crossed by
                      an arc segment that visually sits "in the back
                      half" of the sky. -->
                ${Ae&&Ne.length>0?U`
                    <svg
                        class="solar-svg solar-svg-front-far"
                        style="--solar-daylight:${Ee.daylight}"
                    >
                        ${Ne.map(e=>q`
                            <line
                                class="solar-arc-outline"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${kt.OUTLINE_FAR+(kt.OUTLINE_NEAR-kt.OUTLINE_FAR)*e.nearness}"
                            ></line>
                        `)}
                        ${Ne.map(e=>q`
                            <line
                                class="solar-arc-segment"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${kt.SEGMENT_FAR+(kt.SEGMENT_NEAR-kt.SEGMENT_FAR)*e.nearness}"
                            ></line>
                        `)}
                    </svg>
                `:G}

                <!--  Solar arc, NEAR-FRONT pass. Above-horizon
                      segments whose nearness is at or above 0.5: the
                      part of the arc that is closer to the camera
                      than the home. These render IN FRONT of the
                      home-anchored chips + leaders so the live arc
                      always reads on top of the HUD on its near side.
                      The card is named Helios, the sun must dominate
                      visually wherever it is. -->
                ${Ae&&Oe.length>0?U`
                    <svg
                        class="solar-svg solar-svg-front-near"
                        style="--solar-daylight:${Ee.daylight}"
                    >
                        ${Oe.map(e=>q`
                            <line
                                class="solar-arc-outline"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${kt.OUTLINE_FAR+(kt.OUTLINE_NEAR-kt.OUTLINE_FAR)*e.nearness}"
                            ></line>
                        `)}
                        ${Oe.map(e=>q`
                            <line
                                class="solar-arc-segment"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${kt.SEGMENT_FAR+(kt.SEGMENT_NEAR-kt.SEGMENT_FAR)*e.nearness}"
                            ></line>
                        `)}
                    </svg>
                `:G}

                <!--  Ray + bead live in their own SVG below the chip
                      family (z 7 < pv-pct-label z 8) so the PV chip's
                      background always occludes the ray endpoint at
                      the chip border. The sun disc stays in the
                      depth-split SVG below so it passes in front of /
                      behind the home cluster depending on camera
                      bearing, while the ray never rides over the
                      production chip. -->
                ${Ae&&ze?U`
                    <svg class="solar-svg solar-ray-svg"
                         style="--solar-daylight:${Ee.daylight}">
                        <line
                            class="solar-ray"
                            style="--sun-flow-duration:${Ue}s"
                            x1=${Ee.sun.x}  y1=${Ee.sun.y}
                            x2=${qe}    y2=${Ke}
                            stroke=${De}
                        ></line>
                        <!--  Bead uses an absolute-coordinate path
                              with cx / cy left at the default 0
                              origin, same vocabulary as the PV
                              leader bead. Single-attribute updates
                              keep the SMIL animation continuous
                              during camera rotation. -->
                        <circle
                            class="solar-ray-bead"
                            r="3"
                            fill=${De}
                        >
                            <animateMotion
                                dur="${Ue}s"
                                repeatCount="indefinite"
                                path="M ${Ee.sun.x},${Ee.sun.y} L ${qe},${Ke}"
                            ></animateMotion>
                        </circle>
                    </svg>
                `:G}

                ${Ae?U`
                    <svg
                        class="solar-svg solar-svg-sun ${Ee.sun.nearness>=.5?"solar-svg-sun-near":"solar-svg-sun-far"}"
                        style="--solar-daylight:${Ee.daylight}"
                    >
                        ${(()=>{const e=this._engine?.getSunArcScale()??1,t=Math.min((kt.SUN_R_FAR+(kt.SUN_R_NEAR-kt.SUN_R_FAR)*Ee.sun.nearness)*e,22),i=t*Be,r=3*t;return q`
                                <defs>
                                    <radialGradient id="solar-halo-grad">
                                        <stop offset="0%"   stop-color="${De}" stop-opacity="${.55*Be}"></stop>
                                        <stop offset="100%" stop-color="${De}" stop-opacity="0"></stop>
                                    </radialGradient>
                                </defs>
                                <circle
                                    class="solar-sun-halo"
                                    cx="${Ee.sun.x}" cy="${Ee.sun.y}"
                                    r="${r}"
                                    fill="url(#solar-halo-grad)"
                                ></circle>
                                <circle
                                    class="solar-sun-bg"
                                    cx="${Ee.sun.x}" cy="${Ee.sun.y}"
                                    r="${t}"
                                    fill="${De}"
                                    fill-opacity="${kt.SUN_FILL_OPACITY_BG}"
                                ></circle>
                                <circle
                                    class="solar-sun-fill"
                                    cx="${Ee.sun.x}" cy="${Ee.sun.y}"
                                    r="${i}"
                                    fill="${De}"
                                    stroke="${Re}"
                                    stroke-width="0.5"
                                ></circle>
                                <circle
                                    class="solar-sun-rim"
                                    cx="${Ee.sun.x}" cy="${Ee.sun.y}"
                                    r="${t}"
                                    fill="none"
                                    stroke="${De}"
                                    stroke-width="${kt.SUN_RIM_WIDTH}"
                                ></circle>
                            `})()}
                    </svg>
                `:G}

                <!--  W/m² label, pinned above the sun disc. Same
                      visual language as the cloud-cover label, both
                      read as a matched pair of cartographic readouts.
                      Lands after the front-pass arc so the readout
                      sits on top of the sun glyph as well.  -->
                ${Ve?U`
                    <div
                        class="solar-pct-label ${"irradiance"===this._chartTarget?"is-chart-active":""}"
                        style="left:${Ee.sun.x}px; top:${Ee.sun.y-22}px"
                        role="button"
                        tabindex="0"
                        data-target="irradiance"
                        @click=${this._onChartTargetClick}
                    >
                        <ha-icon icon="mdi:white-balance-sunny"></ha-icon>
                        <span>${je} W/m²</span>
                    </div>
                `:G}

                <!--  Cloud chip: a standalone pill just to the RIGHT of the irradiance chip, joined by a
                      short fixed cloud-coloured leader, showing the live cloud cover with a dynamic glyph.
                      Clicking it re-targets the timeline chart to the cloud cover (three altitude-band
                      curves), same chip <-> chart coupling as the other chips. Anchored off the sun so it
                      tracks the irradiance chip.  -->
                ${Ve&&this._cloudCover>=0?(()=>{const e=Ee.sun.x,t=Ee.sun.y-22,i=t-kt.CHIP_HALF_H_PX,r=this._engine?.getViewportWidth()??0,s=kt.CHIP_HALF_W_PX,n=s+16+76,l=r<=0||e+n<=r-8?1:e-n>=8?-1:e<r/2?1:-1,c=l>0?e+s+16:e-s-16,d=l>0?"translate(0, -100%)":"translate(-100%, -100%)";return U`
                        <div
                            class="cloud-chip-leader"
                            style="left:${(l>0?e+s:e-s-16).toFixed(1)}px; top:${i.toFixed(1)}px; width:${16}px"
                        ></div>
                        <div
                            class="cloud-chip ${"cloud"===this._chartTarget?"is-chart-active":""}"
                            style="left:${c.toFixed(1)}px; top:${t.toFixed(1)}px; transform:${d}"
                            role="button"
                            tabindex="0"
                            data-target="cloud"
                            @click=${this._onChartTargetClick}
                        >
                            <ha-icon icon=${function cloudCoverIcon(e){return e<0?"mdi:weather-cloudy":e<15?"mdi:weather-sunny":e<40?"mdi:weather-partly-cloudy":e<75?"mdi:weather-cloudy":"mdi:weather-pouring"}(this._cloudCover)}></ha-icon>
                            <span>${Math.round(this._cloudCover)} %</span>
                        </div>
                    `})():G}

                <!--  Sunrise / sunset markers: a sun-coloured glyph + local time just outside the arc at
                      each horizon crossing.  -->
                ${Ae&&Ee?U`
                    ${this._renderSunCrossing(Ee.sunrise,Ee.home,"mdi:weather-sunset-up",De)}
                    ${this._renderSunCrossing(Ee.sunset,Ee.home,"mdi:weather-sunset-down",De)}
                `:G}



                <!--  Home pill: the hub the whole chip cluster orbits,
                      painted at the projected home centre with no
                      drop-leader so every chip leader docks straight
                      against its border. Hosts two stacked lines: the
                      home glyph on top and the live home consumption
                      below.                                           -->
                ${e&&null!==t?U`
                    <div
                        class="home-pill ${X?"has-usage":""} ${this._homeHover?"is-hovered":""} ${"consumption"===this._chartTarget?"is-chart-active":""}"
                        style="left:${t.home.x}px; top:${t.home.y}px"
                        role="button"
                        tabindex="0"
                        data-target="consumption"
                        @click=${this._onChartTargetClick}
                        @mouseenter=${this._onHomeEnter}
                        @mouseleave=${this._onHomeLeave}
                    >
                        <ha-icon icon="mdi:home"></ha-icon>
                        ${X?U`<span class="home-pill-usage">${Z}</span>`:G}
                    </div>
                `:G}

            </ha-card>
        `}_maybeRebuildUnifiedStore(){(function isStoreFresh(e,t){return!!t&&t.dataVersion===computeDataVersion(e)})(this,this._unifiedStore)||(this._unifiedStore=buildUnifiedStore(this))}_clockWindowFetched(){const e=`|${this._clockReloadWindowStartMs}|`,t=this._energyDefaults,fresh=(t,i,r)=>0===t.length||!r&&i.includes(e);return fresh(t.solarStatEnergyFroms,this._pvChangeSeriesFetchKey,this._pvChangeSeriesFetching)&&fresh(t.gridStatEnergyFroms,this._gridImportChangeFetchKey,this._gridImportChangeFetching)&&fresh(t.gridStatEnergyTos,this._gridExportChangeFetchKey,this._gridExportChangeFetching)&&fresh([...t.batteryStatEnergyTos,...t.batteryStatEnergyFroms],this._batteryChangeFetchKey,this._batteryChangeFetching)}_isCameraLocked(){return!!this._engine&&this._engine.isCameraLocked()}_setViewMode(e){if(this._viewMode!==e){if(this._clockAnimSeq++,this._clockExiting=[],this._clockSlotFrom.clear(),this._clockSlideStart=0,"clock"===e){0===this._clockTargets.length&&(this._clockTargets=[this._chartTarget]),this._rebuildClockData();const t=Date.now();return this._clockGrowStart.clear(),this._clockTargets.forEach(e=>this._clockGrowStart.set(e,t)),this._engine?.setHomeOnly(!0),this._updateClockHomeAppearance(),this._viewMode=e,this._persistUiState(),refreshClockHourly(this),void this._clockAnimate()}this._engine?.setHomeOnly(!1),this._updateHomeAppearance(!1),this._clockTargets.length>0&&this._setChartTarget(this._clockTargets[0]),this._viewMode=e,this._persistUiState(),refreshClockHourly(this)}}_toggleClockSubMode(){this._clockSubMode="area"===this._clockSubMode?"histogram":"area",this._persistUiState(),this._scheduleClockPaint()}_captureClockSlots(){const e=Date.now(),t=easeOutCubic(this._clockSlideStart?(e-this._clockSlideStart)/320:1),i=/* @__PURE__ */new Map;this._clockData.forEach((e,r)=>{const s=this._clockSlotFrom.get(e.target)??r;i.set(e.target,s+(r-s)*t)}),this._clockSlotFrom=i,this._clockSlideStart=e}_startClockDim(){null!==this._clockHoverSlot&&(this._clockDimSlot=this._clockHoverSlot);const e=null!==this._clockHoverSlot?1:0;if(this.preview||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return this._clockDim=e,0===e&&(this._clockDimSlot=null),void this._scheduleClockPaint();const t=++this._clockDimSeq,i=this._clockDim,r=performance.now(),animateDim=s=>{if(t!==this._clockDimSeq||"clock"!==this._viewMode)return;const n=Math.min(1,(s-r)/150);this._clockDim=i+(e-i)*easeOutCubic(n),this.paintClock(),n<1?requestAnimationFrame(animateDim):(this._clockDim=e,0===e&&(this._clockDimSlot=null),this.paintClock())};requestAnimationFrame(animateDim)}_registerCacheId(){const e=cacheId(this.config);if(!e)return;const t=Tt.get(e)??[];t.includes(this)||(t.push(this),Tt.set(e,t))}_unregisterCacheId(){const e=cacheId(this.config),t=e?Tt.get(e):void 0;if(!t)return;const i=t.indexOf(this);i>=0&&t.splice(i,1),0===t.length&&Tt.delete(e)}effectiveCacheId(){const e=cacheId(this.config);if(!e)return"";const t=Tt.get(e),i=t?t.indexOf(this):-1;return i>0?`${e}#${i+1}`:e}_uiStateStorageKey(){const e=this.effectiveCacheId();if(e)return`helios:ui-state:${e}`;const t=getHomeCoords(this.config,this.hass);return t?`helios:ui-state:${Math.round(1e3*t.lat)/1e3}:${Math.round(1e3*t.lon)/1e3}`:null}_restoreUiState(){if(this._uiStateRestored)return;const e=this._uiStateStorageKey();if(e){this._uiStateRestored=!0;try{const t=window.localStorage.getItem(e);if(!t)return;const i=JSON.parse(t);if(i&&"object"==typeof i){("scene"===i.viewMode||"clock"===i.viewMode||"lidar"===i.viewMode&&hasLocalLidar(this.config))&&(this._viewMode=i.viewMode);const e=["production","consumption","grid","battery","battery-soc","irradiance","cloud","custom"];if("string"==typeof i.chartTarget&&e.includes(i.chartTarget)&&(this._chartTarget=i.chartTarget),"area"!==i.clockSubMode&&"histogram"!==i.clockSubMode||(this._clockSubMode=i.clockSubMode),"string"==typeof i.timelineMode&&i.timelineMode in ze&&(this._timelineMode=i.timelineMode,this._periodPastDays=ze[this._timelineMode].pastDays,this._periodFutureDays=ze[this._timelineMode].futureDays),Array.isArray(i.clockTargets)){const t=/* @__PURE__ */new Set,r=[];for(const s of i.clockTargets)"string"==typeof s&&e.includes(s)&&!t.has(s)&&(t.add(s),r.push(s));this._clockTargets=r,r.length>0&&(this._chartTarget=r[0])}}}catch(I){}}}_persistUiState(){const e=this._uiStateStorageKey();if(e)try{window.localStorage.setItem(e,JSON.stringify({viewMode:this._viewMode,chartTarget:this._chartTarget,clockTargets:this._clockTargets,clockSubMode:this._clockSubMode,timelineMode:this._timelineMode}))}catch(I){}}_rebuildClockData(){this._clockData=this._clockTargets.map(e=>buildClockData(this,e))}_clockSlotNow(e,t){const i=this._clockSlotFrom.get(t)??e;return i+(e-i)*easeOutCubic(this._clockSlideStart?(Date.now()-this._clockSlideStart)/320:1)}_clockRingHeight(e,t){const i=this._clockGrowStart.get(e);return void 0!==i?t>=i?easeOutCubic((t-i)/320):0:this._clockReloadStart?1-easeOutCubic((t-this._clockReloadStart)/320):1}_clockAnimActive(){const e=Date.now();if(this._clockExiting.length>0)return!0;if(this._clockReloadStart)return!0;if(this._clockSlideStart&&e-this._clockSlideStart<320)return!0;for(const t of this._clockGrowStart.values())if(e-t<320)return!0;return!1}_clockAnimate(){const settle=()=>{const e=Date.now();this._clockExiting=this._clockExiting.filter(t=>e-t.start<320);for(const[t,i]of this._clockGrowStart)e-i>=320&&this._clockGrowStart.delete(t);this._clockSlideStart&&e-this._clockSlideStart>=320&&(this._clockSlideStart=0,this._clockSlotFrom.clear()),this._clockReloadStart&&e-this._clockReloadStart>12e3&&(this._clockTargets.forEach(t=>this._clockGrowStart.set(t,e)),this._clockReloadStart=0)};if(this.preview||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return this._clockExiting=[],this._clockGrowStart.clear(),this._clockSlideStart=0,this._clockReloadStart=0,this._clockSlotFrom.clear(),void this.paintClock();const e=++this._clockAnimSeq,animateClock=()=>{e===this._clockAnimSeq&&"clock"===this._viewMode&&(settle(),this.paintClock(),this._clockAnimActive()&&requestAnimationFrame(animateClock))};requestAnimationFrame(animateClock)}_scheduleClockPaint(){requestAnimationFrame(()=>this.paintClock())}paintClock(){if("clock"!==this._viewMode)return;const e=this._clockSvg,t=this._engine?._renderer?.camera;if(!e||!t||!t.hasViewport)return;const i=Date.now(),r=this._clockData.map((e,t)=>({data:e,slot:this._clockSlotNow(t,e.target),heightScale:this._clockRingHeight(e.target,i),opacity:1}));for(const n of this._clockExiting){const e=easeOutCubic((i-n.start)/320);r.push({data:n.data,slot:n.slot,heightScale:n.h0*(1-e),opacity:1-e})}const s=projectClockFrame(t,r,this._clockSubMode,this._clockDimSlot,this._clockDim);e.innerHTML=s.svg,this._clockGuideSvg&&(this._clockGuideSvg.innerHTML=s.guideSvg),this._clockHits=s.hits,this._clockLabels?.forEach((e,t)=>{const i=s.labels[t];i&&(e.style.left=`${i.x.toFixed(1)}px`,e.style.top=`${i.y.toFixed(1)}px`,e.style.opacity=i.opacity.toFixed(3),e.style.transform=i.transform)}),this._clockCompassLabels?.forEach((e,t)=>{const i=s.compass[t];i&&(e.style.left=`${i.x.toFixed(1)}px`,e.style.top=`${i.y.toFixed(1)}px`,e.style.transform=i.transform)})}_formatClockHour(e){return function formatHaTime(e,t){const i=e?.locale,r={hour:"numeric",minute:"2-digit",hour12:haUseAmPm(i)};try{return new Intl.DateTimeFormat(i?.language,r).format(t)}catch(I){return new Intl.DateTimeFormat(void 0,r).format(t)}}(this.hass,new Date(2e3,0,1,e))}_renderClockSubModeToggle(){return U`
            <div
                class="clock-submode mode-${this._clockSubMode}"
                role="button"
                tabindex="0"
                aria-label=${"area"===this._clockSubMode?"Area curve":"Histogram"}
                @click=${this._toggleClockSubMode}
                @keydown=${this._onSubModeKeydown}
            >
                <span class="cs-knob"></span>
                <ha-icon class="cs-opt cs-histogram" icon="mdi:chart-bar"></ha-icon>
                <ha-icon class="cs-opt cs-area" icon="mdi:chart-areaspline"></ha-icon>
            </div>
        `}_renderClockTooltip(e){if(0===this._clockData.length)return G;const t=this._clockSubMode,fmtSlot=e=>`${String(Math.floor(e/4)%24).padStart(2,"0")}:${String(e%4*15).padStart(2,"0")}`,i=Math.floor(e/4);return U`
            <div class="clock-tip">
                <div class="clock-tip-head">${"histogram"===t?`${String(i).padStart(2,"0")}:00 – ${String((i+1)%24).padStart(2,"0")}:00`:`${fmtSlot(e)} – ${fmtSlot((e+1)%96)}`}</div>
                ${this._clockData.map(i=>{const r=clockTargetMeta(this,i.target);if(i.layers.length>1){const r=i.layers.map(r=>({l:r,v:clockLayerValue(r,i,t,e)})).filter(e=>e.v>0);if(r.length>0)return U`${r.map(({l:e,v:t})=>U`
                                <div class="clock-tip-row">
                                    <ha-icon icon=${e.icon} style="color:${e.color}"></ha-icon>
                                    <span class="clock-tip-val">${formatClockValue(this,i,t)}</span>
                                </div>
                            `)}`}return U`
                        <div class="clock-tip-row">
                            <ha-icon icon=${r.icon} style="color:${r.color}"></ha-icon>
                            <span class="clock-tip-val">${formatClockValue(this,i,function clockTotal(e,t,i){return e.layers.reduce((r,s)=>r+clockLayerValue(s,e,t,i),0)}(i,t,e))}</span>
                        </div>
                    `})}
            </div>
        `}},kt=xt,xt.OUTLINE_FAR=1.5,xt.OUTLINE_NEAR=5,xt.SEGMENT_FAR=1,xt.SEGMENT_NEAR=4,xt.SUN_R_FAR=10,xt.SUN_R_NEAR=20,xt.SUN_RIM_WIDTH=1.5,xt.CHIP_HALF_W_PX=48,xt.CHIP_HALF_H_PX=12,xt.HOME_PILL_HALF_WIDTH_PX=38,xt.HOME_PILL_HALF_HEIGHT_PX=14,xt.SUN_FILL_OPACITY_BG=.2,xt.NIGHT_STROKE_FACTOR=.5,xt._LEGACY_ENTITY_KEYS=["pv-power-entity","grid-import-entity","grid-export-entity","grid-power-entity","grid-power-invert","battery-soc-entity","battery-power-entity","battery-power-invert","batteries"],xt.styles=[Ve,Ue,qe,Ke],xt);__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],Ct.prototype,"hass",void 0),__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],Ct.prototype,"config",void 0),__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],Ct.prototype,"preview",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_engine",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_now",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_cloudCover",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_labelLayout",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_pvCurrent",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_pvUnit",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_pvHistory",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_pvCalibStats",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_pvChangeSeries",void 0),__decorate([r$2(),__decorateMetadata("design:type",Array)],Ct.prototype,"_haSolarForecast",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_batterySoc",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_batteryPower",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_batteryPowerUnit",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_gridImportValue",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_gridImportUnit",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_gridExportValue",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_gridExportUnit",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_gridImportChangeSeries",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_gridExportChangeSeries",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_batterySocHistory",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_customEntityHistory",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_clockHourly",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_batteryPowerHistory",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_batteryChargeChangeSeries",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_batteryDischargeChangeSeries",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_sunScene",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_energyDefaults",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_haSolarTodayKwh",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_haGridImportTodayKwh",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_haGridExportTodayKwh",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_haBatteryChargedKwh",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_haBatteryDischargedKwh",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_homeHover",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_chartHoverPct",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_chartTarget",void 0),__decorate([r$2(),__decorateMetadata("design:type",String)],Ct.prototype,"_viewMode",void 0),__decorate([r$2(),__decorateMetadata("design:type",Array)],Ct.prototype,"_clockTargets",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_clockSubMode",void 0),__decorate([r$2(),__decorateMetadata("design:type",Array)],Ct.prototype,"_clockData",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_clockHoverSlot",void 0),__decorate([e$3("ha-card"),__decorateMetadata("design:type","undefined"==typeof HTMLElement?Object:HTMLElement)],Ct.prototype,"_haCard",void 0),__decorate([e$3(".clock-svg"),__decorateMetadata("design:type","undefined"==typeof SVGSVGElement?Object:SVGSVGElement)],Ct.prototype,"_clockSvg",void 0),__decorate([e$3(".clock-guide-svg"),__decorateMetadata("design:type","undefined"==typeof SVGSVGElement?Object:SVGSVGElement)],Ct.prototype,"_clockGuideSvg",void 0),__decorate([r$1(".clock-hour-label"),__decorateMetadata("design:type","undefined"==typeof NodeListOf?Object:NodeListOf)],Ct.prototype,"_clockLabels",void 0),__decorate([r$1(".clock-compass-label"),__decorateMetadata("design:type","undefined"==typeof NodeListOf?Object:NodeListOf)],Ct.prototype,"_clockCompassLabels",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_chartSeries",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_timeRange",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_selectedTime",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_isLiveMode",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_timelineMode",void 0),__decorate([r$2(),__decorateMetadata("design:type",Object)],Ct.prototype,"_unifiedStore",void 0),Ct=kt=__decorate([t$2("helios-card")],Ct);export{Ct as HeliosCard};