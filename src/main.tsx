
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MemoryRouter } from 'react-router-dom'

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <MemoryRouter>
      <App />
    </MemoryRouter>
  </ErrorBoundary>
);
