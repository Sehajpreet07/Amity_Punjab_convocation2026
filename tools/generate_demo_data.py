# makes fake seating data for testing -> data/students.js
import json
import random
from pathlib import Path

random.seed(2026)

FIRST = """Aarav Aditi Akash Amanpreet Ananya Anmol Arjun Arshdeep Avneet Bhavya Daksh Diya Gagandeep
Gurleen Gurpreet Harleen Harman Harsh Ishaan Ishita Jasleen Jaspreet Karan Kavya Khushi Kunal Lakshya
Manpreet Mehak Mohit Muskan Navjot Neha Nikhil Palak Parth Prabhjot Pranav Priya Rahul Riya Rohan
Sahil Sanya Simran Sukhman Tanvi Tanya Taranjeet Ujjwal Vansh Varun Vikram Yashika Zoya Rajveer Ekam
Japneet Noor Sehaj Arpit Devansh Sneha Ritika Aryan Kritika""".split()

LAST = """Singh Kaur Sharma Gill Sandhu Dhillon Grewal Bajwa Sidhu Brar Mann Arora Kapoor Malhotra Verma
Gupta Mehta Chopra Bansal Garg Joshi Rana Thakur Saini Bedi Ahuja Khanna Sethi Bhatia Ghotra Walia
Randhawa Chahal Aggarwal Jindal Mittal""".split()

# name, code, count
PROGRAMS = [
    ("B.Tech – Computer Science & Engineering", "5224", 150),
    ("B.Tech – Electronics & Communication", "5124", 90),
    ("Bachelor of Business Administration (BBA)", "5324", 120),
    ("Master of Business Administration (MBA)", "5424", 110),
    ("Bachelor of Computer Applications (BCA)", "5524", 100),
    ("B.Com (Hons)", "5624", 100),
    ("B.A. LL.B (Hons)", "5724", 90),
    ("B.Sc – Biotechnology", "5824", 100),
]

BLOCKS = [("A", 16, 14), ("B", 16, 14), ("C", 16, 14), ("D", 16, 14)]
GATE = {"A": "Gate 1", "B": "Gate 1", "C": "Gate 2", "D": "Gate 2"}


def seats():
    for block, rows, per_row in BLOCKS:
        for row in range(1, rows + 1):
            for seat in range(1, per_row + 1):
                yield block, row, seat


def main():
    seat_iter = seats()
    students = []
    for program, code, count in PROGRAMS:
        for serial in range(1, count + 1):
            block, row, seat = next(seat_iter)
            students.append({
                "enrollment": f"A2530{code}{serial:03d}",
                "name": f"{random.choice(FIRST)} {random.choice(LAST)}",
                "program": program,
                "block": block,
                "row": row,
                "seat": seat,
                "gate": GATE[block],
            })

    out = Path(__file__).resolve().parent.parent / "data" / "students.js"
    out.write_text(
        "// demo data\n"
        "window.CONVOCATION_STUDENTS = "
        + json.dumps(students, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(students)} demo students to {out}")


if __name__ == "__main__":
    main()
