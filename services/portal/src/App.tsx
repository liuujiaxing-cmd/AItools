import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppShell from "@/components/AppShell";
import Home from "@/pages/Home";
import Links from "@/pages/Links";
import Playground from "@/pages/Playground";
import ToolDetail from "@/pages/ToolDetail";
import Tools from "@/pages/Tools";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/tools/:toolName" element={<ToolDetail />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/links" element={<Links />} />
        </Route>
      </Routes>
    </Router>
  );
}
