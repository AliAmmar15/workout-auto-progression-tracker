import React from "react";

function ProgressionDashboard() {

  const suggestions = [
    "Increase Bench Press by 5 lbs next workout",
    "Maintain Squat weight and focus on form",
    "Add 1 extra rep to Deadlift set"
  ];

  return (
    <div style={{ padding: "20px" }}>
      <h2>Progression Dashboard</h2>

      <h3>Training Suggestions</h3>

      <ul>
        {suggestions.map((tip, index) => (
          <li key={index}>{tip}</li>
        ))}
      </ul>

    </div>
  );
}

export default ProgressionDashboard;
