var e,t=globalThis,i=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,r=Symbol(),o=/* @__PURE__ */new WeakMap,n=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==r)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(i&&void 0===e){const i=void 0!==t&&1===t.length;i&&(e=o.get(t)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&o.set(t,e))}return e}toString(){return this.cssText}},r$5=e=>new n("string"==typeof e?e:e+"",void 0,r),i$6=(e,...t)=>new n(1===e.length?e[0]:t.reduce((t,i,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+e[r+1],e[0]),e,r),s=i?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const i of e.cssRules)t+=i.cssText;return r$5(t)})(e):e,{is:l,defineProperty:c,getOwnPropertyDescriptor:d,getOwnPropertyNames:u,getOwnPropertySymbols:p,getPrototypeOf:g}=Object,m=globalThis,f=m.trustedTypes,y=f?f.emptyScript:"",b=m.reactiveElementPolyfillSupport,d$2=(e,t)=>e,v={toAttribute(e,t){switch(t){case Boolean:e=e?y:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let i=e;switch(t){case Boolean:i=null!==e;break;case Number:i=null===e?null:Number(e);break;case Object:case Array:try{i=JSON.parse(e)}catch(e){i=null}}return i}},f$2=(e,t)=>!l(e,t),_={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:f$2};(e=Symbol).metadata??(e.metadata=Symbol("metadata")),m.litPropertyMetadata??(m.litPropertyMetadata=/* @__PURE__ */new WeakMap);var w=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=_){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const i=Symbol(),r=this.getPropertyDescriptor(e,i,t);void 0!==r&&c(this.prototype,e,r)}}static getPropertyDescriptor(e,t,i){const{get:r,set:o}=d(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){const n=r?.call(this);o?.call(this,t),this.requestUpdate(e,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??_}static _$Ei(){if(this.hasOwnProperty(d$2("elementProperties")))return;const e=g(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(d$2("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(d$2("properties"))){const e=this.properties,t=[...u(e),...p(e)];for(const i of t)this.createProperty(i,e[i])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,i]of t)this.elementProperties.set(e,i)}this._$Eh=/* @__PURE__ */new Map;for(const[t,i]of this.elementProperties){const e=this._$Eu(t,i);void 0!==e&&this._$Eh.set(e,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const e of i)t.unshift(s(e))}else void 0!==e&&t.push(s(e));return t}static _$Eu(e,t){const i=t.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=/* @__PURE__ */new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??(this._$EO=/* @__PURE__ */new Set)).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=/* @__PURE__ */new Map,t=this.constructor.elementProperties;for(const i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((e,r)=>{if(i)e.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const i of r){const r=document.createElement("style"),o=t.litNonce;void 0!==o&&r.setAttribute("nonce",o),r.textContent=i.cssText,e.appendChild(r)}})(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){const i=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,i);if(void 0!==r&&!0===i.reflect){const o=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(t,i.type);this._$Em=e,null==o?this.removeAttribute(r):this.setAttribute(r,o),this._$Em=null}}_$AK(e,t){const i=this.constructor,r=i._$Eh.get(e);if(void 0!==r&&this._$Em!==r){const e=i.getPropertyOptions(r),o="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:v;this._$Em=r;const n=o.fromAttribute(t,e.type);this[r]=n??this._$Ej?.get(r)??n,this._$Em=null}}requestUpdate(e,t,i,r=!1,o){if(void 0!==e){const n=this.constructor;if(!1===r&&(o=this[e]),i??(i=n.getPropertyOptions(e)),!((i.hasChanged??f$2)(o,t)||i.useDefault&&i.reflect&&o===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,i))))return;this.C(e,t,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:r,wrapped:o},n){i&&!(this._$Ej??(this._$Ej=/* @__PURE__ */new Map)).has(e)&&(this._$Ej.set(e,n??t??this[e]),!0!==o||void 0!==n)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??(this._$Eq=/* @__PURE__ */new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,i]of e){const{wrapped:e}=i,r=this[t];!0!==e||this._$AL.has(t)||void 0===r||this.C(t,void 0,i,r)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=/* @__PURE__ */new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(e){}firstUpdated(e){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[d$2("elementProperties")]=/* @__PURE__ */new Map,w[d$2("finalized")]=/* @__PURE__ */new Map,b?.({ReactiveElement:w}),(m.reactiveElementVersions??(m.reactiveElementVersions=[])).push("2.1.2");var $=globalThis,i$4=e=>e,M=$.trustedTypes,T=M?M.createPolicy("lit-html",{createHTML:e=>e}):void 0,C="$lit$",F=`lit$${Math.random().toFixed(9).slice(2)}$`,A="?"+F,H=`<${A}>`,E=document,c$1=()=>E.createComment(""),a=e=>null===e||"object"!=typeof e&&"function"!=typeof e,D=Array.isArray,d$1=e=>D(e)||"function"==typeof e?.[Symbol.iterator],R="[ \t\n\f\r]",L=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,P=/-->/g,I=/>/g,O=RegExp(`>|${R}(?:([^\\s"'>=/]+)(${R}*=${R}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),z=/'/g,W=/"/g,j=/^(?:script|style|textarea|title)$/i,x=e=>(t,...i)=>({_$litType$:e,strings:t,values:i}),U=x(1),B=x(2),q=(x(3),Symbol.for("lit-noChange")),K=Symbol.for("lit-nothing"),G=/* @__PURE__ */new WeakMap,Y=E.createTreeWalker(E,129);function V(e,t){if(!D(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==T?T.createHTML(t):t}var N=(e,t)=>{const i=e.length-1,r=[];let o,n=2===t?"<svg>":3===t?"<math>":"",s=L;for(let l=0;l<i;l++){const t=e[l];let i,c,d=-1,u=0;for(;u<t.length&&(s.lastIndex=u,c=s.exec(t),null!==c);)u=s.lastIndex,s===L?"!--"===c[1]?s=P:void 0!==c[1]?s=I:void 0!==c[2]?(j.test(c[2])&&(o=RegExp("</"+c[2],"g")),s=O):void 0!==c[3]&&(s=O):s===O?">"===c[0]?(s=o??L,d=-1):void 0===c[1]?d=-2:(d=s.lastIndex-c[2].length,i=c[1],s=void 0===c[3]?O:'"'===c[3]?W:z):s===W||s===z?s=O:s===P||s===I?s=L:(s=O,o=void 0);const p=s===O&&e[l+1].startsWith("/>")?" ":"";n+=s===L?t+H:d>=0?(r.push(i),t.slice(0,d)+C+t.slice(d)+F+p):t+F+(-2===d?l:p)}return[V(e,n+(e[i]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),r]},X=class S{constructor({strings:e,_$litType$:t},i){let r;this.parts=[];let o=0,n=0;const s=e.length-1,l=this.parts,[c,d]=N(e,t);if(this.el=S.createElement(c,i),Y.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(r=Y.nextNode())&&l.length<s;){if(1===r.nodeType){if(r.hasAttributes())for(const e of r.getAttributeNames())if(e.endsWith(C)){const t=d[n++],i=r.getAttribute(e).split(F),s=/([.?@])?(.*)/.exec(t);l.push({type:1,index:o,name:s[2],strings:i,ctor:"."===s[1]?ee:"?"===s[1]?te:"@"===s[1]?ie:Q}),r.removeAttribute(e)}else e.startsWith(F)&&(l.push({type:6,index:o}),r.removeAttribute(e));if(j.test(r.tagName)){const e=r.textContent.split(F),t=e.length-1;if(t>0){r.textContent=M?M.emptyScript:"";for(let i=0;i<t;i++)r.append(e[i],c$1()),Y.nextNode(),l.push({type:2,index:++o});r.append(e[t],c$1())}}}else if(8===r.nodeType)if(r.data===A)l.push({type:2,index:o});else{let e=-1;for(;-1!==(e=r.data.indexOf(F,e+1));)l.push({type:7,index:o}),e+=F.length-1}o++}}static createElement(e,t){const i=E.createElement("template");return i.innerHTML=e,i}};function M$1(e,t,i=e,r){if(t===q)return t;let o=void 0!==r?i._$Co?.[r]:i._$Cl;const n=a(t)?void 0:t._$litDirective$;return o?.constructor!==n&&(o?._$AO?.(!1),void 0===n?o=void 0:(o=new n(e),o._$AT(e,i,r)),void 0!==r?(i._$Co??(i._$Co=[]))[r]=o:i._$Cl=o),void 0!==o&&(t=M$1(e,o._$AS(e,t.values),o,r)),t}var Z=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:i}=this._$AD,r=(e?.creationScope??E).importNode(t,!0);Y.currentNode=r;let o=Y.nextNode(),n=0,s=0,l=i[0];for(;void 0!==l;){if(n===l.index){let t;2===l.type?t=new J(o,o.nextSibling,this,e):1===l.type?t=new l.ctor(o,l.name,l.strings,this,e):6===l.type&&(t=new re(o,this,e)),this._$AV.push(t),l=i[++s]}n!==l?.index&&(o=Y.nextNode(),n++)}return Y.currentNode=E,r}p(e){let t=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}},J=class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,r){this.type=2,this._$AH=K,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=M$1(this,e,t),a(e)?e===K||null==e||""===e?(this._$AH!==K&&this._$AR(),this._$AH=K):e!==this._$AH&&e!==q&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):d$1(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==K&&a(this._$AH)?this._$AA.nextSibling.data=e:this.T(E.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:i}=e,r="number"==typeof i?this._$AC(e):(void 0===i.el&&(i.el=X.createElement(V(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===r)this._$AH.p(t);else{const e=new Z(r,this),i=e.u(this.options);e.p(t),this.T(i),this._$AH=e}}_$AC(e){let t=G.get(e.strings);return void 0===t&&G.set(e.strings,t=new X(e)),t}k(e){D(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let i,r=0;for(const o of e)r===t.length?t.push(i=new k(this.O(c$1()),this.O(c$1()),this,this.options)):i=t[r],i._$AI(o),r++;r<t.length&&(this._$AR(i&&i._$AB.nextSibling,r),t.length=r)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=i$4(e).nextSibling;i$4(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}},Q=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,r,o){this.type=1,this._$AH=K,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=o,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(/* @__PURE__ */new String),this.strings=i):this._$AH=K}_$AI(e,t=this,i,r){const o=this.strings;let n=!1;if(void 0===o)e=M$1(this,e,t,0),n=!a(e)||e!==this._$AH&&e!==q,n&&(this._$AH=e);else{const r=e;let s,l;for(e=o[0],s=0;s<o.length-1;s++)l=M$1(this,r[i+s],t,s),l===q&&(l=this._$AH[s]),n||(n=!a(l)||l!==this._$AH[s]),l===K?e=K:e!==K&&(e+=(l??"")+o[s+1]),this._$AH[s]=l}n&&!r&&this.j(e)}j(e){e===K?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},ee=class extends Q{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===K?void 0:e}},te=class extends Q{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==K)}},ie=class extends Q{constructor(e,t,i,r,o){super(e,t,i,r,o),this.type=5}_$AI(e,t=this){if((e=M$1(this,e,t,0)??K)===q)return;const i=this._$AH,r=e===K&&i!==K||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,o=e!==K&&(i===K||r);r&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},re=class{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){M$1(this,e)}},oe={M:C,P:F,A:A,C:1,L:N,R:Z,D:d$1,V:M$1,I:J,H:Q,N:te,U:ie,B:ee,F:re},ae=$.litHtmlPolyfillSupport;ae?.(X,J),($.litHtmlVersions??($.litHtmlVersions=[])).push("3.3.2");var ne=globalThis,se=class extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,i)=>{const r=i?.renderBefore??t;let o=r._$litPart$;if(void 0===o){const e=i?.renderBefore??null;r._$litPart$=o=new J(t.insertBefore(c$1(),e),e,void 0,i??{})}return o._$AI(e),o})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return q}};se._$litElement$=!0,se.finalized=!0,ne.litElementHydrateSupport?.({LitElement:se});var le=ne.litElementPolyfillSupport;le?.({LitElement:se}),(ne.litElementVersions??(ne.litElementVersions=[])).push("4.2.2");var t$2=e=>(t,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)},ce={attribute:!0,type:String,converter:v,reflect:!1,hasChanged:f$2},r$2=(e=ce,t,i)=>{const{kind:r,metadata:o}=i;let n=globalThis.litPropertyMetadata.get(o);if(void 0===n&&globalThis.litPropertyMetadata.set(o,n=/* @__PURE__ */new Map),"setter"===r&&((e=Object.create(e)).wrapped=!0),n.set(i.name,e),"accessor"===r){const{name:r}=i;return{set(i){const o=t.get.call(this);t.set.call(this,i),this.requestUpdate(r,o,e,!0,i)},init(t){return void 0!==t&&this.C(r,void 0,e,t),t}}}if("setter"===r){const{name:r}=i;return function(i){const o=this[r];t.call(this,i),this.requestUpdate(r,o,e,!0,i)}}throw Error("Unsupported decorator location: "+r)};function n$1(e){return(t,i)=>"object"==typeof i?r$2(e,t,i):((e,t,i)=>{const r=t.hasOwnProperty(i);return t.constructor.createProperty(i,e),r?Object.getOwnPropertyDescriptor(t,i):void 0})(e,t,i)}function r$1(e){return n$1({...e,state:!0,attribute:!1})}var he=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,i){this._$Ct=e,this._$AM=t,this._$Ci=i}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}},{I:de}=oe,ue={},pe=(e=>(...t)=>({_$litDirective$:e,values:t}))(class extends he{constructor(){super(...arguments),this.key=K}render(e,t){return this.key=e,t}update(e,[t,i]){return t!==this.key&&(((e,t=ue)=>{e._$AH=t})(e),this.key=t),i}}),ge=36e5,me=864e5,fe=Math.PI/180,ye=.25,be=[3e5,9e5,36e5],ve=[6e4,3e5,9e5,36e5],_e=6e4,we=9e5,xe=["https://overpass-api.de/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter"],Se=.95047,$e=1.08883,ke=.137931034,Me=.12841855,Te=1200,Ce=class{constructor(){this.bearingDeg=180,this.tiltDeg=50,this.pxPerMetre=1,this.centreX=0,this.centreY=0,this._cosB=Math.cos(180*fe),this._sinB=Math.sin(180*fe),this._cosT=Math.cos(50*fe),this._sinT=Math.sin(50*fe)}setPose(e,t){this.bearingDeg=e,this.tiltDeg=Math.min(65,Math.max(5,t))}setViewport(e,t){const i=this.tiltDeg*fe,r=this.bearingDeg*fe;this.centreX=e/2,this.centreY=t/2,this._cosB=Math.cos(r),this._sinB=Math.sin(r),this._cosT=Math.cos(i),this._sinT=Math.sin(i)}project3(e,t,i){const r=e*this.pxPerMetre,o=-t*this.pxPerMetre,n=i*this.pxPerMetre,s=r*this._cosB-o*this._sinB,l=r*this._sinB+o*this._cosB,c=l*this._sinT+n*this._cosT,d=Te/Math.max(Te-c,180);return{x:this.centreX+s*d,y:this.centreY+(l*this._cosT-n*this._sinT)*d,depth:c}}project(e,t,i){const r=this.project3(e,t,i);return[r.x,r.y]}groundTransform(e,t){return{transformOrigin:`${e}px ${t}px`,transform:`translate(${(this.centreX-e).toFixed(2)}px, ${(this.centreY-t).toFixed(2)}px) rotateX(${this.tiltDeg}deg) rotateZ(${this.bearingDeg}deg)`}}};function tileUrl(e,t,i,r){return`https://${"abcd"[(e+t)%4]}.basemaps.cartocdn.com/rastertiles/${r?"dark_nolabels":"light_nolabels"}/${i}/${e}/${t}.png`}async function buildGround(e,t,i,r=18){const[o,n]=function lonLatToTile(e,t,i){const r=2**i,o=t*fe;return[(e+180)/360*r,(1-Math.log(Math.tan(o)+1/Math.cos(o))/Math.PI)/2*r]}(t,e,r),s=Math.floor(o)-3,l=Math.floor(n)-3,c=1792,d=256*(o-s),u=256*(n-l),p=document.createElement("canvas");p.width=c,p.height=c,p.className="ground";const g=p.getContext("2d");if(g){const e=[];for(let t=0;t<7;t++)for(let o=0;o<7;o++){const n=s+t,c=l+o;e.push(new Promise(e=>{const s=new Image;s.onload=()=>{g.drawImage(s,256*t,256*o,256,256),e()},s.onerror=()=>e(),s.referrerPolicy="no-referrer",s.src=tileUrl(n,c,r,i)}))}await Promise.all(e)}const m=document.createElement("div");return m.className="ground-fade",m.style.width="1792px",m.style.height="1792px",{el:p,fade:m,homeX:d,homeY:u,size:c}}function pointsAttr(e){return e.map(e=>`${e[0].toFixed(1)},${e[1].toFixed(1)}`).join(" ")}var lerp=(e,t,i)=>e+(t-e)*i,hexByte=(e,t)=>parseInt(e.slice(t,t+2),16);function mixHex(e,t,i){let r="#";for(let o=1;o<7;o+=2){const n=hexByte(e,o);r+=Math.round(n+(hexByte(t,o)-n)*i).toString(16).padStart(2,"0")}return r}function tintedRgba(e,t,i){const r=function buildingColor(e,t){if(t<-6)return mixHex(e,"#0a0e1a",.85);const i=mixHex(e,"#0a0e1a",.85),r=mixHex(e,"#2a2540",.55),o=mixHex(e,"#5a3220",.35);return t<0?mixHex(i,r,(t+6)/6):t<6?mixHex(r,o,t/6):t<20?mixHex(o,e,(t-6)/14):e}(e,t);return`rgba(${hexByte(r,1)},${hexByte(r,3)},${hexByte(r,5)},${i})`}var arcColor=(e,t)=>e<=0?"#3a4a63":e<12?mixHex(t,"#ff6a00",.5):t;function osmHeightM(e){if(!e)return null;const t=parseFloat(e.height);if(Number.isFinite(t)&&t>0)return t;const i=parseFloat(e["building:levels"]);return Number.isFinite(i)&&i>0?3*i:null}function distanceToHome(e){if(function pointInPolygon(e,t,i){let r=!1;for(let o=0,n=i.length-1;o<i.length;n=o++){const[s,l]=i[o],[c,d]=i[n];l>t!=d>t&&e<(c-s)*(t-l)/(d-l)+s&&(r=!r)}return r}(0,0,e))return 0;let t=1/0;for(let i=0,r=e.length-1;i<e.length;r=i++){const[o,n]=e[r],s=e[i][0]-o,l=e[i][1]-n,c=s*s+l*l,d=c?Math.max(0,Math.min(1,(-o*s-n*l)/c)):0;t=Math.min(t,Math.hypot(o+d*s,n+d*l))}return t}function parseRawBuildings(e,t,i){const r=111320*Math.cos(t*fe),o=[],n=[];for(const s of e)if("way"===s.type&&s.geometry)n.push({geometry:s.geometry,tags:s.tags});else if("relation"===s.type&&s.members)for(const e of s.members)!e.geometry||"outer"!==e.role&&e.role||n.push({geometry:e.geometry,tags:s.tags});for(const{geometry:s,tags:l}of n){const e=s.map(e=>[(e.lon-i)*r,111320*(e.lat-t)]);if(e.length>1&&e[0][0]===e[e.length-1][0]&&e.pop(),e.length<3)continue;let n=0;for(let t=0;t<e.length;t++){const i=(t+1)%e.length;n+=e[t][0]*e[i][1]-e[i][0]*e[t][1]}n<0&&e.reverse();let c=0,d=0;for(const[t,i]of e)c+=t,d+=i;o.push({footprint:e,centerX:c/e.length,centerY:d/e.length,distanceM:distanceToHome(e),osmHeightM:osmHeightM(l)})}return o.sort((e,t)=>e.distanceM-t.distanceM),o.slice(0,100)}function simplifyFootprint(e){const t=e.length;if(t<4)return e;const i=[];for(let r=0;r<t;r++){const o=e[(r+t-1)%t],n=e[r],s=e[(r+1)%t],l=s[0]-o[0],c=s[1]-o[1],d=(n[0]-o[0])*c-(n[1]-o[1])*l;Math.abs(d)/(Math.hypot(l,c)||1)>.05&&i.push(n)}return i.length>=3?i:e}function convexHull(e){if(e.length<3)return e.slice();const t=e.slice().sort((e,t)=>e[0]-t[0]||e[1]-t[1]),cross=(e,t,i)=>(t[0]-e[0])*(i[1]-e[1])-(t[1]-e[1])*(i[0]-e[0]),i=[];for(const o of t){for(;i.length>=2&&cross(i[i.length-2],i[i.length-1],o)<=0;)i.pop();i.push(o)}const r=[];for(let o=t.length-1;o>=0;o--){const e=t[o];for(;r.length>=2&&cross(r[r.length-2],r[r.length-1],e)<=0;)r.pop();r.push(e)}return i.pop(),r.pop(),i.concat(r)}var prefersReducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,Fe=class{constructor(e,t={}){this.camera=new Ce,this._groundToken=0,this._buildings=[],this._sun={azimuth:0,altitude:0},this._growth=1,this._home={growth:1},this._homeRaf=0,this._palette={home:"#488fc2",neighbor:"#cccccc",dark:!1,sun:"#ffc107",shadow:"#000000",shadowOpacity:.32,neighborOpacity:.25},this._redrawScheduled=!1,this._rafToken=0,this._growthRaf=0,this._alive=!0,this._obsW=-1,this._obsH=-1,this._container=e,t.sun&&(this._palette.sun=t.sun),t.shadow&&(this._palette.shadow=t.shadow),null!=t.shadowOpacity&&(this._palette.shadowOpacity=t.shadowOpacity),this._groundHolder=document.createElement("div"),this._groundHolder.className="scene-ground-holder",this._sceneSvg=document.createElementNS("http://www.w3.org/2000/svg","svg"),this._sceneSvg.setAttribute("class","scene-svg"),e.appendChild(this._groundHolder),e.appendChild(this._sceneSvg),this._resizeObserver=new ResizeObserver(e=>{const t=e[e.length-1]?.contentRect;if(!t)return;const i=Math.round(t.width),r=Math.round(t.height);i===this._obsW&&r===this._obsH||(this._obsW=i,this._obsH=r,this.scheduleRedraw())}),this._resizeObserver.observe(e)}async setLocation(e,t){this._groundLat=e,this._groundLon=t,this.camera.pxPerMetre=function pxPerMetreFor(e,t=18){return 256*2**t/(40075016.686*Math.cos(e*fe))}(e);const i=++this._groundToken,r=await buildGround(e,t,this._palette.dark);this._alive&&i===this._groundToken&&(this._ground=r,this._groundHolder.replaceChildren(r.el,r.fade),this.scheduleRedraw())}setBuildings(e){this._buildings=e,this.scheduleRedraw()}setSun(e,t){this._sun={azimuth:e,altitude:t},this.scheduleRedraw()}setGrowth(e){this._growth=Math.max(0,Math.min(1,e))}animateGrowth(){if(this._growthRaf&&(cancelAnimationFrame(this._growthRaf),this._growthRaf=0),prefersReducedMotion())return this._growth=1,void this.scheduleRedraw();this._growth=0,this.scheduleRedraw();const e=performance.now(),tick=t=>{if(!this._alive)return void(this._growthRaf=0);const i=Math.min(1,(t-e)/500);this._growth=1-(1-i)**3,this.scheduleRedraw(),this._growthRaf=i<1?requestAnimationFrame(tick):0};this._growthRaf=requestAnimationFrame(tick)}setPalette(e){const t=void 0!==e.dark&&e.dark!==this._palette.dark;this._palette={...this._palette,...e},t&&void 0!==this._groundLat&&void 0!==this._groundLon&&this.setLocation(this._groundLat,this._groundLon),this.scheduleRedraw()}setHome(e,t=[]){this._home={color:e,bands:t,growth:this._home.growth??1},this.scheduleRedraw()}animateHomeTo(e,t=[]){if(this._homeRaf&&(cancelAnimationFrame(this._homeRaf),this._homeRaf=0),!this._home.color||prefersReducedMotion())return this._home={color:e,bands:t,growth:1},void this.scheduleRedraw();const i=220,r=performance.now(),tick=o=>{if(!this._alive)return void(this._homeRaf=0);const n=o-r;if(n<i){const e=n/i;this._home={...this._home,growth:1-e*e*e}}else{if(!(n<520))return this._home={color:e,bands:t,growth:1},this.scheduleRedraw(),void(this._homeRaf=0);{const r=(n-i)/300;this._home={color:e,bands:t,growth:1-(1-r)**3}}}this.scheduleRedraw(),this._homeRaf=requestAnimationFrame(tick)};this._homeRaf=requestAnimationFrame(tick)}setCameraBearing(e){this.camera.setPose(e,this.camera.tiltDeg),this.scheduleRedraw()}setCameraPitch(e){this.camera.setPose(this.camera.bearingDeg,e),this.scheduleRedraw()}getCameraBearing(){return this.camera.bearingDeg}getCameraPitch(){return this.camera.tiltDeg}scheduleRedraw(){!this._redrawScheduled&&this._alive&&(this._redrawScheduled=!0,this._rafToken=requestAnimationFrame(()=>{this._redrawScheduled=!1,this._draw()}))}_draw(){if(!this._alive)return;const e=this._obsW,t=this._obsH;if(e<=0||t<=0)return;if(this.camera.setViewport(e,t),this._ground){const{transform:e,transformOrigin:t}=this.camera.groundTransform(this._ground.homeX,this._ground.homeY);this._ground.el.style.transformOrigin=t,this._ground.el.style.transform=e,this._ground.fade.style.transformOrigin=t,this._ground.fade.style.transform=e}this._sceneSvg.setAttribute("viewBox",`0 0 ${e} ${t}`);const i=this._sun.altitude,r=function nightShade(e){return e<-12?{color:"#02040c",opacity:.68}:e<-6?{color:"#040824",opacity:lerp(.5,.68,(-e-6)/6)}:e<0?{color:"#0a1240",opacity:lerp(.5,.3,(e+6)/6)}:e<6?{color:"#3a1408",opacity:lerp(.3,.1,e/6)}:e<20?{color:"#3a1408",opacity:lerp(.1,0,(e-6)/14)}:{color:"#000000",opacity:0}}(i),o=r.opacity>0?`<rect width="${e}" height="${t}" fill="${r.color}" opacity="${r.opacity.toFixed(3)}"/>`:"";this._sceneSvg.innerHTML=o+function renderShadows(e,t,i,r,o){const n=Math.min(1,i.altitude/10);if(n<=0)return"";const s=(i.azimuth+180)*fe;let l="";for(const c of t){if(e.project3(c.centerX,c.centerY,0).depth>=1020)continue;const t=Math.min(c.height/Math.tan(i.altitude*fe),50),o=Math.sin(s)*t,n=Math.cos(s)*t,d=c.footprint.map(t=>e.project(t[0],t[1],0)),u=c.footprint.map(t=>e.project(t[0]+o,t[1]+n,0));l+=`<polygon points="${pointsAttr(convexHull([...d,...u]))}" fill="${r}"/>`}return l?`<g opacity="${(o*n).toFixed(3)}">${l}</g>`:""}(this.camera,this._buildings,this._sun,this._palette.shadow,this._palette.shadowOpacity)+function renderBuildings(e,t,i,r,o,n=.25,s={}){const l=t.map((t,i)=>{const r=e.project3(t.centerX,t.centerY,0);return{index:i,depth:r.y,cameraZ:r.depth}}).filter(e=>e.cameraZ<1020).sort((e,t)=>e.depth-t.depth),c=r.neighbor,nbRgba=e=>`rgba(${hexByte(c,1)},${hexByte(c,3)},${hexByte(c,5)},${Math.max(0,Math.min(1,e)).toFixed(3)})`,d=s.bands&&s.bands.length>=2?s.bands:null;let u="";for(const{index:p}of l){const l=t[p],c=simplifyFootprint(l.footprint),g=l.height*o*(l.isHome?s.growth??1:1),m=[0],f=[];if(l.isHome&&d){for(const e of d)m.push(Math.min(1,m[m.length-1]+e.frac)),f.push(tintedRgba(mixHex(e.color,"#000000",.22),i,.9));m[m.length-1]=1}else m.push(1),f.push(l.isHome?tintedRgba(mixHex(s.color??r.home,"#000000",.22),i,.9):nbRgba(.7*n));const y=m.map(t=>c.map(i=>e.project(i[0],i[1],g*t))),b=y[0],v=y[y.length-1],_=d?d[d.length-1].color:s.color??r.home,w=l.isHome?tintedRgba(mixHex(_,"#ffffff",.18),i,.92):nbRgba(n);let $=nbRgba(Math.min(1,1.1*n));if(l.isHome){const e=mixHex(s.color??r.home,"#ffffff",.5);$=`rgba(${hexByte(e,1)},${hexByte(e,3)},${hexByte(e,5)},0.1)`}const M=l.isHome?1:.4,T=[];for(let t=0;t<b.length;t++){const i=(t+1)%b.length,r=b[t],o=b[i],n=v[i],s=v[t];if(r[0]*o[1]-o[0]*r[1]+(o[0]*n[1]-n[0]*o[1])+(n[0]*s[1]-s[0]*n[1])+(s[0]*r[1]-r[0]*s[1])>=0)continue;let l="";for(let e=0;e<f.length;e++){const r=y[e],o=y[e+1];l+=`<polygon points="${pointsAttr([r[t],r[i],o[i],o[t]])}" fill="${f[e]}" stroke="${$}" stroke-width="${M}"/>`}const d=(c[t][0]+c[i][0])/2,u=(c[t][1]+c[i][1])/2;T.push({depth:e.project3(d,u,g/2).depth,svg:l})}T.push({depth:e.project3(l.centerX,l.centerY,g).depth,svg:`<polygon points="${pointsAttr(v)}" fill="${w}" stroke="${$}" stroke-width="${l.isHome?1:.6}"/>`}),T.sort((e,t)=>e.depth-t.depth),u+=T.map(e=>e.svg).join("")}return u}(this.camera,this._buildings,i,this._palette,this._growth,this._palette.neighborOpacity,this._home),this.onAfterDraw?.()}cleanup(){this._alive=!1,this._resizeObserver?.disconnect(),this._resizeObserver=void 0,this._rafToken&&(cancelAnimationFrame(this._rafToken),this._rafToken=0),this._growthRaf&&(cancelAnimationFrame(this._growthRaf),this._growthRaf=0),this._homeRaf&&(cancelAnimationFrame(this._homeRaf),this._homeRaf=0),this._groundHolder.remove(),this._sceneSvg.remove()}},Ae=null,He=null;function getSunPosition(e,t,i){const r=`${e.getTime()}|${t.toFixed(6)}|${i.toFixed(6)}`;if(r===Ae&&null!==He)return He;const o=Math.PI/180,n=e.getUTCHours()+e.getUTCMinutes()/60+e.getUTCSeconds()/3600,s=Math.floor((e.getTime()-Date.UTC(e.getUTCFullYear(),0,0))/864e5),l=23.45*Math.sin(o*(360/365)*(s-81)),c=o*(360/365)*(s-81);let d=15*(n+i/15+(9.87*Math.sin(2*c)-7.53*Math.cos(c)-1.5*Math.sin(c))/60-12);d=((d+180)%360+360)%360-180;const u=Math.sin(o*t)*Math.sin(o*l)+Math.cos(o*t)*Math.cos(o*l)*Math.cos(o*d),p=Math.asin(Math.max(-1,Math.min(1,u)))/o,g=Math.cos(p*o),m=g>1e-4?(Math.sin(o*l)-Math.sin(o*t)*u)/(Math.cos(o*t)*g):0;let f=Math.acos(Math.max(-1,Math.min(1,m)))/o;d>0&&(f=360-f);const y={altitude:p,azimuth:f};return Ae=r,He=y,y}function computePvPower(e,t,i,r,o,n){const s=getSunPosition(e,t,i),l=s.altitude;if(l<=0)return 0;const c=Math.PI/180,d=Math.sin(l*c),u=1098*d*Math.exp(-.059/d),p=Math.max(0,Math.min(100,r))/100,g=1-.75*Math.pow(p,3.4),m=null!=n?.ghiWm2&&n.ghiWm2>=0?n.ghiWm2:u*g;let f;if(!o||o.tiltDeg<=0&&!o.tracker)f=n?.shading?.25*m:m;else{let e=o.tiltDeg,t=o.azimuthDeg;"dual-axis"===o.tracker?(e=90-l,t=s.azimuth):"single-axis-h"===o.tracker?e=90-l:"single-axis-v"===o.tracker&&(t=s.azimuth);const i=e*c,r=(s.azimuth-t)*c,u=l*c,p=Math.sin(u)*Math.cos(i)+Math.cos(u)*Math.sin(i)*Math.cos(r),y=p>0?Math.max(0,p)/Math.max(.087,d):0;let b;b=null!=n?.directWm2&&n.directWm2>=0&&null!=n?.diffuseWm2&&n.diffuseWm2>=0&&n.directWm2+n.diffuseWm2>0?n.directWm2/(n.directWm2+n.diffuseWm2):Math.max(0,Math.min(.85,(g-.25)/.75*.85));const v=1-b,_=n?.shading?0:m*b*y,w=m*v*(1+Math.cos(i))/2,$=.2*m*(1-Math.cos(i))/2;f=null!=n?.poaWm2&&n.poaWm2>=0?n.shading?Math.min(n.poaWm2,w+$):n.poaWm2:_+w+$}const y=Math.max(0,f/1e3);return Math.max(0,Math.min(100,100*y))}function computeIrradianceWm2(e,t,i,r){const o=getSunPosition(e,t,i).altitude;if(o<=0)return 0;const n=Math.PI/180,s=Math.sin(o*n),l=1098*s*Math.exp(-.059/s),c=Math.max(0,Math.min(100,r))/100,d=1-.75*Math.pow(c,3.4);return Math.max(0,l*d)}function medianOfNumbers(e){const t=[];for(const r of e)null==r||Number.isNaN(r)||t.push(r);if(0===t.length)return null;t.sort((e,t)=>e-t);const i=t.length>>1;return t.length%2==0?(t[i-1]+t[i])/2:t[i]}var Ee={cacheHits:0,networkFetches:0,inflightDedups:0,rateLimit429:0,otherErrors:0};var De=/* @__PURE__ */new Map;function cacheKey(e,t,i){return`helios-weather-cache:${i}:${e.toFixed(3)},${t.toFixed(3)}`}var Re=["shortwave_radiation_instant","cloud_cover","cloud_cover_low","cloud_cover_mid","cloud_cover_high","weather_code"];function readSeries(e,t,i){const r=e?.hourly?.[t];if(Array.isArray(r))return r.map(e=>null==e||Number.isNaN(e)?null:Number(e));const o=[];for(const l of i){const i=e?.hourly?.[`${t}_${l}`];Array.isArray(i)&&o.push(i.map(e=>null==e||Number.isNaN(e)?null:Number(e)))}if(0===o.length)return[];const n=Math.max(...o.map(e=>e.length)),s=new Array(n);for(let l=0;l<n;l++)s[l]=medianOfNumbers(o.map(e=>e[l]));return s}function readWeatherCode(e,t){const i=e?.hourly?.weather_code;if(Array.isArray(i))return i.map(e=>Number(e)||0);for(const r of t){const t=e?.hourly?.[`weather_code_${r}`];if(Array.isArray(t))return t.map(e=>Number(e)||0)}return[]}var fillCloud=e=>e.map(e=>null==e?0:e),fillShortwave=e=>e.map(e=>null==e?-1:e),fillNaN=e=>e.map(e=>null==e?NaN:e);async function fetchHomePointData(e,t,i,r,o){const n=Number(e.toFixed(3)),s=Number(t.toFixed(3)),l=function readCache(e,t,i){try{const r=window.localStorage?.getItem(cacheKey(e,t,i));if(!r)return null;const o=JSON.parse(r);if(Date.now()-o.storedAt>27e5)return null;if(new Date(o.storedAt).toDateString()!==/* @__PURE__ */(new Date).toDateString())return null;const n=o.payload;return n&&!Array.isArray(n)&&Array.isArray(n.times)?{lat:n.lat,lon:n.lon,times:n.times.map(e=>new Date(e)),cloudCover:n.cloudCover??[],cloudLow:n.cloudLow??[],cloudMid:n.cloudMid??[],cloudHigh:n.cloudHigh??[],weatherCode:n.weatherCode??[],shortwave:n.shortwave??[],directRad:n.directRad??[],diffuseRad:n.diffuseRad??[],snowDepth:n.snowDepth??[],temperature:n.temperature??[],windSpeed:n.windSpeed??[]}:null}catch{return null}}(n,s,r);if(l)return Ee.cacheHits++,l;const c=cacheKey(n,s,r),d=De.get(c);if(d)return Ee.inflightDedups++,d;const u=(async()=>{const e=function pickModelsForLocation(e,t,i){if("standard"===i)return["best_match"];const r="ecmwf_ifs025";return e>=41.3&&e<=51.2&&t>=-5.5&&t<=8.5?["meteofrance_seamless",r]:e>=49.5&&e<=61&&t>=-10.5&&t<=2?["ukmo_seamless",r]:e>=46&&e<=56&&t>=5&&t<=22?["dwd_icon_seamless",r]:e>=36.5&&e<=47&&t>=10&&t<=18.5?["italia_meteo_arpae_icon_2i",r]:e>=54.5&&e<=71.5&&t>=4&&t<=32?["metno_seamless",r]:e>=24.5&&e<=49.5&&t>=-125&&t<=-66.5?["gfs_seamless",r]:e>=33&&e<=39&&t>=124.5&&t<=132?["kma_seamless",r]:e>=24&&e<=46&&t>=122&&t<=146?["jma_seamless",r]:e>=-47.5&&e<=-10&&t>=112&&t<=179?["bom_access_global",r]:[r,"gfs_seamless"]}(n,s,r);let t=`https://api.open-meteo.com/v1/forecast?latitude=${n.toFixed(3)}&longitude=${s.toFixed(3)}&hourly=${Re.join(",")}&models=${e.join(",")}&past_days=5&forecast_days=3&timezone=auto`;void 0!==i&&(t+=`&elevation=${i.toFixed(0)}`);try{Ee.networkFetches++;const i=await fetch(t,{signal:o});if(!i.ok){if(429===i.status){Ee.rateLimit429++;const e=/* @__PURE__ */new Error("Open-Meteo rate limit (HTTP 429)");throw e.status=429,e}return Ee.otherErrors++,null}const l=await i.json(),c=Array.isArray(l)?l[0]:l,d=(c?.hourly?.time??[]).map(e=>new Date(e)),u=fillCloud(readSeries(c,"cloud_cover_low",e)),p=fillCloud(readSeries(c,"cloud_cover_mid",e)),g=fillCloud(readSeries(c,"cloud_cover_high",e)),m={lat:n,lon:s,times:d,cloudCover:u.map((e,t)=>{const i=Math.max(0,Math.min(100,e??0)),r=Math.max(0,Math.min(100,p[t]??0)),o=Math.max(0,Math.min(100,g[t]??0));return Math.min(100,i+.6*r+.2*o)}),cloudLow:u,cloudMid:p,cloudHigh:g,weatherCode:readWeatherCode(c,e),shortwave:fillShortwave(readSeries(c,"shortwave_radiation_instant",e)),directRad:fillShortwave(readSeries(c,"direct_radiation_instant",e)),diffuseRad:fillShortwave(readSeries(c,"diffuse_radiation_instant",e)),snowDepth:fillNaN(readSeries(c,"snow_depth",e)),temperature:fillNaN(readSeries(c,"temperature_2m",e)),windSpeed:fillNaN(readSeries(c,"wind_speed_10m",e))};return function writeCache(e,t,i,r){try{const o={storedAt:Date.now(),payload:{lat:r.lat,lon:r.lon,times:r.times.map(e=>e.toISOString()),cloudCover:r.cloudCover,cloudLow:r.cloudLow,cloudMid:r.cloudMid,cloudHigh:r.cloudHigh,weatherCode:r.weatherCode,shortwave:r.shortwave,directRad:r.directRad,diffuseRad:r.diffuseRad,snowDepth:r.snowDepth,temperature:r.temperature,windSpeed:r.windSpeed}};window.localStorage?.setItem(cacheKey(e,t,i),JSON.stringify(o))}catch{}}(n,s,r,m),m}catch(l){if(l&&"object"==typeof l&&429===l.status)throw l;return l&&"object"==typeof l&&"AbortError"!==l.name&&Ee.otherErrors++,null}})();De.set(c,u);try{return await u}finally{De.delete(c)}}function displayUpdateFrequencyPerHour(e){const t=e?.["display-update-frequency-per-hour"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 4;const r=Math.round(i);return r<1?1:r>12?12:r}function periodPastDays(e){const t=e?.["period-past-days"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 2;const r=Math.round(i);return r<0?0:r>30?30:r}function periodFutureDays(e){const t=e?.["period-future-days"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 2;const r=Math.round(i);return r<0?0:r>14?14:r}function buildingCount(e){const t=e?.["building-count"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 50;const r=Math.round(i);return r<10?10:r>100?100:r}function buildingFixedHeightM(e){const t=e?.["building-height"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 6;const r=Math.round(i);return r<3?3:r>10?10:r}function bumpStat(e){if("undefined"==typeof window)return;const t=window;t.__heliosStats||(t.__heliosStats={enginesCreated:0,enginesCleanedUp:0,updateConfigCalls:0,styleReloads:0,addBuildingsCalls:0,buildingFetchStarts:0}),t.__heliosStats[e]=(t.__heliosStats[e]??0)+1}var Le=/* @__PURE__ */new Map;var Pe=/* @__PURE__ */new Set;var Ie=class HeliosEngine{_clearWeatherTimer(){void 0!==this._weatherTimer&&(window.clearInterval(this._weatherTimer),window.clearTimeout(this._weatherTimer),this._weatherTimer=void 0)}setSolarRadiationSamples(e){if(!e||0===e.length){if(null===this._sensorIrradianceSamples)return;return this._sensorIrradianceSamples=null,this._arcInputsCache=void 0,void this._renderForCurrentSelection()}const t=[];for(const r of e){const e=r.time.getTime();isFinite(e)&&(!isFinite(r.wm2)||r.wm2<0||t.push({tMs:e,wm2:r.wm2}))}t.sort((e,t)=>e.tMs-t.tMs);const i=t.length>0?t:null;this._sensorSamplesEqual(this._sensorIrradianceSamples,i)||(this._sensorIrradianceSamples=i,this._arcInputsCache=void 0,this._renderForCurrentSelection())}_sensorSamplesEqual(e,t){if(e===t)return!0;if(null===e||null===t)return!1;if(e.length!==t.length)return!1;for(let i=0;i<e.length;i++){if(e[i].tMs!==t[i].tMs)return!1;if(e[i].wm2!==t[i].wm2)return!1}return!0}_sensorIrradianceAt(e){const t=this._sensorIrradianceSamples;if(!t||0===t.length)return null;const i=e.getTime();let r=-1,o=Number.POSITIVE_INFINITY;for(let n=0;n<t.length;n++){const e=Math.abs(t[n].tMs-i);if(e<o)o=e,r=n;else if(e>o)break}return r<0||o>HeliosEngine.SENSOR_IRRADIANCE_WINDOW_MS?null:t[r].wm2}_cameraPoseStorageKey(){return`helios:camera-pose:${Math.round(1e3*this.homeLat)/1e3}:${Math.round(1e3*this.homeLon)/1e3}`}_readStoredPose(){try{const e=window.localStorage.getItem(this._cameraPoseStorageKey());if(!e)return null;const t=JSON.parse(e);if(t&&"object"==typeof t)return t}catch{}return null}_writeStoredPose(e){try{window.localStorage.setItem(this._cameraPoseStorageKey(),JSON.stringify(e))}catch{}}_initialBearing(){const e=this._readStoredPose(),t=e&&"number"==typeof e.bearing?e.bearing:NaN,i=Number(this.cfg["camera-bearing-deg"]),r=Number.isFinite(t)?t:i;return Number.isFinite(r)?(r%360+360)%360:this.homeLat>=0?180:0}_initialPitch(){const e=this._readStoredPose(),t=e&&"number"==typeof e.pitch?e.pitch:NaN,i=Number(this.cfg["camera-pitch-deg"]),r=Number.isFinite(t)?t:i;return Number.isFinite(r)?Math.max(15,Math.min(55,r)):50}isCameraLocked(){const e=this._readStoredPose();return e&&"boolean"==typeof e.locked?e.locked:!0===this.cfg["camera-locked"]}setCameraBearing(e){if(!this._renderer||!Number.isFinite(e))return;const t=(e%360+360)%360;this._renderer.setCameraBearing(t)}setCameraPitch(e){if(!this._renderer||!Number.isFinite(e))return;const t=Math.max(15,Math.min(55,e));this._renderer.setCameraPitch(t)}setCameraLocked(e){this._renderer&&(this.cfg["camera-locked"]=e,this._writeStoredPose({bearing:this._renderer.getCameraBearing(),pitch:this._renderer.getCameraPitch(),locked:e}))}setHomeAppearance(e,t,i){this._renderer&&(i?this._renderer.animateHomeTo(e,t):this._renderer.setHome(e,t))}getDefaultBearing(){return this.homeLat>=0?180:0}getDefaultPitch(){return 50}getCameraBearing(){return this._renderer?this._renderer.getCameraBearing():this.getDefaultBearing()}getCameraPitch(){return this._renderer?this._renderer.getCameraPitch():this.getDefaultPitch()}getCameraZoom(){return 18}getViewportWidth(){return this._cachedCanvasCssW}_startAutoRotateLoop(){if(void 0!==this._autoRotateRaf||!this._renderer)return;this._autoRotateLastFrame=performance.now(),this._autoRotateLastUserAction=0,this._autoRotateBearing=this._renderer.getCameraBearing();const tick=e=>{const t=this._renderer;if(!t)return void(this._autoRotateRaf=void 0);const i=Math.max(0,e-this._autoRotateLastFrame)/1e3;this._autoRotateLastFrame=e;const r=Date.now()-this._autoRotateLastUserAction,o=!0===this.cfg["auto-rotate-enabled"],n=!0===this.cfg["camera-locked"];o&&!n?(r>=5e3?((void 0===this._autoRotateBearing||r-5e3<16)&&(this._autoRotateBearing=t.getCameraBearing()),this._autoRotateBearing-=4*i,t.setCameraBearing(this._autoRotateBearing)):this._autoRotateBearing=t.getCameraBearing(),this._autoRotateRaf=requestAnimationFrame(tick)):this._autoRotateRaf=void 0};this._autoRotateRaf=requestAnimationFrame(tick)}constructor(e,t,i,r,o=!1){this._fetchLat=0,this._fetchLon=0,this._mapReady=!1,this._homeHourlyData=null,this._selectedTime=null,this._lastAtmosphereAlt=-999,this._rateLimitStreak=0,this._otherErrorStreak=0,this._obsW=-1,this._obsH=-1,this._paused=!1,this._sensorIrradianceSamples=null,this._autoRotateLastFrame=0,this._autoRotateLastUserAction=0,this._buildingsData=null,this._buildingsRaw=null,this._buildingsLocKey="",this._selectedTimeShadowTimer=null,this._cardIsDark=!1,this._postExitCooldownUntil=0,this._anchorPtsBuf=[],this._cachedCanvasCssW=0,this._cachedCanvasCssH=0,this.homeLat=i[1],this.homeLon=i[0],this.homeElevation="number"==typeof r&&Number.isFinite(r)?r:void 0,this.cfg={...t},bumpStat("enginesCreated"),this._fetchLat=this.homeLat,this._fetchLon=this.homeLon,this._cardIsDark=o,this._initMapInstance(e,i)}_initMapInstance(e,t){this._container=e,this._renderer=new Fe(e,{sun:"#ffc107",shadow:"#000000",shadowOpacity:this._shadowOpacity()}),this._renderer.setCameraBearing(this._initialBearing()),this._renderer.setCameraPitch(this._initialPitch()),this._resolvePalette(),this._renderer.onAfterDraw=()=>{this.onMapTransform?.()},this._resizeObserver=new ResizeObserver(e=>{const t=e[e.length-1]?.contentRect;if(!t)return;const i=Math.round(t.width),r=Math.round(t.height);i===this._obsW&&r===this._obsH||(this._obsW=i,this._obsH=r,this._cachedCanvasCssW=t.width||this._cachedCanvasCssW,this._cachedCanvasCssH=t.height||this._cachedCanvasCssH,this._arcScaleMemo=void 0)}),this._resizeObserver.observe(e),this._cachedCanvasCssW=e.clientWidth||this._cachedCanvasCssW,this._cachedCanvasCssH=e.clientHeight||this._cachedCanvasCssH;try{window.__heliosEngine=this}catch(P){}this._bootstrapRenderer(),e.style.touchAction="none";let i=!1,r=0,o=0,n=null;const onDown=t=>{if(!("mouse"===t.pointerType&&0!==t.button||null!==n||this.isUserGestureSuppressed()||this.isCameraLocked())){i=!0,n=t.pointerId,r=t.clientX,o=t.clientY,this._autoRotateLastUserAction=Date.now();try{e.setPointerCapture(t.pointerId)}catch(P){}}},onMove=e=>{if(!i||!this._renderer||e.pointerId!==n)return;const t=e.clientX-r,s=e.clientY-o;r=e.clientX,o=e.clientY,this._autoRotateLastUserAction=Date.now(),this._renderer.setCameraBearing(this._renderer.getCameraBearing()-.35*t);const l=Math.max(15,Math.min(55,this._renderer.getCameraPitch()-.3*s));this._renderer.setCameraPitch(l)},onEnd=t=>{if(t.pointerId===n){i=!1,n=null;try{e.releasePointerCapture(t.pointerId)}catch(P){}}};e.addEventListener("pointerdown",onDown),e.addEventListener("pointermove",onMove),e.addEventListener("pointerup",onEnd),e.addEventListener("pointercancel",onEnd),this._dragRotateHandlers={canvas:e,onDown:onDown,onMove:onMove,onEnd:onEnd},this._refreshWeather()}async _bootstrapRenderer(){const e=this._renderer;if(e){try{await e.setLocation(this.homeLat,this.homeLon)}catch(t){console.warn("[HELIOS] Scene basemap failed to load:",t)}this._renderer===e&&this._onRendererReady()}}_onRendererReady(){this._renderer&&(this._mapReady=!0,this._applyBuildings(),this._ensureBuildings(),window.clearInterval(this._skyTimer),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere(),this._skyTimer=window.setInterval(()=>{this._paused||this._refreshShadowsAndAtmosphere()},6e4),this._startAutoRotateLoop(),this._homeHourlyData&&this._renderForCurrentSelection())}_cssHex(e,t){const i=this._container?getComputedStyle(this._container).getPropertyValue(e).trim():"";if(/^#[0-9a-f]{6}$/i.test(i))return i;if(/^#[0-9a-f]{3}$/i.test(i))return"#"+i.slice(1).split("").map(e=>e+e).join("");const r=i.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);if(r){const h=e=>Math.max(0,Math.min(255,Math.round(parseFloat(e)))).toString(16).padStart(2,"0");return"#"+h(r[1])+h(r[2])+h(r[3])}return t}_resolvePalette(){this._renderer?.setPalette({dark:this._cardIsDark,home:this._cssHex("--energy-grid-consumption-color","#488fc2"),neighbor:this._cssHex("--primary-text-color","#dddddd"),sun:this._cssHex("--warning-color","#ffc107"),shadow:this._cssHex("--shadow-color","#000000"),shadowOpacity:this._shadowsEnabled()?this._shadowOpacity():0,neighborOpacity:this._buildingOpacity()})}setCardThemeIsDark(e){this._cardIsDark!==e&&(this._cardIsDark=e,this._resolvePalette())}_shadowsEnabled(){return!1!==this.cfg["shadows-enabled"]}_shadowOpacity(){const e=Number(this.cfg["shadow-opacity"]);return Number.isFinite(e)?Math.max(0,Math.min(1,e)):.32}_findHourIndex(e){const t=this._homeHourlyData;if(!t||!t.times.length)return 0;const i=e.getTime(),r=t.times;let o=0,n=Math.abs(r[0].getTime()-i);for(let s=1;s<r.length;s++){const e=Math.abs(r[s].getTime()-i);if(e<n)n=e,o=s;else if(e>n)break}return o}_getWeatherAtTime(e){const t={cloudCover:0,cloudLow:0,cloudMid:0,cloudHigh:0,shortwave:-1,temperatureC:NaN,windMs:NaN,cloudIntensity:"clear"},i=this._homeHourlyData;if(!i||!i.times.length)return t;const r=this._findHourIndex(e);if(r<0||r>=i.times.length)return t;const o=i.cloudCover[r]??0,n=i.cloudLow[r]??0,s=i.cloudMid[r]??0,l=i.cloudHigh[r]??0,c=i.shortwave[r]??-1,d=i.weatherCode[r]??0;return{cloudCover:o,cloudLow:n,cloudMid:s,cloudHigh:l,shortwave:c,temperatureC:i.temperature[r]??NaN,windMs:i.windSpeed[r]??NaN,cloudIntensity:(u=d,p=o,u>=95?"storm":u>=45&&u<=48?"fog":u>=61&&u<=67||u>=71&&u<=77||u>=80?"heavy":u>=51?"moderate":p<15?"clear":p<50?"light":p<80?"moderate":"heavy")};var u,p}getTimelineRange(){return this._getTimeRange()}setPeriodDays(e,t){this._periodPastDays=e,this._periodFutureDays=t}_getTimeRange(){const e=this._periodPastDays??periodPastDays(this.cfg),t=this._periodFutureDays??periodFutureDays(this.cfg),i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const r=i.getTime()-24*e*36e5,o=i.getTime()+24*(t+1)*36e5;return{start:new Date(r),end:new Date(o)}}_renderForCurrentSelection(){if(!this._renderer)return;const e=this._selectedTime??/* @__PURE__ */new Date,t=this._getWeatherAtTime(e),i=computePvPower(e,this.homeLat,this.homeLon,t.cloudCover);let r=-1;t.shortwave>=0&&(r=Math.max(0,Math.min(100,t.shortwave/1e3*100)));const o=this._sensorIrradianceAt(e),n=null!==o?Math.max(0,Math.min(100,o/1e3*100)):-1;let s,l;n>=0?(s=n,l="sensor"):r>=0?(s=r,l="shortwave"):(s=i,l="haurwitz"),this.onWeatherUpdate?.({cloudCover:t.cloudCover,cloudLow:t.cloudLow,cloudMid:t.cloudMid,cloudHigh:t.cloudHigh,cloudIntensity:t.cloudIntensity,timeRange:this._getTimeRange(),isLiveTime:null===this._selectedTime,pvPower:s,pvPowerHaurwitz:i,pvPowerShortwave:r,irradianceSource:l,temperatureC:t.temperatureC,windMs:t.windMs})}_buildingRadiusMeters(){return function displayRadiusM(e){const t=e?.["display-radius"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 200;const r=Math.round(i);return r<0?0:r>500?500:r}(this.cfg)}_buildingOpacity(){const e=Number(this.cfg["building-opacity"]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):.25}_buildingClusterRadiusMeters(){const e=Number(this.cfg["building-cluster-radius"]);return!Number.isFinite(e)||e<0?0:Math.min(100,e)}_buildingColor(){return this._cssHex("--primary-text-color","#cccccc")}_buildingsLocationKey(){return`${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}`}_ensureBuildings(){if(!this._renderer)return;const e=this._buildingsLocationKey();if(this._buildingsRaw&&this._buildingsLocKey===e)return void this._applyBuildings();const t=function sharedBuildingsCacheGet(e){const t=Le.get(e);return t?Date.now()-t.ts>18e5?(Le.delete(e),null):t.data:null}(e);if(t)return this._buildingsRaw=t,this._buildingsLocKey=e,this._applyBuildings(),this._lastAtmosphereAlt=-999,void this._refreshShadowsAndAtmosphere();this._buildingsAbort?.abort();const i=new AbortController;this._buildingsAbort=i,bumpStat("buildingFetchStarts");try{this.onBuildingsFetchStart?.()}catch(P){}(async function fetchRawBuildings(e,t,i){const r=e,o=t,n=Math.round(500),s=function cacheKey$1(e,t){return`helios-bld2:${e.toFixed(4)}:${t.toFixed(4)}`}(r,o);try{const e=localStorage.getItem(s),t=e?JSON.parse(e):null;if(t?.buildings?.length&&Date.now()-t.time<2592e6)return t.buildings}catch(P){}const l=`[out:json][timeout:25];(way["building"](around:${n},${r},${o});relation["building"](around:${n},${r},${o}););out geom;`;for(const d of xe)try{const e=await fetch(d+"?data="+encodeURIComponent(l),{referrerPolicy:"no-referrer",signal:i});if(!e.ok)throw new Error(String(e.status));const t=parseRawBuildings((await e.json()).elements??[],r,o);if(t.length){try{localStorage.setItem(s,JSON.stringify({time:Date.now(),buildings:t}))}catch(P){}return t}}catch(c){if("AbortError"===c?.name)throw c;await new Promise(e=>{setTimeout(e,1200)})}return[]})(this.homeLat,this.homeLon,i.signal).then(t=>{!i.signal.aborted&&this._renderer&&(this._buildingsRaw=t,this._buildingsLocKey=e,Le.set(e,{data:t,ts:Date.now()}),this._applyBuildings(),this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere())}).catch(e=>{"AbortError"!==e?.name&&console.warn("[HELIOS] Buildings fetch failed:",e)}).finally(()=>{try{this.onBuildingsFetchEnd?.()}catch(P){}})}_applyBuildings(){var e;this._renderer&&(this._buildingsData=function interpretBuildings(e,t){if(0===e.length)return[{footprint:[[-5,-4],[5,-4],[5,4],[-5,4]],height:6,isHome:!0,centerX:0,centerY:0}];let i=e.filter(e=>e.distanceM<=t.radiusM);0===i.length&&(i=[e[0]]),i=i.slice(0,Math.max(0,t.count)),0===i.length&&(i=[e[0]]);const r=i.map(e=>({footprint:e.footprint,height:t.realSize?Math.min(25,e.osmHeightM??6):t.fixedHeightM,isHome:!1,centerX:e.centerX,centerY:e.centerY}));r[0].isHome=!0;const o=r[0],n=Math.max(0,t.clusterRadiusM);if(n>0)for(let s=0;s<r.length;s++){if(0===s)continue;const e=r[s].centerX-o.centerX,t=r[s].centerY-o.centerY;Math.hypot(e,t)<=n&&(r[s].isHome=!0)}return r}(this._buildingsRaw??[],{radiusM:this._buildingRadiusMeters(),count:buildingCount(this.cfg),realSize:(e=this.cfg,!1!==e?.["building-real-size"]),fixedHeightM:buildingFixedHeightM(this.cfg),clusterRadiusM:this._buildingClusterRadiusMeters()}),this._pushRenderableSources())}_pushRenderableSources(){if(!this._renderer)return;const e=this._buildingsData??[];this._renderer.setBuildings(e);const t=this._buildingsLocationKey();e.length&&!Pe.has(t)&&(Pe.add(t),this._renderer.animateGrowth())}_refreshShadowsAndAtmosphere(){if(!this._renderer)return;const{altitude:e,azimuth:t}=getSunPosition(this._selectedTime??/* @__PURE__ */new Date,this.homeLat,this.homeLon);Math.abs(e-this._lastAtmosphereAlt)<1.5||(this._lastAtmosphereAlt=e,this._renderer.setPalette({shadowOpacity:this._shadowsEnabled()?this._shadowOpacity():0}),this._renderer.setSun(t,e))}_resolvedPrecision(){return"high"}async _refreshWeather(e,t){const i=e??this.homeLat,r=t??this.homeLon;this._fetchAbortController?.abort(),this._fetchAbortController=new AbortController;const o=this._fetchAbortController.signal;this._clearWeatherTimer(),this.onFetchStart?.();try{const e=this._resolvedPrecision();this._homeHourlyData=await fetchHomePointData(i,r,this.homeElevation,e,o),this._renderForCurrentSelection(),this._rateLimitStreak=0,this._otherErrorStreak=0,null===this._selectedTime&&(this._weatherTimer=window.setInterval(()=>this._refreshWeather(this._fetchLat,this._fetchLon),6e5))}catch(n){if("AbortError"===n.name)return;let e;this.onWeatherUpdate?.({cloudCover:0,cloudLow:0,cloudMid:0,cloudHigh:0,cloudIntensity:"clear",timeRange:this._getTimeRange(),isLiveTime:null===this._selectedTime,pvPower:0,pvPowerHaurwitz:0,pvPowerShortwave:-1,irradianceSource:"haurwitz",temperatureC:NaN,windMs:NaN}),429===n.status?(e=be[Math.min(this._rateLimitStreak,be.length-1)],this._rateLimitStreak++,this._weatherTimer=window.setTimeout(()=>this._refreshWeather(this._fetchLat,this._fetchLon),e)):(e=ve[Math.min(this._otherErrorStreak,ve.length-1)],this._otherErrorStreak++,this._weatherTimer=window.setTimeout(()=>this._refreshWeather(this._fetchLat,this._fetchLon),e))}finally{this.onFetchEnd?.()}}resetDataCache(){const e=function clearWeatherCache(){let e=0;try{const t=window.localStorage;if(!t)return 0;const i=[];for(let e=0;e<t.length;e++){const r=t.key(e);r&&r.startsWith("helios-weather-cache:")&&i.push(r)}for(const r of i)t.removeItem(r),e++}catch(P){}return e}();return this._homeHourlyData=null,this._refreshWeather(this._fetchLat,this._fetchLon),e}setPaused(e){this._paused!==e&&(this._paused=e,e?(void 0!==this._skyTimer&&(window.clearInterval(this._skyTimer),this._skyTimer=void 0),this._clearWeatherTimer()):(this._refreshShadowsAndAtmosphere(),void 0===this._skyTimer&&(this._skyTimer=window.setInterval(()=>{this._paused||this._refreshShadowsAndAtmosphere()},6e4)),void 0===this._weatherTimer&&this._refreshWeather(this._fetchLat,this._fetchLon)))}isPaused(){return this._paused}isUserGestureSuppressed(){return Date.now()<this._postExitCooldownUntil}projectHomeLabelLayout(){if(!this._renderer)return null;const e=this._projectScenePoint(this.homeLon,this.homeLat,0);if(!e)return null;const t=this.homeLat,i=Math.cos(t*Math.PI/180),r=this._heliosScale(),o=this._clusterLiftScale(),n=84*r,s=60*r;let l=e.y;const c=this._buildingsData?.filter(e=>e.isHome)??[];if(c.length>0){let e=0;for(const t of c)t.height>e&&(e=t.height);if(e>0){const t=this._projectScenePoint(this.homeLon,this.homeLat,e);t&&(l=t.y)}}const d=28*o,u=e.y-d,p=e.x,g=u-70*o,m=e.x+n,f=u-s/2,y=u+s/2,b=e.x-n,v=u+s/2,_=1/111320,w=_/i,$=this._anchorPtsBuf;48!==$.length&&($.length=48);for(let M=0;M<48;M++){const t=M/48*Math.PI*2,i=4*Math.cos(t),r=4*Math.sin(t),o=this._projectScenePoint(this.homeLon+i*w,this.homeLat+r*_,0);if(!o){$[M]="0,0";continue}const n=(100*(o.x-e.x)|0)/100,s=(100*(o.y-e.y)|0)/100;$[M]=n+","+s}return{pvLabel:{x:p,y:g},batterySocLabel:{x:m,y:y},batteryPowerLabel:{x:m,y:f},gridLabel:{x:b,y:v},home:{x:e.x,y:u},homeRoof:{x:e.x,y:l},homeAnchorPoints:$.join(" ")}}_heliosScale(){const e=Math.min(this._cachedCanvasCssW||1/0,this._cachedCanvasCssH||1/0);if(!Number.isFinite(e)||e<=0)return 1;return e<=600?1:e>=1200?1.6:1+(1.6-1)*(e-600)/600}_clusterLiftScale(){const e=Math.min(this._cachedCanvasCssW||1/0,this._cachedCanvasCssH||1/0);if(!Number.isFinite(e)||e<=0)return 1;return e<=600?1:e>=1200?2.4:1+1.4*(e-600)/600}_steppedArcScale(e){if(!Number.isFinite(e)||e<=0)return 1;const t=600,i=.72;return e<=360?i:e<t?i+.28*(e-360)/240:e>=1200?2.2:1+(2.2-1)*(e-t)/600}_sunArcScale(){const e=this._cachedCanvasCssW,t=this._cachedCanvasCssH,i=Math.min(e||1/0,t||1/0),r=this._renderer?this.getCameraZoom():-1,o=this._arcScaleMemo;if(o&&o.w===e&&o.h===t&&o.zoom===r)return o.scale;let n=this._steppedArcScale(i);if(this._renderer&&Number.isFinite(i)&&i>0){const e=Math.PI/180,t=111320,r=111320*Math.cos(this.homeLat*e),o=60,s=this._projectScenePoint(this.homeLon,this.homeLat,0);if(s){let e=0;for(let i=0;i<8;i++){const n=i/8*2*Math.PI,l=o*Math.sin(n),c=o*Math.cos(n),d=this._projectScenePoint(this.homeLon+l/r,this.homeLat+c/t,0);if(!d)continue;const u=Math.hypot(d.x-s.x,d.y-s.y);u>e&&(e=u)}const l=e/o;if(l>0){const e=.41*i/l;n=Math.max(.72,Math.min(e/40,6))}}}return this._arcScaleMemo={w:e,h:t,zoom:r,scale:n},n}getSunArcScale(){return this._sunArcScale()}_projectScenePoint(e,t,i){if(!this._renderer)return null;const r=111320*Math.cos(this.homeLat*Math.PI/180),o=(e-this.homeLon)*r,n=111320*(t-this.homeLat);return this._renderer.camera.project3(o,n,i)}projectSunScene(e){if(!this._renderer)return null;const t=this._projectScenePoint(this.homeLon,this.homeLat,0);if(!t)return null;const i=new Date(e);i.setHours(0,0,0,0);const r=9e5,o=this._homeHourlyData?(()=>this._getWeatherAtTime(e)?.cloudCover??0)():0,n=i.getTime(),s=Math.round(o),l=Math.round(100*this._sunArcScale());let c=this._arcInputsCache;if(!c||c.dayStartMs!==n||c.cloudPctInt!==s||c.scaleKey!==l){const e=[];for(let t=0;t<96;t++){const i=new Date(n+t*r),s=this._sunSpherePoint(i);if(!s){e.push(null);continue}const l=this._sensorIrradianceAt(i),c=null!==l?l:computeIrradianceWm2(i,this.homeLat,this.homeLon,o);e.push({lon:s.lon,lat:s.lat,altitudeM:s.altitudeM,altitudeDeg:s.altitudeDeg,wm2:c,belowHorizon:s.altitudeM<0})}c={dayStartMs:n,cloudPctInt:s,scaleKey:l,samples:e},this._arcInputsCache=c}const d=[];for(let T=0;T<96;T++){const e=c.samples[T];if(!e)continue;const t=this._projectScenePoint(e.lon,e.lat,e.altitudeM);t&&d.push({x:t.x,y:t.y,irradiance:e.wm2,depth:t.depth,altitude:e.altitudeDeg,belowHorizon:e.belowHorizon})}const u=this._sunSpherePoint(e),p=getSunPosition(e,this.homeLat,this.homeLon).altitude,g=this._sensorIrradianceAt(e),m=null!==g?g:computeIrradianceWm2(e,this.homeLat,this.homeLon,o);let f=null;u&&(f=this._projectScenePoint(u.lon,u.lat,u.altitudeM)),f||(f={...t,depth:t.depth});let y=1/0,b=-1/0;for(const T of d)T.depth<y&&(y=T.depth),T.depth>b&&(b=T.depth);f.depth<y&&(y=f.depth),f.depth>b&&(b=f.depth);const v=b-y||1,nearnessOf=e=>(e-y)/v,_=d.map(e=>({x:e.x,y:e.y,irradiance:e.irradiance,altitude:e.altitude,nearness:nearnessOf(e.depth),belowHorizon:e.belowHorizon})),w=(()=>{if(p>=6)return 1;if(p<=-6)return ye;return ye+.75*((p+6)/12)})();let $=null,M=null;for(let T=1;T<c.samples.length;T++){const e=c.samples[T-1],t=c.samples[T];if(!e||!t)continue;const i=e.belowHorizon,o=t.belowHorizon;if(i===o)continue;const s=e.altitudeM,l=t.altitudeM-s,d=Math.abs(l)<1e-6?.5:-s/l,u=Math.max(0,Math.min(1,d)),p=e.lon+(t.lon-e.lon)*u,g=e.lat+(t.lat-e.lat)*u,m=this._projectScenePoint(p,g,0);if(!m)continue;const f=this._projectScenePoint(e.lon,e.lat,e.altitudeM),y=this._projectScenePoint(t.lon,t.lat,t.altitudeM),b=f&&y?Math.atan2(y.y-f.y,y.x-f.x):0,v=new Date(n+(T-1+u)*r),_={x:m.x,y:m.y,angleRad:b,time:v};i&&!o?$=_:!i&&o&&(M=_)}return{arc:_,sun:{x:f.x,y:f.y,irradiance:m,altitude:p,nearness:nearnessOf(f.depth)},home:{x:t.x,y:t.y},daylight:w,sunrise:$,sunset:M}}_sunSpherePoint(e){const t=getSunPosition(e,this.homeLat,this.homeLon),i=Math.PI/180,r=t.altitude*i,o=t.azimuth*i,n=40*this._sunArcScale(),s=n*Math.cos(r)*Math.sin(o),l=n*Math.cos(r)*Math.cos(o),c=n*Math.sin(r),d=111320*Math.cos(this.homeLat*i);return{lon:this.homeLon+s/d,lat:this.homeLat+l/111320,altitudeM:c,altitudeDeg:t.altitude}}setSelectedTime(e){this._selectedTime=e,null===e?(this._clearWeatherTimer(),this._weatherTimer=window.setInterval(()=>this._refreshWeather(this._fetchLat,this._fetchLon),6e5)):this._clearWeatherTimer(),this._mapReady&&(this._lastAtmosphereAlt=-999,this._renderForCurrentSelection(),null!==this._selectedTimeShadowTimer&&window.clearTimeout(this._selectedTimeShadowTimer),this._selectedTimeShadowTimer=window.setTimeout(()=>{this._selectedTimeShadowTimer=null,this._refreshShadowsAndAtmosphere()},100))}getTimelineSeries(){const e=this._homeHourlyData;if(!e||!e.times.length)return null;const t=e.times.map((t,i)=>{const r=this._sensorIrradianceAt(e.times[i]);if(null!==r)return r;const o=e.shortwave[i]??-1;return o>=0?o:10*computePvPower(e.times[i],this.homeLat,this.homeLon,e.cloudCover[i]??0)}),i=e.times.map((t,i)=>e.cloudCover[i]??0),r=e.times.map((t,i)=>e.cloudLow[i]??0),o=e.times.map((t,i)=>e.cloudMid[i]??0),n=e.times.map((t,i)=>e.cloudHigh[i]??0),s=e.times.map((t,i)=>e.directRad[i]??-1),l=e.times.map((t,i)=>e.diffuseRad[i]??-1);return{times:e.times.slice(),irradiance:t,cloud:i,cloudLow:r,cloudMid:o,cloudHigh:n,directRad:s,diffuseRad:l,snowDepth:e.snowDepth.slice(),temperature:e.temperature.slice(),windSpeed:e.windSpeed.slice()}}getStatsSnapshot(){const e=this._shadowsEnabled(),t=this._buildingsData?{home:this._buildingsData.filter(e=>e.isHome).length,surroundings:this._buildingsData.filter(e=>!e.isHome).length}:null;let i;return i=e?this._buildingsData?"footprints":"pending":"disabled",{mapReady:this._mapReady,hemisphere:this.homeLat>=0?"N":"S",shadows:{enabled:e,source:i,opacity:this._shadowOpacity(),clipRadiusM:this._buildingRadiusMeters()},buildings:{radiusM:this._buildingRadiusMeters(),clusterRadiusM:this._buildingClusterRadiusMeters(),opacity:this._buildingOpacity(),color:this._buildingColor(),footprints:t},weather:{samples:this._homeHourlyData?.times.length??0,rateLimitStreak:this._rateLimitStreak,openMeteoStats:{...Ee}},timeline:{rangeStart:this._getTimeRange()?.start?.toISOString()??null,rangeEnd:this._getTimeRange()?.end?.toISOString()??null,selectedTime:this._selectedTime?.toISOString()??null},caches:{arcCacheDay:this._arcInputsCache?new Date(this._arcInputsCache.dayStartMs).toISOString().slice(0,10):null,arcCacheCloudPct:this._arcInputsCache?.cloudPctInt??null}}}updateConfig(e){bumpStat("updateConfigCalls");const t=this._buildingRadiusMeters(),i=this._shadowOpacity(),r=this._shadowsEnabled(),o=!0===this.cfg["auto-rotate-enabled"],n=!0===this.cfg["camera-locked"];this.cfg={...e};const s=!0===this.cfg["auto-rotate-enabled"],l=!0===this.cfg["camera-locked"];if(!s||l||o&&!n||!this._renderer||this._startAutoRotateLoop(),!this._renderer)return;const c=this._buildingRadiusMeters();this._ensureBuildings(),c!==t&&(this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere());const d=this._shadowOpacity(),u=this._shadowsEnabled();this._resolvePalette(),d===i&&u===r||(this._lastAtmosphereAlt=-999,this._refreshShadowsAndAtmosphere()),this._renderer.scheduleRedraw(),this._homeHourlyData&&this._mapReady&&this._renderForCurrentSelection()}cleanup(){if(bumpStat("enginesCleanedUp"),this._clearWeatherTimer(),null!==this._selectedTimeShadowTimer&&(window.clearTimeout(this._selectedTimeShadowTimer),this._selectedTimeShadowTimer=null),window.clearInterval(this._skyTimer),this._fetchAbortController?.abort(),this._buildingsAbort?.abort(),this._arcInputsCache=void 0,this._resizeObserver?.disconnect(),void 0!==this._autoRotateRaf&&(cancelAnimationFrame(this._autoRotateRaf),this._autoRotateRaf=void 0),this._dragRotateHandlers){const e=this._dragRotateHandlers;e.canvas.removeEventListener("pointerdown",e.onDown),e.canvas.removeEventListener("pointermove",e.onMove),e.canvas.removeEventListener("pointerup",e.onEnd),e.canvas.removeEventListener("pointercancel",e.onEnd)}this._buildingsData=null,this._buildingsRaw=null,this._buildingsLocKey="",this._homeHourlyData=null,this._dragRotateHandlers=void 0;try{this._renderer?.cleanup()}catch(P){}this._renderer=void 0,this._mapReady=!1;try{const e=window;void 0!==e.__heliosEngine&&delete e.__heliosEngine}catch(P){}}};Ie.SENSOR_IRRADIANCE_WINDOW_MS=18e5;var Ne={cardName:"Helios",cardDescription:"☀️ Real-time 3D sun, clouds, PV production, battery and LiDAR shadows on your home",period:{rangeLabel:"Time range",today:"Today",configDefault:"Default",last7Days:"7 d"},editor:{locationSection:"Location",homeLatitude:"Home latitude",homeLongitude:"Home longitude",locationHint:"Override the home address used as the card's center. Leave both fields empty to use Home Assistant's configured home. The override is only applied when BOTH fields are set to valid coordinates.",uiAndMapSection:"UI & map",autoRotate:"Camera auto-rotation",autoRotateHint:"When idle for a few seconds, the camera slowly orbits the home (about 1.5°/s, opposite to the sun's apparent motion). A single-finger drag pauses it instantly and it resumes once you let go.",autoRotateOn:"On",autoRotateOff:"Off",dataDisplaySection:"Data display",displayUpdateFrequency:"Graph detail",displayUpdateFrequencyHelp:"How many points per hour the graphs draw. The data itself is always Home Assistant's 5-minute statistics; this only controls how densely the curve is plotted: 1 = one point per hour (smoothest, lightest to render), 12 = one point every 5 minutes (full detail, heaviest). Default 4 = a point every 15 minutes. Lower it on older or slower devices to cut rendering cost. The forecast curve follows the same cadence, so a finer setting also resolves short shadow dips (a tree clipping production for half an hour) that an hourly curve steps over.",valueDecimals:"Decimals",valueDecimalsHelp:"Number of decimals shown on every value readout. Power is always shown in kW and energy in kWh; this sets the precision for all of them so the chips read uniform. 0 to 3, default 1.",installationSection:"PV installation",installationHint:"Every entity Helios reads (PV production, grid import / export, battery power and state of charge) is pulled from the [Home Assistant Energy dashboard](/config/energy). This section only adds the install-level details that improve the forecast accuracy: inverter cap, panel orientation, optional irradiance sensor.",pvInverterMaxKw:"Inverter max output (kW)",pvInverterMaxKwHelp:"Optional clip on the forecast. Set this to your inverter's nameplate AC output when your panels can produce more than the inverter can deliver (typical European pairing: 6.4 kWp DC behind a 5 kW inverter). Leaves observation untouched (the inverter already clips in hardware) but caps the predicted curve, the daily kWh totals and the tooltip values so the readout never overshoots reality.",pvArraysSection:"Panel orientation",pvArraysHelp:"One entry per group of co-oriented panels. Leave a single entry with tilt 0 for a flat install. Add more entries when panels are split across multiple orientations (e.g. one row facing east, one facing west). The card forecasts each entry separately and weights the result by its share of the total kWp.",pvArrayTitle:"Row {n}",pvArrayName:"Name",pvArrayNameHelp:'Optional. A label for this row shown in the editor header (e.g. "South roof", "East garage"). Leave empty to fall back to the auto-numbered title.',pvArrayTilt:"Tilt (°)",pvArrayAzimuth:"Azimuth (°)",pvArrayPeakKwp:"Peak power (kWp)",pvArrayPeakKwpHelp:"Installed peak power of THIS row in kilowatt-peak. The total kWp of your install is the sum across rows; the per-row share is derived automatically from these values.",pvArrayAdd:"+ Add row",pvArrayRemove:"Remove",pvArrayNormHint:"Shares don't add up to 100%, the forecast normalises them automatically.",pvArrayTiltHelp:"Tilt of this row from horizontal, 0 to 90: 0 for a flat install, 30 to 45 for a typical pitched roof, 90 for a fully vertical setup such as a balcony. Combined with the azimuth, this drives the Liu-Jordan transposition that projects the predicted irradiance onto the panel plane.",pvArrayAzimuthHelp:"Compass bearing this row faces, clockwise from north, 0 to 360: 0 = north, 90 = east, 180 = south, 270 = west.",pvArrayLatitude:"Panel latitude",pvArrayLongitude:"Panel longitude",pvArrayCoordsHelp:"Optional. Only set these when this row is NOT at the same place as the home (ground-mount 300 m away, detached garage, etc.). Both fields must be filled in for the position to apply, otherwise the forecast uses the home position. A small green sphere will appear on the map at that location.",pvArrayHeight:"Panel height (m)",pvArrayHeightHelp:"Optional, default 5. Height of this group of panels above ground in metres; used by the LiDAR-aware PV forecast to position the ray-march origin when checking whether the array is shaded by a neighbour or a tree. Raise it for an upper-floor roof (8-10 m), lower it for a ground-mounted array (0-1 m). Has no effect when no LiDAR provider covers the home.",pvArrayTracker:"Sun tracker",pvArrayTrackerNone:"Fixed install",pvArrayTrackerDual:"Dual-axis (follows sun)",pvArrayTrackerSingleH:"Single-axis horizontal (tilt follows)",pvArrayTrackerSingleV:"Single-axis vertical (azimuth follows)",pvArrayTrackerHelp:"Most residential installs are fixed: the panel stays at the configured tilt + azimuth. Pick a tracker type if your panels physically move to follow the sun. Dual-axis keeps the panel face pointed straight at the sun all day (peak output). Single-axis-horizontal keeps the configured azimuth but tilts up and down as the sun rises and sets. Single-axis-vertical keeps the configured tilt but rotates around the vertical axis to track sun azimuth.",pvArrayCoordsPlaceholder:"optional",inverterCutoffSocPct:"Inverter cutoff SoC (%)",inverterCutoffSocPctHelp:"Percent at which your hybrid inverter clamps PV output once the battery hits its set ceiling. Leave empty to disable. When set, the forecast learning skips every hour where the battery SoC reached this value, so the inverter-blocked production does not teach the learned correction a false low output at those sun positions.",solarIrradianceEntity:"Solar irradiance entity",solarIrradianceEntityHelp:"Pick a sensor reporting global shortwave irradiance in W/m² (typical Ecowitt / Davis / personal weather station). When set, its current state and recorder history replace Open-Meteo for the live + past irradiance everywhere it appears (sun chip number, PV chart Y axis, sun arc colouring). Forecast hours stay on Open-Meteo since a sensor cannot carry future values.",buildingsSection:"Building",buildingsHint:'To keep the card smooth in dense urban areas, only buildings within the configured radius around the home are rendered in 3D. The home itself stays at full opacity; nearby buildings are rendered with the configured opacity so they provide urban context without competing with the data overlays. The cluster radius groups attached outbuildings (verandas, garages, sheds) into the "home" set.',displayRadius:"Display radius",displayRadiusHelp:"Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device; 0 shows just the home.",buildingCount:"Building count",buildingCountHelp:"Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device.",buildingRealSize:"Real building heights",buildingRealSizeOn:"On",buildingRealSizeOff:"Off",buildingRealSizeHint:"On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below.",buildingHeight:"Building height",buildingHeightHelp:"Fixed height applied to every building when real heights are off.",buildingClusterRadius:"Home cluster radius",buildingOpacity:"Surrounding opacity",shadowsSection:"Shadows",shadowsEnabled:"Show shadows",shadowsEnabledOn:"Shown",shadowsEnabledOff:"Hidden",shadowsEnabledHint:"Toggles the cast ground shadows. When on, Helios picks the best available source automatically: a LiDAR provider when one covers your area (buildings + vegetation), OpenFreeMap building footprints otherwise (buildings only).",shadowOpacity:"Shadow opacity",shadowOpacityHint:"Opacity of the cast ground shadows.",resetSection:"Reset",resetSectionHint:"Maintenance tools to wipe data the card has cached locally.",resetCacheButton:"Reset data cache",resetCacheWarning:"Warning: this clears the cached Open-Meteo weather and the in-memory PV history for EVERY Helios card open on this page. The refined forecast will lose its 5 days of calibration until they're re-fetched (a few minutes depending on your HA server). Your data inside Home Assistant is never touched.",resetCacheDone:"Cache cleared ✓",aboutSection:"About",aboutVersionLabel:"Version",aboutSiteTitle:"Companion site, helios-lidar.org",aboutSiteDescription:"The Helios website. Everything is there: card documentation, plus a free tool to turn raw open LiDAR data from any country (LAZ / LAS or DSM + DTM pairs) into the nDSM GeoTIFF Helios needs. Fully free and open source.",aboutCodeLabel:"Source code",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios is built by one passionate developer, with a lot of energy and very little sleep. If you like my work, a small star on GitHub already helps me a lot, and if you can, a small coffee keeps the project alive.",aboutDeveloperLabel:"Developer",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}},Oe={en:Ne,fr:{cardName:"Helios",cardDescription:"☀️ Soleil, nuages, production PV, batterie et ombres LiDAR sur ta maison, en 3D temps réel",period:{rangeLabel:"Période",today:"Aujourd'hui",configDefault:"Défaut",last7Days:"7 j"},editor:{locationSection:"Localisation",homeLatitude:"Latitude du domicile",homeLongitude:"Longitude du domicile",locationHint:"Remplace l'adresse du domicile utilisée comme centre de la carte. Laissez les deux champs vides pour utiliser le domicile configuré dans Home Assistant. La substitution n'est appliquée que lorsque LES DEUX champs contiennent des coordonnées valides.",uiAndMapSection:"UI & carte",autoRotate:"Rotation auto de la caméra",autoRotateHint:"Après quelques secondes d'inactivité, la caméra tourne lentement autour de la maison (environ 1,5°/s, dans le sens inverse du mouvement apparent du soleil). Un glissement à un doigt met la rotation en pause immédiatement, elle reprend dès que tu lâches.",autoRotateOn:"Activée",autoRotateOff:"Désactivée",dataDisplaySection:"Affichage des données",displayUpdateFrequency:"Détail du graphique",displayUpdateFrequencyHelp:"Combien de points par heure les graphiques tracent. La donnée elle-même est toujours en 5 minutes (statistiques Home Assistant) ; ce réglage ne change que la densité de tracé de la courbe : 1 = un point par heure (le plus lisse, le plus léger), 12 = un point toutes les 5 minutes (détail maximal, le plus lourd). Par défaut 4 = un point toutes les 15 minutes. Baissez-le sur un appareil ancien ou lent pour réduire le coût d'affichage. La courbe de prévision suit la même cadence : un réglage plus fin fait donc ressortir les creux d'ombre courts (un arbre qui coupe la production une demi-heure) qu'une courbe horaire enjambe.",valueDecimals:"Décimales",valueDecimalsHelp:"Nombre de décimales affichées sur chaque valeur. La puissance est toujours en kW et l'énergie en kWh ; ce réglage fixe la précision de toutes pour que les chips restent uniformes. De 0 à 3, par défaut 1.",installationSection:"Installation photovoltaïque",installationHint:"Toutes les entités lues par Helios (production PV, import / export grid, puissance batterie et SoC) sont récupérées depuis le [dashboard Énergie de Home Assistant](/config/energy). Cette section sert uniquement à ajouter des détails sur ton installation pour affiner la prévision : puissance max onduleur, orientation des panneaux, capteur d'irradiance optionnel.",pvInverterMaxKw:"Puissance max onduleur (kW)",pvInverterMaxKwHelp:"Écrêtage optionnel sur la prévision. Renseigne la puissance AC nominale de ton onduleur si tes panneaux peuvent produire plus que ce qu'il peut sortir (cas classique en Europe : 6,4 kWp DC derrière un onduleur 5 kW). N'affecte pas l'observation (l'onduleur écrête déjà côté matériel) mais plafonne la courbe prévue, les totaux kWh quotidiens et la tooltip pour qu'ils ne dépassent jamais la réalité matérielle.",pvArraysSection:"Orientation des panneaux",pvArraysHelp:"Une entrée par rangée de panneaux orientés à l'identique. Laisse une seule entrée avec une inclinaison à 0 pour une installation à plat. Ajoute des entrées supplémentaires quand tes panneaux sont répartis sur plusieurs orientations (par exemple une rangée à l'est, une autre à l'ouest). La prévision est calculée par entrée, puis pondérée par la part de chacune dans le total des kWp.",pvArrayTitle:"Rangée {n}",pvArrayName:"Nom",pvArrayNameHelp:"Optionnel. Un libellé pour cette rangée affiché dans l'en-tête de l'éditeur (par exemple « Toit sud », « Garage est »). Laisse vide pour retomber sur le titre numéroté automatiquement.",pvArrayTilt:"Inclinaison (°)",pvArrayAzimuth:"Azimut (°)",pvArrayPeakKwp:"Puissance crête (kWp)",pvArrayPeakKwpHelp:"Puissance crête installée de CETTE rangée en kilowatts-crête. La somme sur toutes les rangées = kWp total ; remplace l'ancien champ « Puissance crête » global et le pourcentage par rangée. Laisse vide pour retomber sur l'ancien mode par pourcentage.",pvArrayAdd:"+ Ajouter une rangée",pvArrayRemove:"Supprimer",pvArrayNormHint:"Les parts ne totalisent pas 100 %, la prévision les normalise automatiquement.",pvArrayTiltHelp:"Inclinaison de cette rangée par rapport à l'horizontale, de 0 à 90 : 0 pour une installation à plat, 30 à 45 pour un toit incliné classique, 90 pour une installation verticale (par exemple un balcon). Combinée à l'azimut, elle pilote la transposition Liu-Jordan qui projette l'irradiance prévue sur le plan des panneaux.",pvArrayAzimuthHelp:"Orientation à la boussole vers laquelle cette rangée est tournée, sens horaire depuis le nord, de 0 à 360 : 0 = nord, 90 = est, 180 = sud, 270 = ouest.",pvArrayLatitude:"Latitude des panneaux",pvArrayLongitude:"Longitude des panneaux",pvArrayCoordsHelp:"Optionnel. À renseigner uniquement si cette rangée n'est PAS au même endroit que la maison (panneaux au sol à 300 m, garage isolé, etc.). Les deux champs doivent être remplis pour que la position s'applique. Sinon la prévision utilise la position de la maison. Une petite sphère verte apparaîtra sur la carte à cette position.",pvArrayHeight:"Hauteur des panneaux (m)",pvArrayHeightHelp:"Optionnel, par défaut 5. Hauteur de ce groupe de panneaux au-dessus du sol en mètres ; utilisée par la prévision PV avec ombrage LiDAR pour positionner l’origine du raycast lors du test d’ombrage par un voisin ou un arbre. Augmentez pour un toit d’étage (8-10 m), abaissez pour un montage au sol (0-1 m). Sans effet si aucun fournisseur LiDAR ne couvre votre domicile.",pvArrayTracker:"Tracker solaire",pvArrayTrackerNone:"Installation fixe",pvArrayTrackerDual:"Bi-axe (suit le soleil)",pvArrayTrackerSingleH:"Mono-axe horizontal (inclinaison qui suit)",pvArrayTrackerSingleV:"Mono-axe vertical (azimut qui suit)",pvArrayTrackerHelp:"La plupart des installations résidentielles sont fixes : le panneau reste à l'inclinaison et l'azimut configurés. Choisis un type de tracker si tes panneaux bougent physiquement pour suivre le soleil. Bi-axe garde la face du panneau pointée droit sur le soleil toute la journée (rendement maximum). Mono-axe horizontal garde l'azimut configuré mais incline le panneau au lever et au coucher. Mono-axe vertical garde l'inclinaison configurée mais tourne autour de l'axe vertical pour suivre l'azimut du soleil.",pvArrayCoordsPlaceholder:"optionnel",inverterCutoffSocPct:"Seuil de coupure onduleur (%)",inverterCutoffSocPctHelp:"Pourcentage à partir duquel votre onduleur hybride bloque la production PV une fois que la batterie atteint son plafond. Laissez vide pour désactiver. Quand renseigné, l'apprentissage du forecast ignore chaque heure où le SoC batterie a atteint cette valeur, pour ne pas apprendre une fausse sous-production aux positions solaires concernées.",solarIrradianceEntity:"Entité d'irradiance solaire",solarIrradianceEntityHelp:"Choisis un capteur qui remonte l'irradiance solaire globale en W/m² (typiquement une station météo Ecowitt / Davis / perso). Quand il est défini, son état actuel et son historique recorder remplacent Open-Meteo pour les valeurs live + passées partout où elles apparaissent (nombre sur la pastille soleil, axe Y du graphique PV, coloration de l'arc solaire). Les heures de prévision continuent d'utiliser Open-Meteo, un capteur ne peut pas avoir de valeurs dans le futur.",buildingsSection:"Bâtiment",buildingsHint:"Pour ménager les performances en zone urbaine dense, seuls les bâtiments dans le rayon configuré autour de la maison sont rendus en 3D. La maison elle-même reste toujours à pleine opacité, les bâtiments voisins sont rendus en transparence pour donner le contexte sans concurrencer les données. Le rayon de regroupement permet d'inclure les bâtiments attenants (véranda, dépendance, garage) dans le groupe « maison ».",displayRadius:"Rayon d'affichage",displayRadiusHelp:"Rayon autour de la maison dans lequel les bâtiments sont récupérés et affichés, jusqu'au bord du disque de carte estompé. Baissez-le pour alléger le rendu sur un appareil lent ; à 0, seule la maison reste.",buildingCount:"Nombre de bâtiments",buildingCountHelp:"Nombre maximum de bâtiments voisins à afficher. Baissez-le pour alléger le rendu sur un appareil lent.",buildingRealSize:"Hauteurs réelles des bâtiments",buildingRealSizeOn:"Oui",buildingRealSizeOff:"Non",buildingRealSizeHint:"Oui : utilise les hauteurs réelles OpenStreetMap (plafonnées pour garder un cadrage lisible). Non : applique à chaque bâtiment la hauteur fixe ci-dessous.",buildingHeight:"Hauteur des bâtiments",buildingHeightHelp:"Hauteur fixe appliquée à chaque bâtiment lorsque les hauteurs réelles sont désactivées.",buildingClusterRadius:"Rayon de regroupement maison",buildingOpacity:"Opacité des bâtiments voisins",shadowsSection:"Ombres",shadowsEnabled:"Afficher les ombres",shadowsEnabledOn:"Affichées",shadowsEnabledOff:"Masquées",shadowsEnabledHint:"Active ou masque les ombres projetées au sol. Quand actif, Helios choisit automatiquement la meilleure source disponible : un fournisseur LiDAR si ta zone est couverte (bâtiments + végétation), sinon les empreintes des bâtiments OpenFreeMap (bâtiments uniquement).",shadowOpacity:"Opacité des ombres",shadowOpacityHint:"Opacité des ombres projetées au sol.",resetSection:"Réinitialisation",resetSectionHint:"Outils de maintenance pour purger les données mises en cache par la carte.",resetCacheButton:"Réinitialiser le cache des données",resetCacheWarning:"Attention : ce bouton vide la météo Open-Meteo en cache local et l'historique PV en mémoire pour TOUTES les cartes Helios ouvertes. La prévision affinée perdra ses 5 derniers jours de calibration le temps qu'ils soient récupérés à nouveau (quelques minutes selon ton serveur HA). Tes données dans Home Assistant ne sont jamais touchées.",resetCacheDone:"Cache vidé ✓",aboutSection:"À propos",aboutVersionLabel:"Version",aboutSiteTitle:"Site compagnon, helios-lidar.org",aboutSiteDescription:"Le site d'Helios. Tout est dessus : informations sur la carte, outil gratuit de conversion des données LiDAR ouvertes brutes de n'importe quel pays (LAZ / LAS ou paires DSM + DTM) en GeoTIFF nDSM. Totalement gratuit et open source.",aboutCodeLabel:"Code source",aboutRepoCard:"Helios",aboutCoffeeMessage:"Helios est développé par un seul développeur passionné, avec beaucoup d'énergie et peu de sommeil. Si tu aimes mon travail, une petite étoile sur GitHub m'aide déjà énormément, et si tu le peux, un petit café garde le projet en vie.",aboutDeveloperLabel:"Développeur",aboutDeveloperLinkedIn:"LinkedIn",aboutCoffeeLink:"Buy me a coffee"}}},ze=Ne;function pickTranslations(e){if(!e)return ze;const t=e.toLowerCase();if(Oe[t])return Oe[t];const i=t.split("-")[0];return Oe[i]?Oe[i]:ze}var We=i$6`
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
    /*  Basemap tile canvas (CARTO tiles). Positioned by the renderer's transform-origin + transform;
        sized in JS to the stitched tile grid. */
    .ground
    {
        position: absolute;
        top: 0;
        left: 0;
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
            transparent ${r$5(90)}%,
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
    .solar-pct-label,
    .cloud-chip,
    .home-pill
    {
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }

    /*  Camera-lock toggle, top-left. 40 px circle; brand-blue pastille appears when locked. */
    .camera-lock-btn
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
    .camera-lock-btn:hover,
    .camera-lock-btn:focus,
    .camera-lock-btn:focus-visible,
    .camera-lock-btn:active
    {
        outline: 0 !important;
        box-shadow: none !important;
    }
    .camera-lock-btn ha-icon
    {
        --mdc-icon-size: 22px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        pointer-events: none;
    }
    .camera-lock-btn:hover  { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08); }
    .camera-lock-btn:active { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.16); }
    .camera-lock-btn.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .camera-lock-btn.is-on:hover  { background: var(--dark-primary-color, #0288d1); }
    .camera-lock-btn.is-on:active { background: var(--darker-primary-color, #01579b); }
    /*  Disabled state: button stays visible to show the lock state but is inert,
        greyed out with no hover/active feedback. */
    .camera-lock-btn.is-disabled,
    .camera-lock-btn[disabled]
    {
        opacity: 0.45;
        cursor: default;
        pointer-events: none;
    }

    /*  Top-left rail hosting the camera-lock toggle. pointer-events off on
        the rail; the button opts back in so it doesn't steal map interactions. */
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
    /*  Full-size overlay SVGs for the home-cluster leaders (grid, PV→home, battery). Identical box;
        each hosts its own coloured path(s) defined below. */
    .grid-leader-svg,
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
    .grid-leader-line
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
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .pv-home-leader-bead,
    ha-card.theme-dark .battery-leader-bead,
    ha-card.theme-dark .solar-svg .solar-ray-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
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
        color: var(--primary-color, #03a9f4);
        border-color: var(--primary-color, #03a9f4);
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
                    0 0 7px 1px color-mix(in srgb, var(--primary-color, #03a9f4) 28%, transparent);
    }
    /*  Active consumption target: same retarget glow the other chips use, in the consumption blue. */
    .home-pill.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--energy-grid-consumption-color, #488fc2) 70%, transparent);
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



`,je=i$6`
    /*  Timeline, pinned to the bottom of the card. The whole bar accepts pointer events for scrub.
        Slides out below the card edge (transform) instead of fading when hidden. */
    .time-bar
    {
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: transform;
        position: absolute;
        bottom: 6px;
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
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 70%, transparent);
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
    .tb-header
    {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 2px 4px;
        pointer-events: none;
    }
    /*  Active-target indicator: icon of the current chart target, keyed so it fades in on each
        re-target. */
    .tb-chart-indicator
    {
        display: inline-flex;
        align-items: center;
        /*  Same chip frame as the period selector so the two header controls read as one family. */
        padding: 2px 6px;
        border-radius: 8px;
        background: var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        /*  Icon in the text ink, not the accent colour. */
        color: var(--primary-text-color, #212121);
        pointer-events: none;
    }
    .tb-chart-indicator ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
        display: block;
        animation: tb-chart-indicator-fade 250ms ease;
    }
    @keyframes tb-chart-indicator-fade
    {
        from { opacity: 0; }
        to   { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce)
    {
        .tb-chart-indicator ha-icon { animation: none; }
    }
    /*  Rolling-period selector: compact text segmented control with the shared on-primary active
        recipe so the controls read as one family. */
    .tb-period-selector
    {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        border-radius: 8px;
        background: var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        pointer-events: auto;
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

`;function formatLocalisedNumber(e,t,i,r=!1){if(!isFinite(t))return r?"0":(0).toFixed(i);const o=e?.locale?.language??e?.language??void 0,n=r?{maximumFractionDigits:0}:{minimumFractionDigits:i,maximumFractionDigits:i};try{return new Intl.NumberFormat(o,n).format(t)}catch(P){return r?Math.round(t).toString():t.toFixed(i)}}function formatPowerKw(e,t,i,r=!1){return r?`${t>0?"+":t<0?"−":""}${formatLocalisedNumber(e,Math.abs(t)/1e3,i)} kW`:`${formatLocalisedNumber(e,t/1e3,i)} kW`}function pvNormalizeToWatts(e,t){const i=(t||"").toLowerCase();return"kw"===i?1e3*e:"mw"===i?1e6*e:"w"===i?e:0}function formatEntityValue(e,t,i,r){const o=(i||"").trim(),n=o.toLowerCase();if("w"===n||"kw"===n||"mw"===n)return formatPowerKw(e,pvNormalizeToWatts(t,i),r);if("wh"===n||"kwh"===n||"mwh"===n)return function formatEnergyKwh(e,t,i){return`${formatLocalisedNumber(e,t,i)} kWh`}(e,function energyToKwh(e,t){switch((t||"").trim().toLowerCase()){case"wh":return e/1e3;case"mwh":return 1e3*e;default:return e}}(t,i),r);const s=formatLocalisedNumber(e,t,r);return o?`${s} ${o}`:s}function lerpHexToward(e,t,i){const r=Math.max(0,Math.min(1,i)),o=parseInt(e.slice(1,3),16),n=parseInt(e.slice(3,5),16),s=parseInt(e.slice(5,7),16),l=parseInt(t.slice(1,3),16),c=parseInt(t.slice(3,5),16),d=parseInt(t.slice(5,7),16),u=Math.round(o+(l-o)*r),p=Math.round(n+(c-n)*r),g=Math.round(s+(d-s)*r),h=e=>e.toString(16).padStart(2,"0");return`#${h(u)}${h(p)}${h(g)}`}function cssHex(e,t,i){if(!e)return i;const r=getComputedStyle(e).getPropertyValue(t).trim();if(/^#[0-9a-f]{6}$/i.test(r))return r;if(/^#[0-9a-f]{3}$/i.test(r))return"#"+r.slice(1).split("").map(e=>e+e).join("");const o=r.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);if(o){const h=e=>Math.max(0,Math.min(255,Math.round(parseFloat(e)))).toString(16).padStart(2,"0");return"#"+h(o[1])+h(o[2])+h(o[3])}return i}var rgbXyz=e=>{const t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},xyzLab=e=>e>.008856452?e**(1/3):e/Me+ke,xyzRgb=e=>255*(e<=.00304?12.92*e:1.055*e**(1/2.4)-.055),labXyz=e=>e>.206896552?e*e*e:Me*(e-ke);var Ue=/* @__PURE__ */new Map;function energySolarColor(e,t,i){if(e&&getComputedStyle(e).getPropertyValue(`--energy-solar-color-${i}`).trim())return cssHex(e,`--energy-solar-color-${i}`,"#ff9800");const r=cssHex(e,"--energy-solar-color","#ff9800");if(!i)return r;const o=`${r}|${t}|${i}`;let n=Ue.get(o);if(void 0===n){const e=function rgbToLab([e,t,i]){const r=rgbXyz(e),o=rgbXyz(t),n=rgbXyz(i),s=xyzLab((.4124564*r+.3575761*o+.1804375*n)/Se),l=xyzLab((.2126729*r+.7151522*o+.072175*n)/1),c=116*l-16;return[c<0?0:c,500*(s-l),200*(l-xyzLab((.0193339*r+.119192*o+.9503041*n)/$e))]}(function hexToRgb(e){return[parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]}(r));n=function labToHex([e,t,i]){let r=(e+16)/116,o=r+t/500,n=r-i/200;r=1*labXyz(r),o=Se*labXyz(o),n=$e*labXyz(n);const s=Math.round(xyzRgb(3.2404542*o-1.5371385*r-.4985314*n)),l=Math.round(xyzRgb(-.969266*o+1.8760108*r+.041556*n)),c=Math.round(xyzRgb(.0556434*o-.2040259*r+1.0572252*n)),h=e=>Math.min(255,Math.max(0,e)).toString(16).padStart(2,"0");return"#"+h(s)+h(l)+h(c)}([e[0]+(t?18:-18)*i,e[1],e[2]]),Ue.set(o,n)}return n}var ENERGY_COLOR_pv=e=>cssHex(e,"--energy-solar-color","#ff9800"),ENERGY_COLOR_consumption=e=>cssHex(e,"--energy-grid-consumption-color","#488fc2"),ENERGY_COLOR_gridImport=e=>cssHex(e,"--energy-grid-consumption-color","#488fc2"),ENERGY_COLOR_gridExport=e=>cssHex(e,"--energy-grid-return-color","#8353d1"),ENERGY_COLOR_batteryIn=e=>cssHex(e,"--energy-battery-in-color","#f06292"),ENERGY_COLOR_batteryOut=e=>cssHex(e,"--energy-battery-out-color","#4db6ac"),ENERGY_COLOR_sun=e=>cssHex(e,"--warning-color","#ffc107"),ENERGY_COLOR_cloud=e=>cssHex(e,"--secondary-text-color","#727272"),Be=class extends Error{constructor(e,t){super(`callWS timeout after ${t} ms (${e})`),this.wsType=e,this.timeoutMs=t,this.name="WsTimeoutError"}},Ve=0,qe=[];function callWSWithTimeout(e,t,i=3e4){return e&&"function"==typeof e.callWS?function acquireFetchSlot(){return Ve<2?(Ve++,Promise.resolve()):new Promise(e=>{qe.push(()=>{Ve++,e()})})}().then(()=>new Promise((r,o)=>{let n=!1;const finish=e=>{n||(n=!0,function releaseFetchSlot(){Ve=Math.max(0,Ve-1);const e=qe.shift();e&&e()}(),e())},s=setTimeout(()=>{finish(()=>o(new Be(t.type,i)))},i);e.callWS(t).then(e=>{clearTimeout(s),finish(()=>r(e))},e=>{clearTimeout(s),finish(()=>o(e))})})):Promise.reject(/* @__PURE__ */new Error("hass.callWS unavailable"))}function changeRefreshAnchorMs(){return Math.floor(Date.now()/_e)*_e}var Ke=/* @__PURE__ */new Map;async function fetchChangeSeries(e,t,i,r,o="5minute"){if(0===t.length)return null;if(!e?.callWS)return null;if(r<=i)return null;const n=`${o}|${i}|${r}|${[...t].sort().join("|")}`,s=Date.now();!function pruneExpired(e,t){for(const[i,r]of e)!r.inflight&&t-r.ts>55e3&&e.delete(i)}(Ke,s);const l=Ke.get(n);if(l){if(l.inflight)return l.inflight;if(s-l.ts<55e3)return l.result}const c=(async()=>{try{const n=await e.callWS({type:"recorder/statistics_during_period",start_time:new Date(i).toISOString(),end_time:new Date(r).toISOString(),statistic_ids:t,period:o,types:["change"],units:{energy:"kWh"}}),s=/* @__PURE__ */new Map;let l=!1;for(const e of t){const t=n?.[e];if(Array.isArray(t))for(const e of t){const t=parseStatBoundary$3(e?.start);if(null===t)continue;const i="number"==typeof e?.change?e.change:null;if(null===i||!Number.isFinite(i))continue;const r=parseStatBoundary$3(e?.end)??t+periodMs(o),n=s.get(t);n?n.kwh+=i:s.set(t,{startMs:t,endMs:r,kwh:i}),l=!0}}return l?[...s.values()].sort((e,t)=>e.startMs-t.startMs):null}catch(P){return null}})();Ke.set(n,{ts:s,result:null,inflight:c});const d=await c;return Ke.set(n,{ts:Date.now(),result:d}),d}function changeSeriesToWatts(e,t,i,r,o){const n=new Array(r).fill(null);if(!e||0===e.length)return n;const s=new Array(r).fill(0),l=new Array(r).fill(!1);for(const d of e){if(d.startMs<t||d.startMs>=o)continue;const e=Math.floor((d.startMs-t)/i);e<0||e>=r||(s[e]+=d.kwh,l[e]=!0)}const c=i/ge;for(let d=0;d<r;d++)l[d]&&(n[d]=1e3*s[d]/c);return n}function probeChangeWindow(e,t,i){let r=0,o=0,n=0,s=0;for(const l of e){if(l.endMs<=t||l.startMs>=i)continue;const e=l.endMs-l.startMs;if(e<=0)continue;const c=Math.min(l.endMs,i)-Math.max(l.startMs,t);c<=0||(r+=l.kwh*(c/e),o+=c,s++,l.kwh>0&&n++)}return{kwh:r,ms:o,nonZero:n,total:s}}function wattsFromBucket(e){const t=e.endMs-e.startMs;return t>0?Math.max(0,1e3*e.kwh/(t/ge)):0}function latestWattsFromChangeSeries(e,t){if(!e||0===e.length)return null;let i=-1;for(let n=e.length-1;n>=0;n--)if(e[n].endMs<=t){i=n;break}if(i<0)return null;const r=e[i].endMs,o=probeChangeWindow(e,r-we,r);return 0===o.total||o.nonZero>=Math.ceil(.6*o.total)?wattsFromBucket(e[i]):o.ms>0?Math.max(0,1e3*o.kwh/(o.ms/ge)):0}function wattsAtFromChangeSeries(e,t){if(!e||0===e.length)return null;const i=45e4,r=probeChangeWindow(e,t-i,t+i);if(0===r.total)return null;if(r.nonZero>=Math.ceil(.6*r.total))for(const o of e)if(t>=o.startMs&&t<o.endMs)return wattsFromBucket(o);return r.ms>0?Math.max(0,1e3*r.kwh/(r.ms/ge)):0}function sumChangeForDay(e,t,i){if(!e||0===e.length)return null;let r=0,o=!1;for(const n of e)n.startMs<t||n.startMs>=i||(r+=n.kwh,o=!0);return o?r:null}function periodMs(e){return"5minute"===e?3e5:"hour"===e?ge:me}function parseStatBoundary$3(e){if("number"==typeof e&&Number.isFinite(e))return e;if("string"==typeof e){const t=Date.parse(e);return Number.isNaN(t)?null:t}return null}function resolvePvLiveEntity(e){return e.solarStatRates.length>0?e.solarStatRates[0]:e.solarStatEnergyFroms.length>0?e.solarStatEnergyFroms[0]:""}var Ge=/* @__PURE__ */new Map;function refreshPv(e){const t=resolvePvLiveEntity(e._energyDefaults);if(!t||!e.hass)return void(null===e._pvCurrent&&null===e._pvHistory||(e._pvCurrent=null,e._pvHistory=null,e._pvUnit=""));null===e._pvHistory&&(e._pvHistory={times:[],values:[]});const i=e._energyDefaults.solarStatRates.length>0?e._energyDefaults.solarStatRates:e._energyDefaults.solarStatEnergyFroms,r=i.length>1,o=e.hass.states?.[t];if(o){let t=null,n="",s=0;if(r){let r=0,o="",l=!1;for(const t of i){const i=e.hass.states?.[t];if(!i)continue;const n=parseFloat(i.state);if(!isFinite(n))continue;o||(o=String(i.attributes?.unit_of_measurement??"")),r+=n,l=!0;const c=i.last_updated?new Date(i.last_updated).getTime():Date.now();c>s&&(s=c)}l&&(t=r,n=o)}else{const e=parseFloat(o.state);t=isFinite(e)?e:null,n=o.attributes?.unit_of_measurement??"",s=o.last_updated?new Date(o.last_updated).getTime():Date.now()}if(t!==e._pvCurrent&&(e._pvCurrent=t),n!==e._pvUnit&&(e._pvUnit=n),null!==t){const i=s||Date.now(),r=e._pvHistory;if(r){const o=r.times.length-1;if(i>(o>=0?r.times[o].getTime():0)&&null!==t&&(r.times.push(new Date(i)),r.values.push(t),e._timeRange)){const t=e._timeRange.start.getTime();let i=0;for(;i<r.times.length&&r.times[i].getTime()<t;)i++;i>0&&(r.times.splice(0,i),r.values.splice(0,i))}}}}else null!==e._pvCurrent&&(e._pvCurrent=null);if(!e._timeRange)return;const n=e._timeRange.end,s=/* @__PURE__ */new Date;s.setHours(0,0,0,0);const l=[...i].sort(),c=l.length>0?l.join(","):t;if(!e._pvCalibStatsFetching){const i=/* @__PURE__ */new Date(s.getTime()-5*me),r=`${c}@h|${i.getTime()}|${n.getTime()}`;if(r!==e._pvCalibStatsFetchKey){e._pvCalibStatsFetchKey=r;const o=function pvStatsCacheGet(e,t){const i=e.get(t);return i?Date.now()-i.ts>9e5?(e.delete(t),null):i:null}(Ge,r);if(o)e._pvCalibStats=o.stats,e._pvHistoryPerEntity=o.perEntity;else{const o=l.length>0?l:[t],s=(e._pvUnit||"").toLowerCase();!async function fetchPvStatistics(e,t,i,r,o,n="",s=!1){if(!e.hass?.callWS||0===t.length)return;const l="_pvCalibStatsFetching",c="_pvCalibStats",d=Ge;e[l]=!0;try{const l=/* @__PURE__ */new Date,u=r>l?l:r;if(i>=u)return void(e[c]={times:[],values:[]});const p=await callWSWithTimeout(e.hass,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:u.toISOString(),statistic_ids:t,period:o,types:["mean","state"],units:{energy:"kWh",power:"W"}}),g=[];for(const e of t){const t=(p&&p[e])??[],i=[],r=[];for(const e of t){const t=e?.start,o=e?.end,n=parseStatBoundary$2(t),s=parseStatBoundary$2(o);if(null===n)continue;let l=e?.mean;if(null==l&&(l=e?.state),null==l)continue;const c="number"==typeof l?l:parseFloat(String(l));if(!isFinite(c))continue;const d=null!==s?(n+s)/2:n;i.push(new Date(d)),r.push(c)}g.push({times:i,values:r})}const m=/* @__PURE__ */new Map;for(let e=0;e<t.length;e++)m.set(t[e],g[e]);e._pvHistoryPerEntity=m;const f=function aggregatePvHistoriesLkcf(e,t=!1){if(0===e.length)return{times:[],values:[]};if(1===e.length)return e[0];const i=/* @__PURE__ */new Set;for(const l of e)for(const e of l.times)i.add(e.getTime());const r=Array.from(i).sort((e,t)=>e-t),o=new Array(e.length).fill(-1),n=t?new Array(e.length).fill(null):null,s=[];for(const l of r){let t=0;for(let i=0;i<e.length;i++){const r=e[i];let s=o[i];for(;s+1<r.times.length&&r.times[s+1].getTime()<=l;)s++;o[i]=s,s>=0&&isFinite(r.values[s])&&(n?(null===n[i]&&(n[i]=r.values[s]),t+=r.values[s]-n[i]):t+=r.values[s])}s.push(t)}return{times:r.map(e=>new Date(e)),values:s}}(g,s);e[c]=f,n&&d.set(n,{stats:f,perEntity:m,ts:Date.now()})}catch(u){u instanceof Be?console.warn(`[HELIOS] PV calib statistics fetch timed out (${u.timeoutMs} ms), consumer degrades to raw _pvHistory.`):console.warn("[HELIOS] PV calib statistics fetch failed:",u),e[c]={times:[],values:[]}}finally{e[l]=!1}}(e,o,i,n,"hour",r,"wh"===s||"kwh"===s||"mwh"===s)}}}const d=e._energyDefaults.solarStatEnergyFroms;if(d.length>0&&!e._pvChangeSeriesFetching){const t=/* @__PURE__ */new Date(s.getTime()-2*me),i=[...d].sort(),r=`${i.join(",")}|${t.getTime()}|${n.getTime()}|${changeRefreshAnchorMs()}`;r!==e._pvChangeSeriesFetchKey&&(e._pvChangeSeriesFetchKey=r,e._pvChangeSeriesFetching=!0,fetchChangeSeries(e.hass,i,t.getTime(),n.getTime(),"5minute").then(t=>{null!==t&&(e._pvChangeSeries=t),e.requestUpdate()}).finally(()=>{e._pvChangeSeriesFetching=!1}))}}function parseStatBoundary$2(e){if(null==e)return null;if("number"==typeof e)return e>1e12?e:1e3*e;if("string"==typeof e){const t=Number(e);if(Number.isFinite(t)&&t>1e9)return t>1e12?t:1e3*t;const i=new Date(e).getTime();return isFinite(i)?i:null}return null}var Ye=/* @__PURE__ */new Map;function resolveBatteryEntities(e){return{powerEntity:e.batteryStatRates[0]??e.batteryStatEnergyFroms[0]??e.batteryStatEnergyTos[0]??null,socEntity:e.batteryStatSocs[0]??null}}function refreshBattery(e){if(!e.hass)return;const{powerEntity:t,socEntity:i}=resolveBatteryEntities(e._energyDefaults);if(!t&&!i)return null!==e._batterySoc&&(e._batterySoc=null),null!==e._batteryPower&&(e._batteryPower=null),""!==e._batteryPowerUnit&&(e._batteryPowerUnit=""),null!==e._batterySocHistory&&(e._batterySocHistory=null),null!==e._batteryPowerHistory&&(e._batteryPowerHistory=null),void(e._batteryFetchKey="");let r=null;const o=e._energyDefaults.batteryStatSocs;if(o.length>0){let t=0,i=0;for(const r of o){const o=e.hass.states?.[r],n=o?parseFloat(o.state):NaN;isFinite(n)&&(t+=n,i+=1)}i>0&&(r=Math.max(0,Math.min(100,t/i)))}let n=null,s="";const l=e._energyDefaults.batteryStatRates;if(l.length>0){let t=0,i=!1;for(const r of l){const o=e.hass.states?.[r],n=o?parseFloat(o.state):NaN;if(!isFinite(n))continue;const s=pvNormalizeToWatts(n,String(o.attributes?.unit_of_measurement??""));t+=e._energyDefaults.invertedRateEntities.includes(r)?-s:s,i=!0}i&&(n=t,s="W")}else if(e._energyDefaults.batteryStatEnergyTos.length>0||e._energyDefaults.batteryStatEnergyFroms.length>0){const t=Date.now(),i=latestWattsFromChangeSeries(e._batteryChargeChangeSeries,t),r=latestWattsFromChangeSeries(e._batteryDischargeChangeSeries,t);null===i&&null===r||(n=Math.max(0,i??0)-Math.max(0,r??0),s="W")}if(r!==e._batterySoc&&(e._batterySoc=r),n!==e._batteryPower&&(e._batteryPower=n),s!==e._batteryPowerUnit&&(e._batteryPowerUnit=s),function fetchBatteryChangeSeries(e){const t=e._energyDefaults.batteryStatEnergyTos,i=e._energyDefaults.batteryStatEnergyFroms;if(0===t.length&&0===i.length)return;if(e._batteryChangeFetching)return;const r=/* @__PURE__ */new Date;r.setHours(0,0,0,0);const o=r.getTime()-1728e5,n=changeRefreshAnchorMs(),s=[...t].sort(),l=[...i].sort(),c=`${s.join(",")}|${l.join(",")}|${o}|${n}`;if(c===e._batteryChangeFetchKey)return;e._batteryChangeFetchKey=c,e._batteryChangeFetching=!0,Promise.all([s.length>0?fetchChangeSeries(e.hass,s,o,n,"5minute"):Promise.resolve(null),l.length>0?fetchChangeSeries(e.hass,l,o,n,"5minute"):Promise.resolve(null)]).then(([t,i])=>{null!==t&&(e._batteryChargeChangeSeries=t),null!==i&&(e._batteryDischargeChangeSeries=i),e.requestUpdate()}).finally(()=>{e._batteryChangeFetching=!1})}(e),!e._timeRange||e._batteryFetching)return;const c=e._energyDefaults.batteryStatRates;if(0===o.length&&0===c.length)return;const d=e._timeRange.start,u=6e4*Math.floor(Date.now()/6e4),p=/* @__PURE__ */new Date(u-216e5),g=d<p?d:p,m=`${g.getTime()}|${p.getTime()}|${e._timeRange.end.getTime()}`,f=[...o].sort(),y=[...c].sort(),b=`${f.join(",")}|${y.join(",")}@${m}`;if(b===e._batteryFetchKey)return;e._batteryFetchKey=b;const v=function batteryHistoryCacheGet(e){const t=Ye.get(e);return t?Date.now()-t.ts>9e5?(Ye.delete(e),null):t:null}(b);if(v)return e._batterySocHistory=v.soc,void(e._batteryPowerHistory=v.power);!async function fetchBatteryHistory(e,t,i,r,o,n,s=""){if(!e.hass?.callWS)return;if(0===t.length&&0===i.length)return;e._batteryFetching=!0;try{const l=/* @__PURE__ */new Date,c=n>l?l:n;if(r>=c&&o>=c)return e._batterySocHistory={times:[],values:[]},void(e._batteryPowerHistory={times:[],values:[]});const d=/* @__PURE__ */new Set;for(const e of t)d.add(e);for(const e of i)d.add(e);const u=Array.from(d),p={},g=await callWSWithTimeout(e.hass,{type:"recorder/statistics_during_period",start_time:r.toISOString(),end_time:c.toISOString(),statistic_ids:u,period:"5minute",types:["mean","state"],units:{energy:"kWh",power:"W"}});if(u.some(e=>Array.isArray(g?.[e])&&g[e].length>0))for(const e of u)p[e]=parseBatteryStats(g?.[e]??[]);else{const t=await callWSWithTimeout(e.hass,{type:"history/history_during_period",start_time:o.toISOString(),end_time:c.toISOString(),entity_ids:u,minimal_response:!0,no_attributes:!0,significant_changes_only:!0});for(const e of u)p[e]=parseRawBatteryHistory(t?.[e]??[])}const m=new Set(e._energyDefaults.invertedRateEntities),f=aggregateBatteryLkcf(t.map(e=>p[e]??{times:[],values:[]}),"mean",e=>Math.max(0,Math.min(100,e))),y=aggregateBatteryLkcf(i.map(e=>p[e]??{times:[],values:[]}),"sum",(e,t)=>m.has(i[t])?-e:e);e._batterySocHistory=f,e._batteryPowerHistory=y,s&&Ye.set(s,{soc:f,power:y,ts:Date.now()})}catch(l){l instanceof Be?console.warn(`[HELIOS] battery history fetch timed out (${l.timeoutMs} ms), rendering without past-day curve.`):console.warn("[HELIOS] battery history fetch failed:",l),e._batterySocHistory={times:[],values:[]},e._batteryPowerHistory={times:[],values:[]}}finally{e._batteryFetching=!1}}(e,f,y,g,p,e._timeRange.end,b)}function parseRawBatteryHistory(e){const t=[],i=[];for(const r of e??[]){const e="string"==typeof r?.s?r.s:"string"==typeof r?.state?r.state:null;if(null===e||"unavailable"===e||"unknown"===e||""===e)continue;const o=parseFloat(e);if(!isFinite(o))continue;let n=null;"number"==typeof r?.lu?n=/* @__PURE__ */new Date(1e3*r.lu):"string"==typeof r?.last_updated?n=new Date(r.last_updated):"string"==typeof r?.last_changed&&(n=new Date(r.last_changed)),n&&!isNaN(n.getTime())&&(t.push(n),i.push(o))}return{times:t,values:i}}function parseBatteryStats(e){const t=[],i=[];for(const r of e??[]){const e=parseStatBoundary$1(r?.start),o=parseStatBoundary$1(r?.end);if(null===e)continue;let n=r?.mean,s=!1;if(null==n&&(n=r?.state,s=!0),null==n)continue;const l="number"==typeof n?n:parseFloat(String(n));if(!isFinite(l))continue;const c=s?o??e:null!==o?(e+o)/2:e;t.push(new Date(c)),i.push(l)}return{times:t,values:i}}function parseStatBoundary$1(e){if(null==e)return null;if("number"==typeof e)return e>1e12?e:1e3*e;if("string"==typeof e){const t=Number(e);if(Number.isFinite(t)&&t>1e9)return t>1e12?t:1e3*t;const i=new Date(e).getTime();return isFinite(i)?i:null}return null}function aggregateBatteryLkcf(e,t,i){if(0===e.length)return{times:[],values:[]};if(1===e.length){const t=e[0];return{times:t.times,values:t.values.map((e,t)=>i(e,0))}}const r=/* @__PURE__ */new Set;for(const l of e)for(const e of l.times)r.add(e.getTime());const o=Array.from(r).sort((e,t)=>e-t),n=new Array(e.length).fill(-1),s=[];for(const l of o){let r=0,o=0;for(let t=0;t<e.length;t++){const s=e[t];let c=n[t];for(;c+1<s.times.length&&s.times[c+1].getTime()<=l;)c++;n[t]=c,c>=0&&isFinite(s.values[c])&&(r+=i(s.values[c],t),o++)}s.push(0===o?NaN:"mean"===t?r/o:r)}return{times:o.map(e=>new Date(e)),values:s}}var Xe=/* @__PURE__ */new Map;function parseStatBoundary(e){if(null==e)return null;if("number"==typeof e)return e>1e12?e:1e3*e;if("string"==typeof e){const t=Number(e);if(Number.isFinite(t)&&t>1e9)return t>1e12?t:1e3*t;const i=new Date(e).getTime();return isFinite(i)?i:null}return null}function refreshIrradiance(e){const t=String(e.config?.["solar-irradiance-entity"]??"").trim();if(!t||!e.hass)return null!==e._irradianceHistory&&(e._irradianceHistory=null),e._irradianceFetchKey="",void e._engine?.setSolarRadiationSamples(null);if(pushIrradianceToEngine(e),!e._timeRange||e._irradianceFetching)return;const i=e._timeRange.start,r=6e4*Math.floor(Date.now()/6e4),o=/* @__PURE__ */new Date(r-216e5),n=i<o?o:i,s=`${t}@${n.getTime()}|${e._timeRange.end.getTime()}`;if(s===e._irradianceFetchKey)return;e._irradianceFetchKey=s;const l=function irradianceHistoryCacheGet(e){const t=Xe.get(e);return t?Date.now()-t.ts>9e5?(Xe.delete(e),null):t:null}(s);if(l)return e._irradianceHistory=l.history,void pushIrradianceToEngine(e);!async function fetchIrradianceHistory(e,t,i,r,o=""){if(!e.hass?.callWS)return;e._irradianceFetching=!0;try{const n=/* @__PURE__ */new Date,s=r>n?n:r;if(i>=s)return e._irradianceHistory={times:[],values:[]},void pushIrradianceToEngine(e);let l={times:[],values:[]};const c=await callWSWithTimeout(e.hass,{type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:s.toISOString(),statistic_ids:[t],period:"5minute",types:["mean"]}),d=(c&&c[t])??[];if(d.length>0)l=function parseIrradianceStats(e){const t=[],i=[];for(const r of e??[]){const e=parseStatBoundary(r?.start),o=parseStatBoundary(r?.end);if(null===e)continue;const n=r?.mean;if(null==n)continue;const s="number"==typeof n?n:parseFloat(String(n));if(!isFinite(s)||s<0)continue;const l=null!==o?(e+o)/2:e;t.push(new Date(l)),i.push(s)}return{times:t,values:i}}(d);else{const r=await callWSWithTimeout(e.hass,{type:"history/history_during_period",start_time:i.toISOString(),end_time:s.toISOString(),entity_ids:[t],minimal_response:!0,no_attributes:!0,significant_changes_only:!0});l=function parseRawIrradianceHistory(e){const t=[],i=[];let r=null;for(const o of e){const e=o?.s??o?.state;if(null==e||"unavailable"===e||"unknown"===e||""===e)continue;const n=parseFloat(String(e));if(!isFinite(n)||n<0)continue;let s=null;const l=o?.lu??o?.lc??o?.last_updated??o?.last_changed??null;if("number"==typeof l)s=new Date(l>1e12?l:1e3*l);else if("string"==typeof l){const e=Number(l);s=Number.isFinite(e)&&e>1e9?new Date(e>1e12?e:1e3*e):new Date(l)}s&&!isNaN(s.getTime())||null===r||(s=new Date(r)),s&&!isNaN(s.getTime())&&(r=s.getTime(),t.push(s),i.push(n))}return{times:t,values:i}}((r&&r[t])??[])}e._irradianceHistory=l,pushIrradianceToEngine(e),o&&Xe.set(o,{history:l,ts:Date.now()})}catch(n){n instanceof Be?console.warn(`[HELIOS] irradiance fetch timed out (${n.timeoutMs} ms), engine falls back to Open-Meteo for the past window.`):console.warn("[HELIOS] Irradiance history fetch failed:",n),e._irradianceHistory={times:[],values:[]},pushIrradianceToEngine(e)}finally{e._irradianceFetching=!1}}(e,t,n,e._timeRange.end,s)}var Ze=/* @__PURE__ */new WeakMap;function pushIrradianceToEngine(e){if(!e._engine)return;const t=String(e.config?.["solar-irradiance-entity"]??"").trim();if(!t||!e.hass)return e._engine.setSolarRadiationSamples(null),void Ze.delete(e);const i=e._irradianceHistory,r=e.hass.states?.[t],o=Ze.get(e);if(o&&o.histRef===i&&o.stateRef===r&&o.entity===t)return;const n=[];if(i)for(let s=0;s<i.times.length;s++)n.push({time:i.times[s],wm2:i.values[s]});if(r){const e=parseFloat(r.state);if(isFinite(e)&&e>=0){const t=r.last_updated?new Date(r.last_updated):/* @__PURE__ */new Date;n.push({time:t,wm2:e})}}e._engine.setSolarRadiationSamples(n.length>0?n:null),Ze.set(e,{histRef:i,stateRef:r,entity:t})}function startOfDay(e){const t=new Date(e);return t.setHours(0,0,0,0),t}function addDays(e,t){const i=new Date(e);return i.setDate(i.getDate()+t),i}function addWeeks(e,t){return addDays(e,7*t)}function addMonths(e,t){const i=new Date(e);return i.setMonth(i.getMonth()+t),i}function startOfISOWeek(e){const t=startOfDay(e);return addDays(t,-(t.getDay()+6)%7)}function startOfMonth(e){const t=new Date(e);return t.setHours(0,0,0,0),t.setDate(1),t}function buildTimelineModel(e,t,i=7){const r=t.getTime()-e.getTime()||1,o=r/me;let n,s,l,c,d;if(o<=2.05){n="intraday";const t=r/ge,o=[1,2,3,4,6,12].find(e=>t/e<=i)??12,u=Math.ceil((e.getHours()+e.getMinutes()/60+.001)/o)*o;s=new Date(startOfDay(e).getTime()+u*ge),l=e=>new Date(e.getTime()+o*ge),c=null,d="boundary"}else o<=14.05?(n="days",s=addDays(startOfDay(e),1),l=e=>addDays(e,1),c=e=>startOfDay(e),d="centered"):o<=120.05?(n="weeks",s=startOfISOWeek(addWeeks(e,1)),l=e=>addWeeks(e,1),c=e=>startOfISOWeek(e),d="boundary"):(n="months",s=startOfMonth(addMonths(e,1)),l=e=>addMonths(e,1),c=e=>startOfMonth(e),d="centered");const u="days"===n?Math.max(i,16):i,thin=e=>{const t=Math.max(1,Math.ceil(e.length/u));return e.filter((e,i)=>i%t===0)},p=[];for(let y=s,b=0;y.getTime()<t.getTime()&&b<500;b++){const t=(y.getTime()-e.getTime())/r;t>0&&t<1&&p.push({frac:t,date:new Date(y)}),y=l(y)}const g=thin(p);let m;if("boundary"===d)m=g;else{const i=[];let o=c(e);for(let n=0;o.getTime()<t.getTime()&&n<500;n++){const n=l(o),s=n.getTime()-o.getTime()||1;if(Math.min(n.getTime(),t.getTime())-Math.max(o.getTime(),e.getTime())>=.99*s){const t=((o.getTime()+n.getTime())/2-e.getTime())/r;i.push({frac:t,date:new Date(o)})}o=n}m=thin(i)}const f=[];if(o>1.05&&o<=40){let i=addDays(startOfDay(e),1);for(let o=0;i.getTime()<t.getTime()&&o<64;o++){const t=(i.getTime()-e.getTime())/r;t>0&&t<1&&f.push(t),i=addDays(i,1)}}return{kind:n,start:e,end:t,separators:g,labels:m,dayBoundaries:f}}function nearlyEq(e,t){return Math.abs(e-t)<=.25}function pointEq(e,t){return e===t||!(!e||!t)&&(nearlyEq(e.x,t.x)&&nearlyEq(e.y,t.y))}function refreshHud(e){const t=e._engine?.projectHomeLabelLayout()??null;(function labelLayoutEq(e,t){return e===t||!(!e||!t)&&pointEq(e.pvLabel,t.pvLabel)&&pointEq(e.batterySocLabel,t.batterySocLabel)&&pointEq(e.batteryPowerLabel,t.batteryPowerLabel)&&pointEq(e.gridLabel,t.gridLabel)&&pointEq(e.home,t.home)&&e.homeAnchorPoints===t.homeAnchorPoints})(e._labelLayout,t)||(e._labelLayout=t);const i=e._selectedTime??e._now,r=e._engine?e._engine.projectSunScene(i):null;(function sunSceneEq(e,t){if(e===t)return!0;if(!e||!t)return!1;if(!nearlyEq(e.daylight,t.daylight))return!1;if(!pointEq(e.home,t.home))return!1;if(!nearlyEq(e.sun.x,t.sun.x)||!nearlyEq(e.sun.y,t.sun.y)||!nearlyEq(e.sun.altitude,t.sun.altitude))return!1;if(e.arc.length!==t.arc.length)return!1;for(let i=0;i<e.arc.length;i++){const r=e.arc[i],o=t.arc[i];if(r.belowHorizon!==o.belowHorizon)return!1;if(!nearlyEq(r.x,o.x)||!nearlyEq(r.y,o.y))return!1}return!(null===e.sunrise!=(null===t.sunrise)||e.sunrise&&t.sunrise&&(!nearlyEq(e.sunrise.x,t.sunrise.x)||!nearlyEq(e.sunrise.y,t.sunrise.y))||null===e.sunset!=(null===t.sunset)||e.sunset&&t.sunset&&(!nearlyEq(e.sunset.x,t.sunset.x)||!nearlyEq(e.sunset.y,t.sunset.y)))})(e._sunScene,r)||(e._sunScene=r)}function flowDuration(e,t,i=.4){if(!isFinite(e)||e<=0)return 30;const r=1-Math.min(1,e/t);return 30-(30-i)*(1-r*r*r)}var Je=["solar-irradiance-entity","display-radius","building-cluster-radius","building-count","building-real-size","building-height","building-opacity","auto-rotate-enabled"];function parseConfigCoord(e){if("number"==typeof e)return isFinite(e)?e:null;if("string"==typeof e){const t=e.trim();if(""===t)return null;const i=Number(t);return isFinite(i)?i:null}return null}var Qe=/* @__PURE__ */new WeakMap,et=null;function getHomeCoords(e,t){const i=t?.config,r=window.__heliosLocationOverride;if(e){const t=Qe.get(e);if(t&&t.hassCfg===i&&t.overrideId===r)return t.result}else if(et&&et.hassCfg===i&&et.overrideId===r)return et.result;const o=function _resolveHomeCoords(e,t,i){if(i&&"number"==typeof i.lat&&"number"==typeof i.lon&&isFinite(i.lat)&&isFinite(i.lon))return{lat:i.lat,lon:i.lon};const r=parseConfigCoord(e?.["home-latitude"]),o=parseConfigCoord(e?.["home-longitude"]);if(null!==r&&null!==o&&r>=-90&&r<=90&&o>=-180&&o<=180)return{lat:r,lon:o};const n=t?.latitude,s=t?.longitude;return"number"!=typeof n||"number"!=typeof s?null:{lat:n,lon:s}}(e,i,r),n={hassCfg:i,overrideId:r,result:o};return e?Qe.set(e,n):et=n,o}var tt=/* @__PURE__ */new WeakMap;function computeConfigSig(e){if(!e)return"";const t=tt.get(e);if(void 0!==t)return t;const i=Je.map(t=>`${t}=${e[t]??""}`).join("|");return tt.set(e,i),i}function initEngine(e){e._initInflight=!0,function initEngineNow(e){requestAnimationFrame(()=>{const t=e;if(!t.isConnected)return void(e._initInflight=!1);const i=t.shadowRoot?.getElementById("map-container");if(!i||!e.config||!e.hass?.config)return void(e._initInflight=!1);const r=getHomeCoords(e.config,e.hass);if(!r)return void(e._initInflight=!1);const{lat:o,lon:n}=r,s=e.hass.config.elevation,l=void 0!==e._engine;for(e._engine?.cleanup(),e._engine=void 0;i.firstChild;)i.removeChild(i.firstChild);const spawnNewEngine=()=>{e.config&&e.hass?.config?(e._engine=new Ie(i,e.config,[n,o],s,e.themeIsDark()),function wireEngineCallbacks(e){if(!e._engine)return;e.requestUpdate(),e._engine.onWeatherUpdate=t=>{e._cloudCover=t.cloudCover,e._timeRange=t.timeRange,e._isLiveMode=t.isLiveTime,e._chartSeries=e._engine?.getTimelineSeries()??null,refreshHud(e)};let t=null;e._engine.onMapTransform=()=>{e._engine?.isPaused()||null===t&&(t=requestAnimationFrame(()=>{t=null,refreshHud(e)}))}}(e),e._timeRange||(e._timeRange=e._engine.getTimelineRange()),e._initInflight=!1):e._initInflight=!1};l?requestAnimationFrame(spawnNewEngine):spawnNewEngine()})}(e)}async function fetchHaSolarForecast(e){if(e.hass?.callWS&&!(e._haSolarForecastFetching||e._haSolarForecastLoaded&&Date.now()-(e._haSolarForecastFetchedAt??0)<3e5)){e._haSolarForecastFetchedAt=Date.now(),e._haSolarForecastFetching=!0;try{const t=await async function fetchHeliosSeries(e){const t=e._energyDefaults?.solarForecastEntryIds??[];if(0===t.length)return null;const i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const r=/* @__PURE__ */new Date(i.getTime()-2*me).toISOString(),o=new Date(i.getTime()+3*me).toISOString();for(const n of t)try{const t=(await e.hass.callWS({type:"helios_forecast/series",entry_id:n,start:r,end:o}))?.points;if(!Array.isArray(t))continue;const i=[];for(const e of t){const t=Date.parse(e.t);Number.isFinite(t)&&"number"==typeof e.pv_w&&Number.isFinite(e.pv_w)&&i.push({tMs:t,wh:e.pv_w})}return i.sort((e,t)=>e.tMs-t.tMs),i}catch(P){continue}return null}(e);e._haSolarForecast=null!==t?t:function mergeSolarForecast(e){if(!e||"object"!=typeof e)return[];const t=/* @__PURE__ */new Map;for(const r of Object.keys(e)){const i=e[r]?.wh_hours;if(i&&"object"==typeof i)for(const e of Object.keys(i)){const r=Date.parse(e);if(!Number.isFinite(r))continue;const o=i[e];"number"==typeof o&&Number.isFinite(o)&&t.set(r,(t.get(r)??0)+o)}}const i=[];for(const[r,o]of t)i.push({tMs:r,wh:o});return i.sort((e,t)=>e.tMs-t.tMs),i}(await e.hass.callWS({type:"energy/solar_forecast"})),e._haSolarForecastLoaded=!0,e.requestUpdate()}catch(P){e._haSolarForecastLoaded=!0}finally{e._haSolarForecastFetching=!1}}}function forecastWattsAt(e,t){if(0===e.length)return null;let i=0,r=e.length-1,o=-1;for(;i<=r;){const n=i+r>>1;e[n].tMs<=t?(o=n,i=n+1):r=n-1}if(o<0)return null;const n=e[o],s=e[o+1];if(s&&s.tMs-n.tMs<=54e5&&s.tMs>n.tMs){const e=(t-n.tMs)/(s.tMs-n.tMs),i=e<0?0:e>1?1:e;return n.wh+(s.wh-n.wh)*i}return t>=n.tMs+36e5?null:n.wh}function bucketForMs(e,t,i,r){if(t<e)return-1;const o=Math.floor((t-e)/i);return o>=r?-1:o}function interpolateNullGaps(e){const t=e.length;let i=0;for(;i<t;){if(null!==e[i]){i++;continue}let r=i;for(;r<t&&null===e[r];)r++;const o=i>0?e[i-1]:null,n=r<t?e[r]:null;if(null===o&&null===n)return;if(null===o)for(let t=i;t<r;t++)e[t]=n;else{if(null===n){for(let r=i;r<t;r++)e[r]=o;return}{const t=r-i+1;for(let s=i;s<r;s++){const r=(s-i+1)/t;e[s]=o+(n-o)*r}}}i=r}}function buildGridChange(e,t,i,r,o){const n=changeSeriesToWatts(e,t,i,r,o);for(let c=0;c<n.length;c++){const e=n[c];null!==e&&e<0&&(n[c]=0)}const s=bucketForMs(t,o,i,r),l=Math.min(r,s<0?0:s+1);if(l>0){const e=n.slice(0,l);interpolateNullGaps(e);for(let t=0;t<l;t++)n[t]=e[t]}return n}function computeDataVersion(e){return`d${/* @__PURE__ */(new Date).toDateString()}|c${displayUpdateFrequencyPerHour(e.config)}|${e._chartSeries?.times.length??0}|${e._pvHistory?.times.length??0}|${e._pvCalibStats?.times.length??0}|${e._pvChangeSeries?.length??0}|${(e._batteryChargeChangeSeries?.length??0)+(e._batteryDischargeChangeSeries?.length??0)}|${e._gridImportChangeSeries?.length??0}|${e._gridExportChangeSeries?.length??0}|${e._batterySoc??""}|f${e._haSolarForecast?.length??0}`}function buildUnifiedStore(e){const t=displayUpdateFrequencyPerHour(e.config),i=24*t,r=e._periodPastDays,o=r+1+e._periodFutureDays,n=o*i,s=ge/t,l={bucketsPerHour:t,bucketsPerDay:i,bucketsTotal:n,stepMs:s},c=function storeOriginMs(e){const t=/* @__PURE__ */new Date;return t.setHours(0,0,0,0),t.getTime()-e*me}(r),d=c+o*me,u=Date.now(),p=function buildIrradiance(e,t,i,r){const o=new Array(r.bucketsTotal).fill(null),n=e._chartSeries;if(!n||0===n.times.length)return o;const s=new Array(r.bucketsTotal).fill(0),l=new Array(r.bucketsTotal).fill(0);for(let c=0;c<n.times.length;c++){const e=n.times[c].getTime();if(e<t||e>=i)continue;const o=n.irradiance?.[c];if("number"!=typeof o||!Number.isFinite(o)||o<0)continue;const d=bucketForMs(t,e,r.stepMs,r.bucketsTotal);d<0||(s[d]+=o,l[d]+=1)}for(let c=0;c<r.bucketsTotal;c++)l[c]>0&&(o[c]=s[c]/l[c]);return interpolateNullGaps(o),o}(e,c,d,l),g=function buildCloud(e,t,i,r){const o=new Array(r.bucketsTotal).fill(null),n=e._chartSeries;if(!n||0===n.times.length)return o;const s=new Array(r.bucketsTotal).fill(0),l=new Array(r.bucketsTotal).fill(0);for(let c=0;c<n.times.length;c++){const e=n.times[c].getTime();if(e<t||e>=i)continue;const o=n.cloud[c];if("number"!=typeof o||!Number.isFinite(o))continue;const d=bucketForMs(t,e,r.stepMs,r.bucketsTotal);d<0||(s[d]+=Math.max(0,Math.min(100,o)),l[d]+=1)}for(let c=0;c<r.bucketsTotal;c++)l[c]>0&&(o[c]=s[c]/l[c]);return interpolateNullGaps(o),o}(e,c,d,l),m=function buildProduction(e,t,i,r,o){const n=changeSeriesToWatts(e._pvChangeSeries,t,o.stepMs,o.bucketsTotal,r);for(let c=0;c<n.length;c++){const e=n[c];null!==e&&e<0&&(n[c]=0)}const s=bucketForMs(t,r,o.stepMs,o.bucketsTotal),l=Math.min(o.bucketsTotal,s<0?0:s+1);if(l>0){const e=n.slice(0,l);interpolateNullGaps(e);for(let t=0;t<l;t++)n[t]=e[t]}return n}(e,c,0,u,l),f=function buildForecast(e,t,i,r){const o=new Array(r.bucketsTotal).fill(null),n=e._haSolarForecast;if(!n||0===n.length)return o;for(let s=0;s<r.bucketsTotal;s++){const e=t+s*r.stepMs+r.stepMs/2;if(e<t||e>=i)continue;const l=forecastWattsAt(n,e);null!==l&&Number.isFinite(l)&&(o[s]=Math.max(0,l))}return o}(e,c,d,l),y=function buildBattery(e,t,i,r){const o=changeSeriesToWatts(e._batteryChargeChangeSeries,t,r.stepMs,r.bucketsTotal,i),n=changeSeriesToWatts(e._batteryDischargeChangeSeries,t,r.stepMs,r.bucketsTotal,i),s=new Array(r.bucketsTotal).fill(null);for(let d=0;d<r.bucketsTotal;d++){const e=o[d],t=n[d];null===e&&null===t||(s[d]=Math.max(0,e??0)-Math.max(0,t??0))}const l=bucketForMs(t,i,r.stepMs,r.bucketsTotal),c=Math.min(r.bucketsTotal,l<0?0:l+1);if(c>0){const e=s.slice(0,c);interpolateNullGaps(e);for(let t=0;t<c;t++)s[t]=e[t]}return s}(e,c,u,l),b=function buildBatterySoc(e,t,i,r){const o=new Array(r.bucketsTotal).fill(null),n=e._batterySoc;if(null==n||!Number.isFinite(n))return o;const s=bucketForMs(t,i,r.stepMs,r.bucketsTotal);return s>=0&&(o[s]=Math.max(0,Math.min(100,n))),o}(e,c,u,l),v=buildGridChange(e._gridImportChangeSeries,c,l.stepMs,l.bucketsTotal,u),_=buildGridChange(e._gridExportChangeSeries,c,l.stepMs,l.bucketsTotal,u);return{storeStartMs:c,storeEndMs:d,bucketsPerHour:t,bucketsPerDay:i,bucketsTotal:n,stepMs:s,builtAtMs:u,dataVersion:computeDataVersion(e),irradiance:p,cloud:g,production:m,forecast:f,battery:y,batterySoc:b,gridImport:v,gridExport:_}}function valueAt(e,t,i){if(i<t.storeStartMs||i>=t.storeEndMs)return null;const r=(i-t.storeStartMs)/t.stepMs-.5,o=Math.max(0,Math.min(t.bucketsTotal-1,Math.floor(r))),n=Math.max(0,Math.min(t.bucketsTotal-1,o+1)),s=e[o],l=e[n];if(null===s&&null===l)return null;if(null===s)return l;if(null===l)return s;return s+(l-s)*Math.max(0,Math.min(1,r-o))}function findSunCrossing(e,t,i,r,o){const n=36e5;let s=getSunPosition(new Date(i),e,t).altitude,l=0,c=0,d=!1;for(let u=i+n;u<=r;u+=n){const i=getSunPosition(new Date(u),e,t).altitude;if("rising"===o&&s<=0&&i>0){l=u-n,c=u,d=!0;break}if("setting"===o&&s>0&&i<=0){l=u-n,c=u,d=!0;break}s=i}if(!d)return null;for(let u=0;u<12;u++){const i=(l+c)/2;"rising"===o==getSunPosition(new Date(i),e,t).altitude>0?c=i:l=i}/* @__PURE__ */
return new Date((l+c)/2)}var it=null;function renderTimelineNightZones(e){const t=function computeNightIntervals(e){const t=e._timeRange;if(!t)return[];const i=getHomeCoords(e.config,e.hass);if(!i)return[];const r=t.start.getTime(),o=t.end.getTime(),n=o-r;if(n<=0)return[];const s=`${r}|${o}|${i.lat.toFixed(4)}|${i.lon.toFixed(4)}`;if(it&&it.key===s)return it.out;const l=[],c=new Date(t.start);c.setHours(0,0,0,0),c.setDate(c.getDate()-1);const d=o+864e5;for(;c.getTime()<=d;){const e=c.getTime(),t=e+864e5,r=findSunCrossing(i.lat,i.lon,e,t,"rising"),o=findSunCrossing(i.lat,i.lon,e,t,"setting");r&&l.push({ms:r.getTime(),kind:"sunrise"}),o&&l.push({ms:o.getTime(),kind:"sunset"}),c.setDate(c.getDate()+1)}l.sort((e,t)=>e.ms-t.ms);const u=[];let p=null,g=!1;for(const f of l)"sunset"===f.kind?p=f.ms:(null!==p?(u.push({startMs:p,endMs:f.ms}),p=null):g||u.push({startMs:-1/0,endMs:f.ms}),g=!0);null!==p&&u.push({startMs:p,endMs:1/0});const m=[];for(const f of u){const e=Math.max(f.startMs,r),t=Math.min(f.endMs,o);t>e&&m.push({startPct:(e-r)/n*100,endPct:(t-r)/n*100})}return it={key:s,out:m},m}(e);return 0===t.length?U``:U`
        ${t.map(e=>U`
            <div
                class="hc-night-zone"
                style="left:${e.startPct.toFixed(2)}%; width:${(e.endPct-e.startPct).toFixed(2)}%"
            ></div>
        `)}
    `}var chartIsDark=e=>!!e.hass?.themes?.darkMode;function pvValueAtTime(e,t,i){const r=(e._pvUnit||"").trim();if(!r)return{value:NaN,unit:"",isPredicted:!1};const o=r.toLowerCase(),n="wh"===o||"kwh"===o||"mwh"===o,s=n?"kwh"===o?"kW":"mwh"===o?"MW":"W":r,l=s.toLowerCase(),c="kw"===l?.001:"mw"===l?1e-6:1,d=getHomeCoords(e.config,e.hass);if(d&&getSunPosition(new Date(t),d.lat,d.lon).altitude<=0)return{value:0,unit:s,isPredicted:!1};const u=i??e._pvHistory,p=u&&u.times.length>=1?u.times[0].getTime():1/0,g=u&&u.times.length>=1?u.times[u.times.length-1].getTime():-1/0;if(u&&u.times.length>=2&&t>=p&&t<=g)if(n)for(let f=1;f<u.times.length;f++){const e=u.times[f].getTime();if(t>e)continue;const i=u.times[f-1].getTime();if(t<i)break;const r=(e-i)/36e5;if(r<=0||r>6)break;const o=u.values[f]-u.values[f-1];if(!isFinite(o)||o<0)break;return{value:Math.max(0,o/r),unit:s,isPredicted:!1}}else{const e=interpAt(u.times,u.values,t);if(isFinite(e))return{value:Math.max(0,e),unit:s,isPredicted:!1}}if(!i){const i=e._pvCalibStats;if(i&&i.times.length>=2&&t<=g)if(n)for(let e=1;e<i.times.length;e++){const r=i.times[e].getTime();if(t>r)continue;const o=i.times[e-1].getTime();if(t<o)break;const n=(r-o)/36e5;if(n<=0||n>6)break;const l=i.values[e]-i.values[e-1];if(!isFinite(l)||l<0)break;return{value:Math.max(0,l/n),unit:s,isPredicted:!1}}else{const e=interpAt(i.times,i.values,t);if(isFinite(e))return{value:Math.max(0,e),unit:s,isPredicted:!1}}}if(i)return{value:NaN,unit:s,isPredicted:!1};const m=e._unifiedStore;if(m){const e=valueAt(m.forecast,m,t);if(null!==e&&e>0)return{value:Math.max(0,e)*c,unit:s,isPredicted:!0}}return{value:NaN,unit:s,isPredicted:!1}}function renderTimelineHoverTooltip(e){const t=e._timeRange,i=e._chartSeries;if(!t)return U``;const r=t.start.getTime(),o=t.end.getTime()-r;if(o<=0)return U``;const n=e._chartHoverPct;if(null===n||n<0||n>100)return U``;const s=n,l=r+s/100*o,c=i?interpAt(i.times,i.irradiance,l):NaN,d=i?interpAt(i.times,i.cloudLow,l):NaN,u=i?interpAt(i.times,i.cloudMid,l):NaN,p=i?interpAt(i.times,i.cloudHigh,l):NaN,g=pvValueAtTime(e,l),m=e._chartTarget??"production",f=e._unifiedStore,y=f?valueAt(f.gridImport,f,l)??NaN:NaN,b=f?valueAt(f.gridExport,f,l)??NaN:NaN,v=f?valueAt(f.battery,f,l)??NaN:NaN,_=f?valueAt(f.production,f,l)??NaN:NaN,w=isFinite(_)||isFinite(y)||isFinite(b)||isFinite(v),$=Math.max(0,(isFinite(_)?_:0)+(isFinite(y)?y:0)-(isFinite(b)?b:0)-(isFinite(v)?v:0)),M=e._batterySocHistory?interpAt(e._batterySocHistory.times,e._batterySocHistory.values,l):NaN,kw=t=>`${formatLocalisedNumber(e.hass,t/1e3,1)} kW`,T=e._pvHistoryPerEntity,C=T.size>1?Array.from(T.keys()).sort():[],F=[];for(let U=0;U<C.length;U++){const t=C[U],i=T.get(t);if(!i)continue;const r=pvValueAtTime(e,l,i);if(!isFinite(r.value))continue;const o=e.hass?.states?.[t],n=String(o?.attributes?.friendly_name??t),s="W"===r.unit?0:Math.abs(r.value)<100?1:0,c=`${formatLocalisedNumber(e.hass,r.value,s)} ${r.unit}`;F.push({id:t,label:n,valueText:c,colorIdx:U})}const A=isFinite(g.value),H=new Date(l),E=e.hass?.language||void 0,D=new Intl.DateTimeFormat(E,{hour:"2-digit",minute:"2-digit"}).format(H),R=new Date(H);R.setHours(0,0,0,0);const L=/* @__PURE__ */new Date;L.setHours(0,0,0,0);const P=R.getTime()===L.getTime(),I=l>Date.now();let O=function computeDailyKwhTotals(e){const t=/* @__PURE__ */new Map;if(!e._timeRange)return t;const{start:i,end:r}=e._timeRange,o=i.getTime(),n=r.getTime(),dayKey=e=>{const t=new Date(e);return t.setHours(0,0,0,0),t.getTime()},s=e._pvChangeSeries;if(s&&s.length>0){const e=new Date(o);for(e.setHours(0,0,0,0);e.getTime()<n;){const i=e.getTime(),r=new Date(e);r.setDate(r.getDate()+1);const o=sumChangeForDay(s,i,r.getTime());null!==o&&t.set(i,Math.max(0,o)),e.setTime(r.getTime())}}const l=e._unifiedStore;if(l){const e=Date.now(),i=l.stepMs/36e5;for(let r=0;r<l.bucketsTotal;r++){const s=l.storeStartMs+(r+.5)*l.stepMs;if(s<o||s>n)continue;if(s<e)continue;const c=l.forecast[r];if(null===c||!isFinite(c)||c<=0)continue;const d=dayKey(s);t.set(d,(t.get(d)??0)+c*i/1e3)}}return t}(e).get(R.getTime());P&&!I&&"number"==typeof e._haSolarTodayKwh&&isFinite(e._haSolarTodayKwh)&&(O=e._haSolarTodayKwh);const z=!I&&void 0!==O&&isFinite(O)&&O>=.05,W=I&&void 0!==O&&isFinite(O)&&O>=.05,j=void 0!==O&&isFinite(O)&&O>=.05?formatLocalisedNumber(e.hass,O,1)+" kWh":"",B=Date.now(),q=B>=r&&B<=r+o&&Math.abs(s-(B-r)/o*100)<=1.2,G=A?"W"===g.unit?0:Math.abs(g.value)<100?1:0:0,Y=(e.hass?.language||"").toLowerCase().startsWith("fr")?"Retour au live":"Back to live";return U`
        <div
            class="tb-hover-tooltip-tail ${q?"is-magnet-snap":""}"
            style="left:${s.toFixed(2)}%"
        ></div>
        <div
            class="tb-hover-tooltip-wrapper"
            style="left:${s.toFixed(2)}%; transform: translateX(-${s.toFixed(2)}%)"
        >
            <div class="tb-hover-tooltip">
                <div class="tb-hover-tooltip-time">
                    <ha-icon class="tb-hover-tooltip-time-icon" icon="mdi:clock-outline"></ha-icon>
                    <span class="tb-hover-tooltip-time-label">${D}</span>
                    <span
                        class="tb-hover-tooltip-live-chip ${q?"is-visible":""}"
                        title="${Y}"
                        aria-label="${Y}"
                        aria-hidden="${q?"false":"true"}"
                    >
                        <ha-icon class="tb-hover-tooltip-live-chip-dot" icon="mdi:circle-medium"></ha-icon>
                        <span class="tb-hover-tooltip-live-chip-label">${"Live"}</span>
                    </span>
                </div>
                ${"production"===m?U`
                    ${z&&j?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:solar-power-variant"></ha-icon>
                            <span class="tb-hover-tooltip-value">${j}</span>
                        </div>
                    `:K}
                    ${W&&j?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-value">${j}</span>
                        </div>
                    `:K}
                    ${A?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:solar-power"></ha-icon>
                            <span class="tb-hover-tooltip-value">${formatLocalisedNumber(e.hass,g.value,G)} ${g.unit}</span>
                        </div>
                    `:K}
                    ${F.map(t=>U`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${energySolarColor(e,chartIsDark(e),t.colorIdx)}"></span>
                            <span class="tb-hover-tooltip-sublabel">${t.label}</span>
                            <span class="tb-hover-tooltip-value">${t.valueText}</span>
                        </div>
                    `)}
                `:K}
                ${"consumption"===m&&w?U`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:home-lightning-bolt"></ha-icon>
                        <span class="tb-hover-tooltip-value">${kw($)}</span>
                    </div>
                `:K}
                ${"grid"===m?U`
                    ${isFinite(y)&&y>=1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:transmission-tower-export"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(y)}</span>
                        </div>
                    `:K}
                    ${isFinite(b)&&b>=1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:transmission-tower-import"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(b)}</span>
                        </div>
                    `:K}
                `:K}
                ${"battery"===m?U`
                    ${isFinite(v)&&v>=1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:battery-arrow-up"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(v)}</span>
                        </div>
                    `:K}
                    ${isFinite(v)&&v<=-1?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:battery-arrow-down"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(-v)}</span>
                        </div>
                    `:K}
                `:K}
                ${"battery-soc"===m&&isFinite(M)?U`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:battery"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,M)))} %</span>
                    </div>
                `:K}
                ${"irradiance"===m&&isFinite(c)?U`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:white-balance-sunny"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,c))} W/m²</span>
                    </div>
                `:K}
                ${"cloud"===m?U`
                    ${isFinite(d)?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:format-vertical-align-bottom"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,d)))} %</span>
                        </div>
                    `:K}
                    ${isFinite(u)?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:format-vertical-align-center"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,u)))} %</span>
                        </div>
                    `:K}
                    ${isFinite(p)?U`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:format-vertical-align-top"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0,Math.min(100,p)))} %</span>
                        </div>
                    `:K}
                `:K}
            </div>
        </div>
    `}function interpAt(e,t,i){const r=Math.min(e.length,t.length);if(0===r)return NaN;if(i<=e[0].getTime())return isFinite(t[0])?t[0]:NaN;if(i>=e[r-1].getTime()){const e=t[r-1];return isFinite(e)?e:NaN}let o=0,n=r-1;for(;n-o>1;){const t=o+n>>1;e[t].getTime()<=i?o=t:n=t}const s=e[o].getTime(),l=e[n].getTime(),c=t[o],d=t[n];if(!isFinite(c)||!isFinite(d))return NaN;const u=l-s;return u<=0?d:c+(d-c)*(i-s)/u}function renderPvChart(e){const t=e,i=e._timeRange;e._pvHistory;const r=1e3,o=100;if(!i)return U`<svg class="hc-chart-svg" viewBox="0 0 ${r} ${o}" preserveAspectRatio="none"></svg>`;const n=i.start.getTime(),s=i.end.getTime()-n;if(s<=0)return U`<svg class="hc-chart-svg" viewBox="0 0 ${r} ${o}" preserveAspectRatio="none"></svg>`;const l=ENERGY_COLOR_pv(t),c=e.hass?.themes?.darkMode?lerpHexToward(l,"#ffffff",.55):lerpHexToward(l,"#000000",.35),d=i.end.getTime(),u=buildTimelineModel(i.start,i.end).dayBoundaries.map(e=>e*r),p=(e._pvUnit||"").toLowerCase(),g="wh"===p||"kwh"===p||"mwh"===p,m=e._unifiedStore,f=m?function sliceForRange(e,t,i){const r=Math.max(e.storeStartMs,t),o=Math.min(e.storeEndMs,i);if(o<=r)return{times:[],production:[],forecast:[],cloud:[],irradiance:[]};const n=e.stepMs,s=Math.floor((r-e.storeStartMs)/n),l=[],c=[],d=[],u=[],p=[];for(let g=e.storeStartMs+s*n+n/2;g<o;g+=n)g<r||(l.push(new Date(g)),c.push(valueAt(e.production,e,g)),d.push(valueAt(e.forecast,e,g)),u.push(valueAt(e.cloud,e,g)),p.push(valueAt(e.irradiance,e,g)));return{times:l,production:c,forecast:d,cloud:u,irradiance:p}}(m,n,d):null,xOf=e=>(e.getTime()-n)/s*r,y=(()=>{const e=g?"kwh"===p?"kw":"mwh"===p?"mw":"wh"===p?"w":"":p;return"kw"===e?.001:"mw"===e?1e-6:1})(),b=[];if(f)for(let L=0;L<f.times.length;L++){const e=f.production[L];null!==e&&isFinite(e)&&b.push({t:f.times[L],v:e*y})}const v=[];if(f)for(let L=0;L<f.times.length;L++){const e=f.forecast[L];null===e||!isFinite(e)||e<=0||v.push({t:f.times[L],v:e*y})}let _=1;for(const L of b)L.v>_&&(_=L.v);for(const L of v)L.v>_&&(_=L.v);const yOf=e=>o-90*Math.max(0,Math.min(1,e/_)),w=b.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`);let $="",M="";if(w.length>=2){const e=xOf(b[0].t),t=xOf(b[b.length-1].t);$=`M ${e},100 L ${w.join(" L ")} L ${t},100 Z`,M=`M ${w.join(" L ")}`}const T=e._pvHistoryPerEntity.size>1?Array.from(e._pvHistoryPerEntity.keys()).sort():[],C=[];for(let L=0;L<T.length;L++){const t=T[L],i=e._pvHistoryPerEntity.get(t);if(!i)continue;let r=i.times,o=i.values;if(g&&r.length>=2){const e=.05,t=[],i=[];let n=0;for(let s=1;s<r.length;s++){const l=(r[s].getTime()-r[n].getTime())/36e5;if(l<=0)continue;if(l>6){n=s;continue}const c=o[s]-o[n];c<0?n=s:l<e||(t.push(r[s]),i.push(c/l),n=s)}r=t,o=i}const s=[],l=Math.max(1,Math.floor(r.length/750));for(let e=0;e<r.length;e+=l){const t=r[e],i=o[e],l=t.getTime();l<n||l>d||isFinite(i)&&s.push(`${xOf(t).toFixed(2)},${yOf(i).toFixed(2)}`)}s.length<2||C.push({id:t,line:`M ${s.join(" L ")}`,color:energySolarColor(e,chartIsDark(e),L)})}let F="";v.length>=2&&(F=`M ${v.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`).join(" L ")}`);const A=e._chartHoverPct;let H=0,E=NaN,D=NaN,R=!1;if(null!==A&&A>=0&&A<=100){H=A/100*r;const e=n+A/100*s,t=b.length>0?b[b.length-1].t.getTime():-1/0;if(b.length>=1&&e<=t){const t=interpAt(b.map(e=>e.t),b.map(e=>e.v),e);isFinite(t)&&(E=yOf(Math.max(0,t)))}if(v.length>=1){const t=interpAt(v.map(e=>e.t),v.map(e=>e.v),e);isFinite(t)&&(D=yOf(Math.max(0,t)))}R=isFinite(E)||isFinite(D)}return U`
        <svg
            class="hc-chart-svg"
            viewBox="0 0 ${r} ${o}"
            preserveAspectRatio="none"
        >
            ${u.map(e=>B`
                <line
                    class="hc-day-sep"
                    x1="${e.toFixed(2)}" y1="0"
                    x2="${e.toFixed(2)}" y2="${o}"
                ></line>
            `)}
            <g class="hc-chart-grow">
                ${$?B`
                    <path
                        d="${$}"
                        fill="${l}"
                        fill-opacity="0.25"
                    ></path>
                `:K}
                ${C.map(e=>B`
                    <path
                        class="hc-chart-line hc-chart-line-source"
                        d="${e.line}"
                        stroke="${e.color}"
                    ></path>
                `)}
                ${M?B`
                    <path
                        class="hc-chart-line"
                        d="${M}"
                        stroke="${l}"
                    ></path>
                `:K}
                ${F?B`
                    <path
                        class="hc-chart-line hc-chart-predicted"
                        d="${F}"
                        stroke="${c}"
                    ></path>
                `:K}
            </g>
            ${R?B`
                <line
                    class="hc-hover-guide"
                    x1="${H.toFixed(2)}" y1="0"
                    x2="${H.toFixed(2)}" y2="${o}"
                ></line>
            `:K}
        </svg>
        ${R&&isFinite(E)?U`
            <div class="hc-hover-dot-html" style="left: ${(H/r*100).toFixed(2)}%; top: ${(E/o*100).toFixed(2)}%; background: ${l};"></div>
        `:K}
        ${R&&isFinite(D)?U`
            <div class="hc-hover-dot-html" style="left: ${(H/r*100).toFixed(2)}%; top: ${(D/o*100).toFixed(2)}%; background: ${c};"></div>
        `:K}
    `}function renderBottomChart(e){const t=e._chartTarget??"production";return"production"===t?renderPvChart(e):function renderTargetChart(e,t){const i=e,r=e._unifiedStore,o=e._timeRange,n=1e3,s=100;if(!r||!o)return U`<svg class="hc-chart-svg" viewBox="0 0 ${n} ${s}" preserveAspectRatio="none"></svg>`;const l=o.start.getTime(),c=o.end.getTime(),d=c-l;if(d<=0)return U`<svg class="hc-chart-svg" viewBox="0 0 ${n} ${s}" preserveAspectRatio="none"></svg>`;const xOf=e=>(e-l)/d*n,toPts=(e,t)=>{const i=[];for(let o=0;o<e.length;o++){const n=e[o];if(null===n||!isFinite(n))continue;const s=r.storeStartMs+(o+.5)*r.stepMs;s<l||s>c||i.push({t:s,v:t?t(n):n})}return i},sum=e=>e.reduce((e,t)=>e+t.v,0);let u,p=0;if("consumption"===t){const e=[];for(let t=0;t<r.production.length;t++){const i=r.production[t],o=r.gridImport[t],n=r.gridExport[t],s=r.battery[t];if(null===i&&null===o&&null===n&&null===s)continue;const d=r.storeStartMs+(t+.5)*r.stepMs;if(d<l||d>c)continue;const u=Math.max(0,(i??0)+(o??0)-(n??0)-(s??0));e.push({t:d,v:u})}u=[{pts:e,color:ENERGY_COLOR_consumption(i)}]}else if("grid"===t){const e=toPts(r.gridImport),t=toPts(r.gridExport);u=[{pts:e,color:ENERGY_COLOR_gridImport(i)},{pts:t,color:ENERGY_COLOR_gridExport(i)}]}else if("battery"===t){const e=toPts(r.battery,e=>Math.max(0,e)),t=toPts(r.battery,e=>Math.max(0,-e));u=[{pts:e,color:ENERGY_COLOR_batteryIn(i)},{pts:t,color:ENERGY_COLOR_batteryOut(i)}]}else if("battery-soc"===t){const t=e._batterySocHistory,r=[];if(t)for(let e=0;e<t.times.length;e++){const i=t.times[e].getTime();if(i<l||i>c)continue;const o=t.values[e];void 0!==o&&isFinite(o)&&r.push({t:i,v:o})}u=[{pts:r,color:ENERGY_COLOR_batteryOut(i)}],p=100}else if("cloud"===t){const t=e._chartSeries,csPts=e=>{if(!t)return[];const i=[];for(let r=0;r<t.times.length;r++){const o=t.times[r].getTime();if(o<l||o>c)continue;const n=e[r];void 0!==n&&isFinite(n)&&i.push({t:o,v:n})}return i};u=[{pts:csPts(t?.cloudLow??[]),color:lerpHexToward(ENERGY_COLOR_cloud(i),"#ffffff",.35)},{pts:csPts(t?.cloudMid??[]),color:ENERGY_COLOR_cloud(i)},{pts:csPts(t?.cloudHigh??[]),color:lerpHexToward(ENERGY_COLOR_cloud(i),"#000000",.3)}],p=100}else u=[{pts:toPts(r.irradiance),color:ENERGY_COLOR_sun(i)}],p=1e3;let g=p;if(g<=0){g=1;for(const e of u)for(const t of e.pts)t.v>g&&(g=t.v)}const m=10,yOf=e=>s-Math.max(0,Math.min(1,e/g))*(s-m),f=u.map(e=>{if(e.pts.length<2)return{area:"",line:"",color:e.color,total:sum(e.pts)};const t=e.pts.map(e=>`${xOf(e.t).toFixed(2)},${yOf(e.v).toFixed(2)}`),i=xOf(e.pts[0].t),r=xOf(e.pts[e.pts.length-1].t);return{area:`M ${i},${s} L ${t.join(" L ")} L ${r},${s} Z`,line:`M ${t.join(" L ")}`,color:e.color,total:sum(e.pts)}}),y=buildTimelineModel(o.start,o.end).dayBoundaries.map(e=>e*n),b=e._chartHoverPct;let v=0,_=!1;const w=[];if(null!==b&&b>=0&&b<=100){v=b/100*n;const e=l+b/100*d;for(const t of u){if(t.pts.length<1)continue;const i=interpAt(t.pts.map(e=>new Date(e.t)),t.pts.map(e=>e.v),e);isFinite(i)&&(w.push({y:yOf(Math.max(0,i)),color:t.color}),_=!0)}}return U`
        <svg class="hc-chart-svg" viewBox="0 0 ${n} ${s}" preserveAspectRatio="none">
            ${y.map(e=>B`
                <line class="hc-day-sep" x1="${e.toFixed(2)}" y1="0" x2="${e.toFixed(2)}" y2="${s}"></line>
            `)}
            <g class="hc-chart-grow">
                ${f.map(e=>e.area?B`
                    <path d="${e.area}" fill="${e.color}" fill-opacity="0.22"></path>
                `:K)}
                ${f.map(e=>e.line?B`
                    <path class="hc-chart-line" d="${e.line}" stroke="${e.color}"></path>
                `:K)}
            </g>
            ${_?B`
                <line class="hc-hover-guide" x1="${v.toFixed(2)}" y1="0" x2="${v.toFixed(2)}" y2="${s}"></line>
            `:K}
        </svg>
        ${w.map(e=>U`
            <div class="hc-hover-dot-html" style="left: ${(v/n*100).toFixed(2)}%; top: ${(e.y/s*100).toFixed(2)}%; background: ${e.color};"></div>
        `)}
    `}(e,t)}function chartAccentColor(e){const t=e,i=e._chartTarget??"production";if("production"===i)return ENERGY_COLOR_pv(t);if("consumption"===i)return ENERGY_COLOR_consumption(t);if("irradiance"===i)return ENERGY_COLOR_sun(t);if("cloud"===i)return ENERGY_COLOR_cloud(t);if("battery-soc"===i)return ENERGY_COLOR_batteryOut(t);const r=e._unifiedStore,o=e._timeRange;if(!r||!o)return"grid"===i?ENERGY_COLOR_gridImport(t):ENERGY_COLOR_batteryOut(t);const n=o.start.getTime(),s=o.end.getTime(),sumArr=(e,t)=>{let i=0;for(let o=0;o<e.length;o++){const l=e[o];if(null===l||!isFinite(l))continue;const c=r.storeStartMs+(o+.5)*r.stepMs;c<n||c>s||(i+=t?t(l):l)}return i};return"grid"===i?sumArr(r.gridImport)>=sumArr(r.gridExport)?ENERGY_COLOR_gridImport(t):ENERGY_COLOR_gridExport(t):sumArr(r.battery,e=>Math.max(0,e))>=sumArr(r.battery,e=>Math.max(0,-e))?ENERGY_COLOR_batteryIn(t):ENERGY_COLOR_batteryOut(t)}function renderTimelineDayLabels(e){if(!e._timeRange)return U``;const{start:t,end:i}=e._timeRange,r=buildTimelineModel(t,i),o=r.labels.filter(e=>e.frac>.02&&e.frac<.98),n=r.separators.filter(e=>e.frac>.02&&e.frac<.98),s=/* @__PURE__ */new Date;s.setHours(0,0,0,0);return U`
        <div class="tb-day-strip">
            ${n.map(e=>U`
                <div class="tb-day-strip-sep" style="left:${(100*e.frac).toFixed(2)}%"></div>
            `)}
            ${o.map(t=>U`
                <span
                    class="tb-day-strip-date ${(e=>"days"===r.kind&&e.getTime()===s.getTime())(t.date)?"is-today":""}"
                    style="left:${(100*t.frac).toFixed(2)}%"
                >${function formatTimelineLabel(e,t,i){const r=i?.language||void 0,o="intraday"===e?{hour:"2-digit",minute:"2-digit"}:"days"===e?{weekday:"short"}:"weeks"===e?{day:"numeric",month:"short"}:{month:"long"};try{return new Intl.DateTimeFormat(r,o).format(t)}catch(P){return new Intl.DateTimeFormat(void 0,o).format(t)}}(r.kind,t.date,e.hass)}</span>
            `)}
        </div>
    `}function tick(e){const t=/* @__PURE__ */new Date,i=e._now;if(i&&t.getMinutes()===i.getMinutes()&&t.getHours()===i.getHours()&&t.getDate()===i.getDate()&&t.getMonth()===i.getMonth()&&t.getFullYear()===i.getFullYear())return;const r=!i||t.getDate()!==i.getDate()||t.getMonth()!==i.getMonth()||t.getFullYear()!==i.getFullYear();if(e._now=t,r&&e._engine){const t=e._engine.getTimelineRange();t&&(e._timeRange=t),e._chartSeries=e._engine.getTimelineSeries()??e._chartSeries}refreshHud(e)}function applyTimelinePointer(e,t){if(!e._timeRange)return;const i=t.currentTarget.getBoundingClientRect(),r=Math.max(0,Math.min(1,(t.clientX-i.left)/i.width)),o=e._timeRange.end.getTime()-e._timeRange.start.getTime(),n=e._timeRange.start.getTime()+r*o,s=Date.now(),l=e._timeRange.start.getTime(),c=e._timeRange.end.getTime();if(s>=l&&s<=c){const r=(s-l)/o,n=i.left+r*i.width,c=t.clientX;if(Math.abs(c-n)<=8)return void(e._isLiveMode&&null===e._selectedTime||(e._selectedTime=null,e._isLiveMode=!0,e._chartHoverPct=null,e._engine?.setSelectedTime(null)))}const d=new Date(n);e._selectedTime&&e._selectedTime.getTime()===d.getTime()||(e._selectedTime=d,e._isLiveMode=!1,e._chartHoverPct=100*r,e._engine?.setSelectedTime(d))}function refreshGrid(e){if(!e.hass)return null!==e._gridImportValue&&(e._gridImportValue=null),""!==e._gridImportUnit&&(e._gridImportUnit=""),null!==e._gridExportValue&&(e._gridExportValue=null),void(""!==e._gridExportUnit&&(e._gridExportUnit=""));fetchGridChangeSeries(e,"import"),fetchGridChangeSeries(e,"export");const t=e._energyDefaults?.gridStatRates??[];if(t.length>0)!function readStatRates(e,t){let i=0,r=!1;for(const o of t){const t=e.hass.states?.[o];if(!t)continue;const n=t.state;if(null==n||""===n||"unknown"===n||"unavailable"===n)continue;const s=parseNumericState(n);if(null===s)continue;const l=pvNormalizeToWatts(s,String(t.attributes?.unit_of_measurement??"").trim());i+=e._energyDefaults?.invertedRateEntities.includes(o)??!1?-l:l,r=!0}if(!r)return;!function applyCombinedSplit(e,t){t>=0?(applyValue(e,"import",t,"W"),applyValue(e,"export",null,"")):(applyValue(e,"import",null,""),applyValue(e,"export",-t,"W"))}(e,i)}(e,t);else{const t=Date.now(),i=latestWattsFromChangeSeries(e._gridImportChangeSeries,t),r=latestWattsFromChangeSeries(e._gridExportChangeSeries,t);applyValue(e,"import",null!==i?Math.max(0,i):null,null!==i?"W":""),applyValue(e,"export",null!==r?Math.max(0,r):null,null!==r?"W":"")}}function fetchGridChangeSeries(e,t){const i=e._energyDefaults,r="import"===t?i?.gridStatEnergyFroms??[]:i?.gridStatEnergyTos??[];if(0===r.length)return;if("import"===t?e._gridImportChangeFetching:e._gridExportChangeFetching)return;const o=/* @__PURE__ */new Date;o.setHours(0,0,0,0);const n=o.getTime()-1728e5,s=changeRefreshAnchorMs(),l=[...r].sort(),c=`${l.join(",")}|${n}|${s}`;c!==("import"===t?e._gridImportChangeFetchKey:e._gridExportChangeFetchKey)&&("import"===t?(e._gridImportChangeFetchKey=c,e._gridImportChangeFetching=!0):(e._gridExportChangeFetchKey=c,e._gridExportChangeFetching=!0),fetchChangeSeries(e.hass,l,n,s,"5minute").then(i=>{null!==i&&("import"===t?e._gridImportChangeSeries=i:e._gridExportChangeSeries=i),e.requestUpdate()}).finally(()=>{"import"===t?e._gridImportChangeFetching=!1:e._gridExportChangeFetching=!1}))}function applyValue(e,t,i,r){const o=null===i?null:Math.max(0,i);"import"===t?(e._gridImportValue!==o&&(e._gridImportValue=o),e._gridImportUnit!==r&&(e._gridImportUnit=r)):(e._gridExportValue!==o&&(e._gridExportValue=o),e._gridExportUnit!==r&&(e._gridExportUnit=r))}function parseNumericState(e){if("number"==typeof e)return Number.isFinite(e)?e:null;if("string"!=typeof e)return null;const t=e.trim();if(""===t)return null;const i=t.replace(",","."),r=parseFloat(i);return Number.isFinite(r)?r:null}function formatGridValue(e,t,i,r){return null===t?"":formatEntityValue(e,t,i,r)}var rt={solarStatRates:[],solarStatEnergyFroms:[],gridStatRates:[],gridStatEnergyFroms:[],gridStatEnergyTos:[],batteryStatRates:[],batteryStatEnergyFroms:[],batteryStatEnergyTos:[],batteryStatSocs:[],invertedRateEntities:[],solarForecastEntryIds:[]};async function fetchEnergyPrefs(e){if(e.hass?.callWS)try{e._energyDefaults=function parseEnergyPrefs(e){const t={solarStatRates:[],solarStatEnergyFroms:[],gridStatRates:[],gridStatEnergyFroms:[],gridStatEnergyTos:[],batteryStatRates:[],batteryStatEnergyFroms:[],batteryStatEnergyTos:[],batteryStatSocs:[],invertedRateEntities:[],solarForecastEntryIds:[]},i=Array.isArray(e?.energy_sources)?e.energy_sources:[];for(const r of i){if(!r||"object"!=typeof r)continue;const e=String(r.type??"").toLowerCase();if("solar"===e){const e=pickFirstString(r.stat_energy_from);e&&t.solarStatEnergyFroms.push(e);const i=pickFirstString(r.stat_rate);i&&t.solarStatRates.push(i);const o=r.config_entry_solar_forecast;if(Array.isArray(o))for(const r of o)"string"!=typeof r||""===r.trim()||t.solarForecastEntryIds.includes(r.trim())||t.solarForecastEntryIds.push(r.trim());else"string"!=typeof o||""===o.trim()||t.solarForecastEntryIds.includes(o.trim())||t.solarForecastEntryIds.push(o.trim())}else if("grid"===e){const e=pickFirstString(r.stat_energy_from);e&&t.gridStatEnergyFroms.push(e);const i=pickFirstString(r.stat_energy_to);i&&t.gridStatEnergyTos.push(i);const o=pickFirstString(r.stat_rate);if(o)t.gridStatRates.push(o);else for(const n of collectPowerConfigRates(r.power_config,"grid"))t.gridStatRates.push(n.entity),n.inverted&&t.invertedRateEntities.push(n.entity)}else if("battery"===e){const e=pickFirstString(r.stat_energy_from);e&&t.batteryStatEnergyFroms.push(e);const i=pickFirstString(r.stat_energy_to);i&&t.batteryStatEnergyTos.push(i);const o=pickFirstString(r.stat_soc);o&&t.batteryStatSocs.push(o);for(const n of collectPowerConfigRates(r.power_config,"battery"))t.batteryStatRates.push(n.entity),n.inverted&&t.invertedRateEntities.push(n.entity)}}return t}(await e.hass.callWS({type:"energy/get_prefs"})),e._energyDefaultsLoaded=!0,e.requestUpdate()}catch(P){e._energyDefaultsLoaded=!0}}function subscribeEnergyPrefs(e){if(e.hass?.connection&&!e._energyPrefsUnsub){fetchEnergyPrefs(e);try{e._energyPrefsUnsub=e.hass.connection.subscribeEvents(()=>fetchEnergyPrefs(e),"energy_preferences_updated")}catch(P){}}}var ot=/* @__PURE__ */new Map;async function fetchTodayKwhChange(e,t){if(0===t.length)return null;if(!e.hass?.callWS)return null;const i=/* @__PURE__ */new Date;i.setHours(0,0,0,0);const r=/* @__PURE__ */new Date,o=`${i.getFullYear()}-${i.getMonth()}-${i.getDate()}|${[...t].sort().join("|")}`,n=r.getTime(),s=ot.get(o);if(s){if(s.inflight)return s.inflight;if(n-s.ts<25e3)return s.result}const l=(async()=>{try{const o=await e.hass.callWS({type:"recorder/statistics_during_period",start_time:i.toISOString(),end_time:r.toISOString(),statistic_ids:t,period:"day",types:["change"],units:{energy:"kWh"}});let n=0,s=!1;for(const e of t){const t=o?.[e];if(Array.isArray(t))for(const e of t){const t="number"==typeof e?.change?e.change:null;null!==t&&(n+=t,s=!0)}}return s?n:null}catch(P){return null}})();ot.set(o,{ts:n,result:null,inflight:l});const c=await l;return ot.set(o,{ts:Date.now(),result:c}),c}async function refreshHaDailyTotals(e){const t=e._energyDefaults;let i=null,r=null,o=null,n=null,s=null;[i,r,o,n,s]=await Promise.all([fetchTodayKwhChange(e,t.solarStatEnergyFroms),fetchTodayKwhChange(e,t.gridStatEnergyFroms),fetchTodayKwhChange(e,t.gridStatEnergyTos),fetchTodayKwhChange(e,t.batteryStatEnergyTos),fetchTodayKwhChange(e,t.batteryStatEnergyFroms)]);let l=!1;null!==i&&i!==e._haSolarTodayKwh&&(e._haSolarTodayKwh=i,l=!0),null!==r&&r!==e._haGridImportTodayKwh&&(e._haGridImportTodayKwh=r,l=!0),null!==o&&o!==e._haGridExportTodayKwh&&(e._haGridExportTodayKwh=o,l=!0),null!==n&&n!==e._haBatteryChargedKwh&&(e._haBatteryChargedKwh=n,l=!0),null!==s&&s!==e._haBatteryDischargedKwh&&(e._haBatteryDischargedKwh=s,l=!0),l&&e.requestUpdate()}function collectPowerConfigRates(e,t){if(!e||"object"!=typeof e)return[];const i=e,r=[],o=pickFirstString(i.stat_rate);o&&r.push({entity:o,inverted:"battery"===t});const n=pickFirstString(i.stat_rate_inverted);if(n&&r.push({entity:n,inverted:"grid"===t}),r.length>0)return r;const s=pickFirstString(i.stat_rate_from);s&&r.push({entity:s,inverted:"battery"===t});const l=pickFirstString(i.stat_rate_to);return l&&r.push({entity:l,inverted:"grid"===t}),r}function pickFirstString(e){if("string"==typeof e&&""!==e.trim())return e.trim();if(Array.isArray(e))for(const t of e)if("string"==typeof t&&""!==t.trim())return t.trim();return null}var at,nt,st=i$6`
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
`;function __decorateMetadata(e,t){if("object"==typeof Reflect&&"function"==typeof Reflect.metadata)return Reflect.metadata(e,t)}function __decorate(e,t,i,r){var o,n=arguments.length,s=n<3?t:null===r?r=Object.getOwnPropertyDescriptor(t,i):r;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,r);else for(var l=e.length-1;l>=0;l--)(o=e[l])&&(s=(n<3?o(s):n>3?o(t,i,s):o(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s}var lt,ct,ht=(at=class HeliosCardEditor extends se{constructor(...e){super(...e),this._cfg={},this._pickerReady=!1,this._openSection="location",this._sliderDebounce=/* @__PURE__ */new Map,this._solarIrradianceEntityFilter=e=>{if(!e||!e.attributes)return!1;if("irradiance"===e.attributes.device_class)return!0;const t=String(e.attributes.unit_of_measurement??"").trim();return"W/m²"===t||"W/m2"===t},this._resetFeedback=null}disconnectedCallback(){super.disconnectedCallback();for(const e of this._sliderDebounce.values())window.clearTimeout(e);this._sliderDebounce.clear(),void 0!==this._resetFeedbackTimer&&(window.clearTimeout(this._resetFeedbackTimer),this._resetFeedbackTimer=void 0)}setConfig(e){this._cfg={...e}}connectedCallback(){super.connectedCallback(),this._ensureEntityPicker()}async _ensureEntityPicker(){if(!this._pickerReady)if("undefined"!=typeof customElements&&customElements.get("ha-entity-picker"))this._pickerReady=!0;else try{const e=window;if("function"==typeof e.loadCardHelpers){const t=await e.loadCardHelpers();if(t?.createCardElement){const e=(await t.createCardElement({type:"entities",entities:[]}))?.constructor;"function"==typeof e?.getConfigElement&&await e.getConfigElement()}}"undefined"!=typeof customElements&&await Promise.race([customElements.whenDefined("ha-entity-picker"),new Promise(e=>setTimeout(e,8e3))])}catch(e){console.warn("[HELIOS] Failed to lazy-load ha-entity-picker:",e)}finally{this._pickerReady=!0}}_t(){return pickTranslations(this.hass?.language)}_update(e,t){const i={...this._cfg,[e]:t};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i}})),this._cfg=i}_numField(e,t){const i=t.target.value.trim();if(""===i)return void this._update(e,void 0);const r=parseFloat(i);isFinite(r)&&this._update(e,r)}_numSlider(e,t){const i=parseFloat(t.target.value);if(!isFinite(i))return;this._cfg={...this._cfg,[e]:i};const r=String(e),o=this._sliderDebounce.get(r);void 0!==o&&window.clearTimeout(o);const n=window.setTimeout(()=>{this._sliderDebounce.delete(r),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._cfg}}))},nt.SLIDER_COMMIT_DELAY_MS);this._sliderDebounce.set(r,n)}_onSectionToggle(e,t){const i=t.currentTarget;i.open?(this._openSection=e,requestAnimationFrame(()=>{i.scrollIntoView({behavior:"smooth",block:"start"})})):this._openSection===e&&(this._openSection=null)}_fmtNum(e,t){return t>=1?String(Math.round(e)):e.toFixed(2)}render(){const e=this._cfg,t=this._t(),i=this.hass?.config?.latitude,r=this.hass?.config?.longitude,o="number"==typeof i&&isFinite(i)?String(i):"52.379",n="number"==typeof r&&isFinite(r)?String(r):"4.900";return U`
            <div class="editor">

                <details class="advanced-section" ?open="${"location"===this._openSection}" @toggle="${e=>this._onSectionToggle("location",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map-marker"></ha-icon>${t.editor.locationSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.homeLatitude}</span>
                    <input
                        type="number"
                        min="-90"
                        max="90"
                        step="any"
                        placeholder="${o}"
                        .value="${null!=e["home-latitude"]?String(e["home-latitude"]):""}"
                        @change="${e=>this._numField("home-latitude",e)}"
                    />
                </label>
                <label class="field">
                    <span class="label">${t.editor.homeLongitude}</span>
                    <input
                        type="number"
                        min="-180"
                        max="180"
                        step="any"
                        placeholder="${n}"
                        .value="${null!=e["home-longitude"]?String(e["home-longitude"]):""}"
                        @change="${e=>this._numField("home-longitude",e)}"
                    />
                </label>
                <div class="hint">${t.editor.locationHint}</div>

                </details>

                <details class="advanced-section" ?open="${"map"===this._openSection}" @toggle="${e=>this._onSectionToggle("map",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map"></ha-icon>${t.editor.uiAndMapSection}</summary>
                <div class="field">
                    <span class="label">${t.editor.autoRotate}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${!0===e["auto-rotate-enabled"]?"active":""}"
                            @click="${()=>this._update("auto-rotate-enabled",!0)}"
                        >${t.editor.autoRotateOn}</button>
                        <button
                            type="button"
                            class="seg-option ${!0!==e["auto-rotate-enabled"]?"active":""}"
                            @click="${()=>this._update("auto-rotate-enabled",!1)}"
                        >${t.editor.autoRotateOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.autoRotateHint}</div>

                </details>

                <details class="advanced-section" ?open="${"buildings"===this._openSection}" @toggle="${e=>this._onSectionToggle("buildings",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:office-building-outline"></ha-icon>${t.editor.buildingsSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.displayRadius??"Display radius"}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min="${0}"
                            max="${500}"
                            step="10"
                            .value="${String(e["display-radius"]??200)}"
                            @input="${e=>this._numSlider("display-radius",e)}"
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
                            min="${10}"
                            max="${100}"
                            step="5"
                            .value="${String(e["building-count"]??50)}"
                            @input="${e=>this._numSlider("building-count",e)}"
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
                            @click="${()=>this._update("building-real-size",!0)}"
                        >${t.editor.buildingRealSizeOn??"On"}</button>
                        <button
                            type="button"
                            class="seg-option ${!1===e["building-real-size"]?"active":""}"
                            @click="${()=>this._update("building-real-size",!1)}"
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
                                min="${3}"
                                max="${10}"
                                step="0.5"
                                .value="${String(e["building-height"]??6)}"
                                @input="${e=>this._numSlider("building-height",e)}"
                            />
                            <span class="slider-value">${this._fmtNum(Number(e["building-height"]??6),.5)} m</span>
                        </div>
                    </label>
                `:K}
                <label class="field">
                    <span class="label">${t.editor.buildingClusterRadius}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="100" step="1"
                            .value="${String(e["building-cluster-radius"]??0)}"
                            @input="${e=>this._numSlider("building-cluster-radius",e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["building-cluster-radius"]??0),1)} m</span>
                    </div>
                </label>
                <label class="field">
                    <span class="label">${t.editor.buildingOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value="${String(e["building-opacity"]??.25)}"
                            @input="${e=>this._numSlider("building-opacity",e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["building-opacity"]??.25),.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.buildingsHint}</div>

                </details>

                <details class="advanced-section" ?open="${"shadows"===this._openSection}" @toggle="${e=>this._onSectionToggle("shadows",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gradient-vertical"></ha-icon>${t.editor.shadowsSection}</summary>
                <div class="field">
                    <span class="label">${t.editor.shadowsEnabled}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${!1!==e["shadows-enabled"]?"active":""}"
                            @click="${()=>this._update("shadows-enabled",!0)}"
                        >${t.editor.shadowsEnabledOn}</button>
                        <button
                            type="button"
                            class="seg-option ${!1===e["shadows-enabled"]?"active":""}"
                            @click="${()=>this._update("shadows-enabled",!1)}"
                        >${t.editor.shadowsEnabledOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.shadowsEnabledHint}</div>

                <label class="field">
                    <span class="label">${t.editor.shadowOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value="${String(e["shadow-opacity"]??.32)}"
                            @input="${e=>this._numSlider("shadow-opacity",e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["shadow-opacity"]??.32),.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.shadowOpacityHint}</div>

                </details>

                <details class="advanced-section" ?open="${"dataDisplay"===this._openSection}" @toggle="${e=>this._onSectionToggle("dataDisplay",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:chart-timeline-variant"></ha-icon>${t.editor.dataDisplaySection}</summary>
                <label class="field">
                    <span class="label">${t.editor.displayUpdateFrequency}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min="${1}"
                            max="${12}"
                            step="1"
                            .value="${String(e["display-update-frequency-per-hour"]??4)}"
                            @input="${e=>this._numSlider("display-update-frequency-per-hour",e)}"
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
                            min="${0}"
                            max="${3}"
                            step="1"
                            .value="${String(e["value-decimals"]??1)}"
                            @input="${e=>this._numSlider("value-decimals",e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(e["value-decimals"]??1),1)}</span>
                    </div>
                </label>
                <div class="field-help">${t.editor.valueDecimalsHelp??"Number of decimals shown on every value (power in kW, energy in kWh). 0 to 3."}</div>
                </details>

                <details class="advanced-section" ?open="${"installation"===this._openSection}" @toggle="${e=>this._onSectionToggle("installation",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:solar-power-variant"></ha-icon>${t.editor.installationSection}</summary>
                <div class="hint">${function renderMarkdownLinks(e){const t=[],i=/\[([^\]]+)\]\(([^)]+)\)/g;let r,o=0;for(;null!==(r=i.exec(e));){r.index>o&&t.push(e.slice(o,r.index));const i=r[1],n=r[2];/^https?:\/\//i.test(n)?t.push(U`<a href="${n}" target="_blank" rel="noopener noreferrer">${i}</a>`):/^\/[a-zA-Z0-9_\-/.]*$/.test(n)?t.push(U`<a href="${n}">${i}</a>`):t.push(`${i} (${n})`),o=r.index+r[0].length}return o<e.length&&t.push(e.slice(o)),t}(t.editor.installationHint)}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.solarIrradianceEntity}</span>
                    ${this._pickerReady?U`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass="${this.hass}"
                            .value="${String(e["solar-irradiance-entity"]??"")}"
                            .includeDomains="${["sensor","input_number"]}"
                            .entityFilter="${this._solarIrradianceEntityFilter}"
                            @value-changed="${e=>this._update("solar-irradiance-entity",e.detail.value??"")}"
                        ></ha-entity-picker>
                    `:K}
                </div>
                <div class="field-help">${t.editor.solarIrradianceEntityHelp}</div>

                </details>


                <details class="advanced-section" ?open="${"reset"===this._openSection}" @toggle="${e=>this._onSectionToggle("reset",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:refresh"></ha-icon>${t.editor.resetSection}</summary>
                    <div class="hint">${t.editor.resetSectionHint}</div>
                    <div class="hint reset-warning">${t.editor.resetCacheWarning}</div>
                    <button
                        type="button"
                        class="reset-btn"
                        @click="${()=>this._onResetCacheClick()}"
                    >${this._resetFeedback??t.editor.resetCacheButton}</button>
                </details>

                <details class="advanced-section about-section" ?open="${"about"===this._openSection}" @toggle="${e=>this._onSectionToggle("about",e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:information-outline"></ha-icon>${t.editor.aboutSection}</summary>
                    <!-- Identity + links column. Every row uses the same label-left, content-right
                         layout the version row established: a single .about-row line per piece of
                         info, the right side carrying the value (or a clickable link with icon).
                         The X brand mark is an inline SVG because the MDI icon set doesn't ship
                         the post-rebrand glyph and mdi:twitter would mis-label the platform. -->
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutVersionLabel}</span>
                        <a class="about-row-link about-version-link"
                           href="https://github.com/ReikanYsora/Helios/releases/tag/v${"1.9.0-alpha.7"}"
                           target="_blank" rel="noopener noreferrer"
                        >${"1.9.0-alpha.7"}</a>
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
        `}_onResetCacheClick(){try{window.dispatchEvent(new CustomEvent("helios-data-cache-reset"))}catch(P){}const e=pickTranslations(this.hass?.language);this._resetFeedback=e.editor.resetCacheDone,void 0!==this._resetFeedbackTimer&&window.clearTimeout(this._resetFeedbackTimer),this._resetFeedbackTimer=window.setTimeout(()=>{this._resetFeedback=null},2e3)}},nt=at,at.SLIDER_COMMIT_DELAY_MS=250,at.styles=st,at);__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],ht.prototype,"hass",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],ht.prototype,"_cfg",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],ht.prototype,"_pickerReady",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],ht.prototype,"_openSection",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],ht.prototype,"_resetFeedback",void 0),ht=nt=__decorate([t$2("helios-card-editor")],ht);var dt=pickTranslations("undefined"!=typeof navigator?navigator.language:"en");window.customCards=window.customCards||[];{const e={type:"helios-card",name:dt.cardName,description:dt.cardDescription,preview:!0},t=window.customCards.findIndex(e=>"helios-card"===e.type);t>=0?window.customCards[t]=e:window.customCards.push(e)}{const e="__heliosBannerPrinted",t=window;if(!t[e]){t[e]=!0;const i="background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px 0 0 4px;font-weight:bold;";console.info("%c☀ HELIOS%c v1.9.0-alpha.7",i,"background:#1f2937;color:#f59e0b;padding:2px 8px;border-radius:0 4px 4px 0;font-weight:bold;"),console.info("%c☀ HELIOS%c run window.heliosStats() in the console for a live config + engine dump",i,"color:#6b7280;font-style:italic;")}}var ut=/* @__PURE__ */new Set;window.addEventListener("helios-data-cache-reset",()=>{for(const e of ut)e.resetDataCache()});{const e=window;e.heliosStats||(e.heliosStats=()=>{const t=Array.from(ut).map((e,t)=>({index:t,snapshot:e.getStatsSnapshot()})),i={version:"1.9.0-alpha.7",cards:t.length,lifecycle:e.__heliosStats??null,details:t},r="color:#f59e0b;font-weight:bold;";return console.groupCollapsed(`%c☀ HELIOS stats%c v1.9.0-alpha.7, ${t.length} card${1===t.length?"":"s"} alive`,"background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px;font-weight:bold;","color:#6b7280;font-weight:normal;"),console.log("%cLifecycle counters",r,e.__heliosStats??"(none yet)"),t.forEach((e,t)=>{const i=e.snapshot;console.groupCollapsed(`%cCard #${t+1}`,r),console.log("config:",i.config),console.log("engine:",i.engine),console.log("pv:",i.pv),console.groupEnd()}),console.groupEnd(),i})}{const e=window,t="background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px;font-weight:bold;";e.setHeliosLocation||(e.setHeliosLocation=(i,r)=>{if("number"!=typeof i||"number"!=typeof r||!isFinite(i)||!isFinite(r)||i<-90||i>90||r<-180||r>180)console.warn("☀ HELIOS: setHeliosLocation expected (lat[-90..90], lon[-180..180]), got",i,r);else{e.__heliosLocationOverride={lat:i,lon:r},console.info(`%c☀ HELIOS%c location override → ${i.toFixed(5)}, ${r.toFixed(5)} (refresh page to revert)`,t,"color:#6b7280;");for(const e of ut)e.invalidateLocation()}}),e.clearHeliosLocation||(e.clearHeliosLocation=()=>{if(e.__heliosLocationOverride){e.__heliosLocationOverride=void 0,console.info("%c☀ HELIOS%c location override cleared, reverting to hass.config",t,"color:#6b7280;");for(const e of ut)e.invalidateLocation()}else console.info("☀ HELIOS: no location override active")})}var pt=(lt=class HeliosCard extends se{constructor(...e){super(...e),this._now=/* @__PURE__ */new Date,this._cloudCover=-1,this._labelLayout=null,this._pvCurrent=null,this._pvUnit="",this._pvHistory=null,this._pvHistoryPerEntity=/* @__PURE__ */new Map,this._pvHistoryDiagnostics=null,this._pvCalibStats=null,this._pvCalibStatsFetchKey="",this._pvCalibStatsFetching=!1,this._pvChangeSeries=null,this._pvChangeSeriesFetchKey="",this._pvChangeSeriesFetching=!1,this._haSolarForecast=[],this._haSolarForecastLoaded=!1,this._haSolarForecastFetching=!1,this._haSolarForecastFetchedAt=0,this._batterySoc=null,this._batteryPower=null,this._batteryPowerUnit="",this._gridImportValue=null,this._gridImportUnit="",this._gridExportValue=null,this._gridExportUnit="",this._gridImportChangeSeries=null,this._gridExportChangeSeries=null,this._gridImportChangeFetchKey="",this._gridExportChangeFetchKey="",this._gridImportChangeFetching=!1,this._gridExportChangeFetching=!1,this._batterySocHistory=null,this._batteryPowerHistory=null,this._batteryFetchKey="",this._batteryFetching=!1,this._batteryChargeChangeSeries=null,this._batteryDischargeChangeSeries=null,this._batteryChangeFetchKey="",this._batteryChangeFetching=!1,this._irradianceHistory=null,this._irradianceFetchKey="",this._irradianceFetching=!1,this._sunScene=null,this._energyDefaults=rt,this._haSolarTodayKwh=null,this._haGridImportTodayKwh=null,this._haGridExportTodayKwh=null,this._haBatteryChargedKwh=null,this._haBatteryDischargedKwh=null,this._homeHover=!1,this._chartHoverPct=null,this._chartTarget="production",this._chartSeries=null,this._timeRange=null,this._selectedTime=null,this._isLiveMode=!0,this._periodPastDays=2,this._periodFutureDays=2,this._energyDefaultsLoaded=!1,this._dailyTotalsKicked=!1,this._unifiedStore=null,this._lastHomeKey="",this._lastConfigSig="",this._initInflight=!1,this._cachedIsDarkThemesRef=void 0,this._cachedIsDark=!1,this._lastRefreshHassRef=void 0,this._lastRefreshConfigSig=void 0,this._lastRefreshTimeRangeRef=void 0,this._lastRefreshEnergyDefaultsRef=void 0,this._arcBackBuf=[],this._arcFrontBuf=[],this._arcFrontNearBuf=[],this._setChartTarget=e=>{this._chartTarget!==e&&(this._chartTarget=e)},this._legacyKeyWarningFired=!1,this._trackElement=null,this._trackPointerId=null,this._boundPointerMove=e=>function onTimelinePointerMove(e,t){t.pointerId===e._trackPointerId&&applyTimelinePointer(e,t)}(this,e),this._boundPointerUp=e=>function onTimelinePointerUp(e,t){if(t.pointerId!==e._trackPointerId)return;const i=e._trackElement;if(i){try{i.releasePointerCapture(t.pointerId)}catch(P){}i.removeEventListener("pointermove",e._boundPointerMove),i.removeEventListener("pointerup",e._boundPointerUp),i.removeEventListener("pointercancel",e._boundPointerUp)}e._trackElement=null,e._trackPointerId=null,e._chartHoverPct=null}(this,e),this._onPageVisibilityForTheme=()=>{"undefined"!=typeof document&&"visible"===document.visibilityState&&(this._cachedIsDarkThemesRef=void 0,this.requestUpdate())},this._instanceId=`h${Math.floor(1e9*Math.random()).toString(36)}`,this._onHomeEnter=()=>{this._homeHover=!0},this._onHomeLeave=()=>{this._homeHover=!1},this._exitScrubMode=()=>{null!==this._selectedTime&&(this._selectedTime=null),this._isLiveMode||(this._isLiveMode=!0)},this._onCameraLockToggle=()=>{this._engine&&(this._engine.setCameraLocked(!this._engine.isCameraLocked()),this.requestUpdate())}}setConfig(e){if(!e)throw new Error("Invalid HELIOS configuration");this.config={...e};const t=periodPastDays(this.config),i=periodFutureDays(this.config);t===this._periodPastDays&&i===this._periodFutureDays||(this._periodPastDays=t,this._periodFutureDays=i,this._applyPeriod()),this._warnIfLegacyEntityKeys(e)}_applyPeriod(){this._engine?.setPeriodDays(this._periodPastDays,this._periodFutureDays),this._unifiedStore=null;const e=this._engine?.getTimelineRange();e&&(this._timeRange=e,this._selectedTime&&(this._selectedTime.getTime()<e.start.getTime()||this._selectedTime.getTime()>e.end.getTime())&&this._exitScrubMode()),this.requestUpdate()}_setPeriod(e,t){this._periodPastDays===e&&this._periodFutureDays===t||(this._periodPastDays=e,this._periodFutureDays=t,this._applyPeriod())}_updateHomeAppearance(e){if(!this._engine)return;const t=chartAccentColor(this),i=this._selectedTime?.getTime()??Date.now(),r="production"===this._chartTarget?function solarBands(e,t){const i=e._pvHistoryPerEntity;if(!i||i.size<2)return[];const r=Array.from(i.keys()).sort(),o=e,n=chartIsDark(e),s=t>=Date.now()-3e5,l=[];for(let d=0;d<r.length;d++){const o=r[d];let n=NaN;if(s){const t=e.hass?.states?.[o];if(t){const e=parseFloat(t.state);isFinite(e)&&(n=pvNormalizeToWatts(e,String(t.attributes?.unit_of_measurement??"")))}}if(!(isFinite(n)&&n>0)){const r=i.get(o);r&&(n=pvValueAtTime(e,t,r).value)}isFinite(n)&&n>0&&l.push({v:n,idx:d})}const c=l.reduce((e,t)=>e+t.v,0);return c<=0||l.length<2?[]:l.map(e=>({frac:e.v/c,color:energySolarColor(o,n,e.idx)}))}(this,i):[],o=e&&void 0!==this._lastHomeTarget;this._lastHomeTarget=this._chartTarget,this._engine.setHomeAppearance(t,r,o)}_renderChartIndicator(){const e={production:"mdi:solar-power",consumption:"mdi:home-lightning-bolt",grid:"mdi:transmission-tower",battery:"mdi:lightning-bolt","battery-soc":"mdi:battery",irradiance:"mdi:white-balance-sunny",cloud:"mdi:cloud"}[this._chartTarget]??"mdi:chart-line";return U`
            <div class="tb-chart-indicator">
                ${pe(this._chartTarget,U`<ha-icon icon="${e}"></ha-icon>`)}
            </div>
        `}_renderPeriodSelector(){const e=pickTranslations(this.hass?.language),t=this._periodPastDays,i=this._periodFutureDays,r=periodPastDays(this.config),o=periodFutureDays(this.config),n=[{label:e.period?.today??"Today",past:0,future:0},{label:e.period?.configDefault??"Default",past:r,future:o},{label:e.period?.last7Days??"7 d",past:6,future:1}];return U`
            <div
                class="tb-period-selector"
                role="group"
                aria-label="${e.period?.rangeLabel??"Time range"}"
                @pointerdown="${e=>e.stopPropagation()}"
            >
                ${n.map(e=>U`
                    <button
                        type="button"
                        class="tb-period-seg ${t===e.past&&i===e.future?"is-on":""}"
                        @click="${()=>this._setPeriod(e.past,e.future)}"
                    >${e.label}</button>
                `)}
            </div>
        `}_warnIfLegacyEntityKeys(e){if(this._legacyKeyWarningFired)return;if(!this.hass?.callService)return;const t=[];for(const r of ct._LEGACY_ENTITY_KEYS){const i=e[r];null!=i&&""!==i&&t.push(r)}if(0===t.length)return;this._legacyKeyWarningFired=!0;const i=`The Helios card no longer reads its PV, grid and battery entities from the card YAML. The following key${t.length>1?"s are":" is"} silently ignored: ${t.map(e=>"`"+e+"`").join(", ")}. Helios now resolves these directly from the official Home Assistant Energy dashboard (Settings → Dashboards → Energy → your sources). The PV forecast is also read from the Energy dashboard's configured solar forecast now, so the card no longer carries any PV install configuration. Only the entity slots and the forecast config were retired; the visual options still live in the card YAML.`;try{this.hass.callService("persistent_notification","create",{notification_id:"helios-legacy-entity-config",title:"Helios card: deprecated entity keys ignored",message:i})}catch(P){}}static getConfigElement(){return document.createElement("helios-card-editor")}static getStubConfig(e,t){if(e&&Array.isArray(t)&&t.length>0)for(const i of t){if("string"!=typeof i||!i.startsWith("zone."))continue;const t=e.states?.[i],r=t?.attributes?.latitude,o=t?.attributes?.longitude;if("number"==typeof r&&Number.isFinite(r)&&"number"==typeof o&&Number.isFinite(o))return{"home-latitude":r,"home-longitude":o}}return{}}getStatsSnapshot(){const e={};if(this.config)for(const[t,i]of Object.entries(this.config))"home-latitude"!==t&&"home-longitude"!==t&&(e[t]=i);return{config:e,engine:this._engine?this._engine.getStatsSnapshot():null,pv:{entityConfigured:""!==resolvePvLiveEntity(this._energyDefaults),unit:this._pvUnit||null,lastHistory:this._pvHistoryDiagnostics}}}invalidateLocation(){this._lastHomeKey="",this.requestUpdate()}resetDataCache(){this._pvHistory=null,this._pvCalibStats=null,this._pvChangeSeries=null,this._pvChangeSeriesFetchKey="",this._haSolarForecast=[],this._haSolarForecastLoaded=!1,this._haSolarForecastFetching=!1,this._haSolarForecastFetchedAt=0,this._pvCalibStatsFetchKey="",this._pvHistoryDiagnostics=null,this._gridImportChangeSeries=null,this._gridExportChangeSeries=null,this._gridImportChangeFetchKey="",this._gridExportChangeFetchKey="",this._batterySocHistory=null,this._batteryPowerHistory=null,this._batteryFetchKey="",this._batteryChargeChangeSeries=null,this._batteryDischargeChangeSeries=null,this._batteryChangeFetchKey="",this._irradianceHistory=null,this._irradianceFetchKey="",function clearPvModuleCaches(){Ge.clear()}(),function clearBatteryModuleCaches(){Ye.clear()}(),function clearIrradianceModuleCaches(){Xe.clear()}(),function clearEnergyStatsCache(){Ke.clear()}(),this._engine?.resetDataCache(),this.requestUpdate()}getCardSize(){return 15}getGridOptions(){return{rows:8,columns:12,min_rows:8,max_rows:24,min_columns:12,max_columns:12}}connectedCallback(){super.connectedCallback(),ut.add(this),this._dailyTotalsKicked=!1,tick(this),this._timer=window.setInterval(()=>{tick(this),refreshHaDailyTotals(this)},3e4),function initVisibilityObserver(e){if(e._visibilityObserver||"undefined"==typeof IntersectionObserver)return;let t=!0,i=!1;const applyState=()=>{const r="undefined"!=typeof document&&"hidden"===document.visibilityState,o=!t||r;if(function setAnimationsPaused(e,t){e.classList.toggle("helios-paused",t);const i=e.shadowRoot;if(!i)return;const r=i.querySelectorAll("svg");for(let o=0;o<r.length;o++){const e=r[o];try{t?e.pauseAnimations?.():e.unpauseAnimations?.()}catch(P){}}}(e,o),e._engine?.setPaused(o),i&&!r){const t=e;t._lastRefreshHassRef=void 0,t._lastRefreshConfigSig=void 0,t._lastRefreshTimeRangeRef=void 0,t._lastRefreshEnergyDefaultsRef=void 0,e.requestUpdate()}i=r};e._visibilityObserver=new IntersectionObserver(e=>{for(const i of e)t=i.isIntersecting;applyState()},{threshold:0}),e._visibilityObserver.observe(e),"undefined"!=typeof document&&(e._onVisibilityChange=applyState,document.addEventListener("visibilitychange",e._onVisibilityChange))}(this),"undefined"!=typeof document&&document.addEventListener("visibilitychange",this._onPageVisibilityForTheme),subscribeEnergyPrefs(this),refreshHaDailyTotals(this)}disconnectedCallback(){super.disconnectedCallback(),ut.delete(this),window.clearInterval(this._timer),this._visibilityObserver?.disconnect(),this._visibilityObserver=void 0,this._onVisibilityChange&&(document.removeEventListener("visibilitychange",this._onVisibilityChange),this._onVisibilityChange=void 0),"undefined"!=typeof document&&document.removeEventListener("visibilitychange",this._onPageVisibilityForTheme),function unsubscribeEnergyPrefs(e){if(e._energyPrefsUnsub){try{e._energyPrefsUnsub()}catch(P){}e._energyPrefsUnsub=void 0}}(this),void 0!==this._engine&&(this._engine.cleanup(),this._engine=void 0),this._lastHomeKey="",this._initInflight=!1}updated(e){if(this._maybeRebuildUnifiedStore(),this._engine&&(e.has("_chartTarget")||e.has("_selectedTime")||e.has("hass")||e.has("_unifiedStore"))&&this._updateHomeAppearance(e.has("_chartTarget")),this.hass&&!this._energyPrefsUnsub&&subscribeEnergyPrefs(this),this._energyDefaultsLoaded&&!this._dailyTotalsKicked&&(this._dailyTotalsKicked=!0,refreshHaDailyTotals(this)),!this.hass?.config||!this.config)return;const t=getHomeCoords(this.config,this.hass);if(!t)return;const{lat:i,lon:r}=t,o=`${i.toFixed(5)},${r.toFixed(5)}`,n=o!==this._lastHomeKey;if(!this._engine||n){if(!this.isConnected)return;if(this._initInflight)return;return this._lastHomeKey=o,this._lastConfigSig=computeConfigSig(this.config),void initEngine(this)}const s=computeConfigSig(this.config);s!==this._lastConfigSig&&(this._lastConfigSig=s,this._engine.updateConfig(this.config)),this.hass===this._lastRefreshHassRef&&s===this._lastRefreshConfigSig&&this._timeRange===this._lastRefreshTimeRangeRef&&this._energyDefaults===this._lastRefreshEnergyDefaultsRef||(this._lastRefreshHassRef=this.hass,this._lastRefreshConfigSig=s,this._lastRefreshTimeRangeRef=this._timeRange,this._lastRefreshEnergyDefaultsRef=this._energyDefaults,refreshPv(this),refreshBattery(this),refreshGrid(this),refreshIrradiance(this),fetchHaSolarForecast(this))}_resolveIsDark(e){const t=this._computeIsDark(e);return this._engine?.setCardThemeIsDark(t),t}_computeIsDark(e){if(e&&"boolean"==typeof e.darkMode)return e.darkMode;if(this._cachedIsDarkThemesRef===e)return this._cachedIsDark;const t=this._probeIsDarkFromCss();return this._cachedIsDarkThemesRef=e,this._cachedIsDark=t,t}themeIsDark(){return this._computeIsDark(this.hass?.themes)}_probeIsDarkFromCss(){try{const e=getComputedStyle(this).getPropertyValue("--primary-background-color").trim();if(!e)return!1;const t=e.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);let i=0,r=0,o=0;if(t){const e=3===t[1].length?t[1].split("").map(e=>e+e).join(""):t[1];i=parseInt(e.slice(0,2),16),r=parseInt(e.slice(2,4),16),o=parseInt(e.slice(4,6),16)}else{const t=e.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);t&&(i=+t[1],r=+t[2],o=+t[3])}return(.299*i+.587*r+.114*o)/255<.5}catch(P){}return!1}_nudgeToHomePill(e,t,i,r){const o=ct.HOME_PILL_HALF_WIDTH_PX,n=ct.HOME_PILL_HALF_HEIGHT_PX,s=e-i,l=t-r,c=Math.max(0,o-n);if(Math.abs(s)<=c)return{x:e,y:r+(l>=0?1:-1)*n};const d=i+(s>=0?1:-1)*c,u=e-d,p=t-r,g=Math.sqrt(u*u+p*p)||1;return{x:d+n*u/g,y:r+n*p/g}}_renderSunCrossing(e,t,i,r){if(!e)return K;const o=e.x-t.x,n=e.y-t.y,s=Math.hypot(o,n)||1,l=e.x+o/s*22,c=e.y+n/s*22,d=e.time.toLocaleTimeString(this.hass?.locale?.language??void 0,{hour:"2-digit",minute:"2-digit"});return U`
            <div
                class="sun-cross-marker"
                style="left:${l.toFixed(1)}px; top:${c.toFixed(1)}px; --sun-cross-color:${r}"
            >
                <ha-icon icon="${i}"></ha-icon>
                <span>${d}</span>
            </div>
        `}render(){const e=null!==getHomeCoords(this.config,this.hass),t=this._labelLayout,i=resolvePvLiveEntity(this._energyDefaults),r=ENERGY_COLOR_pv(this),o=!this._isLiveMode&&null!==this._selectedTime,n=o&&this._selectedTime.getTime()>Date.now()+6e4,s=""!==i&&null!==t?o?function pvRateAtTime(e,t){const i=wattsAtFromChangeSeries(e._pvChangeSeries,t.getTime());return null===i?null:{value:Math.max(0,i),unit:"W"}}(this,this._selectedTime):null!==this._pvCurrent?function currentPvRate(e){const t=e._energyDefaults.solarStatRates;if(t.length>0){let i=0,r=!1;for(const o of t){const t=e.hass?.states?.[o];if(!t)continue;const n=parseFloat(t.state);isFinite(n)&&(i+=pvNormalizeToWatts(n,String(t.attributes?.unit_of_measurement??"")),r=!0)}if(r)return{value:Math.max(0,i),unit:"W"}}const i=latestWattsFromChangeSeries(e._pvChangeSeries,Date.now());return null===i?null:{value:Math.max(0,i),unit:"W"}}(this):null:null;let l=null;if(n&&""!==i&&null!==t&&this._unifiedStore){const e=valueAt(this._unifiedStore.forecast,this._unifiedStore,this._selectedTime.getTime());null!==e&&e>0&&(l={value:e,unit:"W"})}const c=n&&null!==l,d=c?l:s,u=e&&null!==t&&""!==i&&null!==d&&(!n||c),p=function valueDecimals(e){const t=e?.["value-decimals"],i="number"==typeof t?t:"string"==typeof t?parseFloat(t):NaN;if(!Number.isFinite(i))return 1;const r=Math.round(i);return r<0?0:r>3?3:r}(this.config),g=u?(c?"≈ ":"")+function formatPvValue(e,t,i,r){return formatEntityValue(e,t,i,r)}(this.hass,d.value,d.unit,p):"",m=null!==s?pvNormalizeToWatts(s.value,s.unit):0,f=flowDuration(m,5e3,.5),y=!(m>0),b=resolveBatteryEntities(this._energyDefaults),v=null!==b.socEntity,_=null!==b.powerEntity,w=!this._isLiveMode&&null!==this._selectedTime,$=w&&this._selectedTime.getTime()>Date.now()+6e4,M=w&&!$?this._selectedTime.getTime():null,T=null!==M?wattsAtFromChangeSeries(this._gridImportChangeSeries,M):this._gridImportValue,C=null!==M?wattsAtFromChangeSeries(this._gridExportChangeSeries,M):this._gridExportValue,F=null===T?null:Math.max(0,T),A=null===C?null:Math.max(0,C),H=null!==M?"W":this._gridImportUnit,E=null!==M?"W":this._gridExportUnit,D=w?function batterySampleAtTime(e,t){if(!e||0===e.times.length)return null;const i=t.getTime(),r=e.times[0].getTime(),o=e.times[e.times.length-1].getTime();if(i<r||i>o+6e4)return null;let n=e.times.length-1;for(let s=0;s<e.times.length;s++)if(e.times[s].getTime()>i){n=s-1;break}return n<0&&(n=0),e.values[n]}(this._batterySocHistory,this._selectedTime):this._batterySoc;let R;if(w){const e=this._selectedTime.getTime(),t=wattsAtFromChangeSeries(this._batteryChargeChangeSeries,e),i=wattsAtFromChangeSeries(this._batteryDischargeChangeSeries,e);R=null===t&&null===i?null:Math.max(0,t??0)-Math.max(0,i??0)}else R=this._batteryPower;const L=w?"W":this._batteryPowerUnit,P=e&&null!==t&&!$&&v&&null!==D,I=e&&null!==t&&!$&&_&&null!==R,O=P?`${Math.round(D)} %`:"",z=I?function formatBatteryPower(e,t,i,r){return formatPowerKw(e,pvNormalizeToWatts(t,i),r,!0)}(this.hass,-R,L,p):"",W=n||null===d?null:pvNormalizeToWatts(d.value,d.unit),j=null!==F||null!==A?(F??0)-(A??0):null,q=I?R:null,G=null===W&&null===j&&null===q?null:Math.max(0,(W??0)+(j??0)-(q??0)),Y=e&&null!==t&&!$&&null!==G,X=Y?formatGridValue(this.hass,G,"W",p):"",Z=I&&R>0,J=I&&R<0,Q=Z?"var(--energy-battery-in-color, #f06292)":"var(--energy-battery-out-color, #4db6ac)",ee=I?Math.abs(pvNormalizeToWatts(R,L)):0,te=I&&ee<5,ie=flowDuration(ee,5e3),buildLPathToHome=(e,i,r)=>{if(!t)return"";const o=t.home.x,n=t.home.y,s=o>e?1:-1,l=n>i?1:-1,c=e+s*r,d=i,u=o-13*s,p=n-l*ct.HOME_PILL_HALF_HEIGHT_PX,g=Math.min(12,Math.abs(u-c)/2,Math.abs(p-d)/2),m=u-s*g,f=d+l*g;return`M ${c.toFixed(1)},${d.toFixed(1)} L ${m.toFixed(1)},${d.toFixed(1)} Q ${u.toFixed(1)},${d.toFixed(1)} ${u.toFixed(1)},${f.toFixed(1)} L ${u.toFixed(1)},${p.toFixed(1)}`},re=t?.batterySocLabel.x??0,oe=t?.batterySocLabel.y??0,ae=t?.batteryPowerLabel.x??0,ne=t?.batteryPowerLabel.y??0,se=t&&I?`M ${re.toFixed(1)},${(oe-14).toFixed(1)} L ${ae.toFixed(1)},${(ne+14).toFixed(1)}`:"",le=t&&J?buildLPathToHome(re,oe,22):"",ce=t&&P&&!I&&!J?buildLPathToHome(re,oe,22):"",he=t&&Z&&u?((e,t,i,r,o)=>{const n=i>e?1:-1,s=r>t?1:-1,l=Math.min(12,Math.abs(i-e)/2,Math.abs(r-t)/2);if(o){const o=r-s*l,c=e+n*l;return`M ${e.toFixed(1)},${t.toFixed(1)} L ${e.toFixed(1)},${o.toFixed(1)} Q ${e.toFixed(1)},${r.toFixed(1)} ${c.toFixed(1)},${r.toFixed(1)} L ${i.toFixed(1)},${r.toFixed(1)}`}const c=i-n*l,d=t+s*l;return`M ${e.toFixed(1)},${t.toFixed(1)} L ${c.toFixed(1)},${t.toFixed(1)} Q ${i.toFixed(1)},${t.toFixed(1)} ${i.toFixed(1)},${d.toFixed(1)} L ${i.toFixed(1)},${r.toFixed(1)}`})(t.pvLabel.x+14,t.pvLabel.y+11,ae-30,ne,!0):"",de=buildLPathToHome(t?.gridLabel.x??0,t?.gridLabel.y??0,22),ue=null!==this._gridImportValue?Math.abs(pvNormalizeToWatts(this._gridImportValue,this._gridImportUnit)):0,ge=null!==this._gridExportValue?Math.abs(pvNormalizeToWatts(this._gridExportValue,this._gridExportUnit)):0,proportionalBeadDur=(e,t)=>{const i=Math.max(e,1);return Math.min(8,Math.max(1.2,1.2*t/i))},me=ue<5?null:proportionalBeadDur(ue,5e3),fe=ge<5?null:proportionalBeadDur(ge,1e3),ye=(F??0)>=(A??0),be=ye?"var(--energy-grid-consumption-color, #488fc2)":"var(--energy-grid-return-color, #8353d1)",ve=ye?me:fe,_e=this._sunScene,we=e&&null!==_e&&_e.arc.length>=2,xe=ENERGY_COLOR_sun(this),Se=function darkenHex(e,t){const i=1-Math.max(0,Math.min(1,t)),r=Math.round(parseInt(e.slice(1,3),16)*i),o=Math.round(parseInt(e.slice(3,5),16)*i),n=Math.round(parseInt(e.slice(5,7),16)*i),h=e=>e.toString(16).padStart(2,"0");return`#${h(r)}${h(o)}${h(n)}`}(xe,.2),$e=we?function buildArcSegments(e,t){const i=[];for(let r=0;r<e.length-1;r++){const o=e[r],n=e[r+1];i.push({x1:o.x,y1:o.y,x2:n.x,y2:n.y,color:arcColor(.5*(o.altitude+n.altitude),t),nearness:.5*(o.nearness+n.nearness),belowHorizon:o.belowHorizon||n.belowHorizon})}return i}(_e.arc,xe):[],ke=this._arcBackBuf,Me=this._arcFrontBuf,Te=this._arcFrontNearBuf;ke.length=0,Me.length=0,Te.length=0;for(let U=0;U<$e.length;U++){const e=$e[U];e.belowHorizon?ke.push(e):e.nearness>=.5?Te.push(e):Me.push(e)}const Ce=we&&_e.sun.altitude>0,Fe=_e?.sun.irradiance??0,Ae=Math.round(Fe),He=Math.sqrt(Math.max(0,Math.min(1,Fe/1e3))),Ee=we&&_e.sun.altitude>0,De=flowDuration(Fe,1e3,.8);let Re=_e?.home.x??0,Le=_e?.home.y??0;if(t&&_e&&i){const e=t.pvLabel.x,i=t.pvLabel.y,r=28,o=11,n=_e.sun.x-e,s=_e.sun.y-i,l=Math.max(0,r-o);if(Math.abs(n)<=l)Re=_e.sun.x,Le=i+(s>=0?1:-1)*o;else{const t=e+(n>=0?1:-1)*l,r=i,s=_e.sun.x-t,c=_e.sun.y-r,d=Math.sqrt(s*s+c*c)||1;Re=t+o*s/d,Le=r+o*c/d}}const Pe=this.hass?.themes;return U`
            <ha-card class="${[this._resolveIsDark(Pe)?"theme-dark":"theme-light",this._isCameraLocked()?"camera-locked":""].filter(Boolean).join(" ")}">

                <div id="map-container"></div>

                ${e&&this._timeRange?U`
                    <div
                        class="time-bar"
                        @pointerdown="${e=>function onTimelinePointerDown(e,t){if(!e._timeRange)return;if(e._engine?.isUserGestureSuppressed())return;const i=t.currentTarget;i.setPointerCapture(t.pointerId),e._trackElement=i,e._trackPointerId=t.pointerId,i.addEventListener("pointermove",e._boundPointerMove),i.addEventListener("pointerup",e._boundPointerUp),i.addEventListener("pointercancel",e._boundPointerUp),applyTimelinePointer(e,t)}(this,e)}"
                    >
                        <!--  Header row just above the chart: the active-target indicator on the left
                              (what the timeline currently shows) and the rolling-period selector on the
                              right, at the same height. The selector swallows its own pointer-down so
                              tapping a preset never starts a scrub on the parent .time-bar.  -->
                        <div class="tb-header">
                            ${this._renderChartIndicator()}
                            ${this._renderPeriodSelector()}
                        </div>

                        <!--  Optional PV production graph, only
                              rendered when the HA Energy dashboard
                              exposes a solar source. Same chip
                              styling as the main chart card; sits
                              just above it with a 4 px gap so the
                              two read as a stacked instrument. The
                              graph's height is the same as one half
                              of the main chart so the irradiance
                              area and the PV area visually balance
                              each other.  -->
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
                                @pointermove="${e=>function handleChartHoverMove(e,t){if(0!==t.buttons)return void(e._chartHoverPct=null);const i=t.currentTarget;if(!i)return;const r=i.getBoundingClientRect();r.width<=0||(e._chartHoverPct=100*Math.max(0,Math.min(1,(t.clientX-r.left)/r.width)))}(this,e)}"
                                @pointerleave="${()=>function handleChartHoverLeave(e){e._chartHoverPct=null}(this)}"
                            >
                                ${pe(this._chartTarget,renderBottomChart(this))}
                                ${renderTimelineNightZones(this)}
                                ${function renderTimelineFutureMask(e){const t=e._timeRange;if(!t)return U``;const i=t.start.getTime(),r=t.end.getTime(),o=r-i;if(o<=0)return U``;const n=Date.now();return n<=i||n>=r?U``:U`
        <div
            class="hc-future-mask"
            style="left:${((n-i)/o*100).toFixed(2)}%"
        ></div>
    `}(this)}
                                ${function renderTimelineTicks(e){if(!e._timeRange)return U``;const{start:t,end:i}=e._timeRange,r=i.getTime()-t.getTime(),toPct=e=>Math.max(0,Math.min(100,(e.getTime()-t.getTime())/r*100)),o=toPct(/* @__PURE__ */new Date),n=!e._isLiveMode&&null!==e._selectedTime,s=n?toPct(e._selectedTime):0;return U`
        <div class="tb-cursor-now" style="left:${o}%"></div>
        ${n?U`
            <div class="tb-cursor-sel" style="left:${s}%"></div>
        `:K}
    `}(this)}
                            </div>
                            ${renderTimelineDayLabels(this)}
                        </div>
                    </div>
                `:K}

<!--  Camera lock chip (top-left). Tapping flips the
                      lock and asks the engine to persist the pose
                      (bearing + pitch + lock flag) to localStorage for
                      the next reload. No tooltip/label: the padlock
                      glyph carries the meaning and tooltips are
                      useless on touch.                              -->
                ${e?(()=>{const e=this._isCameraLocked(),t=e?"mdi:lock":"mdi:lock-open-variant";return U`
                        <div class="overlay-top-left">
                            <button
                                type="button"
                                class="camera-lock-btn ${e?"is-on":""}"
                                aria-pressed="${e?"true":"false"}"
                                @click="${this._onCameraLockToggle}"
                            >
                                <ha-icon icon="${t}"></ha-icon>
                            </button>
                        </div>
                    `})():K}

                <!--  Solar arc, BACK pass. Renders only the dotted
                      below-horizon segments (the sun's path through
                      the underside of the celestial sphere), so the
                      home and its chips read in front of the night
                      half of the loop. Above-horizon segments, the
                      ray, the disc and the W/m² readout move to the
                      FRONT pass at the end of the overlay stack.  -->
                ${we&&ke.length>0?U`
                    <svg
                        class="solar-svg solar-svg-back"
                        style="--solar-daylight:${_e.daylight}"
                    >
                        ${ke.map(e=>B`
                            <line
                                class="solar-arc-outline solar-arc-night"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${(ct.OUTLINE_FAR+(ct.OUTLINE_NEAR-ct.OUTLINE_FAR)*e.nearness)*ct.NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                        ${ke.map(e=>B`
                            <line
                                class="solar-arc-segment solar-arc-night"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${(ct.SEGMENT_FAR+(ct.SEGMENT_NEAR-ct.SEGMENT_FAR)*e.nearness)*ct.NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                    </svg>
                `:K}


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
                ${K}

                ${u?(()=>{const e=t.pvLabel.x,i=t.pvLabel.y+11,o=this._nudgeToHomePill(e,i,t.home.x,t.home.y);return U`
                    <svg class="pv-home-leader-svg">
                        <line
                            class="pv-home-leader-line"
                            style="--pv-leader-color:${r}"
                            x1="${e}"
                            y1="${i}"
                            x2="${o.x}"
                            y2="${o.y}"
                        ></line>
                        ${y?K:B`
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
                                    dur="${f}s"
                                    repeatCount="indefinite"
                                    path="M ${e},${i} L ${o.x},${o.y}"
                                ></animateMotion>
                            </circle>
                        `}
                    </svg>`})():K}

                ${u?U`
                    <div
                        class="pv-pct-label ${c?"is-predicted":""} ${"production"===this._chartTarget?"is-chart-active":""}"
                        style="left:${t.pvLabel.x}px; top:${t.pvLabel.y}px; --pv-leader-color:${r}"
                        role="button"
                        tabindex="0"
                        @click=${()=>this._setChartTarget("production")}
                    >
                        <ha-icon icon="mdi:solar-power"></ha-icon>
                        <span>${g}</span>
                    </div>
                `:K}

                ${P||I?U`
                    <svg class="battery-leader-svg">
                        <!--
                            SoC → Power chip, solid straight vertical
                            hairline between the two stacked chips. No
                            animation: SoC is a level, not a flow.
                        -->
                        ${se?B`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${Q}"
                                d="${se}"
                            ></path>
                        `:K}
                        <!--  SoC → home static connector when the SoC chip is the only battery chip. -->
                        ${ce?B`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${Q}"
                                d="${ce}"
                            ></path>
                        `:K}
                        <!--
                            SoC → home, the battery→home discharge
                            flow: solid rounded-L + bead toward the
                            home, drawn only while the battery is
                            discharging to feed the house.
                        -->
                        ${le?B`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${Q}"
                                d="${le}"
                            ></path>
                            ${te?K:B`
                                <circle
                                    class="battery-leader-bead"
                                    r="3"
                                    style="fill:${Q}"
                                >
                                    <animateMotion
                                        dur="${ie}s"
                                        repeatCount="indefinite"
                                        path="${le}"
                                    ></animateMotion>
                                </circle>
                            `}
                        `:K}
                        <!--
                            PV → Power chip, only while charging: an
                            inverted L (down then right) in the PV
                            colour with a bead flowing toward the
                            battery, so the user sees the PV feeding it.
                        -->
                        ${he?B`
                            <path
                                class="pv-home-leader-line"
                                style="--pv-leader-color:${r}"
                                fill="none"
                                d="${he}"
                            ></path>
                            ${te?K:B`
                                <circle
                                    class="pv-home-leader-bead"
                                    r="3"
                                    fill="${r}"
                                >
                                    <animateMotion
                                        dur="${ie}s"
                                        repeatCount="indefinite"
                                        path="${he}"
                                    ></animateMotion>
                                </circle>
                            `}
                        `:K}
                    </svg>
                    ${P?U`
                        <div
                            class="battery-pct-label ${"battery-soc"===this._chartTarget?"is-chart-active":""}"
                            style="left:${t.batterySocLabel.x}px; top:${t.batterySocLabel.y}px; --battery-leader-color:${Q}"
                            role="button"
                            tabindex="0"
                            @click=${()=>this._setChartTarget("battery-soc")}
                        >
                            <ha-icon icon="mdi:battery"></ha-icon>
                            <span>${O}</span>
                        </div>
                    `:K}
                    ${I?U`
                        <div
                            class="battery-pct-label ${"battery"===this._chartTarget?"is-chart-active":""}"
                            style="left:${t.batteryPowerLabel.x}px; top:${t.batteryPowerLabel.y}px; --battery-leader-color:${Q}"
                            role="button"
                            tabindex="0"
                            @click=${()=>this._setChartTarget("battery")}
                        >
                            <ha-icon icon="mdi:lightning-bolt"></ha-icon>
                            <span>${z}</span>
                        </div>
                    `:K}
                `:K}

                <!--  Grid chip on the LEFT of the home, sitting on the
                      cluster's centre row. A single normal-size pill
                      that shows the ACTIVE flow only: when importing it
                      reads consumption blue with the import value and a
                      grid → home bead, when exporting it flips to return
                      purple with the export value and a home → grid
                      bead. The dominant side wins when both are live.
                      Same compact recipe as the other chips so the text
                      stays crisp under camera rotation.               -->
                ${!e||null===t||null===F&&null===A||$?K:U`
                    <svg class="grid-leader-svg">
                        <path class="grid-leader-line" style="stroke:${be}" d="${de}" />
                        <!--  Single bead on the active flow. Import
                              flows grid → home (default traversal),
                              export flows home → grid (keyPoints 1;0
                              reverses it). Dropped when the active side
                              is idle, no misleading motion.           -->
                        ${null!==ve?ye?B`
                            <circle class="grid-leader-bead" r="3" style="fill:${be}">
                                <animateMotion dur="${ve.toFixed(2)}s" repeatCount="indefinite"
                                               path="${de}" />
                            </circle>
                        `:B`
                            <circle class="grid-leader-bead" r="3" style="fill:${be}">
                                <animateMotion dur="${ve.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints="1;0" keyTimes="0;1"
                                               path="${de}" />
                            </circle>
                        `:K}
                    </svg>
                    <div
                        class="grid-label ${"grid"===this._chartTarget?"is-chart-active":""}"
                        style="left:${t.gridLabel.x}px; top:${t.gridLabel.y}px; --grid-leader-color:${be}"
                        role="button"
                        tabindex="0"
                        @click=${()=>this._setChartTarget("grid")}
                    >
                        <ha-icon icon="${ye?"mdi:transmission-tower-export":"mdi:transmission-tower-import"}"></ha-icon>
                        <span>${formatGridValue(this.hass,ye?F??0:A??0,ye?H:E,p)}</span>
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
                ${we&&Me.length>0?U`
                    <svg
                        class="solar-svg solar-svg-front-far"
                        style="--solar-daylight:${_e.daylight}"
                    >
                        ${Me.map(e=>B`
                            <line
                                class="solar-arc-outline"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${ct.OUTLINE_FAR+(ct.OUTLINE_NEAR-ct.OUTLINE_FAR)*e.nearness}"
                            ></line>
                        `)}
                        ${Me.map(e=>B`
                            <line
                                class="solar-arc-segment"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${ct.SEGMENT_FAR+(ct.SEGMENT_NEAR-ct.SEGMENT_FAR)*e.nearness}"
                            ></line>
                        `)}
                    </svg>
                `:K}

                <!--  Solar arc, NEAR-FRONT pass. Above-horizon
                      segments whose nearness is at or above 0.5: the
                      part of the arc that is closer to the camera
                      than the home. These render IN FRONT of the
                      home-anchored chips + leaders so the live arc
                      always reads on top of the HUD on its near side.
                      The card is named Helios, the sun must dominate
                      visually wherever it is. -->
                ${we&&Te.length>0?U`
                    <svg
                        class="solar-svg solar-svg-front-near"
                        style="--solar-daylight:${_e.daylight}"
                    >
                        ${Te.map(e=>B`
                            <line
                                class="solar-arc-outline"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke-width="${ct.OUTLINE_FAR+(ct.OUTLINE_NEAR-ct.OUTLINE_FAR)*e.nearness}"
                            ></line>
                        `)}
                        ${Te.map(e=>B`
                            <line
                                class="solar-arc-segment"
                                x1="${e.x1}" y1="${e.y1}"
                                x2="${e.x2}" y2="${e.y2}"
                                stroke="${e.color}"
                                stroke-width="${ct.SEGMENT_FAR+(ct.SEGMENT_NEAR-ct.SEGMENT_FAR)*e.nearness}"
                            ></line>
                        `)}
                    </svg>
                `:K}

                <!--  Ray + bead live in their own SVG below the chip
                      family (z 7 < pv-pct-label z 8) so the PV chip's
                      background always occludes the ray endpoint at
                      the chip border. The sun disc stays in the
                      depth-split SVG below so it passes in front of /
                      behind the home cluster depending on camera
                      bearing, while the ray never rides over the
                      production chip. -->
                ${we&&Ce?U`
                    <svg class="solar-svg solar-ray-svg"
                         style="--solar-daylight:${_e.daylight}">
                        <line
                            class="solar-ray"
                            style="--sun-flow-duration:${De}s"
                            x1="${_e.sun.x}"  y1="${_e.sun.y}"
                            x2="${Re}"    y2="${Le}"
                            stroke="${xe}"
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
                            fill="${xe}"
                        >
                            <animateMotion
                                dur="${De}s"
                                repeatCount="indefinite"
                                path="M ${_e.sun.x},${_e.sun.y} L ${Re},${Le}"
                            ></animateMotion>
                        </circle>
                    </svg>
                `:K}

                ${we?U`
                    <svg
                        class="solar-svg solar-svg-sun ${_e.sun.nearness>=.5?"solar-svg-sun-near":"solar-svg-sun-far"}"
                        style="--solar-daylight:${_e.daylight}"
                    >
                        ${(()=>{const e=this._engine?.getSunArcScale()??1,t=Math.min((ct.SUN_R_FAR+(ct.SUN_R_NEAR-ct.SUN_R_FAR)*_e.sun.nearness)*e,22),i=t*He,r=3*t;return B`
                                <defs>
                                    <radialGradient id="solar-halo-grad">
                                        <stop offset="0%"   stop-color="${xe}" stop-opacity="${.55*He}"></stop>
                                        <stop offset="100%" stop-color="${xe}" stop-opacity="0"></stop>
                                    </radialGradient>
                                </defs>
                                <circle
                                    class="solar-sun-halo"
                                    cx="${_e.sun.x}" cy="${_e.sun.y}"
                                    r="${r}"
                                    fill="url(#solar-halo-grad)"
                                ></circle>
                                <circle
                                    class="solar-sun-bg"
                                    cx="${_e.sun.x}" cy="${_e.sun.y}"
                                    r="${t}"
                                    fill="${xe}"
                                    fill-opacity="${ct.SUN_FILL_OPACITY_BG}"
                                ></circle>
                                <circle
                                    class="solar-sun-fill"
                                    cx="${_e.sun.x}" cy="${_e.sun.y}"
                                    r="${i}"
                                    fill="${xe}"
                                    stroke="${Se}"
                                    stroke-width="0.5"
                                ></circle>
                                <circle
                                    class="solar-sun-rim"
                                    cx="${_e.sun.x}" cy="${_e.sun.y}"
                                    r="${t}"
                                    fill="none"
                                    stroke="${xe}"
                                    stroke-width="${ct.SUN_RIM_WIDTH}"
                                ></circle>
                            `})()}
                    </svg>
                `:K}

                <!--  W/m² label, pinned above the sun disc. Same
                      visual language as the cloud-cover label, both
                      read as a matched pair of cartographic readouts.
                      Lands after the front-pass arc so the readout
                      sits on top of the sun glyph as well.  -->
                ${Ee?U`
                    <div
                        class="solar-pct-label ${"irradiance"===this._chartTarget?"is-chart-active":""}"
                        style="left:${_e.sun.x}px; top:${_e.sun.y-22}px"
                        role="button"
                        tabindex="0"
                        @click=${()=>this._setChartTarget("irradiance")}
                    >
                        <ha-icon icon="mdi:white-balance-sunny"></ha-icon>
                        <span>${Ae} W/m²</span>
                    </div>
                `:K}

                <!--  Cloud chip: a standalone pill just to the RIGHT of the irradiance chip, joined by a
                      short fixed cloud-coloured leader, showing the live cloud cover with a dynamic glyph.
                      Clicking it re-targets the timeline chart to the cloud cover (three altitude-band
                      curves), same chip <-> chart coupling as the other chips. Anchored off the sun so it
                      tracks the irradiance chip.  -->
                ${Ee&&this._cloudCover>=0?(()=>{const e=_e.sun.x,t=_e.sun.y-22,i=t-ct.CHIP_HALF_H_PX,r=this._engine?.getViewportWidth()??0,o=ct.CHIP_HALF_W_PX,n=o+16+76,s=r<=0||e+n<=r-8?1:e-n>=8?-1:e<r/2?1:-1,l=s>0?e+o+16:e-o-16,c=s>0?"translate(0, -100%)":"translate(-100%, -100%)";return U`
                        <div
                            class="cloud-chip-leader"
                            style="left:${(s>0?e+o:e-o-16).toFixed(1)}px; top:${i.toFixed(1)}px; width:${16}px"
                        ></div>
                        <div
                            class="cloud-chip ${"cloud"===this._chartTarget?"is-chart-active":""}"
                            style="left:${l.toFixed(1)}px; top:${t.toFixed(1)}px; transform:${c}"
                            role="button"
                            tabindex="0"
                            @click=${()=>this._setChartTarget("cloud")}
                        >
                            <ha-icon icon="${function cloudCoverIcon(e){return e<0?"mdi:weather-cloudy":e<15?"mdi:weather-sunny":e<40?"mdi:weather-partly-cloudy":e<75?"mdi:weather-cloudy":"mdi:weather-pouring"}(this._cloudCover)}"></ha-icon>
                            <span>${Math.round(this._cloudCover)} %</span>
                        </div>
                    `})():K}

                <!--  Sunrise / sunset markers: a sun-coloured glyph + local time just outside the arc at
                      each horizon crossing.  -->
                ${we&&_e?U`
                    ${this._renderSunCrossing(_e.sunrise,_e.home,"mdi:weather-sunset-up",xe)}
                    ${this._renderSunCrossing(_e.sunset,_e.home,"mdi:weather-sunset-down",xe)}
                `:K}



                <!--  Home pill: the hub the whole chip cluster orbits,
                      painted at the projected home centre with no
                      drop-leader so every chip leader docks straight
                      against its border. Hosts two stacked lines: the
                      home glyph on top and the live home consumption
                      below.                                           -->
                ${e&&null!==t?U`
                    <div
                        class="home-pill ${Y?"has-usage":""} ${this._homeHover?"is-hovered":""} ${"consumption"===this._chartTarget?"is-chart-active":""}"
                        style="left:${t.home.x}px; top:${t.home.y}px"
                        role="button"
                        tabindex="0"
                        @click=${()=>this._setChartTarget("consumption")}
                        @mouseenter="${this._onHomeEnter}"
                        @mouseleave="${this._onHomeLeave}"
                    >
                        <ha-icon icon="mdi:home"></ha-icon>
                        ${Y?U`<span class="home-pill-usage">${X}</span>`:K}
                    </div>
                `:K}

            </ha-card>
        `}_maybeRebuildUnifiedStore(){(function isStoreFresh(e,t){return!!t&&t.dataVersion===computeDataVersion(e)})(this,this._unifiedStore)||(this._unifiedStore=buildUnifiedStore(this))}_isCameraLocked(){return!!this._engine&&this._engine.isCameraLocked()}},ct=lt,lt.OUTLINE_FAR=1.5,lt.OUTLINE_NEAR=5,lt.SEGMENT_FAR=1,lt.SEGMENT_NEAR=4,lt.SUN_R_FAR=10,lt.SUN_R_NEAR=20,lt.SUN_RIM_WIDTH=1.5,lt.CHIP_HALF_W_PX=48,lt.CHIP_HALF_H_PX=12,lt.HOME_PILL_HALF_WIDTH_PX=38,lt.HOME_PILL_HALF_HEIGHT_PX=14,lt.SUN_FILL_OPACITY_BG=.2,lt.NIGHT_STROKE_FACTOR=.5,lt._LEGACY_ENTITY_KEYS=["pv-power-entity","grid-import-entity","grid-export-entity","grid-power-entity","grid-power-invert","battery-soc-entity","battery-power-entity","battery-power-invert","batteries"],lt.styles=[We,je],lt);__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],pt.prototype,"hass",void 0),__decorate([n$1({attribute:!1}),__decorateMetadata("design:type",Object)],pt.prototype,"config",void 0),__decorate([r$1(),__decorateMetadata("design:type",void 0===Ie?Object:Ie)],pt.prototype,"_engine",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_now",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_cloudCover",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_labelLayout",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_pvCurrent",void 0),__decorate([r$1(),__decorateMetadata("design:type",String)],pt.prototype,"_pvUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_pvHistory",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_pvCalibStats",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_pvChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Array)],pt.prototype,"_haSolarForecast",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_batterySoc",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_batteryPower",void 0),__decorate([r$1(),__decorateMetadata("design:type",String)],pt.prototype,"_batteryPowerUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_gridImportValue",void 0),__decorate([r$1(),__decorateMetadata("design:type",String)],pt.prototype,"_gridImportUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_gridExportValue",void 0),__decorate([r$1(),__decorateMetadata("design:type",String)],pt.prototype,"_gridExportUnit",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_gridImportChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_gridExportChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_batterySocHistory",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_batteryPowerHistory",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_batteryChargeChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_batteryDischargeChangeSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_sunScene",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_energyDefaults",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_haSolarTodayKwh",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_haGridImportTodayKwh",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_haGridExportTodayKwh",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_haBatteryChargedKwh",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_haBatteryDischargedKwh",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_homeHover",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_chartHoverPct",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_chartTarget",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_chartSeries",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_timeRange",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_selectedTime",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_isLiveMode",void 0),__decorate([r$1(),__decorateMetadata("design:type",Object)],pt.prototype,"_unifiedStore",void 0),pt=ct=__decorate([t$2("helios-card")],pt);export{pt as HeliosCard};