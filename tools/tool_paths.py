from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parent
DATA_DIR = REPO_ROOT / "data"


@dataclass(frozen=True)
class DatasetPaths:
    root: Path
    raw: Path
    work: Path
    out: Path


def get_dataset_paths(dataset_name: str) -> DatasetPaths:
    cleaned_name = dataset_name.strip()
    if not cleaned_name:
        raise ValueError("dataset name must not be empty")

    dataset_root = DATA_DIR / cleaned_name
    return DatasetPaths(
        root=dataset_root,
        raw=dataset_root / "raw",
        work=dataset_root / "work",
        out=dataset_root / "out",
    )
