"""
Excel seating sheet -> data/students.js

python3 tools/excel_to_students.py "Seating Plan.xlsx" [sheet]

Needs columns for enrollment, name, block, row, seat (program and gate optional).
"""
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

ALIASES = {
    "enrollment": ["enrollment", "enrolment", "enrollmentno", "enrolmentno", "enrollmentnumber",
                   "enrolmentnumber", "rollno", "rollnumber", "roll", "enrno", "enrollno"],
    "name": ["name", "studentname", "nameofstudent", "fullname", "candidatename"],
    "program": ["program", "programme", "course", "branch", "programname", "programmename", "degree"],
    "block": ["block", "section", "enclosure", "blockno", "area", "zone"],
    "row": ["row", "rowno", "rownumber"],
    "seat": ["seat", "seatno", "seatnumber"],
    "gate": ["gate", "entry", "entrygate", "gateno"],
}
REQUIRED = ["enrollment", "name", "block", "row", "seat"]


def key(text):
    return re.sub(r"[^a-z]", "", str(text or "").lower())


def to_int(value, field, line):
    try:
        return int(float(str(value).strip()))
    except ValueError:
        sys.exit(f"Row {line}: '{field}' must be a number, got {value!r}")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    wb = load_workbook(sys.argv[1], data_only=True, read_only=True)
    ws = wb[sys.argv[2]] if len(sys.argv) > 2 else wb.active
    rows = list(ws.iter_rows(values_only=True))

    # header row = first row with an enrollment column
    header_idx, cols = None, {}
    for i, row in enumerate(rows[:15]):
        found = {}
        for j, cell in enumerate(row):
            k = key(cell)
            for field, names in ALIASES.items():
                if k in names and field not in found:
                    found[field] = j
        if "enrollment" in found:
            header_idx, cols = i, found
            break
    if header_idx is None:
        sys.exit("Could not find a header row with an enrollment number column.")
    missing = [f for f in REQUIRED if f not in cols]
    if missing:
        sys.exit(f"Missing columns: {', '.join(missing)}. Found: {', '.join(cols)}")

    students, seen = [], {}
    for line, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
        get = lambda f: row[cols[f]] if f in cols and cols[f] < len(row) else None
        enr = re.sub(r"\s+", "", str(get("enrollment") or "")).upper()
        if not enr:
            continue
        if enr in seen:
            print(f"WARNING: duplicate enrollment {enr} on rows {seen[enr]} and {line}")
        seen[enr] = line
        students.append({
            "enrollment": enr,
            "name": " ".join(str(get("name") or "").split()).title(),
            "program": " ".join(str(get("program") or "").split()),
            "block": str(get("block") or "").strip().upper(),
            "row": to_int(get("row"), "row", line),
            "seat": to_int(get("seat"), "seat", line),
            **({"gate": str(get("gate")).strip()} if get("gate") else {}),
        })

    out = Path(__file__).resolve().parent.parent / "data" / "students.js"
    out.write_text("window.CONVOCATION_STUDENTS = "
                   + json.dumps(students, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")

    blocks = {}
    for s in students:
        b = blocks.setdefault(s["block"], [0, 0])
        b[0], b[1] = max(b[0], s["row"]), max(b[1], s["seat"])
    print(f"Wrote {len(students)} students to {out}")
    print("Blocks found (update js/config.js hall.blocks to match):")
    for b, (r, s) in sorted(blocks.items()):
        print(f"  Block {b}: {r} rows, up to {s} seats per row")


if __name__ == "__main__":
    main()
