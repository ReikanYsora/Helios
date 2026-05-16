# Data folder

This folder holds local LiDAR inputs and derived raster outputs used during nDSM preparation.

Structure:

```text
data/
  <dataset>/
    raw/
    work/
    out/
```

- `raw/`: original source files such as downloaded `.laz` tiles.
- `work/`: intermediate files created while processing data.
- `out/`: final outputs ready to inspect, host, or use in Helios.

Current convention:

- Subfolders under `data/` are treated as local working data and are excluded from the repo by `.gitignore`.
- Keep large local data files out of git unless there is a specific reason to commit them.
- Helper-generated test rasters default to `data/test/work/` and `data/test/out/`.
- Use one top-level folder per dataset or workflow, following the same `raw/work/out` pattern.
