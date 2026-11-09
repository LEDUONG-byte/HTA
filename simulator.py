"""CLI entry point và re-export cho bộ nạp dữ liệu ảo SPC."""

import sys
from pathlib import Path

# Đảm bảo import core dù chạy trực tiếp qua python simulator.py
sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.simulator import (
    DATABASE_PATH,
    DATA_PATH,
    INTERVAL_SECONDS,
    ROOT_PATH,
    SAMPLE_COLUMNS,
    WORKBOOK_PATH,
    VirtualDataSimulator,
    clear_virtual_batches,
    delete_run_data,
    initialize_database,
    insert_virtual_cycle,
    load_defect_profiles,
    main,
)

__all__ = [
    "VirtualDataSimulator",
    "clear_virtual_batches",
    "delete_run_data",
    "initialize_database",
    "insert_virtual_cycle",
    "load_defect_profiles",
    "DATABASE_PATH",
    "DATA_PATH",
    "INTERVAL_SECONDS",
    "ROOT_PATH",
    "SAMPLE_COLUMNS",
    "WORKBOOK_PATH",
    "main",
]

if __name__ == "__main__":
    main()
