# LiDAR tools

These helper scripts work with dataset folders under `data/<dataset>/`.

Dataset layout:

```text
data/
  <dataset>/
    raw/
    work/
    out/
```

Default dataset:

- If you do not pass `--dataset`, the tools use `data/test/`.

## Create a synthetic test nDSM

Write the default test raster into `data/test/work/helios-test-ndsm.tif`:

```bash
uv run python tools/lidar/make_test_ndsm.py
```

Write into a specific dataset and filename:

```bash
uv run python tools/lidar/make_test_ndsm.py --dataset demo --filename demo-ndsm.tif
```

That resolves to:

```text
data/demo/work/demo-ndsm.tif
```

You can also override the bbox directly:

```bash
uv run python tools/lidar/make_test_ndsm.py \
  --dataset demo \
  --filename demo-ndsm.tif \
  --min-lon 150.0 \
  --max-lon 150.002 \
  --min-lat -34.002 \
  --max-lat -34.0
```

## Inspect an nDSM

Inspect the default test raster:

```bash
uv run python tools/lidar/inspect_ndsm.py
```

Inspect a dataset-specific file using `--dataset` and `--filename`:

```bash
uv run python tools/lidar/inspect_ndsm.py --dataset demo --filename demo-ndsm.tif
```

That resolves to:

```text
data/demo/work/demo-ndsm.tif
```

If you pass a file path as the first positional argument, it takes precedence over `--dataset` and `--filename`:

```bash
uv run python tools/lidar/inspect_ndsm.py data/demo/work/demo-ndsm.tif
```

## Convert an nDSM to COG

Convert the default test raster into `data/test/out/helios-test-ndsm-cog.tif`:

```bash
uv run python tools/lidar/convert_ndsm_to_cog.py
```

Convert a dataset-specific input and output together:

```bash
uv run python tools/lidar/convert_ndsm_to_cog.py \
  --dataset demo \
  --input-filename demo-ndsm.tif \
  --output-filename demo-ndsm-cog.tif
```

That resolves to:

```text
input:  data/demo/work/demo-ndsm.tif
output: data/demo/out/demo-ndsm-cog.tif
```

If you pass positional `input_path` and `output_path`, those take precedence over the dataset-based defaults.
