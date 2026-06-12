"""Ejecuta las celdas de codigo marcadas con '# [compute]' de un notebook.

Uso:
    python scripts/run_notebook_compute.py <notebook.ipynb>

Concatena el source de todas las celdas de codigo cuya primera linea es
'# [compute]', elimina lineas que empiecen por '%' (magics de Jupyter/Colab),
y ejecuta el resultado con exec() en un namespace comun.
"""
import json
import sys
from pathlib import Path


def main(nb_path: str) -> None:
    nb = json.loads(Path(nb_path).read_text(encoding="utf-8"))

    chunks = []
    for cell in nb["cells"]:
        if cell.get("cell_type") != "code":
            continue
        source = cell.get("source", [])
        if not source:
            continue
        first_line = source[0].strip()
        if first_line != "# [compute]":
            continue

        lines = []
        for line in source:
            if line.lstrip().startswith("%"):
                continue
            lines.append(line)
        chunks.append("".join(lines))

    code = "\n\n".join(chunks)
    namespace = {"__name__": "__main__"}
    exec(compile(code, nb_path, "exec"), namespace)


if __name__ == "__main__":
    main(sys.argv[1])
