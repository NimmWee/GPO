import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="w-full bg-white shadow p-4 flex gap-6">
      <Link to="/" className="font-semibold">Dashboard</Link>
      <Link to="/planner" className="font-semibold">Маршруты</Link>
      <Link to="/path" className="font-semibold">Траектория</Link>
      <Link to="/tasks" className="font-semibold">Задачи</Link>
    </nav>
  );
}