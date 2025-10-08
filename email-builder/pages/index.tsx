import { useState, useEffect } from 'react';
import Header from '../components/Header';
import EmailBuilder from '../components/EmailBuilder';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-5xl mx-auto p-4">
        <EmailBuilder />
      </main>
    </div>
  );
} 