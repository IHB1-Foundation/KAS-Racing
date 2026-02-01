import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home, FreeRun, DuelLobby, Proof } from './pages';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/free-run" element={<FreeRun />} />
        <Route path="/duel" element={<DuelLobby />} />
        <Route path="/proof" element={<Proof />} />
      </Routes>
    </BrowserRouter>
  );
}
