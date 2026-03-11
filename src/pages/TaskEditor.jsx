import { useState } from "react";

export default function TaskEditor() {
  const [tasks, setTasks] = useState([]);
  const [point, setPoint] = useState("");
  const [action, setAction] = useState("");

  const addTask = () => {
    if (!point || !action) return;
    setTasks([...tasks, { point, action }]);
    setPoint("");
    setAction("");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Задачи в точках</h1>

      <div className="bg-white p-4 rounded shadow w-1/2">
        <h2 className="font-semibold mb-2">Добавить задачу</h2>

        <input
          className="border p-2 rounded w-full mb-2"
          placeholder="Точка (например A)"
          value={point}
          onChange={(e) => setPoint(e.target.value)}
        />

        <input
          className="border p-2 rounded w-full mb-2"
          placeholder="Действие (например 'Сделать фото')"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={addTask}
        >
          Добавить
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow mt-4 w-1/2">
        <h2 className="font-semibold mb-2">Список задач</h2>
        <ul className="list-disc pl-5">
          {tasks.map((t, i) => (
            <li key={i}>
              <b>{t.point}</b>: {t.action}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
