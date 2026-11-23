//One abortable OBJ request per engine. Geometry transforms are reapplied locally on option changes.
import type { HouseModelOptions } from '../core/config/house-model-config';
import { parseObj, transformHouseModel, MAX_OBJ_BYTES } from './house-model';
import type { HouseMesh, ObjGeometry } from './house-model';

const LOAD_TIMEOUT_MS = 15000;

export async function fetchObjGeometry(url: string, signal: AbortSignal): Promise<ObjGeometry>
{
    const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
    const resolved = new URL(url, base);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:')
    {
        throw new Error('House model URL must use HTTP(S), normally /local/models/house.obj.');
    }
    const response = await fetch(resolved.href, { signal, credentials: 'same-origin' });
    if (!response.ok)
    {
        throw new Error(`House model request failed (HTTP ${response.status}).`);
    }
    const declared = Number(response.headers.get('content-length'));
    if (declared > MAX_OBJ_BYTES)
    {
        throw new Error('OBJ exceeds the 2 MiB limit.');
    }
    if (!response.body)
    {
        //A streaming body is needed to enforce the limit even if the server omits Content-Length.
        throw new Error('This browser did not provide a streaming model response.');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try
    {
        while (true)
        {
            // eslint-disable-next-line no-await-in-loop -- bounded sequential reads from one response
            const { value, done } = await reader.read();
            if (done)
            {
                break;
            }
            size += value.byteLength;
            if (size > MAX_OBJ_BYTES)
            {
                // eslint-disable-next-line no-await-in-loop -- cancel as soon as the byte limit is exceeded
                await reader.cancel();
                throw new Error('OBJ exceeds the 2 MiB limit.');
            }
            chunks.push(value);
        }
    }
    finally
    {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks)
    {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return parseObj(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export class HouseModelLoader
{
    public model: HouseMesh | null = null;
    public error: string | null = null;
    private _options: HouseModelOptions | null = null;
    private _source: ObjGeometry | null = null;
    private _signature = '';
    private _abort?: AbortController;
    private _disposed = false;

    public constructor(private readonly _changed: () => void)
    {
    }

    public setOptions(options: HouseModelOptions | null): void
    {
        if (this._disposed)
        {
            return;
        }
        const signature = JSON.stringify(options);
        if (signature === this._signature)
        {
            return;
        }
        this._signature = signature;
        const sameUrl = options?.url === this._options?.url;
        this._options = options;
        if (!sameUrl || !options)
        {
            this._abort?.abort();
            this._abort = undefined;
            this._source = null;
            this.model = null;
            this.error = null;
            this._changed(); //Built-in home stays visible while the next model loads.
        }
        if (!options)
        {
            return;
        }
        if (this._source)
        {
            this._apply();
            return;
        }
        if (this._abort)
        {
            return; //Current request will apply the LATEST size/rotation, not its initial snapshot.
        }
        this._load(options.url);
    }

    //Explicit retry / cache-reset entry point, including a refresh when an asset changed at the same URL.
    public reload(): void
    {
        if (!this._options || this._disposed)
        {
            return;
        }
        this._abort?.abort();
        this._abort = undefined;
        this._source = null;
        this.model = null;
        this.error = null;
        this._changed();
        this._load(this._options.url);
    }

    private _apply(): void
    {
        if (!this._source || !this._options || this._disposed)
        {
            return;
        }
        try
        {
            this.model = transformHouseModel(this._source, this._options);
            this.error = null;
        }
        catch (error: unknown)
        {
            this.model = null;
            this.error = error instanceof Error ? error.message : String(error);
        }
        this._changed();
    }

    private _load(url: string): void
    {
        const ac = new AbortController();
        this._abort = ac;
        const timer = setTimeout(() => ac.abort(), LOAD_TIMEOUT_MS);
        void fetchObjGeometry(url, ac.signal)
            .then((geometry) =>
            {
                if (this._disposed || this._abort !== ac || ac.signal.aborted)
                {
                    return;
                }
                this._source = geometry;
                this._apply();
            })
            .catch((error: unknown) =>
            {
                if (this._disposed || this._abort !== ac)
                {
                    return;
                }
                this.model = null;
                this.error = ac.signal.aborted ? 'House model load timed out after 15 seconds.'
                    : error instanceof Error ? error.message : String(error);
                this._changed();
            })
            .finally(() =>
            {
                clearTimeout(timer);
                if (this._abort === ac)
                {
                    this._abort = undefined;
                }
            });
    }

    public dispose(): void
    {
        this._disposed = true;
        this._abort?.abort();
        this._abort = undefined;
        this._source = null;
        this.model = null;
        this._options = null;
    }
}
