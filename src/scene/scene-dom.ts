//The scene SVG's DOM, kept alive between frames. The painters (buildings.ts) describe each frame as shapes; this
//layer owns one node per shape slot and, per frame, only writes the attributes whose text changed, appends or drops
//nodes at the tail as the shape count moves, and swaps a node in place when its slot changes tag. An innerHTML
//rebuild would be the heaviest per-frame cost of a camera move (the whole subtree thrown away, reparsed, recreated,
//restyled); a slot's node keeps its computed style when only its geometry moves, which is every wall and shade
//during a rotation.
//
//shapesSvg / shadowLayerSvg serialise the same elements in the same order with the same attributes, so the tests
//pin paint order, occlusion and clipping.

import { SVG_NS } from '../core/config/constants';
import type { SceneShape, ShadowLayer } from './buildings';

//Attribute text last written to a node, keyed by attribute name; undefined = absent.
type Written = Record<string, string | undefined>;

//Only what this layer touches, so a test can drive it with a plain fake in place of a document.
export interface SceneNode
{
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    appendChild(child: SceneNode): unknown;
    replaceChild(child: SceneNode, old: SceneNode): unknown;
    removeChild(child: SceneNode): unknown;
}

export interface SceneDocument
{
    createElementNS(ns: string, tag: string): SceneNode;
}

//A run of sibling nodes under one parent, addressed by slot. The slot's node is reused across frames whenever its
//tag matches; attributes are written only when their text changed since the last write to that node.
class NodeRun
{
    private readonly _nodes:   SceneNode[] = [];
    private readonly _written: Written[]   = [];

    public constructor(private readonly _doc: SceneDocument, private readonly _parent: SceneNode, private readonly _tag: string)
    {
    }

    //The node of slot k, created (appended) on first use. `tag` defaults to the run's; a different one replaces
    //the slot's node in place, so the sibling order never changes.
    public node(k: number, tag = this._tag): SceneNode
    {
        const cur = this._nodes[k];
        if (cur && this._written[k].__tag === tag)
        {
            return cur;
        }
        const el = this._doc.createElementNS(SVG_NS, tag);
        if (cur)
        {
            this._parent.replaceChild(el, cur);
        }
        else
        {
            this._parent.appendChild(el);
        }
        this._nodes[k]   = el;
        this._written[k] = { __tag: tag };
        return el;
    }

    public set(k: number, name: string, value: string | undefined): void
    {
        const w = this._written[k];
        if (w[name] === value)
        {
            return;
        }
        w[name] = value;
        if (value === undefined)
        {
            this._nodes[k].removeAttribute(name);
        }
        else
        {
            this._nodes[k].setAttribute(name, value);
        }
    }

    //Drop every slot from `count` on.
    public trim(count: number): void
    {
        while (this._nodes.length > count)
        {
            const last = this._nodes.pop();
            this._written.pop();
            if (last)
            {
                this._parent.removeChild(last);
            }
        }
    }
}

export class SceneSvgLayers
{
    private readonly _grads:   NodeRun;
    private readonly _stops:   [NodeRun, NodeRun][] = [];
    private readonly _casts:   NodeRun;
    private readonly _shapes:  NodeRun;
    private readonly _shade:   NodeRun;
    private readonly _clip:    NodeRun;
    private readonly _defs:    SceneNode;
    private readonly _doc:     SceneDocument;

    //Builds the fixed skeleton under `svg`:
    //  <g class="scene-shadows"><defs>[gradients]<clipPath id="hsh-clip"><path/></clipPath></defs>
    //                           <g clip-path="url(#hsh-clip)">[casts]</g></g>
    //  <g class="scene-buildings">[shapes]</g>
    //Each pass in its own group, addressable from a stylesheet, which is how a pass can be held off.
    public constructor(doc: SceneDocument, svg: SceneNode)
    {
        this._doc = doc;
        const shadows = doc.createElementNS(SVG_NS, 'g');
        shadows.setAttribute('class', 'scene-shadows');
        this._defs = doc.createElementNS(SVG_NS, 'defs');
        shadows.appendChild(this._defs);
        this._grads = new NodeRun(doc, this._defs, 'linearGradient');
        //The stencil first, so the gradients append after it; order inside <defs> paints nothing.
        const clipPath = doc.createElementNS(SVG_NS, 'clipPath');
        clipPath.setAttribute('id', 'hsh-clip');
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
        this._defs.appendChild(clipPath);
        this._clip = new NodeRun(doc, clipPath, 'path');
        this._clip.node(0);
        this._clip.set(0, 'clip-rule', 'evenodd');
        this._shade = new NodeRun(doc, shadows, 'g');
        this._shade.node(0);
        this._shade.set(0, 'clip-path', 'url(#hsh-clip)');
        this._casts = new NodeRun(doc, this._shade.node(0), 'path');
        svg.appendChild(shadows);

        const buildings = doc.createElementNS(SVG_NS, 'g');
        buildings.setAttribute('class', 'scene-buildings');
        this._shapes = new NodeRun(doc, buildings, 'polygon');
        svg.appendChild(buildings);
    }

    public commit(shadows: ShadowLayer | null, shapes: SceneShape[]): void
    {
        //No shade: every cast (and its gradient) goes, the stencil and group stay, painting nothing.
        const casts = shadows?.casts ?? [];
        const color = shadows?.color ?? '';
        for (let k = 0; k < casts.length; k++)
        {
            const c  = casts[k];
            const id = `hsh${k}`;
            const fresh = !this._stops[k];
            const g = this._grads.node(k);
            if (fresh)
            {
                //A new gradient: id + units once, then its two stops, which only ever change colour.
                this._grads.set(k, 'id', id);
                this._grads.set(k, 'gradientUnits', 'userSpaceOnUse');
                const stops: [NodeRun, NodeRun] = [new NodeRun(this._doc, g, 'stop'), new NodeRun(this._doc, g, 'stop')];
                stops[0].node(0); stops[0].set(0, 'offset', '0'); stops[0].set(0, 'stop-opacity', '1');
                stops[1].node(0); stops[1].set(0, 'offset', '1'); stops[1].set(0, 'stop-opacity', '0');
                this._stops[k] = stops;
            }
            this._grads.set(k, 'x1', c.x1);
            this._grads.set(k, 'y1', c.y1);
            this._grads.set(k, 'x2', c.x2);
            this._grads.set(k, 'y2', c.y2);
            this._stops[k][0].set(0, 'stop-color', color);
            this._stops[k][1].set(0, 'stop-color', color);
            this._casts.node(k);
            this._casts.set(k, 'd', c.d);
            this._casts.set(k, 'fill', `url(#${id})`);
            this._casts.set(k, 'fill-rule', 'nonzero');
        }
        this._grads.trim(casts.length);
        this._stops.length = casts.length;
        this._casts.trim(casts.length);
        if (shadows)
        {
            this._clip.set(0, 'd', shadows.clip);
            this._shade.set(0, 'opacity', shadows.opacity);
        }

        for (let k = 0; k < shapes.length; k++)
        {
            const s = shapes[k];
            this._shapes.node(k, s.tag);
            this._shapes.set(k, s.tag === 'polygon' ? 'points' : 'd', s.geom);
            this._shapes.set(k, 'fill', s.fill);
            this._shapes.set(k, 'fill-rule', s.fillRule);
            this._shapes.set(k, 'stroke', s.stroke);
            this._shapes.set(k, 'stroke-width', s.strokeWidth);
        }
        this._shapes.trim(shapes.length);
    }
}
