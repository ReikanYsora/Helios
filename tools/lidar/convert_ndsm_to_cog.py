from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from tool_paths import get_dataset_paths

DEFAULT_DATASET = "test"
DEFAULT_INPUT_FILENAME = "helios-test-ndsm.tif"
DEFAULT_OUTPUT_FILENAME = "helios-test-ndsm-cog.tif"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert an nDSM GeoTIFF into a COG")
    parser.add_argument("input_path", nargs="?", help="Optional explicit input file path")
    parser.add_argument("output_path", nargs="?", help="Optional explicit output file path")
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help="Dataset folder under data/")
    parser.add_argument("--input-filename", default=DEFAULT_INPUT_FILENAME)
    parser.add_argument("--output-filename", default=DEFAULT_OUTPUT_FILENAME)
    return parser.parse_args()


def resolve_input_path(args: argparse.Namespace) -> Path:
    if args.input_path:
        return Path(args.input_path).expanduser().resolve()
    dataset_paths = get_dataset_paths(args.dataset)
    return (dataset_paths.work / args.input_filename).resolve()


def resolve_output_path(args: argparse.Namespace) -> Path:
    if args.output_path:
        return Path(args.output_path).expanduser().resolve()
    dataset_paths = get_dataset_paths(args.dataset)
    return (dataset_paths.out / args.output_filename).resolve()


def main() -> int:
    args = parse_args()
    input_path = resolve_input_path(args)
    output_path = resolve_output_path(args)

    if not input_path.exists():
        print(f"File not found: {input_path}", file=sys.stderr)
        return 1

    gdal_translate = shutil.which("gdal_translate")
    if gdal_translate is None:
        print("gdal_translate is not available on PATH", file=sys.stderr)
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            gdal_translate,
            str(input_path),
            str(output_path),
            "-of",
            "COG",
            "-co",
            "COMPRESS=DEFLATE",
            "-co",
            "BLOCKSIZE=256",
        ],
        check=True,
    )

    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
