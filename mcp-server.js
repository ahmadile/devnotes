#!/usr/bin/env node

/**
 * DevNotes MCP Server
 * Zero-dependency implementation of the Model Context Protocol (MCP) over Stdio.
 * Exposes tools for AI agents to read, list, create, and update notes.
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env.local variables
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        // Remove quotes if present
        if (val.length > 0 && val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
          val = val.substring(1, val.length - 1);
        } else if (val.length > 0 && val.charAt(0) === "'" && val.charAt(val.length - 1) === "'") {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY;

if (!AGENT_API_KEY) {
  console.error('[DevNotes-MCP] ERROR: AGENT_API_KEY is not defined in .env.local.');
  process.exit(1);
}

// Low-level helper to communicate with the DevNotes API
async function apiCall(method, body = null) {
  const url = `${API_URL}/api/notes`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AGENT_API_KEY
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API call failed with status ${res.status}: ${text}`);
  }
  return await res.json();
}

// Tool Implementation Functions
async function listNotes() {
  const data = await apiCall('GET');
  const notes = data.notes || [];
  return notes.map(n => ({
    id: n.id,
    title: n.title || 'Untitled Note',
    tags: n.tags || [],
    updatedAt: new Date(n.updatedAt).toISOString()
  }));
}

async function getNote(id) {
  const data = await apiCall('GET');
  const notes = data.notes || [];
  const note = notes.find(n => n.id === id);
  if (!note) {
    throw new Error(`Note with ID "${id}" not found.`);
  }
  return note;
}

async function createNote(title, content, tags = []) {
  const data = await apiCall('GET');
  const notes = data.notes || [];
  
  const newNote = {
    id: Math.random().toString(36).substring(2, 11),
    title: title || '',
    content: content || '',
    snippets: [],
    tags: tags || [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const updatedNotes = [newNote, ...notes];
  await apiCall('PUT', { notes: updatedNotes });
  return newNote;
}

async function updateNote(id, { title, content, tags, appendContent }) {
  const data = await apiCall('GET');
  const notes = data.notes || [];
  
  const index = notes.findIndex(n => n.id === id);
  if (index === -1) {
    throw new Error(`Note with ID "${id}" not found.`);
  }

  const note = notes[index];
  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;
  if (appendContent !== undefined) note.content = (note.content || '') + '\n' + appendContent;
  if (tags !== undefined) note.tags = tags;
  note.updatedAt = Date.now();

  await apiCall('PUT', { notes });
  return note;
}

// JSON-RPC over Stdio Server Implementation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    sendError(null, -32700, 'Parse error');
    return;
  }

  const { jsonrpc, id, method, params } = request;

  if (jsonrpc !== '2.0') {
    sendError(id, -32600, 'Invalid Request');
    return;
  }

  // Handle Notifications (no ID)
  if (id === undefined || id === null) {
    // We ignore initialized notifications
    return;
  }

  try {
    switch (method) {
      case 'initialize':
        sendResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'devnotes-mcp-server',
            version: '1.0.0'
          }
        });
        break;

      case 'tools/list':
        sendResult(id, {
          tools: [
            {
              name: 'list_notes',
              description: 'Retrieve a list of all notes with their IDs, titles, and tags.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'get_note',
              description: 'Retrieve the detailed content of a specific note by its ID.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'The unique ID of the note.' }
                },
                required: ['id']
              }
            },
            {
              name: 'create_note',
              description: 'Create a new developer note with a title, markdown content, and optional tags.',
              inputSchema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'The title of the note.' },
                  content: { type: 'string', description: 'The markdown text/thoughts content of the note.' },
                  tags: { 
                    type: 'array', 
                    items: { type: 'string' }, 
                    description: 'Optional tags to categorize the note.' 
                  }
                },
                required: ['title', 'content']
              }
            },
            {
              name: 'update_note',
              description: 'Update or append text/tags to an existing note.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'The unique ID of the note to update.' },
                  title: { type: 'string', description: 'New title for the note.' },
                  content: { type: 'string', description: 'Replace the entire text content of the note.' },
                  appendContent: { type: 'string', description: 'Append text to the end of the existing content.' },
                  tags: { 
                    type: 'array', 
                    items: { type: 'string' }, 
                    description: 'New list of tags for the note.' 
                  }
                },
                required: ['id']
              }
            }
          ]
        });
        break;

      case 'tools/call':
        if (!params || !params.name) {
          sendError(id, -32602, 'Invalid params: name is required');
          break;
        }

        const toolResult = await executeTool(params.name, params.arguments || {});
        sendResult(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolResult, null, 2)
            }
          ]
        });
        break;

      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    sendError(id, -32603, err.message || 'Internal error');
  }
});

async function executeTool(name, args) {
  switch (name) {
    case 'list_notes':
      return await listNotes();
    case 'get_note':
      return await getNote(args.id);
    case 'create_note':
      return await createNote(args.title, args.content, args.tags);
    case 'update_note':
      const { id, ...updates } = args;
      return await updateNote(id, updates);
    default:
      throw new Error(`Tool "${name}" is not implemented.`);
  }
}

function sendResult(id, result) {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result
  }));
}

function sendError(id, code, message) {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message }
  }));
}
