from typing import Iterable


def build_csv_rows(results: Iterable[dict]) -> list[dict]:
    return [dict(row) for row in results]
