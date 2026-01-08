'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, Paperclip, FileText } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, envie apenas arquivos PDF.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Falha no upload');

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `📚 **Novo documento aprendido!**\nLi o arquivo "${data.filename}" e processei ${data.count} trechos de informação. Pode me perguntar sobre ele!`,
        },
      ]);
    } catch (error) {
      console.error(error);
      alert('Erro ao processar o arquivo. Veja o console.');
    } finally {
      setIsUploading(false);
      // Limpa o input para permitir enviar o mesmo arquivo novamente se quiser
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isUploading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let assistantMessage = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        assistantMessage += text;

        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content = assistantMessage;
          } else {
            updated.push({
              id: Date.now().toString(),
              role: 'assistant',
              content: assistantMessage,
            });
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="p-4 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2">
        <Bot className="text-blue-500" />
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
          DocMind AI
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col h-full items-center justify-center text-zinc-400 space-y-4">
            <FileText size={48} className="opacity-20" />
            <p className="text-center">
              Envie um PDF para começar ou faça uma pergunta.<br />
              <span className="text-sm opacity-70">Eu aprendo com seus documentos!</span>
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
          >
            {m.role !== 'user' && (
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <Bot size={20} />
              </div>
            )}

            <div
              className={`px-4 py-2.5 rounded-lg max-w-[80%] whitespace-pre-wrap leading-relaxed shadow-sm ${m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
                }`}
            >
              {m.content.split('**').map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </div>

            {m.role === 'user' && (
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-600 text-white">
                <User size={20} />
              </div>
            )}
          </div>
        ))}

        {(isLoading || isUploading) && (
          <div className="flex items-center justify-start gap-4">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Bot size={20} />
            </div>
            <div className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center gap-2">
              <Loader2 className="animate-spin text-zinc-400" size={18} />
              <span className="text-sm text-zinc-500">
                {isUploading ? 'Lendo documento...' : 'Pensando...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto flex gap-3 items-end">

          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={isLoading || isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading}
            className="p-3 text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="Anexar PDF"
          >
            <Paperclip size={20} />
          </button>

          <input
            className="flex-1 p-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre o PDF..."
            disabled={isLoading || isUploading}
          />

          <button
            type="submit"
            disabled={isLoading || isUploading || !input.trim()}
            className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            <Send size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
}