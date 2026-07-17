import React from 'react';
import { Search, Plus, FileText, Clock, Settings as SettingsIcon, Folder, FolderOpen, FolderPlus, ChevronRight, ChevronDown, Trash2, Edit3 } from 'lucide-react';
import { Logo } from './Logo';
import { UserButton } from '@clerk/clerk-react';
import { Note, Module } from '../types';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  notes: Note[];
  modules: Module[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: (moduleId?: string | null) => void;
  onNewModule: (name: string, parentId?: string | null) => void;
  onRenameModule: (id: string, name: string) => void;
  onDeleteModule: (id: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  notes, 
  modules,
  activeNoteId, 
  onSelectNote, 
  onNewNote,
  onNewModule,
  onRenameModule,
  onDeleteModule,
  onOpenSettings
}) => {
  const [search, setSearch] = React.useState('');
  const [expandedModules, setExpandedModules] = React.useState<Record<string, boolean>>({});
  const [creatingModuleInId, setCreatingModuleInId] = React.useState<string | null>(null);
  const [renamingModuleId, setRenamingModuleId] = React.useState<string | null>(null);
  const [newModuleName, setNewModuleName] = React.useState('');
  const [renameModuleName, setRenameModuleName] = React.useState('');

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  const renderNoteRow = (note: Note, depth: number) => {
    return (
      <button
        key={note.id}
        onClick={() => onSelectNote(note.id)}
        className={cn(
          "w-full text-left py-1.5 pr-3 rounded-lg border transition-all group relative flex items-center justify-between",
          activeNoteId === note.id 
            ? "bg-secondary border-primary/10 shadow-sm" 
            : "hover:bg-secondary/40 border-transparent"
        )}
        style={{ paddingLeft: `${depth * 12 + 28}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className={cn(
            "w-3.5 h-3.5 shrink-0",
            activeNoteId === note.id ? "text-primary" : "text-muted-foreground/60"
          )} strokeWidth="1.5" />
          <span className={cn(
            "text-xs truncate transition-colors",
            activeNoteId === note.id ? "font-semibold text-foreground" : "font-medium text-foreground/70 group-hover:text-foreground"
          )}>
            {note.title || 'Untitled Note'}
          </span>
        </div>
      </button>
    );
  };

  const renderInlineCreateForm = (parentId: string | null, depth: number) => {
    return (
      <div 
        className="flex items-center gap-2 py-1.5 px-2"
        style={{ paddingLeft: `${depth * 12 + 28}px` }}
      >
        <Folder className="w-4 h-4 text-primary/40 shrink-0" />
        <input
          type="text"
          placeholder="Folder name..."
          value={newModuleName}
          autoFocus
          className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none w-full"
          onChange={(e) => setNewModuleName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (newModuleName.trim()) {
                onNewModule(newModuleName.trim(), parentId);
                setCreatingModuleInId(null);
              }
            } else if (e.key === 'Escape') {
              setCreatingModuleInId(null);
            }
          }}
          onBlur={() => {
            if (newModuleName.trim()) {
              onNewModule(newModuleName.trim(), parentId);
            }
            setCreatingModuleInId(null);
          }}
        />
      </div>
    );
  };

  const renderModule = (module: Module, depth: number) => {
    const isExpanded = !!expandedModules[module.id];
    const childModules = modules.filter(m => m.parentId === module.id);
    const childNotes = notes.filter(n => n.moduleId === module.id);
    const isRenaming = renamingModuleId === module.id;

    return (
      <div key={module.id} className="select-none">
        {/* Module Folder Row */}
        <div 
          className={cn(
            "flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/40 group/module cursor-pointer text-sm font-medium",
            "transition-all duration-200"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => toggleExpand(module.id)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button 
              className="p-0.5 hover:bg-secondary rounded text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(module.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-primary shrink-0" />
            )}
            
            {isRenaming ? (
              <input
                type="text"
                value={renameModuleName}
                autoFocus
                className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none w-full"
                onChange={(e) => setRenameModuleName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    if (renameModuleName.trim()) {
                      onRenameModule(module.id, renameModuleName.trim());
                      setRenamingModuleId(null);
                    }
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setRenamingModuleId(null);
                  }
                }}
                onBlur={() => {
                  if (renameModuleName.trim()) {
                    onRenameModule(module.id, renameModuleName.trim());
                  }
                  setRenamingModuleId(null);
                }}
              />
            ) : (
              <span className="truncate text-foreground/80 hover:text-foreground">{module.name}</span>
            )}
          </div>

          {/* Hover Actions */}
          {!isRenaming && (
            <div className="flex items-center gap-1 opacity-0 group-hover/module:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNewNote(module.id);
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                title="New Note here"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingModuleInId(module.id);
                  setNewModuleName('');
                  setExpandedModules(prev => ({ ...prev, [module.id]: true }));
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                title="New Subfolder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingModuleId(module.id);
                  setRenameModuleName(module.name);
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                title="Rename Folder"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete folder "${module.name}"? Notes inside will be moved to uncategorized.`)) {
                    onDeleteModule(module.id);
                  }
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive"
                title="Delete Folder"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Expanded Children */}
        {isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {/* Subfolders */}
            {childModules.map(child => renderModule(child, depth + 1))}

            {/* Inline creation field if active in this module */}
            {creatingModuleInId === module.id && renderInlineCreateForm(module.id, depth + 1)}

            {/* Notes inside this module */}
            {childNotes.map(note => renderNoteRow(note, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="h-full w-72 border-r border-border bg-background flex flex-col shrink-0 overflow-hidden transition-colors duration-300">
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
          onClick={() => onNewNote(null)}
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

      {/* Note List / Folder Tree */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {search !== '' ? (
          <div>
            <h2 className="text-[10px] font-bold text-muted-foreground/60 mb-3 px-2 tracking-[0.2em] uppercase">Search Results</h2>
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
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[10px] font-bold text-muted-foreground/60 tracking-[0.2em] uppercase">Folders</h2>
              <button 
                onClick={() => {
                  setCreatingModuleInId('root');
                  setNewModuleName('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 hover:bg-secondary rounded cursor-pointer"
                title="New Folder"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex flex-col gap-0.5">
              {/* Root folder inline create form */}
              {creatingModuleInId === 'root' && renderInlineCreateForm(null, 0)}
              
              {/* Render root modules */}
              {modules.filter(m => !m.parentId).map(module => renderModule(module, 0))}

              {/* Render root notes */}
              {notes.filter(n => !n.moduleId).map(note => renderNoteRow(note, 0))}

              {modules.length === 0 && notes.filter(n => !n.moduleId).length === 0 && creatingModuleInId !== 'root' && (
                <div className="px-2 py-8 text-center bg-secondary/15 rounded-xl border border-dashed border-border/40">
                  <p className="text-xs text-muted-foreground italic">No folders or notes. Create one to get started!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
