import React, { useState } from "react";

function WorkoutLogScreen() {
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const workoutData = {
      exercise,
      weight,
      reps,
    };

    console.log("Workout Logged:", workoutData);

    setExercise("");
    setWeight("");
    setReps("");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Log Workout</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Exercise</label>
          <input
            type="text"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Weight</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Reps</label>
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            required
          />
        </div>

        <button type="submit">Log Workout</button>
      </form>
    </div>
  );
}

export default WorkoutLogScreen;
