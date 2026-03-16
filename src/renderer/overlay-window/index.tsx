import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/overlay.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
