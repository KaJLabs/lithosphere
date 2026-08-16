import "./App.scss";
import { Routes } from "react-router-dom";
import { DashBoardRoutes } from "./routes/routeConfig";

function App() {
  return (
    <Routes>{DashBoardRoutes()}</Routes>
  );
}

export default App;
