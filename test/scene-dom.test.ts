import { describe, it, expect } from 'vitest';
import { SceneSvgLayers, type SceneDocument, type SceneNode } from '../src/scene/scene-dom';
import {
    renderBuildings,
    renderShadows,
    shapesSvg,
    shadowLayerSvg,
    type Building,
    type SceneShape,
    type ShadowLayer,
} from '../src/scene/buildings';
import { SceneCamera } from '../src/scene/projection';

//A minimal element tree standing in for the document: enough to check that what the committer leaves in the tree
//is exactly the markup the string serialisers describe, and to count the attribute writes it actually makes.
class FakeNode implements SceneNode
{
    public readonly attrs = new Map<string, string>();
    public readonly children: FakeNode[] = [];
    public writes = 0;

    public constructor(public readonly tag: string)
    {
    }

    public setAttribute(name: string, value: string): void
    {
        this.attrs.set(name, value); this.writes++;
    }

    public removeAttribute(name: string): void
    {
        this.attrs.delete(name); this.writes++;
    }

    public appendChild(child: SceneNode): void
    {
        this.children.push(child as FakeNode);
    }

    public replaceChild(child: SceneNode, old: SceneNode): void
    {
        const k = this.children.indexOf(old as FakeNode);
        if (k < 0)
        {
            throw new Error('replaceChild: not a child');
        }
        this.children[k] = child as FakeNode;
    }

    public removeChild(child: SceneNode): void
    {
        const k = this.children.indexOf(child as FakeNode);
        if (k < 0)
        {
            throw new Error('removeChild: not a child');
        }
        this.children.splice(k, 1);
    }

    //Serialise like the painters' string form: attributes in insertion order, self-closed leaves.
    public toString(): string
    {
        const attrs = [...this.attrs].map(([k, v]) => ` ${k}="${v}"`).join('');
        const inner = this.children.map((c) => c.toString()).join('');
        return inner ? `<${this.tag}${attrs}>${inner}</${this.tag}>` : `<${this.tag}${attrs}/>`;
    }

    public count(): number
    {
        return this.children.reduce((n, c) => n + c.count(), 1);
    }

    public totalWrites(): number
    {
        return this.children.reduce((n, c) => n + c.totalWrites(), this.writes);
    }
}

const doc: SceneDocument = { createElementNS: (_ns, tag) => new FakeNode(tag) };

//The tree, minus the fixed skeleton the innerHTML version never had, in the innerHTML version's shape.
function markup(svg: FakeNode): { shadows: string; buildings: string }
{
    const [shadows, buildings] = svg.children;
    return {
        shadows:   shadows.children.map((c) => c.toString()).join(''),
        buildings: buildings.children.map((c) => c.toString()).join(''),
    };
}

