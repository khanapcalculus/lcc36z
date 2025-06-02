import React from 'react';
import './App.css';
import Canvas from './components/Canvas/Canvas.jsx';
import Logo from './components/Logo/Logo.jsx';
import PageNavigation from './components/PageNavigation/PageNavigation.jsx';
import Toolbar from './components/Toolbar/Toolbar.jsx';
import { WhiteboardProvider } from './context/WhiteboardContext';

function App() {
  return (
    <WhiteboardProvider>
      <div className="App">
        <Toolbar />
        <Canvas />
        <PageNavigation />
        <Logo />
      </div>
    </WhiteboardProvider>
  );
}

export default App;
