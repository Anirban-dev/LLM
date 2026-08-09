import React, { useEffect } from 'react';
import { useChatStore } from './store/useChatStore';
import { AuthScreen } from './components/AuthScreen';
import { LeftSidebar } from './components/LeftSidebar';
import { ChatWindow } from './components/ChatWindow';
import { RightDrawer } from './components/RightDrawer';
import { NewChatModal } from './components/NewChatModal';
import { NewGroupModal } from './components/NewGroupModal';
import { CallOverlay } from './components/CallOverlay';
import { PersonaModal } from './components/PersonaModal';

export default function App() {
  const {
    user,
    token,
    activeChatId,
    initSocket,
    fetchChats,
    isPersonaModalOpen,
    setPersonaModalOpen,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
  } = useChatStore();

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
    <div className="w-screen h-screen flex flex-col bg-[#d1d7db] font-sans overflow-hidden antialiased text-gray-900 select-none relative">
      {/* Top WhatsApp Web accent banner stripe (desktop) */}
      <div className="hidden md:block absolute top-0 inset-x-0 h-32 bg-[#00a884] z-0" />

      {/* Main Responsive App Container */}
      <div className="relative z-10 w-full h-full max-w-[1600px] mx-auto md:p-3 flex overflow-hidden">
        <div className="w-full h-full flex bg-white md:rounded-2xl md:shadow-2xl overflow-hidden border border-[#d1d7db] relative">
          {/* Mobile Drawer Backdrop */}
          {isMobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* LeftSidebar Container */}
          <div
            className={`
              ${
                activeChatId
                  ? isMobileSidebarOpen
                    ? 'fixed inset-y-0 left-0 z-40 w-full sm:w-80 flex shadow-2xl'
                    : 'hidden md:flex'
                  : 'flex w-full'
              }
              md:relative md:inset-auto md:z-0 md:w-80 lg:w-96 h-full shrink-0 transition-all
            `}
          >
            <LeftSidebar />
          </div>

          <div className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0`}>
            <ChatWindow />
          </div>

          <RightDrawer />
        </div>
      </div>

      {/* Global Call Overlay */}
      <CallOverlay />

      {/* Modals */}
      <NewChatModal />
      <NewGroupModal />
      <PersonaModal isOpen={isPersonaModalOpen} onClose={() => setPersonaModalOpen(false)} />
    </div>
  );
}
