import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import VoiceChat from './pages/VoiceChat';
import BabyAGI from './pages/BabyAGI';
import MultiAgent from './pages/MultiAgent';
import PersonaAgent from './pages/PersonaAgent';
import ComplexAgent from './pages/ComplexAgent';
import CamelDialogue from './pages/CamelDialogue';

function Router() {
  const [hash, setHash] = useState(window.location.hash || '#/');

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  let page: React.ReactNode;
  switch (hash) {
    case '#/voice-chat': page = <VoiceChat />; break;
    case '#/babyagi': page = <BabyAGI />; break;
    case '#/multi-agent': page = <MultiAgent />; break;
    case '#/persona-agent': page = <PersonaAgent />; break;
    case '#/complex-agent': page = <ComplexAgent />; break;
    case '#/camel-dialogue': page = <CamelDialogue />; break;
    default: page = <Home />; break;
  }

  return <Layout>{page}</Layout>;
}

export default function App() {
  return <Router />;
}
