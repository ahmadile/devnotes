# Configuration du Serveur MCP DevNotes 🤖

Ce projet inclut un serveur **Model Context Protocol (MCP)** local (`mcp-server.js`) qui permet à des outils et agents d'Intelligence Artificielle (comme **Claude Desktop**, **Cursor** ou **VS Code**) d'interagir directement avec vos notes stockées dans DevNotes.

## Prérequis
1. Le serveur d'API backend de DevNotes doit être lancé en local (`npm run dev:api` ou `npm run dev`) pour que l'agent puisse y envoyer des requêtes.
2. Vos clés d'agent doivent être configurées dans le fichier `.env.local` du projet :
   ```env
   AGENT_API_KEY="devnotes_secret_agent_key"
   AGENT_USER_ID="user_3Bn0Y0P2ClK5pGeXZjDRBQTDSAw"
   ```

---

## 1. Configurer Claude Desktop (Recommandé)
Pour que l'application de bureau **Claude** (par Anthropic) puisse utiliser vos notes :

1. Ouvrez (ou créez) le fichier de configuration de Claude Desktop à cet emplacement :
   - **Windows** : `%APPDATA%\Claude\claude_desktop_config.json` (Copiez-collez ce chemin dans l'Explorateur de fichiers Windows)
   - **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Modifiez le fichier pour ajouter la configuration suivante (remplacez le chemin absolu vers `mcp-server.js` par le vôtre si nécessaire) :

```json
{
  "mcpServers": {
    "devnotes": {
      "command": "node",
      "args": ["c:/Users/ali/Downloads/devnotes/mcp-server.js"]
    }
  }
}
```

3. Redémarrez complètement **Claude Desktop**.
4. Vous devriez maintenant voir une icône en forme de prise/outil en bas à droite de la zone d'écriture. Vous pouvez demander à Claude :
   - *"Affiche la liste de mes notes dans DevNotes"*
   - *"Crée une note nommée 'Tâches du jour' avec une liste de choses à faire"*
   - *"Ajoute les détails sur le projet IA à ma note existante"*

---

## 2. Configurer Cursor
Pour utiliser le serveur MCP dans l'éditeur de code **Cursor** :

1. Allez dans les **Settings** (Paramètres) de Cursor en haut à droite.
2. Allez dans la section **Features** (Fonctionnalités) > **MCP**.
3. Cliquez sur **"+ Add New MCP Server"**.
4. Remplissez les champs :
   - **Name** : `devnotes`
   - **Type** : `command`
   - **Command** : `node c:/Users/ali/Downloads/devnotes/mcp-server.js`
5. Cliquez sur **Save**. Cursor va se connecter au serveur et lister les 4 outils disponibles : `list_notes`, `get_note`, `create_note`, `update_note`.

---

## Outils Exposés

Le serveur MCP expose les outils suivants :
- `list_notes` : Récupère la liste de toutes vos notes (titres, identifiants et tags).
- `get_note` : Obtient le contenu complet d'une note en lui fournissant son `id`.
- `create_note` : Crée une nouvelle note à partir d'un titre, d'un texte Markdown et de tags optionnels.
- `update_note` : Modifie le titre, remplace le contenu, ajoute/modifie des tags, ou ajoute du texte à la fin d'une note existante (via `appendContent`).
