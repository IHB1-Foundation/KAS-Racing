import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home, FreeRun, DuelLobby, Proof } from './pages';
import { WalletProvider } from './wallet';
import { EvmWalletProvider } from './evm';

export function App() {
  return (
    <EvmWalletProvider>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/free-run" element={<FreeRun />} />
            <Route path="/duel" element={<DuelLobby />} />
            <Route path="/proof" element={<Proof />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </EvmWalletProvider>
  );
}
