import React, { useEffect } from 'react';
import { useChatStore } from './store/useChatStore';
import { AuthScreen } from './components/AuthScreen';
import { LeftSidebar } from './components/LeftSidebar';
import { ChatWindow } from './components/ChatWindow';
import { RightDrawer } from './components/RightDrawer';
import { NewChatModal } from './components/NewChatModal';
import { NewGroupModal } from './components/NewGroupModal';

export default function App() {
  const { user, token, initSocket, fetchChats } = useChatStore();

  useEffect(() => {
    if (token && user) {
      initSocket(token);
      fetchChats();
    }
  }, [token]);

  if (!token || !user) {
    return <AuthScreen />;
  }

  return (
    <div className="w-screen h-screen flex bg-slate-950 font-sans overflow-hidden antialiased text-slate-100 select-none">
      <LeftSidebar />
      <ChatWindow />
      <RightDrawer />

      {/* Modals */}
      <NewChatModal />
      <NewGroupModal />
    </div>
  );
}
