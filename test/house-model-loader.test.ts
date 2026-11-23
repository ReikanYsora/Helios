import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HouseModelLoader, fetchObjGeometry } from '../src/scene/house-model-loader';
import { houseModelOptions } from '../src/core/config/house-model-config';
import { MAX_OBJ_BYTES } from '../src/scene/house-model';

const OBJ = readFileSync(new URL('../examples/low-poly-house.obj', import.meta.url), 'utf8');
const OPTIONS = houseModelOptions({ 'house-model-url': '/local/house.obj' })!;
const loaders: HouseModelLoader[] = [];

afterEach(() =>
{
    for (const loader of loaders.splice(0))
    {
        loader.dispose();
    }
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

function loader(): { instance: HouseModelLoader; changed: ReturnType<typeof vi.fn> }
{
    const changed = vi.fn();
    const instance = new HouseModelLoader(changed);
    loaders.push(instance);
    return { instance, changed };
}

describe('OBJ fetch boundary', () =>
{
    it('rejects executable/data/file URL schemes without fetching', async () =>
    {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        for (const url of ['javascript:alert(1)', 'data:text/plain,house', 'file:///house.obj'])
        {
            await expect(fetchObjGeometry(url, new AbortController().signal)).rejects.toThrow(/HTTP/);
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('surfaces HTTP failures', async () =>
    {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));
        await expect(fetchObjGeometry('/local/missing.obj', new AbortController().signal)).rejects.toThrow(/404/);
    });

    it('enforces both declared and actual streamed byte limits', async () =>
    {
        const mock = vi.fn()
            .mockResolvedValueOnce(new Response('small', { headers: { 'content-length': String(MAX_OBJ_BYTES + 1) } }))
            .mockResolvedValueOnce(new Response('#'.repeat(MAX_OBJ_BYTES + 1)));
        vi.stubGlobal('fetch', mock);
        await expect(fetchObjGeometry('/local/large.obj', new AbortController().signal)).rejects.toThrow(/2 MiB/);
        await expect(fetchObjGeometry('/local/large.obj', new AbortController().signal)).rejects.toThrow(/2 MiB/);
    });

    it('loads local geometry with same-origin credentials and no material requests', async () =>
    {
        const mock = vi.fn().mockResolvedValue(new Response('mtllib missing.mtl\n' + OBJ));
        vi.stubGlobal('fetch', mock);
        const signal = new AbortController().signal;
        const geometry = await fetchObjGeometry('/local/house.obj', signal);
        expect(geometry.triangles).toHaveLength(16);
        expect(mock).toHaveBeenCalledTimes(1);
        expect(mock).toHaveBeenCalledWith('http://localhost/local/house.obj',
            { signal, credentials: 'same-origin' });
    });
});

describe('model loading lifecycle', () =>
{
    it('does not fetch when unconfigured and loads when configured', async () =>
    {
        const mock = vi.fn().mockResolvedValue(new Response(OBJ));
        vi.stubGlobal('fetch', mock);
        const { instance } = loader();
        instance.setOptions(null);
        expect(mock).not.toHaveBeenCalled();
        instance.setOptions(OPTIONS);
        await vi.waitFor(() => expect(instance.model?.height).toBeCloseTo(8));
        expect(instance.error).toBeNull();
        expect(mock).toHaveBeenCalledTimes(1);
    });

    it('transforms an already loaded model without a second request', async () =>
    {
        const mock = vi.fn().mockResolvedValue(new Response(OBJ));
        vi.stubGlobal('fetch', mock);
        const { instance } = loader();
        instance.setOptions(OPTIONS);
        await vi.waitFor(() => expect(instance.model).not.toBeNull());
        instance.setOptions({ ...OPTIONS, scale: 2, rotationDeg: 90 });
        expect(instance.model?.height).toBeCloseTo(16);
        expect(mock).toHaveBeenCalledTimes(1);
    });

    it('uses the latest transform options when an in-flight model arrives', async () =>
    {
        let resolve!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
        const { instance } = loader();
        instance.setOptions(OPTIONS);
        instance.setOptions({ ...OPTIONS, scale: 2 });
        resolve(new Response(OBJ));
        await vi.waitFor(() => expect(instance.model?.height).toBeCloseTo(16));
    });

    it('clears a loaded model when the URL is removed', async () =>
    {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(OBJ)));
        const { instance } = loader();
        instance.setOptions(OPTIONS);
        await vi.waitFor(() => expect(instance.model).not.toBeNull());
        instance.setOptions(null);
        expect(instance.model).toBeNull();
        expect(instance.error).toBeNull();
    });

    it('falls back on malformed geometry and can explicitly retry', async () =>
    {
        const mock = vi.fn().mockResolvedValueOnce(new Response('<html>not an OBJ</html>'))
            .mockResolvedValueOnce(new Response(OBJ));
        vi.stubGlobal('fetch', mock);
        const { instance } = loader();
        instance.setOptions(OPTIONS);
        await vi.waitFor(() => expect(instance.error).toMatch(/no usable/));
        expect(instance.model).toBeNull();
        //Wait for the completion/finally turn, then explicitly refresh the same URL.
        await Promise.resolve();
        instance.reload();
        await vi.waitFor(() => expect(instance.model?.height).toBeCloseTo(8));
        expect(instance.error).toBeNull();
        expect(mock).toHaveBeenCalledTimes(2);
    });

    it('keeps parsed geometry so an invalid transform can be corrected without a refetch', async () =>
    {
        const mock = vi.fn().mockResolvedValue(new Response(OBJ));
        vi.stubGlobal('fetch', mock);
        const { instance } = loader();
        instance.setOptions({ ...OPTIONS, sizeM: 100, scale: 10 });
        await vi.waitFor(() => expect(instance.error).toMatch(/100 m/));
        instance.setOptions(OPTIONS);
        expect(instance.model?.height).toBeCloseTo(8);
        expect(mock).toHaveBeenCalledTimes(1);
    });

    it('does not accept a stale response after switching URLs, even if fetch ignores abort', async () =>
    {
        let resolveOld!: (response: Response) => void;
        const mock = vi.fn()
            .mockImplementationOnce(() => new Promise<Response>((done) => { resolveOld = done; }))
            .mockResolvedValueOnce(new Response(OBJ));
        vi.stubGlobal('fetch', mock);
        const { instance } = loader();
        instance.setOptions(OPTIONS);
        const signal = mock.mock.calls[0][1].signal as AbortSignal;
        instance.setOptions({ ...OPTIONS, url: '/local/new.obj', scale: 2 });
        expect(signal.aborted).toBe(true);
        await vi.waitFor(() => expect(instance.model?.height).toBeCloseTo(16));
        resolveOld(new Response('bad old response'));
        await new Promise((done) => setTimeout(done, 0));
        expect(instance.model?.height).toBeCloseTo(16);
        expect(instance.error).toBeNull();
    });

    it('aborts on dispose and ignores late completion callbacks', async () =>
    {
        let resolve!: (response: Response) => void;
        const mock = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
        vi.stubGlobal('fetch', mock);
        const { instance, changed } = loader();
        instance.setOptions(OPTIONS);
        const signal = mock.mock.calls[0][1].signal as AbortSignal;
        instance.dispose();
        const calls = changed.mock.calls.length;
        expect(signal.aborted).toBe(true);
        resolve(new Response(OBJ));
        await new Promise((done) => setTimeout(done, 0));
        expect(instance.model).toBeNull();
        expect(changed).toHaveBeenCalledTimes(calls);
    });

    it('times out an unavailable asset rather than leaving an endless request', async () =>
    {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) =>
        {
            init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })));
        const { instance } = loader();
        instance.setOptions(OPTIONS);
        await vi.advanceTimersByTimeAsync(15001);
        expect(instance.model).toBeNull();
        expect(instance.error).toMatch(/timed out/);
    });
});
