import React from 'react';
import { Search, Plus, FileText, Clock, Settings as SettingsIcon } from 'lucide-react';
import { Logo } from './Logo';
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

  const filteredNotes = notes.filter(n => {
    const query = search.toLowerCase();
    if (query.startsWith('#')) {
      const tagQuery = query.slice(1);
      return n.tags.some(t => t.toLowerCase().includes(tagQuery));
    }
    return (
      n.title.toLowerCase().includes(query) ||
      n.tags.some(t => t.toLowerCase().includes(query)) ||
      n.content.toLowerCase().includes(query)
    );
  });

  return (
    <aside className="w-72 border-r border-border bg-background flex flex-col shrink-0 overflow-hidden transition-colors duration-300">
      {/* App Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Logo size={24} className="w-6 h-6 rounded" />
          <span className="text-base font-semibold text-foreground tracking-tight">DevNotes</span>
        </div>
        <div className="flex items-center gap-2">
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-6 h-6 rounded outline-none ring-0",
                userButtonTrigger: "hover:bg-secondary p-1 rounded transition-colors outline-none ring-0",
                userButtonPopoverCard: "bg-popover border border-border shadow-2xl text-foreground",
              }
            }}
          />
          <button 
            onClick={onOpenSettings}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <SettingsIcon className="w-4 h-4" strokeWidth="1.5" />
          </button>
        </div>
      </div>

      {/* Action & Search */}
      <div className="p-4 flex flex-col gap-4">
        <button 
          onClick={onNewNote}
          className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary py-2 rounded-md text-sm font-medium transition-colors group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" strokeWidth="2" />
          New Note
        </button>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth="2" />
          <input 
            type="text" 
            placeholder="Search notes (use # for tags)..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-sans"
          />
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        <div>
          <h2 className="text-[10px] font-bold text-muted-foreground/60 mb-3 px-2 tracking-[0.2em] uppercase">Recent Notes</h2>
          
          <div className="flex flex-col gap-1">
            {filteredNotes.length === 0 ? (
              <div className="px-2 py-8 text-center bg-secondary/20 rounded-xl border border-dashed border-border/50">
                <p className="text-xs text-muted-foreground italic">No results found</p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all group relative mb-1",
                    activeNoteId === note.id 
                      ? "bg-secondary border-primary/20 shadow-sm" 
                      : "hover:bg-secondary/60 border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={cn(
                      "text-sm pr-4 truncate transition-colors",
                      activeNoteId === note.id ? "font-semibold text-foreground" : "font-medium text-foreground/70 group-hover:text-foreground"
                    )}>
                      {note.title || 'Untitled Note'}
                    </h3>
                    <FileText className={cn(
                      "w-4 h-4 shrink-0 transition-opacity",
                      activeNoteId === note.id ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                    )} strokeWidth="1.5" />
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                    <Clock className="w-3 h-3" strokeWidth="1.5" />
                    <span>{formatDistanceToNow(note.updatedAt)} ago</span>
                  </div>

                  {note.tags.length > 0 && (
                    <div className="flex gap-1.5">
                      {note.tags.slice(0, 2).map(tag => (
                        <span 
                          key={tag} 
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-medium border bg-background/50",
                            activeNoteId === note.id ? "border-primary/20 text-primary" : "border-border text-muted-foreground"
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="text-[9px] font-medium text-muted-foreground/60 transition-opacity flex items-center">+{note.tags.length - 2}</span>
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
