// event settings
window.CONVOCATION_CONFIG = {
  demo: true,

  university: "Amity University Punjab",
  logo: "assets/logo.svg",

  eventTitle: "Convocation 2026",
  batchLine: "Celebrating the Graduating Class",
  date: "Date to be announced",
  reportingTime: "Reporting time: to be announced",
  venue: "Amity University Punjab, Mohali",

  welcomeHeading: "Welcome, Graduates",
  welcomeMessage:
    "Today we celebrate every late night, every exam and every dream that brought you here. " +
    "Enter your enrollment number to find your seat for the ceremony.",

  exampleEnrollment: "A25305224077",

  helpDesk: "If your details look wrong, please visit the Help Desk near Gate 1.",

  instructions: [
    "Please report at least 60 minutes before the ceremony begins.",
    "Collect your convocation robe and stole from the robe counter before entering.",
    "Carry your university ID card. You may be asked to show it at the gate.",
    "Sit only in your allotted seat. Seats are arranged in the order names will be called.",
    "Please keep your phone on silent during the ceremony."
  ],

  // blocks left to right facing the stage, row 1 = front row, seat 1 = leftmost
  hall: {
    blocks: [
      { id: "A", rows: 16, seats: 14, gate: "Gate 1" },
      { id: "B", rows: 16, seats: 14, gate: "Gate 1" },
      { id: "C", rows: 16, seats: 14, gate: "Gate 2" },
      { id: "D", rows: 16, seats: 14, gate: "Gate 2" }
    ],
    gates: [
      { name: "Gate 1", position: "left" }, // left / center / right
      { name: "Gate 2", position: "right" }
    ]
  }
};
