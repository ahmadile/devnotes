import React from 'react';
import { Search, Plus, FileText, Hash, Clock, Settings as SettingsIcon } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { Note } from '../types';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  notes, 
  activeNoteId, 
  onSelectNote, 
  onNewNote,
  onOpenSettings
}) => {
  const [search, setSearch] = React.useState('');

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <aside className="w-72 border-r border-zinc-800/60 bg-[#09090b] flex flex-col shrink-0 overflow-hidden">
      {/* App Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white">
            <Hash className="w-3.5 h-3.5" stroke-width="2" />
          </div>
          <span className="text-base font-medium text-zinc-100 tracking-tight">DevNotes</span>
        </div>
        <div className="flex items-center gap-2">
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-6 h-6 rounded outline-none ring-0",
                userButtonTrigger: "hover:bg-zinc-800/50 p-1 rounded transition-colors outline-none ring-0",
                userButtonPopoverCard: "bg-[#121214] border border-zinc-800 shadow-2xl",
              }
            }}
          />
          <button 
            onClick={onOpenSettings}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <SettingsIcon className="w-4 h-4" stroke-width="1.5" />
          </button>
        </div>
      </div>

      {/* Action & Search */}
      <div className="p-4 flex flex-col gap-4">
        <button 
          onClick={onNewNote}
          className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 py-2 rounded-md text-sm transition-colors group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" stroke-width="2" />
          New Note
        </button>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" stroke-width="2" />
          <input 
            type="text" 
            placeholder="Search notes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#121214] border border-zinc-800/80 rounded-md pl-9 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all font-sans"
          />
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        <div>
          <h2 className="text-[10px] font-bold text-zinc-500 mb-3 px-2 tracking-[0.2em] uppercase">Recent Notes</h2>
          
          <div className="flex flex-col gap-1">
            {filteredNotes.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-xs text-zinc-600 italic">No notes found</p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all group relative",
                    activeNoteId === note.id 
                      ? "bg-zinc-800/40 border-zinc-700/50 shadow-sm" 
                      : "hover:bg-zinc-800/20 border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={cn(
                      "text-sm pr-4 truncate",
                      activeNoteId === note.id ? "font-medium text-zinc-100" : "font-normal text-zinc-300 group-hover:text-zinc-100"
                    )}>
                      {note.title || 'Untitled Note'}
                    </h3>
                    <FileText className={cn(
                      "w-4 h-4 shrink-0 transition-opacity",
                      activeNoteId === note.id ? "text-indigo-400 opacity-100" : "text-zinc-600 opacity-0 group-hover:opacity-100"
                    )} stroke-width="1.5" />
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-2">
                    <Clock className="w-3 h-3" stroke-width="1.5" />
                    <span>{formatDistanceToNow(note.updatedAt)} ago</span>
                  </div>

                  {note.tags.length > 0 && (
                    <div className="flex gap-1.5">
                      {note.tags.slice(0, 2).map(tag => (
                        <span 
                          key={tag} 
                          className={cn(
                            "px-1.5 py-0.5 rounded-sm text-[10px]",
                            activeNoteId === note.id ? "bg-zinc-800/80 text-zinc-400" : "bg-zinc-800/50 text-zinc-500"
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="text-[10px] text-zinc-600">+{note.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
