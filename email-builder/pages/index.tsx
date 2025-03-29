import { useState, useEffect } from 'react';
import Header from '../components/Header';
import EmailTemplateSelector from '../components/EmailTemplateSelector';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-4xl mx-auto p-4">
        <EmailTemplateSelector />
      </main>
    </div>
  );
} 