//Attribute insertion order on a reused node follows its first write, so compare attribute SETS per element rather
//than raw strings: parse both markups into [tag, sorted attrs] lists.
function elements(svg: string): string[]
{
    const out: string[] = [];
    for (const m of svg.matchAll(/<([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g))
    {
        const attrs = [...m[2].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => `${a[1]}=${a[2]}`).sort();
        out.push(`${m[1]} ${attrs.join(' ')}`);
    }
    return out;
}

function scene(bearing: number, tilt: number, altitude = 40): { shadows: ShadowLayer | null; shapes: SceneShape[] }
{
    const cam = new SceneCamera();
    cam.pxPerMetre = 2.4;
    cam.setPose(bearing, tilt);
    cam.setViewport(640, 420);
    const sq = (cx: number, cy: number, r: number): [number, number][] => [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]];
    const buildings: Building[] = [
        { footprint: sq(0, 0, 4), height: 6, isHome: true, centerX: 0, centerY: 0, detail: [sq(0, 0, 4)] },
        { footprint: [[10, 8], [30, 8], [30, 28], [10, 28]], holes: [[[16, 14], [24, 14], [24, 22], [16, 22]]], height: 8, isHome: false, centerX: 20, centerY: 18 },
        { footprint: [[-22, 4], [-12, 4], [-12, 14], [-15, 14], [-15, 9], [-22, 9]], height: 5, isHome: false, centerX: -17, centerY: 9 },
        { footprint: sq(0, -60, 6), height: 12, isHome: false, centerX: 0, centerY: -60 },
    ];
    const palette = { home: '#e0a020', neighbor: '#8a8f98' };
    const sun = { azimuth: 135, altitude };
    return {
        shadows: renderShadows(cam, buildings, sun, '#101014', 0.35),
        shapes:  renderBuildings(cam, buildings, altitude, palette, 1, 0.25, { color: '#e0a020', growth: 1 }, sun.azimuth),
    };
}

describe('scene-dom: persistent scene SVG nodes', () =>
{
    it('the committed tree is the markup the painters serialise, frame after frame', () =>
    {
        const svg = new FakeNode('svg');
        const layers = new SceneSvgLayers(doc, svg);
        //Poses chosen so the face count and order change between frames, and one that walks a caster off-card.
        for (const [b, t, alt] of [[35, 62, 40], [200, 70, 40], [35, 62, 40], [90, 30, 5], [270, 80, 70], [0, 45, 0], [35, 62, 40]] as const)
        {
            const { shadows, shapes } = scene(b, t, alt);
            layers.commit(shadows, shapes);
            const got = markup(svg);
            expect(elements(got.buildings)).toEqual(elements(shapesSvg(shapes)));
            //The shade pass keeps its stencil + group even when there is no shade to cast (nothing paints).
            //Inside <defs> nothing paints and order carries no meaning (the stencil sits first in the tree, last in
            //the markup), and the casts flatten under one group opacity, so the pass compares as a set.
            const want = shadowLayerSvg(shadows);
            if (shadows)
            {
                expect(elements(got.shadows).sort()).toEqual(elements(want).sort());
            }
            else
            {
                expect(want).toBe('');
                expect(elements(got.shadows).filter((e) => e.startsWith('linearGradient ') || (e.startsWith('path ') && !e.includes('clip-rule=')))).toEqual([]);
            }
        }
    });

    it('an unchanged frame writes nothing, a moved camera rewrites geometry only', () =>
    {
        const svg = new FakeNode('svg');
        const layers = new SceneSvgLayers(doc, svg);
        const a = scene(35, 62);
        layers.commit(a.shadows, a.shapes);
        const nodes  = svg.count();
        const writes = svg.totalWrites();
        layers.commit(a.shadows, a.shapes);
        expect(svg.totalWrites()).toBe(writes);
        expect(svg.count()).toBe(nodes);

        //A tenth of a degree: every face stays, in the same order with the same fill, so only points/d and the
        //gradient anchors move. Bounded by one geometry write per shape + cast + clip + four gradient anchors.
        const b = scene(35.1, 62);
        expect(b.shapes.length).toBe(a.shapes.length);
        layers.commit(b.shadows, b.shapes);
        const geometryWrites = b.shapes.length + (b.shadows?.casts.length ?? 0) * 5 + 1;
        expect(svg.totalWrites() - writes).toBeLessThanOrEqual(geometryWrites);
        expect(svg.count()).toBe(nodes);
    });

    it('a slot that changes tag is swapped in place, keeping sibling order', () =>
    {
        const svg = new FakeNode('svg');
        const layers = new SceneSvgLayers(doc, svg);
        const wall = (n: number): SceneShape => ({ tag: 'polygon', geom: `0,0 ${n},0 ${n},${n}`, fill: '#111', stroke: '#222', strokeWidth: '1' });
        const roof = (n: number): SceneShape => ({ tag: 'path', geom: `M0,0L${n},0Z`, fill: '#333', fillRule: 'evenodd', stroke: '#444', strokeWidth: '0.6' });
        layers.commit(null, [wall(1), wall(2), roof(3)]);
        const first = svg.children[1].children.slice();
        layers.commit(null, [wall(1), roof(2), roof(3), wall(4)]);
        const second = svg.children[1].children;
        expect(second.map((c) => c.tag)).toEqual(['polygon', 'path', 'path', 'polygon']);
        //Slot 0 and 2 kept their nodes; slot 1 was replaced; slot 3 appended.
        expect(second[0]).toBe(first[0]);
        expect(second[2]).toBe(first[2]);
        expect(second[1]).not.toBe(first[1]);
        expect(elements(markup(svg).buildings)).toEqual(elements(shapesSvg([wall(1), roof(2), roof(3), wall(4)])));
        //A roof turned detail (no fill-rule) drops the attribute rather than keeping a stale one.
        layers.commit(null, [{ tag: 'path', geom: 'M0,0Z', fill: 'none', stroke: '#444', strokeWidth: '0.6' }]);
        expect(svg.children[1].children.length).toBe(1);
        expect(svg.children[1].children[0].attrs.has('fill-rule')).toBe(false);
    });
});
