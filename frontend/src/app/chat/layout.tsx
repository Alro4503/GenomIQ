'use client';

import React from 'react';
import ChatProvider from '@/context/ChatContext';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      {children}
    </ChatProvider>
  );
}