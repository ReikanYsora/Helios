from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from osgeo import gdal

TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from tool_paths import get_dataset_paths

gdal.UseExceptions()

DEFAULT_DATASET = "test"
DEFAULT_FILENAME = "helios-test-ndsm.tif"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect an nDSM GeoTIFF")
    parser.add_argument("dataset_path", nargs="?", help="Optional explicit path to inspect")
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help="Dataset folder under data/")
    parser.add_argument("--filename", default=DEFAULT_FILENAME, help="Input filename when using a dataset path")
    return parser.parse_args()


def resolve_input_path(args: argparse.Namespace) -> Path:
    if args.dataset_path:
        return Path(args.dataset_path).expanduser().resolve()
    dataset_paths = get_dataset_paths(args.dataset)
    return (dataset_paths.work / args.filename).resolve()


def load_gdalinfo_json(dataset_path: Path) -> dict:
    gdalinfo = shutil.which("gdalinfo")
    if gdalinfo is not None:
        result = subprocess.run(
            [gdalinfo, "-json", "-stats", str(dataset_path)],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)

    return gdal.Info(
        str(dataset_path),
        options=gdal.InfoOptions(format="json", stats=True),
    )


def main() -> int:
    args = parse_args()
    dataset_path = resolve_input_path(args)

    if not dataset_path.exists():
        print(f"File not found: {dataset_path}", file=sys.stderr)
        return 1

    info = load_gdalinfo_json(dataset_path)
    bands = info.get("bands", [])
    first_band = bands[0] if bands else {}
    corner_coordinates = info.get("cornerCoordinates", {})

    print(f"path: {dataset_path}")
    print(f"driver: {info.get('driverShortName')}/{info.get('driverLongName')}")
    print(f"size: {info.get('size')}")
    print(f"coordinate_system: {info.get('coordinateSystem', {}).get('wkt', '').splitlines()[0] if info.get('coordinateSystem') else 'unknown'}")
    print(f"geo_transform: {info.get('geoTransform')}")
    print(f"band_count: {len(bands)}")
    print(f"band_1_type: {first_band.get('type', 'unknown')}")
    print(f"band_1_no_data: {first_band.get('noDataValue', 'unset')}")
    print(f"band_1_min: {first_band.get('minimum', 'unknown')}")
    print(f"band_1_max: {first_band.get('maximum', 'unknown')}")
    print("corner_coordinates:")
    for corner_name in ("upperLeft", "lowerLeft", "upperRight", "lowerRight", "center"):
        print(f"  {corner_name}: {corner_coordinates.get(corner_name)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
