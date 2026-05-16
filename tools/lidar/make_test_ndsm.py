from osgeo import gdal, osr
import argparse
import numpy as np
from pathlib import Path
import sys

TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from tool_paths import get_dataset_paths

gdal.UseExceptions()

DEFAULT_DATASET = "test"
DEFAULT_FILENAME = "helios-test-ndsm.tif"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a synthetic test nDSM GeoTIFF")
    parser.add_argument("output_path", nargs="?", help="Optional explicit output file path")
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help="Dataset folder under data/")
    parser.add_argument("--filename", default=DEFAULT_FILENAME, help="Output filename when using a dataset path")
    parser.add_argument("--min-lon", type=float, default=151.0)
    parser.add_argument("--max-lon", type=float, default=151.003)
    parser.add_argument("--min-lat", type=float, default=-33.703)
    parser.add_argument("--max-lat", type=float, default=-33.700)
    parser.add_argument("--width", type=int, default=512)
    parser.add_argument("--height", type=int, default=512)
    return parser.parse_args()


def resolve_output_path(args: argparse.Namespace) -> Path:
    if args.output_path:
        return Path(args.output_path).expanduser().resolve()
    dataset_paths = get_dataset_paths(args.dataset)
    return (dataset_paths.work / args.filename).resolve()


def build_synthetic_raster(width: int, height: int) -> np.ndarray:
    raster = np.zeros((height, width), dtype=np.float32)

    # Synthetic structures used for quick smoke tests of height-above-ground rendering.
    raster[220:300, 225:310] = 8.0
    raster[110:180, 330:390] = 14.0
    raster[320:390, 120:180] = 10.0
    raster[390:405, 180:380] = 2.0
    return raster


def main() -> int:
    args = parse_args()
    output_path = resolve_output_path(args)
    raster = build_synthetic_raster(args.width, args.height)

    driver = gdal.GetDriverByName("GTiff")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ds = driver.Create(
        str(output_path),
        args.width,
        args.height,
        1,
        gdal.GDT_Float32,
        options=[
            "TILED=YES",
            "COMPRESS=DEFLATE",
            "BIGTIFF=IF_SAFER",
        ],
    )

    pixel_width = (args.max_lon - args.min_lon) / args.width
    pixel_height = (args.max_lat - args.min_lat) / args.height

    ds.SetGeoTransform((args.min_lon, pixel_width, 0, args.max_lat, 0, -pixel_height))

    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    ds.SetProjection(srs.ExportToWkt())

    band = ds.GetRasterBand(1)
    band.WriteArray(raster)
    band.SetNoDataValue(0)
    band.FlushCache()

    ds.FlushCache()
    ds = None

    print(f"Wrote {output_path}")
    print("bbox:")
    print("min_lon", args.min_lon)
    print("max_lon", args.max_lon)
    print("min_lat", args.min_lat)
    print("max_lat", args.max_lat)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
