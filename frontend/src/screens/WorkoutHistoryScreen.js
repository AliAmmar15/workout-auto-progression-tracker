import React from "react";

function WorkoutHistoryScreen() {

  const workouts = [
    { exercise: "Bench Press", weight: 185, reps: 8 },
    { exercise: "Squat", weight: 225, reps: 5 },
    { exercise: "Deadlift", weight: 275, reps: 5 }
  ];

  return (
    <div style={{ padding: "20px" }}>
      <h2>Workout History</h2>

      <ul>
        {workouts.map((workout, index) => (
          <li key={index}>
            {workout.exercise} — {workout.weight} lbs x {workout.reps} reps
          </li>
        ))}
      </ul>

    </div>
  );
}

export default WorkoutHistoryScreen;
